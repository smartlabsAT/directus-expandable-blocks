import { defineEndpoint } from '@directus/extensions-sdk';
import {log} from "@directus/extensions-sdk/dist/cli/utils/logger";

export default defineEndpoint({
    id: 'items-with-relations',
    handler: (router, context) => {
        const { services, database, getSchema } = context;
        const { ItemsService, FieldsService } = services;

        router.get('/test', (req: any, res: any) => {
            res.json({
                message: 'Endpoint working',
                context_keys: Object.keys(context || {}),
                has_services: !!services,
                has_database: !!database,
                has_getSchema: !!getSchema
            });
        });

        router.get('/:collection', async (req, res) => {
            try {
                const { collection } = req.params;
                const {
                    limit = 10,
                    offset = 0,
                    search,
                    filter,
                    fields = '*',
                    sort,
                    include_usage_items = 'true',
                    usage_items_limit = 10
                } = req.query;

                // Convert string parameters to proper types
                const includeItems = include_usage_items !== 'false';
                const itemsLimit = parseInt(usage_items_limit) || 10;
                const accountability = req.accountability;
                const itemsServiceOptions: any = { knex: context.database, accountability };

                let schema = await context.getSchema();

                if (schema) {
                    itemsServiceOptions.schema = schema;
                }

                const itemsService = new ItemsService(collection, itemsServiceOptions);

                const query: any = {
                    limit: Number(limit),
                    offset: Number(offset),
                    fields: fields === '*' ? ['*'] : String(fields).split(','),
                    ...(search && { search }),
                    ...(filter && { filter: typeof filter === 'string' ? JSON.parse(filter) : filter }),
                    ...(sort && { sort })
                };

                // Get items
                const items = await itemsService.readByQuery(query);
                const itemsArray = Array.isArray(items) ? items : [items];

                console.log(`[Main] Processing ${itemsArray.length} items from collection '${collection}'`);

                // Get total count - Simplified approach
                let totalCount = itemsArray.length;

                // Only try to get accurate count if we have pagination
                if (Number(limit) !== -1 && itemsArray.length === Number(limit)) {
                    try {
                        // Simple direct count without complex filters
                        const countResult = await database(collection).count('* as total');
                        totalCount = parseInt(countResult[0].total);
                    } catch (error) {
                        // Silently fall back to array length
                        console.log('Using array length for count');
                    }
                }

                // Find ALL relations pointing to our collection
                let incomingRelations = await database
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

                // Load all reverse relations for M2A
                const reverseRelations = await database
                    .select('*')
                    .from('directus_relations')
                    .whereNotNull('one_field')
                    .whereNotIn('many_field', ['user_created', 'user_updated']);

                // Map for quick access
                const reverseRelationMap = new Map();
                reverseRelations.forEach(rel => {
                    const key = `${rel.one_collection}-${rel.many_collection}`;
                    reverseRelationMap.set(key, rel);
                });

                // Collect possible usage locations - with field details
                const possibleUsageMap = new Map<string, { fields: Set<string>, junction_tables: Set<string> }>();
                const allJunctionTables = new Set<string>();

                incomingRelations.forEach(rel => {
                    if (rel.many_collection) {
                        allJunctionTables.add(rel.many_collection);

                        // For M2A relations
                        if (rel.one_collection === null && rel.one_allowed_collections) {
                            const junctionTable = rel.many_collection;
                            const junctionField = rel.junction_field;

                            // Extract main collection from junction field
                            let mainCollection = junctionField.replace('_id', '');

                            if (junctionTable.includes('_m2a')) {
                                mainCollection = junctionTable.replace('_m2a', '');
                            } else if (junctionTable.endsWith('_blocks')) {
                                mainCollection = junctionTable.replace('_blocks', '');
                            } else if (junctionTable.startsWith('extra_')) {
                                mainCollection = 'extra';
                            } else if (junctionTable.includes('_')) {
                                mainCollection = junctionTable.split('_')[0];
                            }

                            // Check if this collection is allowed in this M2A relation
                            const allowedCollections = rel.one_allowed_collections.split(',').map(c => c.trim());
                            if (allowedCollections.includes(collection)) {
                                // Initialize collection entry if not exists
                                if (!possibleUsageMap.has(mainCollection)) {
                                    possibleUsageMap.set(mainCollection, {
                                        fields: new Set<string>(),
                                        junction_tables: new Set<string>()
                                    });
                                }

                                // IMPROVED FIELD NAME DETECTION FOR M2A
                                let fieldName = '';

                                // 1. Try to get field name from reverse relation
                                const reverseRelKey = `${mainCollection}-${junctionTable}`;
                                const reverseRel = reverseRelationMap.get(reverseRelKey);
                                if (reverseRel && reverseRel.one_field) {
                                    fieldName = reverseRel.one_field;
                                }

                                // 2. If not found, try from relation metadata
                                if (!fieldName && rel.meta) {
                                    try {
                                        const meta = typeof rel.meta === 'string' ? JSON.parse(rel.meta) : rel.meta;
                                        if (meta.one_field) {
                                            fieldName = meta.one_field;
                                        }
                                    } catch (e) {
                                        // Continue with fallback
                                    }
                                }

                                // 3. Fallback: Try to derive field name from junction table naming
                                if (!fieldName) {
                                    if (junctionTable.startsWith(mainCollection + '_')) {
                                        // e.g. "pages_blocks" -> "blocks"
                                        fieldName = junctionTable.substring(mainCollection.length + 1);
                                    } else if (junctionTable.endsWith('_m2a')) {
                                        // e.g. "content_m2a" -> "content"
                                        fieldName = junctionTable.replace('_m2a', '');
                                        if (fieldName.startsWith(mainCollection + '_')) {
                                            fieldName = fieldName.substring(mainCollection.length + 1);
                                        }
                                    } else if (junctionTable.includes('_')) {
                                        // Take the part after the first underscore if it starts with mainCollection
                                        if (junctionTable.startsWith(mainCollection + '_')) {
                                            fieldName = junctionTable.substring(mainCollection.length + 1);
                                        } else {
                                            const parts = junctionTable.split('_');
                                            fieldName = parts[parts.length - 1];
                                        }
                                    } else {
                                        // Last fallback
                                        fieldName = 'content';
                                    }
                                }

                                // Make sure we don't have "m2a", "item" or the junction table itself as field name
                                if (fieldName === 'm2a' || fieldName === 'item' || fieldName === junctionTable) {
                                    // Try again with better logic
                                    if (junctionTable.includes('_')) {
                                        const parts = junctionTable.split('_');
                                        // Remove mainCollection prefix if present
                                        if (parts[0] === mainCollection && parts.length > 1) {
                                            parts.shift();
                                        }
                                        // Remove "m2a" suffix if present
                                        if (parts[parts.length - 1] === 'm2a' && parts.length > 1) {
                                            parts.pop();
                                        }
                                        fieldName = parts.join('_') || 'content';
                                    } else {
                                        fieldName = 'content';
                                    }
                                }

                                possibleUsageMap.get(mainCollection)!.fields.add(fieldName);
                                possibleUsageMap.get(mainCollection)!.junction_tables.add(junctionTable);
                            }
                        }

                        // For normal relations
                        if (rel.one_collection === collection && rel.many_collection && rel.many_field) {
                            const targetCollection = rel.many_collection;

                            if (!possibleUsageMap.has(targetCollection)) {
                                possibleUsageMap.set(targetCollection, {
                                    fields: new Set<string>(),
                                    junction_tables: new Set<string>()
                                });
                            }

                            possibleUsageMap.get(targetCollection)!.fields.add(rel.many_field);
                        }
                    }
                });

                // Convert Map to array format with collection metadata
                const possibleUsageCollections = await Promise.all(
                    Array.from(possibleUsageMap.entries()).map(async ([collection, data]) => {
                        // Get collection metadata
                        let collectionName = collection;
                        let collectionIcon = 'box';

                        try {
                            const collectionInfo = await database
                                .select('*')
                                .from('directus_collections')
                                .where('collection', collection)
                                .first();

                            if (collectionInfo) {
                                const metaData = collectionInfo.options || collectionInfo.meta || collectionInfo.collection_meta;

                                if (metaData) {
                                    const parsed = typeof metaData === 'string' ? JSON.parse(metaData) : metaData;
                                    collectionName = parsed.display || parsed.name || collection;
                                    collectionIcon = parsed.icon || 'box';
                                }
                            }
                        } catch (metaError) {
                            // Ignore and use defaults
                        }

                        return {
                            collection,
                            collection_name: collectionName,
                            collection_icon: collectionIcon,
                            fields: Array.from(data.fields),
                            junction_tables: Array.from(data.junction_tables)
                        };
                    })
                );

                // Helper function to find display name from an object
                const findDisplayName = (obj: any, collectionName: string) => {
                    // Better handling of null/undefined objects
                    if (!obj) {
                        console.log(`[Display Name] Object is null/undefined for ${collectionName}`);
                        return `${collectionName} #unknown`;
                    }

                    if (!obj.id) {
                        console.log(`[Display Name] Object has no ID for ${collectionName}:`, obj);
                        return `${collectionName} #unknown`;
                    }

                    // Common field names for display
                    const displayFields = [
                        'name', 'title', 'headline', 'label', 'display_name',
                        'slug', 'description', 'text', 'content', 'page_title',
                        'menu_title', 'heading', 'caption', 'subject'
                    ];

                    // Find first non-empty field
                    for (const field of displayFields) {
                        if (obj[field] && obj[field].toString().trim()) {
                            return obj[field];
                        }
                    }

                    // If no display field found, use first string field
                    for (const [key, value] of Object.entries(obj)) {
                        if (value && typeof value === 'string' &&
                            !['id', 'status', 'sort', 'user_created', 'user_updated',
                                'date_created', 'date_updated'].includes(key) &&
                            value.trim().length > 0 && value.trim().length < 100) {
                            return value;
                        }
                    }

                    // Fallback to ID
                    return `${collectionName} #${obj.id}`;
                };

                // Process each item to find its usage
                const itemsWithRelations = await Promise.all(
                    itemsArray.map(async (item) => {
                        if (!item.id) return { ...item, _used_in: [] };

                        const usages = [];

                        console.log(`[Usage Debug] Processing item ${item.id} with ${incomingRelations.length} incoming relations`);

                        for (const relation of incomingRelations) {
                            try {
                                // M2A Relation
                                if (relation.one_collection === null && relation.one_allowed_collections) {
                                    const junctionTable = relation.many_collection;
                                    const junctionField = relation.junction_field;
                                    const itemField = relation.many_field;
                                    const collectionField = relation.one_collection_field;

                                    // Extract main collection from junction field
                                    let mainCollection = junctionField.replace('_id', '');

                                    if (junctionTable.includes('_m2a')) {
                                        mainCollection = junctionTable.replace('_m2a', '');
                                    } else if (junctionTable.endsWith('_blocks')) {
                                        // Special case for _blocks tables
                                        mainCollection = junctionTable.replace('_blocks', '');
                                    } else if (junctionTable.startsWith('extra_')) {
                                        mainCollection = 'extra';
                                    } else if (junctionTable.includes('_')) {
                                        mainCollection = junctionTable.split('_')[0];
                                    }

                                    console.log(`[M2A Debug] Junction: ${junctionTable}, Field: ${junctionField}, Detected Collection: ${mainCollection}`);

                                    // Count entries using direct SQL
                                    let count = 0;
                                    try {
                                        const sqlResult = await database.raw(`
                                            SELECT COUNT(*) as count
                                            FROM "${junctionTable}"
                                            WHERE "${itemField}" = ?
                                              AND "${collectionField}" = ?
                                        `, [String(item.id), collection]);

                                        count = parseInt(sqlResult.rows?.[0]?.count || sqlResult[0]?.count || 0);
                                    } catch (sqlError) {
                                        // Try without quotes
                                        try {
                                            const sqlResult2 = await database.raw(`
                                                SELECT COUNT(*) as count
                                                FROM ${junctionTable}
                                                WHERE ${itemField} = ?
                                                  AND ${collectionField} = ?
                                            `, [String(item.id), collection]);

                                            count = parseInt(sqlResult2.rows?.[0]?.count || sqlResult2[0]?.count || 0);
                                        } catch (e) {
                                            console.error(`Failed to query ${junctionTable}:`, e.message);
                                            continue;
                                        }
                                    }

                                    if (count > 0) {
                                        console.log(`[M2A Debug] Found ${count} usages in ${junctionTable}`);

                                        // Get the actual items that use this item (if requested)
                                        let usingItems = [];
                                        if (includeItems) {
                                            try {
                                                // Get junction entries
                                                const junctionEntries = await database.raw(`
                                                    SELECT * FROM "${junctionTable}"
                                                    WHERE "${itemField}" = ?
                                                      AND "${collectionField}" = ?
                                                    ORDER BY sort ASC, id ASC
                                                        LIMIT ?
                                                `, [String(item.id), collection, itemsLimit]);

                                                const entries = junctionEntries.rows || junctionEntries || [];

                                                console.log(`[M2A Debug] Junction entries for item ${item.id}:`, entries.length);
                                                if (entries.length > 0) {
                                                    console.log(`[M2A Debug] First junction entry:`, entries[0]);
                                                }

                                                // Get unique parent IDs
                                                const parentIds = [...new Set(entries.map(e => e[junctionField]))];

                                                console.log(`[M2A Debug] Found ${entries.length} junction entries, ${parentIds.length} unique parent IDs:`, parentIds);

                                                if (parentIds.length > 0) {
                                                    // Load parent items using direct SQL with better type handling
                                                    let parentArray = [];

                                                    try {
                                                        // Better query with type casting for IDs
                                                        if (parentIds.length === 1) {
                                                            const sqlResult = await database.raw(`
                                                                SELECT * FROM "${mainCollection}"
                                                                WHERE id::text = ?
                                                            `, [String(parentIds[0])]);

                                                            parentArray = sqlResult.rows || sqlResult || [];
                                                        } else {
                                                            // Multiple IDs - use ANY array
                                                            const sqlResult = await database.raw(`
                                                                SELECT * FROM "${mainCollection}"
                                                                WHERE id::text = ANY(?)
                                                            `, [parentIds.map(id => String(id))]);

                                                            parentArray = sqlResult.rows || sqlResult || [];
                                                        }

                                                        console.log(`[M2A Debug] Loaded ${parentArray.length} parent items from ${mainCollection}`);
                                                        if (parentArray.length === 0 && parentIds.length > 0) {
                                                            console.log(`[M2A Debug] WARNING: No parents found for IDs:`, parentIds);
                                                        }

                                                        if (parentArray.length > 0) {
                                                            console.log(`[M2A Debug] First parent item:`, {
                                                                id: parentArray[0].id,
                                                                id_type: typeof parentArray[0].id,
                                                                fields: Object.keys(parentArray[0]).slice(0, 10)
                                                            });
                                                        }
                                                    } catch (sqlError) {
                                                        console.error(`[M2A Debug] Failed to load items from ${mainCollection}:`, sqlError.message);

                                                        // Alternative Query without type casting
                                                        try {
                                                            const placeholders = parentIds.map((_, i) => `$${i + 1}`).join(',');
                                                            const sqlResult2 = await database.raw(`
                                                                SELECT * FROM "${mainCollection}"
                                                                WHERE id IN (${placeholders})
                                                            `, parentIds);

                                                            parentArray = sqlResult2.rows || sqlResult2 || [];
                                                            console.log(`[M2A Debug] Alternative query loaded ${parentArray.length} items`);
                                                        } catch (e) {
                                                            console.error(`[M2A Debug] Both queries failed:`, e.message);
                                                        }
                                                    }

                                                    // Get the field name for this relation
                                                    const fieldName = Array.from(possibleUsageMap.get(mainCollection)?.fields || [])[0] || 'unknown_field';

                                                    // Map entries with display names AND field names
                                                    usingItems = entries.map(entry => {
                                                        const parentId = entry[junctionField];
                                                        const parent = parentArray.find(p => {
                                                            // Flexible comparison for different ID types
                                                            return String(p.id) === String(parentId) ||
                                                                p.id === parentId ||
                                                                (typeof p.id === 'number' && p.id === Number(parentId)) ||
                                                                (typeof parentId === 'number' && Number(p.id) === parentId);
                                                        });

                                                        if (!parent) {
                                                            console.log(`[M2A Debug] Parent not found for ID ${parentId} in ${mainCollection}. Available IDs:`,
                                                                parentArray.map(p => ({ id: p.id, type: typeof p.id })).slice(0, 5));
                                                        }

                                                        return {
                                                            id: entry[junctionField],
                                                            junction_id: entry.id,
                                                            display_name: findDisplayName(parent, mainCollection),
                                                            status: parent?.status || null,
                                                            sort: entry.sort || null,
                                                            field: fieldName,
                                                            relation_type: 'm2a'
                                                        };
                                                    });
                                                }
                                            } catch (junctionError) {
                                                console.error(`Error loading junction items:`, junctionError.message);
                                            }
                                        }

                                        // Get collection info
                                        let collectionName = mainCollection;
                                        let collectionIcon = 'box';

                                        try {
                                            const collectionInfo = await database
                                                .select('*')
                                                .from('directus_collections')
                                                .where('collection', mainCollection)
                                                .first();

                                            if (collectionInfo) {
                                                const metaData = collectionInfo.options || collectionInfo.meta || collectionInfo.collection_meta;

                                                if (metaData) {
                                                    const parsed = typeof metaData === 'string' ? JSON.parse(metaData) : metaData;
                                                    collectionName = parsed.display || parsed.name || mainCollection;
                                                    collectionIcon = parsed.icon || 'box';
                                                }
                                            }
                                        } catch (metaError) {
                                            // Ignore
                                        }

                                        // Use the correct field name instead of junction table
                                        const fieldName = Array.from(possibleUsageMap.get(mainCollection)?.fields || [])[0] || junctionTable;

                                        usages.push({
                                            collection: mainCollection,
                                            collection_name: collectionName,
                                            collection_icon: collectionIcon,
                                            field: fieldName,
                                            relation_type: 'm2a',
                                            junction_table: junctionTable,
                                            count: count,
                                            items: usingItems,
                                            has_more: count > itemsLimit
                                        });
                                    }

                                } else if (relation.many_collection && relation.many_field) {
                                    // Normal relations (M2O, O2M)
                                    const referencingCollection = relation.many_collection;
                                    const referencingField = relation.many_field;

                                    if (referencingCollection === collection &&
                                        (referencingField === 'user_created' || referencingField === 'user_updated')) {
                                        continue;
                                    }

                                    if (referencingCollection === collection && referencingField === 'id') {
                                        continue;
                                    }

                                    // Count using direct SQL
                                    let count = 0;
                                    try {
                                        const sqlResult = await database.raw(`
                                            SELECT COUNT(*) as count
                                            FROM "${referencingCollection}"
                                            WHERE "${referencingField}" = ?
                                        `, [String(item.id)]);

                                        count = parseInt(sqlResult.rows?.[0]?.count || sqlResult[0]?.count || 0);
                                    } catch (e) {
                                        // Try without quotes
                                        try {
                                            const sqlResult2 = await database.raw(`
                                                SELECT COUNT(*) as count
                                                FROM ${referencingCollection}
                                                WHERE ${referencingField} = ?
                                            `, [String(item.id)]);

                                            count = parseInt(sqlResult2.rows?.[0]?.count || sqlResult2[0]?.count || 0);
                                        } catch (e2) {
                                            console.error(`Failed to count in ${referencingCollection}:`, e2.message);
                                            continue;
                                        }
                                    }

                                    if (count > 0) {
                                        console.log(`[Normal Relation] Found ${count} usages in ${referencingCollection}.${referencingField}`);

                                        // Get the actual items that reference this one (if requested)
                                        let usingItems = [];
                                        if (includeItems) {
                                            try {
                                                // Use direct SQL
                                                const sqlResult = await database.raw(`
                                                    SELECT * FROM "${referencingCollection}"
                                                    WHERE "${referencingField}" = ?
                                                    ORDER BY id
                                                        LIMIT ?
                                                `, [String(item.id), itemsLimit]);

                                                const itemsArray = sqlResult.rows || sqlResult || [];

                                                console.log(`[Normal Relation] Loaded ${itemsArray.length} items from ${referencingCollection}`);
                                                if (itemsArray.length > 0) {
                                                    console.log(`[Normal Relation] First item sample:`, {
                                                        id: itemsArray[0].id,
                                                        fields: Object.keys(itemsArray[0]).slice(0, 10)
                                                    });
                                                }

                                                usingItems = itemsArray.map(refItem => ({
                                                    id: refItem.id,
                                                    display_name: findDisplayName(refItem, referencingCollection),
                                                    status: refItem.status || null,
                                                    field: referencingField,
                                                    relation_type: 'm2o'
                                                }));
                                            } catch (loadError) {
                                                console.error(`Could not load items from ${referencingCollection}:`, loadError.message);
                                                // Try without quotes
                                                try {
                                                    const sqlResult2 = await database.raw(`
                                                        SELECT * FROM ${referencingCollection}
                                                        WHERE ${referencingField} = ?
                                                        ORDER BY id
                                                            LIMIT ?
                                                    `, [String(item.id), itemsLimit]);

                                                    const itemsArray2 = sqlResult2.rows || sqlResult2 || [];

                                                    usingItems = itemsArray2.map(refItem => ({
                                                        id: refItem.id,
                                                        display_name: findDisplayName(refItem, referencingCollection),
                                                        status: refItem.status || null,
                                                        field: referencingField,
                                                        relation_type: 'm2o'
                                                    }));
                                                } catch (e) {
                                                    console.error(`Second SQL attempt also failed:`, e.message);
                                                }
                                            }
                                        }

                                        // Get collection info
                                        let collectionName = referencingCollection;
                                        let collectionIcon = 'box';

                                        try {
                                            const collectionInfo = await database
                                                .select('*')
                                                .from('directus_collections')
                                                .where('collection', referencingCollection)
                                                .first();

                                            if (collectionInfo) {
                                                const metaData = collectionInfo.options || collectionInfo.meta || collectionInfo.collection_meta;

                                                if (metaData) {
                                                    const parsed = typeof metaData === 'string' ? JSON.parse(metaData) : metaData;
                                                    collectionName = parsed.display || parsed.name || referencingCollection;
                                                    collectionIcon = parsed.icon || 'box';
                                                }
                                            }
                                        } catch (metaError) {
                                            // Ignore
                                        }

                                        usages.push({
                                            collection: referencingCollection,
                                            collection_name: collectionName,
                                            collection_icon: collectionIcon,
                                            field: referencingField,
                                            relation_type: 'm2o',
                                            count: count,
                                            items: usingItems,
                                            has_more: count > itemsLimit
                                        });
                                    }
                                }
                            } catch (error) {
                                console.error(`Error checking usage:`, error.message);
                            }
                        }

                        const result = {
                            ...item,
                            _used_in: usages,
                            _total_usage_count: usages.reduce((sum, usage) => sum + usage.count, 0)
                        };

                        if (usages.length > 0) {
                            console.log(`[Usage Summary] Item ${item.id} has ${result._total_usage_count} total usages across ${usages.length} collections`);
                        }

                        return result;
                    })
                );

                // Get collection fields
                const fieldsService = new FieldsService({
                    schema,
                    accountability,
                    knex: database
                });

                const collectionFields = await fieldsService.readAll(collection);
                const searchableFields = collectionFields
                    .filter(field =>
                        !['date_created', 'date_updated', 'user_created', 'user_updated', 'sort'].includes(field.field)
                        && field.type !== 'alias'
                        && field.type !== 'presentation'
                    )
                    .map(field => ({
                        field: field.field,
                        name: field.meta?.name || field.field,
                        type: field.type,
                        interface: field.meta?.interface
                    }));

                // Return response
                res.json({
                    data: itemsWithRelations,
                    meta: {
                        total_count: totalCount,
                        filter_count: totalCount,
                        collection: collection,
                        searchable_fields: searchableFields,
                        possible_usage_locations: {
                            collections: possibleUsageCollections,
                            all_junction_tables: Array.from(allJunctionTables)
                        }
                    }
                });

            } catch (error) {
                console.error('Error in items-with-relations endpoint:', error);
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