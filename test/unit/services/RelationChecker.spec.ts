import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelationChecker } from '@/services/RelationChecker';

describe('RelationChecker', () => {
  let mockApi: any;
  let relationChecker: RelationChecker;

  beforeEach(() => {
    mockApi = {
      post: vi.fn(),
      get: vi.fn(),
      delete: vi.fn()
    };
    
    relationChecker = new RelationChecker(mockApi, 'page-123');
  });

  describe('checkItemUsage', () => {
    it('should return no usage when item is not used', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          data: [{
            id: 1,
            usage_summary: { total_count: 0 },
            usage_locations: []
          }]
        }
      });

      const result = await relationChecker.checkItemUsage('content_text', 1);

      expect(result).toEqual({
        totalCount: 0,
        currentPageUsage: false,
        locations: [],
        canDelete: true
      });
    });

    it('should detect current page usage', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          data: [{
            id: 1,
            usage_summary: { total_count: 1 },
            usage_locations: [
              { collection: 'pages', id: 'page-123', field: 'blocks' }
            ]
          }]
        }
      });

      const result = await relationChecker.checkItemUsage('content_text', 1);

      expect(result).toEqual({
        totalCount: 1,
        currentPageUsage: true,
        locations: expect.any(Array),
        canDelete: true
      });
    });

    it('should detect multiple usages', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          data: [{
            id: 1,
            usage_summary: { total_count: 3 },
            usage_locations: [
              { collection: 'pages', id: 'page-123', field: 'blocks' },
              { collection: 'pages', id: 'page-456', field: 'blocks' },
              { collection: 'posts', id: 'post-789', field: 'content' }
            ]
          }]
        }
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
      mockApi.post.mockRejectedValue(new Error('API Error'));

      const result = await relationChecker.checkItemUsage('content_text', 1);

      expect(result).toEqual({
        totalCount: 0,
        currentPageUsage: false,
        locations: [],
        canDelete: false
      });
    });

    it('should handle no permission response', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          data: [{
            _no_permission: true
          }]
        }
      });

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
      mockApi.post.mockResolvedValue({
        data: {
          data: [
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
          ]
        }
      });

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