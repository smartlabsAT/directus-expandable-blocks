import {defineEndpoint} from '@directus/extensions-sdk';
import {RelationAnalyzer} from './services/RelationAnalyzer';
import {RelationAnalyzerConfig} from './types/RelationTypes';
import {ItemLoader} from './services/ItemLoader';
import {ItemLoaderConfig, ItemQuery} from './types/ItemLoaderTypes';
import {FieldAnalyzer} from './services/FieldAnalyzer';
import {FieldAnalyzerConfig} from './types/FieldAnalyzerTypes';
import {TranslationFieldAnalyzer} from './services/TranslationFieldAnalyzer';
import {TranslationFieldAnalyzerConfig} from './types/TranslationFieldAnalyzerTypes';
import {UsageFinderService} from './services/UsageFinderService';
import {PathBuilderService} from './services/PathBuilderService';
import {DirectusCacheWrapper} from './services/DirectusCacheWrapper';
import {CacheKeys, CacheTTL} from './types/CacheTypes';
import {log} from "@directus/extensions-sdk/dist/cli/utils/logger";

// Create a singleton cache instance that persists across requests
let cacheInstance: DirectusCacheWrapper | null = null;

export default defineEndpoint({
    id: 'expandable-blocks-api',
    handler: (router, context) => {
        const {getSchema} = context;

        // Initialize singleton cache instance if not already created
        if (!cacheInstance) {
            cacheInstance = new DirectusCacheWrapper({
                database: context.database,
                services: context.services,
                defaultTTL: CacheTTL.LONG,
                prefix: 'expandable_blocks'
            });
            console.log('[API] Initialized singleton cache instance');
        }

        /**
         * Route 1: Metadata Endpoint
         * Returns collection metadata for frontend initialization
         */
        router.get('/:collection/metadata', async (req, res) => {
            try {
                const {collection} = req.params;
                const schema = await getSchema();
                const accountability = req.accountability;

                // Use singleton cache instance
                const cache = cacheInstance!;

                // Initialize analyzers
                const relationAnalyzerConfig: RelationAnalyzerConfig = {
                    database: context.database,
                    services: context.services,
                    schema,
                    accountability
                };

                const fieldAnalyzerConfig: FieldAnalyzerConfig = {
                    database: context.database,
                    services: context.services,
                    schema,
                    accountability
                };

                const translationAnalyzerConfig: TranslationFieldAnalyzerConfig = {
                    database: context.database,
                    services: context.services,
                    schema,
                    accountability
                };

                const relationAnalyzer = new RelationAnalyzer(relationAnalyzerConfig);
                const fieldAnalyzer = new FieldAnalyzer(fieldAnalyzerConfig);
                const translationAnalyzer = new TranslationFieldAnalyzer(translationAnalyzerConfig);

                // Get cached or fresh metadata
                const possibleLocations = await cache.getOrSet(
                    CacheKeys.collectionPossibleLocations(collection),
                    async () => relationAnalyzer.getPossibleUsageLocations(collection),
                    {ttl: CacheTTL.LONG}
                );

                const searchableFields = await cache.getOrSet(
                    CacheKeys.collectionSearchableFields(collection),
                    async () => fieldAnalyzer.getSearchableFields(collection),
                    {ttl: CacheTTL.LONG}
                );

                const translationInfo = await cache.getOrSet(
                    CacheKeys.collectionTranslationInfo(collection),
                    async () => translationAnalyzer.analyzeCollection(collection),
                    {ttl: CacheTTL.LONG}
                );

                res.json({
                    collection,
                    possibleLocations,
                    searchableFields,
                    translationInfo,
                    cached_at: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error in metadata endpoint:', error);
                res.status(500).json({
                    errors: [{
                        message: error.message || 'Internal server error',
                        extensions: {
                            code: 'INTERNAL_SERVER_ERROR'
                        }
                    }]
                });
            }
        });

        /**
         * Route 2: Fast Search Endpoint
         * Returns items with translations but without usage information
         */
        router.get('/:collection/search', async (req, res) => {
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


                // Initialize ItemLoader
                const itemLoaderConfig: ItemLoaderConfig = {
                    database: context.database,
                    services: context.services,
                    schema,
                    accountability
                };
                const itemLoader = new ItemLoader(itemLoaderConfig);


                // Build query
                const query: ItemQuery = {
                    limit: Number(limit),
                    offset: Number(offset),
                    fields: fields === '*' ? ['*'] : String(fields).split(','),
                    search: search as string,
                    filter: filter ? (typeof filter === 'string' ? JSON.parse(filter) : filter) : undefined,
                    sort: sort ? String(sort).split(',') : undefined
                };

                // Load items with translations
                const itemsResult = await itemLoader.loadItems(collection, query);


                res.json({
                    data: itemsResult.data,
                    meta: itemsResult.meta
                });

            } catch (error) {
                console.error('Error in search endpoint:', error);
                res.status(500).json({
                    errors: [{
                        message: error.message || 'Internal server error',
                        extensions: {
                            code: 'INTERNAL_SERVER_ERROR'
                        }
                    }]
                });
            }
        });

        /**
         * Route 3: Batch Usage Endpoint
         * Returns full items with usage information for specific IDs
         */
        router.post('/:collection/detail', async (req, res) => {
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

                // Use singleton cache instance
                const cache = cacheInstance!;

                // Create ItemLoader instance
                const itemLoader = new ItemLoader({
                    database: context.database,
                    schema: schema,
                    services: context.services,
                    accountability: req.accountability
                });

                // Load filtered relations once
                const filteredRelations = await cache.getOrSet(
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
                    {ttl: CacheTTL.LONG}
                );

                // Initialize services
                const usageFinder = new UsageFinderService({
                    database: context.database,
                    services: context.services,
                    schema: schema,
                    accountability: req.accountability,
                    incomingRelations: filteredRelations
                });

                const pathBuilder = new PathBuilderService({
                    database: context.database,
                    services: context.services,
                    schema: schema,
                    accountability: req.accountability,
                    defaultLocale: 'de-DE',
                    usageFinder: usageFinder,
                    cache: cache
                });

                // Load items by IDs using ItemLoader
                const itemsResult = await itemLoader.loadItems(collection, {
                    filter: {id: {_in: ids}},
                    fields: fields === '*' ? ['*'] : String(fields).split(','),
                    limit: -1
                });

                // Add usage information to each item
                const itemsWithUsage = await Promise.all(
                    itemsResult.data.map(async (item) => {
                        // Try to get complete cached result first
                        const itemCacheKey = CacheKeys.itemDetail(collection, item.id, fields);
                        
                        return cache.getOrSet(
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
                                    console.error(`[Usage] Error processing usage for item ${item.id}:`, error);
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
                            { ttl: CacheTTL.SHORT }
                        );
                    })
                );

                res.json({
                    data: itemsWithUsage
                });

            } catch (error) {
                console.error('Error in batch usage endpoint:', error);
                res.status(500).json({
                    errors: [{
                        message: error.message || 'Internal server error',
                        extensions: {
                            code: 'INTERNAL_SERVER_ERROR'
                        }
                    }]
                });
            }
        });

        /**
         * Build usage locations with full path information
         * @param directUsages Array of direct usage locations
         * @param pathBuilder PathBuilderService instance
         * @returns Array of usage locations with path information
         */
        async function buildUsageLocations(directUsages: any[], pathBuilder: PathBuilderService): Promise<any[]> {
            const locations = [];
            
            for (const usage of directUsages) {
                // Build path with full relation information
                const path = await pathBuilder.buildSimplePathWithRelations(usage);
                
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