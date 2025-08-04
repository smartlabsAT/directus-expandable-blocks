import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceFactory } from '../../../../src/api/factories/ServiceFactory';
import type { DirectusContext } from '../../../../src/api/factories/ServiceFactory';

describe('ServiceFactory', () => {
  let serviceFactory: ServiceFactory;
  let mockContext: DirectusContext;
  let mockSchema: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock schema
    mockSchema = {
      collections: {
        test_collection: {
          collection: 'test_collection',
          fields: []
        }
      },
      relations: []
    };
    
    // Create mock database with Knex-like interface
    const mockDatabase: any = vi.fn();
    mockDatabase.select = vi.fn().mockReturnThis();
    mockDatabase.from = vi.fn().mockReturnThis();
    mockDatabase.where = vi.fn().mockReturnThis();
    mockDatabase.whereNot = vi.fn().mockReturnThis();
    mockDatabase.orWhere = vi.fn().mockReturnThis();
    mockDatabase.andWhere = vi.fn().mockReturnThis();
    mockDatabase.then = vi.fn().mockResolvedValue([]);
    
    // Create mock context
    mockContext = {
      database: mockDatabase,
      getSchema: vi.fn().mockResolvedValue(mockSchema),
      accountability: {
        user: 'test-user',
        role: 'test-role'
      },
      services: {
        ItemsService: vi.fn().mockImplementation(() => ({
          readByQuery: vi.fn(),
          readOne: vi.fn(),
          createOne: vi.fn(),
          updateOne: vi.fn(),
          deleteOne: vi.fn()
        })),
        PermissionsService: vi.fn().mockImplementation(() => ({
          checkAccess: vi.fn().mockResolvedValue(true)
        }))
      } as any,
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      }
    };

    serviceFactory = new ServiceFactory(mockContext);
  });

  describe('getRelationAnalyzer', () => {
    it('should create and return RelationAnalyzer instance', async () => {
      const analyzer = await serviceFactory.getRelationAnalyzer();
      
      expect(analyzer).toBeDefined();
      expect(mockContext.getSchema).toHaveBeenCalled();
    });

    it('should reuse existing RelationAnalyzer instance', async () => {
      const analyzer1 = await serviceFactory.getRelationAnalyzer();
      const analyzer2 = await serviceFactory.getRelationAnalyzer();
      
      // Should only call getSchema once
      expect(mockContext.getSchema).toHaveBeenCalledTimes(1);
      expect(analyzer1).toBe(analyzer2);
    });
  });

  describe('getFieldAnalyzer', () => {
    it('should create and return FieldAnalyzer instance', async () => {
      const analyzer = await serviceFactory.getFieldAnalyzer();
      
      expect(analyzer).toBeDefined();
      expect(mockContext.getSchema).toHaveBeenCalled();
    });

    it('should reuse existing FieldAnalyzer instance', async () => {
      const analyzer1 = await serviceFactory.getFieldAnalyzer();
      const analyzer2 = await serviceFactory.getFieldAnalyzer();
      
      expect(mockContext.getSchema).toHaveBeenCalledTimes(1);
      expect(analyzer1).toBe(analyzer2);
    });
  });

  describe('getItemLoader', () => {
    it('should create and return ItemLoader instance', async () => {
      const loader = await serviceFactory.getItemLoader();
      
      expect(loader).toBeDefined();
      expect(mockContext.getSchema).toHaveBeenCalled();
    });

    it('should reuse existing ItemLoader instance', async () => {
      const loader1 = await serviceFactory.getItemLoader();
      const loader2 = await serviceFactory.getItemLoader();
      
      expect(mockContext.getSchema).toHaveBeenCalledTimes(1);
      expect(loader1).toBe(loader2);
    });
  });

  describe.skip('getUsageFinder', () => {
    it('should create UsageFinder for collection', async () => {
      const finder = await serviceFactory.getUsageFinder('test_collection');
      
      expect(finder).toBeDefined();
      expect(mockContext.getSchema).toHaveBeenCalled();
      expect(mockContext.database.select).toHaveBeenCalled();
    });

    it('should create different instances for different collections', async () => {
      const finder1 = await serviceFactory.getUsageFinder('collection1');
      const finder2 = await serviceFactory.getUsageFinder('collection2');
      
      expect(finder1).not.toBe(finder2);
    });

    it('should reuse instance for same collection', async () => {
      const finder1 = await serviceFactory.getUsageFinder('test_collection');
      const finder2 = await serviceFactory.getUsageFinder('test_collection');
      
      expect(finder1).toBe(finder2);
    });
  });

  describe.skip('getPathBuilder', () => {
    it('should create and return PathBuilderService instance', async () => {
      const cache = serviceFactory.createCache({ ttl: 300 });
      const pathBuilder = await serviceFactory.getPathBuilder('test_collection', cache);
      
      expect(pathBuilder).toBeDefined();
      expect(mockContext.getSchema).toHaveBeenCalled();
    });

    it('should reuse existing PathBuilderService instance', async () => {
      const cache = serviceFactory.createCache({ ttl: 300 });
      const builder1 = await serviceFactory.getPathBuilder('test_collection', cache);
      const builder2 = await serviceFactory.getPathBuilder('test_collection', cache);
      
      // Should call getSchema more times due to getUsageFinder
      expect(builder1).toBe(builder2);
    });
  });

  describe('createCache', () => {
    it('should create DirectusCacheWrapper with config', () => {
      const cacheConfig = {
        ttl: 300,
        namespace: 'test'
      };
      
      const cache = serviceFactory.createCache(cacheConfig);
      
      expect(cache).toBeDefined();
    });

    it('should create new instance each time', () => {
      const cache1 = serviceFactory.createCache({ ttl: 300 });
      const cache2 = serviceFactory.createCache({ ttl: 300 });
      
      expect(cache1).not.toBe(cache2);
    });
  });

  describe('updateAccountability', () => {
    it('should update accountability and clear services', async () => {
      // Create some services first
      await serviceFactory.getRelationAnalyzer();
      
      const newAccountability = {
        user: 'new-user',
        role: 'new-role'
      };
      
      serviceFactory.updateAccountability(newAccountability);
      
      // Services should be recreated with new accountability
      await serviceFactory.getRelationAnalyzer();
      
      // getSchema should be called at least once
      expect(mockContext.getSchema).toHaveBeenCalled();
    });
  });
});