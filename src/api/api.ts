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
import {CacheServiceImpl} from './services/CacheService';
import {CacheKeys, CacheTTL} from './types/CacheTypes';

export default defineEndpoint({
    id: 'expandable-blocks-api',
    handler: (router, context) => {
        const {getSchema} = context;


        /**
         * Route 1: Metadata Endpoint
         * Returns collection metadata for frontend initialization
         */
        router.get('/:collection/metadata', async (req, res) => {
            try {
                const {collection} = req.params;
                const schema = await getSchema();
                const accountability = req.accountability;

                // Create CacheService instance
                const cache = new CacheServiceImpl({
                    database: context.database,
                    services: context.services,
                    defaultTTL: CacheTTL.LONG
                });

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

                // Create CacheService instance
                const cache = new CacheServiceImpl({
                    database: context.database,
                    services: context.services
                });

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
                        try {
                            // Find all usages for this item (cached)
                            const usageTreeCacheKey = CacheKeys.itemUsage(collection, item.id);
                            const usageTree = await cache.getOrSet(
                                usageTreeCacheKey,
                                async () => usageFinder.findAllUsages(collection, item.id, {
                                    maxDepth: 3,
                                    includeItemDetails: true,
                                    includeFieldMetadata: true
                                }),
                                {ttl: CacheTTL.SHORT}
                            );

                            // Get usage statistics
                            const usageStats = await usageFinder.getUsageStatistics(collection, item.id, usageTree);

                            // Build paths for direct usages
                            const usagePaths = await Promise.all(
                                usageTree.direct_usages.map(async (usage) => {
                                    const path = await pathBuilder.buildPath(usage, {
                                        includeCollections: true,
                                        includeFields: true,
                                        includeIds: false,
                                        includeAdminUrls: true,
                                        adminBaseUrl: '/admin'
                                    });

                                    const breadcrumbs = await pathBuilder.buildBreadcrumbs(usage, {
                                        includeAdminUrls: true,
                                        adminBaseUrl: '/admin'
                                    });

                                    return {
                                        ...usage,
                                        path: path.formatted,
                                        short_path: path.short_formatted,
                                        breadcrumbs,
                                        admin_url: path.to.admin_url
                                    };
                                })
                            );

                            // Build all paths collection
                            const allPaths = await pathBuilder.buildAllPaths(collection, item.id, {
                                includeAdminUrls: true,
                                adminBaseUrl: '/admin'
                            });

                            return {
                                ...item,
                                _usage: {
                                    direct_usages: usagePaths,
                                    total_usage_count: usageTree.total_usage_count,
                                    usage_tree: usageTree,
                                    usage_stats: usageStats,
                                    paths_by_collection: allPaths.by_collection,
                                    shortest_paths: allPaths.shortest_paths,
                                    has_circular_reference: usageTree.has_circular_reference
                                }
                            };
                        } catch (error) {
                            console.error(`[Usage] Error processing usage for item ${item.id}:`, error);
                            return {
                                ...item,
                                _usage: {
                                    error: error.message || 'Failed to load usage information'
                                }
                            };
                        }
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


    }
});