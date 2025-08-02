import { defineEndpoint } from '@directus/extensions-sdk';
import { ServiceFactory } from './factories/ServiceFactory';
import { MetadataHandler } from './handlers/MetadataHandler';
import { SearchHandler } from './handlers/SearchHandler';
import { DetailHandler } from './handlers/DetailHandler';
import { errorHandler } from './middleware/error-handler';
import { cacheMiddleware } from './middleware/cache';
import { securityHeaders, corsMiddleware } from './middleware/security-headers';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { requestIdMiddleware } from './middleware/request-id';
import { openAPISpec } from './docs/openapi';

export default defineEndpoint({
    id: 'expandable-blocks-api',
    handler: (router, context) => {

        // Initialize service factory and handlers
        const serviceFactory = new ServiceFactory(context);
        const metadataHandler = new MetadataHandler(serviceFactory, context.logger);
        const searchHandler = new SearchHandler(serviceFactory, context.logger);
        const detailHandler = new DetailHandler(serviceFactory, context.logger);

        // Apply middleware
        router.use(requestIdMiddleware());
        router.use(corsMiddleware());
        router.use(securityHeaders());
        router.use(rateLimitMiddleware());
        router.use(cacheMiddleware(context));

        /**
         * OpenAPI Documentation
         */
        router.get('/docs', (_req, res) => {
            res.json(openAPISpec);
        });

        router.get('/docs.yaml', (_req, res) => {
            res.setHeader('Content-Type', 'application/x-yaml');
            res.send(JSON.stringify(openAPISpec, null, 2));
        });

        /**
         * Route 1: Metadata Endpoint
         * Returns collection metadata for frontend initialization
         */
        router.get('/:collection/metadata', async (req, res, next) => {
            try {
                await metadataHandler.handle(req as any, res);
            } catch (error) {
                next(error);
            }
        });

        /**
         * Route 2: Fast Search Endpoint
         * Returns items with translations but without usage information
         */
        router.get('/:collection/search', async (req, res, next) => {
            try {
                await searchHandler.handle(req as any, res);
            } catch (error) {
                next(error);
            }
        });

        /**
         * Route 3: Batch Usage Endpoint
         * Returns full items with usage information for specific IDs
         */
        router.post('/:collection/detail', async (req, res, next) => {
            try {
                await detailHandler.handle(req as any, res);
            } catch (error) {
                next(error);
            }
        });

        // Apply error handler middleware (must be last)
        router.use(errorHandler(context));

    }
});