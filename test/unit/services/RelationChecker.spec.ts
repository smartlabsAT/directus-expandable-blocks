import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelationChecker } from '@/services/RelationChecker';

// Mock the API client
const mockLoadItemsWithRelations = vi.fn();
const mockIsFeatureAvailable = vi.fn();

vi.mock('@/services/api-client', () => ({
  createApiClient: vi.fn(() => ({
    isFeatureAvailable: mockIsFeatureAvailable,
    loadItemsWithRelations: mockLoadItemsWithRelations
  }))
}));

// Mock logger
vi.mock('@/utils/logger-wrapper', () => ({
  logDebug: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn()
}));

describe('RelationChecker', () => {
  let mockApi: any;
  let relationChecker: RelationChecker;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApi = {
      post: vi.fn(),
      get: vi.fn(),
      delete: vi.fn()
    };
    
    // Setup default behavior
    mockIsFeatureAvailable.mockResolvedValue(true);
    mockLoadItemsWithRelations.mockResolvedValue([]);
    
    relationChecker = new RelationChecker(mockApi, 'page-123');
  });

  describe('checkItemUsage', () => {
    it('should return no usage when item is not used', async () => {
      mockLoadItemsWithRelations.mockResolvedValue([{
        id: 1,
        usage_summary: { total_count: 0 },
        usage_locations: []
      }]);

      const result = await relationChecker.checkItemUsage('content_text', 1);

      expect(result).toEqual({
        totalCount: 0,
        currentPageUsage: false,
        locations: [],
        canDelete: true
      });
    });

    it('should detect current page usage', async () => {
      mockLoadItemsWithRelations.mockResolvedValue([{
        id: 1,
        usage_summary: { total_count: 1 },
        usage_locations: [
          { collection: 'pages', id: 'page-123', field: 'blocks' }
        ]
      }]);

      const result = await relationChecker.checkItemUsage('content_text', 1);

      expect(result).toEqual({
        totalCount: 1,
        currentPageUsage: true,
        locations: expect.any(Array),
        canDelete: true
      });
    });

    it('should detect multiple usages', async () => {
      mockLoadItemsWithRelations.mockResolvedValue([{
        id: 1,
        usage_summary: { total_count: 3 },
        usage_locations: [
          { collection: 'pages', id: 'page-123', field: 'blocks' },
          { collection: 'pages', id: 'page-456', field: 'blocks' },
          { collection: 'posts', id: 'post-789', field: 'content' }
        ]
      }]);

      const result = await relationChecker.checkItemUsage('content_text', 1);

      expect(result).toEqual({
        totalCount: 3,
        currentPageUsage: true,
        locations: expect.any(Array),
        canDelete: false
      });
      expect(result!.locations).toHaveLength(3);
    });

    it('should handle API errors gracefully', async () => {
      mockLoadItemsWithRelations.mockRejectedValue(new Error('API Error'));

      const result = await relationChecker.checkItemUsage('content_text', 1);

      expect(result).toEqual({
        totalCount: 0,
        currentPageUsage: false,
        locations: [],
        canDelete: false
      });
    });

    it('should handle no permission response', async () => {
      mockLoadItemsWithRelations.mockResolvedValue([{
        _no_permission: true
      }]);

      const result = await relationChecker.checkItemUsage('content_text', 1);

      expect(result).toEqual({
        totalCount: 0,
        currentPageUsage: false,
        locations: [],
        canDelete: true
      });
    });
  });

  describe('checkMultipleItemsUsage', () => {
    it('should check multiple items and return a map', async () => {
      // Mock response for batch loading
      mockLoadItemsWithRelations.mockResolvedValue([
        {
          id: 1,
          usage_summary: { total_count: 1 },
          usage_locations: [
            { collection: 'pages', id: 'page-123', field: 'blocks' }
          ]
        },
        {
          id: 2,
          usage_summary: { total_count: 2 },
          usage_locations: [
            { collection: 'pages', id: 'page-456', field: 'blocks' },
            { collection: 'posts', id: 'post-789', field: 'content' }
          ]
        }
      ]);

      const items = [
        { collection: 'content_text', id: 1 },
        { collection: 'content_text', id: 2 }
      ];

      const result = await relationChecker.checkMultipleItemsUsage(items);

      expect(result.size).toBe(2);
      expect(result.get('content_text:1')).toMatchObject({
        totalCount: 1,
        currentPageUsage: true
      });
      expect(result.get('content_text:2')).toMatchObject({
        totalCount: 2,
        currentPageUsage: false
      });
    });
  });
});