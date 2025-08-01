import {defineEndpoint} from '@directus/extensions-sdk';
import type {Request} from 'express';
import {RelationAnalyzer} from './services/RelationAnalyzer';
import {RelationAnalyzerConfig} from './types/RelationTypes';
import {ItemLoader} from './services/ItemLoader';
import {ItemLoaderConfig, ItemQuery} from './types/ItemLoaderTypes';
import {FieldAnalyzer} from './services/FieldAnalyzer';
import {FieldAnalyzerConfig} from './types/FieldAnalyzerTypes';
import {UsageFinderService} from './services/UsageFinderService';
import {PathBuilderService} from './services/PathBuilderService';
import {DirectusCacheWrapper} from './services/DirectusCacheWrapper';
import {CacheKeys, CacheTTL, CacheServiceConfig} from './types/CacheTypes';
import type { DirectusAccountability } from './types/directus-api';

// Extend Express Request type for Directus
interface DirectusRequest extends Request {
    accountability?: DirectusAccountability;
}

// Create a singleton cache instance that persists across requests
let cacheInstance: DirectusCacheWrapper | null = null;

/**
 * Get global cache configuration from environment variables or defaults
 */
function getGlobalCacheConfig(): Partial<CacheServiceConfig> {
    const envConfig = process.env.EXPANDABLE_BLOCKS_CACHE_TTL_METADATA ||
                     process.env.EXPANDABLE_BLOCKS_CACHE_TTL_SEARCH ||
                     process.env.EXPANDABLE_BLOCKS_CACHE_TTL_DETAIL ||
                     process.env.EXPANDABLE_BLOCKS_CACHE_TTL_PATHS;
    
    if (envConfig) {
        return {
            defaultTTL: parseInt(process.env.EXPANDABLE_BLOCKS_CACHE_DEFAULT_TTL || '600000'), // 10 min default
            ttlOverrides: {
                metadata: parseInt(process.env.EXPANDABLE_BLOCKS_CACHE_TTL_METADATA || '30') * 60 * 1000,
                search: parseInt(process.env.EXPANDABLE_BLOCKS_CACHE_TTL_SEARCH || '5') * 60 * 1000,
                detail: parseInt(process.env.EXPANDABLE_BLOCKS_CACHE_TTL_DETAIL || '10') * 60 * 1000,
                paths: parseInt(process.env.EXPANDABLE_BLOCKS_CACHE_TTL_PATHS || '10') * 60 * 1000
            },
            maxKeys: parseInt(process.env.EXPANDABLE_BLOCKS_CACHE_MAX_SIZE || '50000'),
            prefix: 'expandable_blocks'
        } as Partial<CacheServiceConfig>;
    }
    
    return {
        defaultTTL: CacheTTL.MEDIUM, // 10 minutes
        ttlOverrides: {
            metadata: 30 * 60 * 1000, // 30 minutes
            search: 5 * 60 * 1000,    // 5 minutes
            detail: 10 * 60 * 1000,   // 10 minutes
            paths: 10 * 60 * 1000     // 10 minutes
        },
        maxKeys: 50000,
        prefix: 'expandable_blocks'
    } as Partial<CacheServiceConfig>;
}

/**
 * Send standardized error response
 */
function sendErrorResponse(res: any, error: any, context: any, customMessage?: string) {
    context.logger.error(customMessage || 'API Error:', error);
    
    // Extract meaningful error message
    let errorMessage = 'Internal server error';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    
    if (error.response?.data?.errors?.[0]) {
        // Directus API error format
        errorMessage = error.response.data.errors[0].message;
        errorCode = error.response.data.errors[0].extensions?.code || errorCode;
    } else if (error.errors?.[0]?.message) {
        // Our custom error format
        errorMessage = error.errors[0].message;
        errorCode = error.errors[0].extensions?.code || errorCode;
    } else if (error.message) {
        // Standard error message
        errorMessage = error.message;
    }
    
    res.status(500).json({
        errors: [{
            message: errorMessage,
            extensions: {
                code: errorCode
            }
        }]
    });
}

export default defineEndpoint({
    id: 'expandable-blocks-api',
    handler: (router, context) => {
        const {getSchema} = context;

        // Initialize cache with global configuration on first use
        const initializeCache = () => {
            if (!cacheInstance) {
                const globalConfig = getGlobalCacheConfig();
                cacheInstance = new DirectusCacheWrapper({
                    ...globalConfig,
                    database: context.database,
                    services: context.services
                });
                context.logger.info('[API] Initialized cache with global config:', {
                    defaultTTL: globalConfig.defaultTTL,
                    maxKeys: globalConfig.maxKeys,
                    ttlOverrides: globalConfig.ttlOverrides
                });
            }
            return cacheInstance;
        };

        // Get cache instance based on request header
        const getCacheForRequest = (req: DirectusRequest): DirectusCacheWrapper | null => {
            const cacheEnabled = req.headers['x-cache-enabled'] !== 'false';
            return cacheEnabled ? initializeCache() : null;
        };

        /**
         * Route 1: Metadata Endpoint
         * Returns collection metadata for frontend initialization
         */
        router.get('/:collection/metadata', async (req: DirectusRequest, res) => {
            try {
                const {collection} = req.params;
                const schema = await getSchema();
                const accountability = req.accountability;

                // Create base configuration for all analyzers
                const baseAnalyzerConfig = {
                    database: context.database,
                    services: context.services,
                    schema,
                    accountability
                };

                // Initialize analyzers with base config
                const relationAnalyzer = new RelationAnalyzer(baseAnalyzerConfig);
                const fieldAnalyzer = new FieldAnalyzer(baseAnalyzerConfig);

                // Get cache instance based on request
                const cache = getCacheForRequest(req);
                
                // Get all metadata in one call
                const cacheKey = `metadata:complete:${collection}`;
                
                const metadata = cache
                    ? await cache.getOrSet(
                        cacheKey,
                        async () => {
                            // Try to get data, but handle permission errors gracefully
                            let possibleLocations: any[] = [];
                            let fieldAnalysis: any = {
                                searchableFields: [],
                                translationInfo: { hasTranslations: false },
                                collectionMetadata: { totalFields: 0, translatableCount: 0, systemFieldsCount: 0 }
                            };
                            
                            try {
                                possibleLocations = await relationAnalyzer.getPossibleUsageLocations(collection, {
                                    bypassPermissions: true,
                                    includeHidden: true
                                });
                            } catch (error) {
                                context.logger.warn(`Failed to get relations for ${collection}:`, error);
                            }
                            
                            try {
                                fieldAnalysis = await fieldAnalyzer.analyzeCollectionComplete(collection, {
                                    translationOptions: { includeLanguages: true }
                                });
                            } catch (error) {
                                context.logger.warn(`Failed to analyze fields for ${collection}:`, error);
                                // Return minimal data for collections without permissions
                            }
                            
                            return {
                                collection,
                                possibleLocations,
                                searchableFields: fieldAnalysis.searchableFields,
                                translationInfo: fieldAnalysis.translationInfo,
                                collectionMetadata: fieldAnalysis.collectionMetadata,
                                cached_at: new Date().toISOString()
                            };
                        },
                        {ttl: cache.getTTLForDataType('metadata') || CacheTTL.LONG}
                    )
                    : await (async () => {
                        // Try to get data, but handle permission errors gracefully
                        let possibleLocations: any[] = [];
                        let fieldAnalysis: any = {
                            searchableFields: [],
                            translationInfo: { hasTranslations: false },
                            collectionMetadata: { totalFields: 0, translatableCount: 0, systemFieldsCount: 0 }
                        };
                        
                        try {
                            possibleLocations = await relationAnalyzer.getPossibleUsageLocations(collection, {
                                bypassPermissions: true,
                                includeHidden: true
                            });
                        } catch (error) {
                            context.logger.warn(`Failed to get relations for ${collection}:`, error);
                        }
                        
                        try {
                            fieldAnalysis = await fieldAnalyzer.analyzeCollectionComplete(collection, {
                                translationOptions: { includeLanguages: true }
                            });
                        } catch (error) {
                            context.logger.warn(`Failed to analyze fields for ${collection}:`, error);
                            // Return minimal data for collections without permissions
                        }
                        
                        return {
                            collection,
                            possibleLocations,
                            searchableFields: fieldAnalysis.searchableFields,
                            translationInfo: fieldAnalysis.translationInfo,
                            collectionMetadata: fieldAnalysis.collectionMetadata,
                            cached_at: new Date().toISOString()
                        };
                    })();

                res.json(metadata);

            } catch (error) {
                sendErrorResponse(res, error, context, 'Error in metadata endpoint');
            }
        });

        /**
         * Route 2: Fast Search Endpoint
         * Returns items with translations but without usage information
         */
        router.get('/:collection/search', async (req: DirectusRequest, res) => {
            try {
                const {collection} = req.params;
                const {
                    limit = 10,
                    offset = 0,
                    search,
                    filter,
                    fields = '*',
                    sort
                } = req.query;

                const schema = await getSchema();
                const accountability = req.accountability;

                // Create base configuration for all analyzers
                const baseAnalyzerConfig = {
                    database: context.database,
                    services: context.services,
                    schema,
                    accountability
                };

                const itemLoader = new ItemLoader(baseAnalyzerConfig);


                // Parse fields - handle both array and string formats
                let parsedFields: string[];
                if (Array.isArray(fields)) {
                    // Handle fields[]=* & fields[]=translations.* format
                    parsedFields = fields as string[];
                } else if (fields === '*') {
                    parsedFields = ['*'];
                } else {
                    // Handle comma-separated string
                    parsedFields = String(fields).split(',');
                }

                // Build query
                const query: ItemQuery = {
                    limit: Number(limit),
                    offset: Number(offset),
                    fields: parsedFields,
                    search: search as string,
                    filter: filter ? (typeof filter === 'string' ? JSON.parse(filter) : filter) : undefined,
                    sort: sort ? String(sort).split(',') : undefined,
                    expandTranslations: true  // Always expand translations for search endpoint
                };

                // Get cache instance based on request
                const cache = getCacheForRequest(req);
                
                // Create cache key for search query
                const searchCacheKey = cache ? `search:${collection}:${JSON.stringify(query)}` : null;
                
                // Load items with translations
                const itemsResult = cache && searchCacheKey
                    ? await cache.getOrSet(
                        searchCacheKey,
                        async () => itemLoader.loadItems(collection, query),
                        { ttl: cache.getTTLForDataType('search') || CacheTTL.SHORT }
                    )
                    : await itemLoader.loadItems(collection, query);

                res.json({
                    data: itemsResult.data,
                    meta: itemsResult.meta
                });

            } catch (error: any) {
                sendErrorResponse(res, error, context, 'Error in search endpoint');
            }
        });

        /**
         * Route 3: Batch Usage Endpoint
         * Returns full items with usage information for specific IDs
         */
        router.post('/:collection/detail', async (req: DirectusRequest, res) => {
            try {
                const {collection} = req.params;
                const {ids, fields = '*'} = req.body;

                if (!ids || !Array.isArray(ids) || ids.length === 0) {
                    return res.status(400).json({
                        errors: [{
                            message: 'Missing or invalid ids array in request body',
                            extensions: {
                                code: 'INVALID_PAYLOAD'
                            }
                        }]
                    });
                }

                const schema = await getSchema();
                const accountability = req.accountability;

                // Create base configuration for all analyzers
                const baseAnalyzerConfig = {
                    database: context.database,
                    services: context.services,
                    schema,
                    accountability
                };

                // Get cache instance based on request
                const cache = getCacheForRequest(req);

                const itemLoader = new ItemLoader(baseAnalyzerConfig);

                // Load filtered relations once
                const filteredRelations = cache
                    ? await cache.getOrSet(
                        CacheKeys.collectionIncomingRelations(collection),
                        async () => {
                        const allRelations = await context.database
                            .select('*')
                            .from('directus_relations')
                            .where(function () {
                                this.where('one_collection', collection)
                                    .orWhere('one_allowed_collections', '=', collection)
                                    .orWhere('one_allowed_collections', 'like', `${collection},%`)
                                    .orWhere('one_allowed_collections', 'like', `%,${collection},%`)
                                    .orWhere('one_allowed_collections', 'like', `%,${collection}`);
                            })
                            .whereNot(function () {
                                this.where('many_collection', collection)
                                    .whereIn('many_field', ['user_created', 'user_updated']);
                            });
                        return allRelations;
                    },
                    {ttl: cache?.getTTLForDataType('metadata') || CacheTTL.LONG}
                )
                : await context.database
                    .select('*')
                    .from('directus_relations')
                    .where(function () {
                        this.where('one_collection', collection)
                            .orWhere('one_allowed_collections', '=', collection)
                            .orWhere('one_allowed_collections', 'like', `${collection},%`)
                            .orWhere('one_allowed_collections', 'like', `%,${collection},%`)
                            .orWhere('one_allowed_collections', 'like', `%,${collection}`);
                    })
                    .whereNot(function () {
                        this.where('many_collection', collection)
                            .whereIn('many_field', ['user_created', 'user_updated']);
                    });

                const usageFinder = new UsageFinderService({
                    ...baseAnalyzerConfig,
                    incomingRelations: filteredRelations
                });

                const pathBuilder = cache ? new PathBuilderService({
                    ...baseAnalyzerConfig,
                    defaultLocale: 'de-DE',
                    usageFinder: usageFinder,
                    cache: cache
                }) : null;

                // Load items by IDs using ItemLoader
                const itemsResult = await itemLoader.loadItems(collection, {
                    filter: {id: {_in: ids}},
                    fields: fields === '*' ? ['*'] : String(fields).split(','),
                    limit: -1,
                    returnMinimalOnPermissionError: true
                });

                // Add usage information to each item
                const itemsWithUsage = await Promise.all(
                    itemsResult.data.map(async (item) => {
                        // Skip usage calculation for items without permission
                        if (item._no_permission) {
                            return {
                                ...item,
                                usage_locations: [],
                                usage_summary: {
                                    total_count: 0,
                                    by_collection: {},
                                    by_status: {}
                                }
                            };
                        }

                        // Try to get complete cached result first
                        const itemCacheKey = CacheKeys.itemDetail(collection, item.id, fields);
                        
                        return cache
                            ? await cache.getOrSet(
                                itemCacheKey,
                                async () => {
                                try {
                                    // Find direct usages only, excluding translations
                                    const directUsages = await usageFinder.findDirectUsages(collection, item.id, {
                                        includeItemDetails: true,
                                        includeFieldMetadata: true,
                                        excludeTranslations: true,
                                        groupDuplicates: false
                                    });

                                    // Build usage locations with full path information
                                    const usageLocations = await buildUsageLocations(directUsages, pathBuilder);
                                    
                                    // Calculate simple summary
                                    const summary = calculateSimpleSummary(usageLocations);

                                    return {
                                        ...item,
                                        usage_locations: usageLocations,
                                        usage_summary: summary
                                    };
                                } catch (error) {
                                    context.logger.error(`[Usage] Error processing usage for item ${item.id}:`, error);
                                    return {
                                        ...item,
                                        usage_locations: [],
                                        usage_summary: {
                                            total_count: 0,
                                            by_collection: {},
                                            by_status: {}
                                        }
                                    };
                                }
                            },
                            { ttl: cache?.getTTLForDataType('detail') || CacheTTL.SHORT }
                        )
                        : {
                            ...item,
                            usage_locations: [],
                            usage_summary: {
                                total_count: 0,
                                by_collection: {},
                                by_status: {}
                            }
                        };
                    })
                );

                res.json({
                    data: itemsWithUsage
                });

            } catch (error) {
                sendErrorResponse(res, error, context, 'Error in batch usage endpoint');
            }
        });

        /**
         * Build usage locations with full path information
         * @param directUsages Array of direct usage locations
         * @param pathBuilder PathBuilderService instance
         * @returns Array of usage locations with path information
         */
        async function buildUsageLocations(directUsages: any[], pathBuilder: PathBuilderService | null): Promise<any[]> {
            const locations = [];
            
            for (const usage of directUsages) {
                // Build path with full relation information
                const path = pathBuilder 
                    ? await pathBuilder.buildSimplePathWithRelations(usage)
                    : null;
                
                locations.push({
                    id: usage.item_id,
                    collection: usage.collection,
                    collection_display: usage.collection_name,
                    title: usage.item_name,
                    status: usage.status,
                    field: usage.field,
                    field_display: usage.field_name,
                    sort: usage.sort,
                    path,
                    edit_url: `/admin/content/${usage.collection}/${usage.item_id}`
                });
            }
            
            return locations;
        }

        /**
         * Calculate simple summary statistics from usage locations
         * @param usageLocations Array of usage locations
         * @returns Summary object with counts by collection and status
         */
        function calculateSimpleSummary(usageLocations: any[]): any {
            const summary = {
                total_count: usageLocations.length,
                by_collection: {} as Record<string, number>,
                by_status: {} as Record<string, number>
            };
            
            for (const location of usageLocations) {
                // Count by collection
                if (!summary.by_collection[location.collection]) {
                    summary.by_collection[location.collection] = 0;
                }
                summary.by_collection[location.collection]++;
                
                // Count by status
                if (location.status) {
                    if (!summary.by_status[location.status]) {
                        summary.by_status[location.status] = 0;
                    }
                    summary.by_status[location.status]++;
                }
            }
            
            return summary;
        }

    }
});