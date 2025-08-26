import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelationChecker } from '@/services/RelationChecker';

// Mock the API client
const mockGetItemUsage = vi.fn();
const mockIsFeatureAvailable = vi.fn();
const mockLoadItemsWithRelations = vi.fn();

vi.mock('@/services/api-client', () => ({
  createApiClient: vi.fn(() => ({
    isFeatureAvailable: mockIsFeatureAvailable,
    getItemUsage: mockGetItemUsage,
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
    mockGetItemUsage.mockResolvedValue(null);
    mockLoadItemsWithRelations.mockResolvedValue([]);
    
    relationChecker = new RelationChecker(mockApi, 'page-123');
  });

  describe('checkItemUsage', () => {
    it('should return no usage when item is not used', async () => {
      mockGetItemUsage.mockResolvedValue({
        total_count: 0,
        locations: []
      });

      const result = await relationChecker.checkItemUsage('content_text', 1);

      expect(result.totalCount).toBe(0);
      expect(result.currentPageUsage).toBe(false);
      expect(result.locations).toEqual([]);
      expect(result.canDelete).toBe(true);
    });

    it('should detect current page usage', async () => {
      mockGetItemUsage.mockResolvedValue({
        total_count: 1,
        locations: [
          { collection: 'pages', id: 'page-123', field: 'blocks' }
        ]
      });

      const result = await relationChecker.checkItemUsage('content_text', 1);

      // Check the basic structure
      expect(result.totalCount).toBe(1);
      expect(result.currentPageUsage).toBe(true);
      expect(result.locations).toBeDefined();
      expect(result.canDelete).toBe(true); // Can delete if only used on current page
    });

    it('should detect multiple usages', async () => {
      mockGetItemUsage.mockResolvedValue({
        total_count: 3,
        locations: [
          { collection: 'pages', id: 'page-123', field: 'blocks' },
          { collection: 'pages', id: 'page-456', field: 'blocks' },
          { collection: 'posts', id: 'post-789', field: 'content' }
        ]
      });

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
      mockGetItemUsage.mockRejectedValue(new Error('API Error'));

      const result = await relationChecker.checkItemUsage('content_text', 1);

      expect(result.totalCount).toBe(0);
      expect(result.currentPageUsage).toBe(false);
      expect(result.locations).toEqual([]);
      expect(result.canDelete).toBe(true);
      expect(result.hasUncheckedUsage).toBe(true);
    });

    it('should handle no permission response', async () => {
      mockGetItemUsage.mockResolvedValue(null);

      const result = await relationChecker.checkItemUsage('content_text', 1);

      expect(result.totalCount).toBe(0);
      expect(result.currentPageUsage).toBe(false);
      expect(result.locations).toEqual([]);
      expect(result.canDelete).toBe(true);
      // When API returns null but feature is available, hasUncheckedUsage is true
      expect(result.hasUncheckedUsage).toBe(true);
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