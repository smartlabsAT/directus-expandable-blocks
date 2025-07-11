import { describe, it, expect } from 'vitest';
import {
  buildM2AFieldsString,
  extractItemTitle,
  getActualItemId,
  isNewItem,
  parseAllowedCollections,
  deepClone
} from '@/utils/helpers';
import type { CollectionInfo, JunctionRecord, ItemRecord } from '@/types';

describe('helpers.ts', () => {
  describe('buildM2AFieldsString', () => {
    it('returns default fields when no collections provided', () => {
      const result = buildM2AFieldsString([]);
      expect(result).toBe('*,item.*');
    });

    it('builds correct field string for multiple collections', () => {
      const collections: CollectionInfo[] = [
        { collection: 'content_text', name: 'Text' },
        { collection: 'content_image', name: 'Image' }
      ];
      const result = buildM2AFieldsString(collections);
      expect(result).toBe('*,item:content_text.*,item:content_image.*');
    });

    it('handles single collection correctly', () => {
      const collections: CollectionInfo[] = [
        { collection: 'content_hero', name: 'Hero' }
      ];
      const result = buildM2AFieldsString(collections);
      expect(result).toBe('*,item:content_hero.*');
    });
  });

  describe('extractItemTitle', () => {
    it('extracts title from item with title field', () => {
      const item: ItemRecord = { id: 1, title: 'Test Title' };
      expect(extractItemTitle(item)).toBe('Test Title');
    });

    it('falls back to name field', () => {
      const item: ItemRecord = { id: 1, name: 'Test Name' };
      expect(extractItemTitle(item)).toBe('Test Name');
    });

    it('falls back to headline field', () => {
      const item: ItemRecord = { id: 1, headline: 'Test Headline' };
      expect(extractItemTitle(item)).toBe('Test Headline');
    });

    it('falls back to label field', () => {
      const item: ItemRecord = { id: 1, label: 'Test Label' };
      expect(extractItemTitle(item)).toBe('Test Label');
    });

    it('falls back to heading field', () => {
      const item: ItemRecord = { id: 1, heading: 'Test Heading' };
      expect(extractItemTitle(item)).toBe('Test Heading');
    });

    it('returns "Untitled Block" when no title fields exist', () => {
      const item: ItemRecord = { id: 1, content: 'Some content' };
      expect(extractItemTitle(item)).toBe('Untitled Block');
    });

    it('extracts title from junction record with nested item', () => {
      const junction: JunctionRecord = {
        id: 1,
        collection: 'content_text',
        item: { id: 2, title: 'Nested Title' }
      };
      expect(extractItemTitle(junction)).toBe('Nested Title');
    });

    it('handles junction record with ID reference', () => {
      const junction: JunctionRecord = {
        id: 1,
        collection: 'content_text',
        item: 123
      };
      expect(extractItemTitle(junction)).toBe('Untitled Block');
    });
  });

  describe('getActualItemId', () => {
    it('gets ID from nested item object', () => {
      const junction: JunctionRecord = {
        id: 1,
        collection: 'content_text',
        item: { id: 42, title: 'Test' }
      };
      expect(getActualItemId(junction)).toBe(42);
    });

    it('returns junction ID when item is not an object', () => {
      const junction: JunctionRecord = {
        id: 1,
        collection: 'content_text',
        item: 123
      };
      expect(getActualItemId(junction)).toBe(1);
    });
  });

  describe('isNewItem', () => {
    it('identifies new items with string IDs starting with "new_"', () => {
      const item: JunctionRecord = {
        id: 'new_123456',
        collection: 'content_text',
        item: { id: 'new_item_123', title: 'New Block' }
      };
      expect(isNewItem(item)).toBe(true);
    });

    it('identifies new items with temp_ prefix', () => {
      const item: JunctionRecord = {
        id: 'temp_123456',
        collection: 'content_text',
        item: { id: 1, title: 'Test' }
      };
      expect(isNewItem(item)).toBe(true);
    });

    it('identifies new items with dup_ prefix', () => {
      const item: JunctionRecord = {
        id: 'dup_123456',
        collection: 'content_text',
        item: { id: 1, title: 'Test' }
      };
      expect(isNewItem(item)).toBe(true);
    });

    it('identifies existing items with numeric IDs', () => {
      const item: JunctionRecord = {
        id: 123,
        collection: 'content_text',
        item: { id: 456, title: 'Existing Block' }
      };
      expect(isNewItem(item)).toBe(false);
    });

    it('identifies existing items with string numeric IDs', () => {
      const item: JunctionRecord = {
        id: '123',
        collection: 'content_text',
        item: { id: 456, title: 'Existing Block' }
      };
      expect(isNewItem(item)).toBe(false);
    });
  });

  describe('parseAllowedCollections', () => {
    it('returns empty array for undefined input', () => {
      expect(parseAllowedCollections(undefined)).toEqual([]);
    });

    it('returns empty array for null input', () => {
      expect(parseAllowedCollections(null as any)).toEqual([]);
    });

    it('returns array as-is when input is array', () => {
      const collections = ['content_text', 'content_image'];
      expect(parseAllowedCollections(collections)).toEqual(collections);
    });

    it('splits comma-separated string into array', () => {
      const input = 'content_text,content_image,content_hero';
      expect(parseAllowedCollections(input)).toEqual([
        'content_text',
        'content_image',
        'content_hero'
      ]);
    });

    it('handles string with spaces around commas', () => {
      const input = 'content_text , content_image , content_hero';
      expect(parseAllowedCollections(input)).toEqual([
        'content_text',
        'content_image',
        'content_hero'
      ]);
    });

    it('returns array with single item for non-comma string', () => {
      expect(parseAllowedCollections('content_text')).toEqual(['content_text']);
    });
  });

  describe('deepClone', () => {
    it('clones primitive values', () => {
      expect(deepClone('test')).toBe('test');
      expect(deepClone(123)).toBe(123);
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });

    it('clones simple objects', () => {
      const obj = { a: 1, b: 'test', c: true };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it('clones nested objects', () => {
      const obj = {
        a: 1,
        b: {
          c: 2,
          d: {
            e: 3
          }
        }
      };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
      expect(cloned.b.d).not.toBe(obj.b.d);
    });

    it('clones arrays', () => {
      const arr = [1, 2, 3, { a: 4 }];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[3]).not.toBe(arr[3]);
    });

    it('clones complex structures', () => {
      const complex = {
        id: 1,
        items: [
          { id: 1, title: 'First' },
          { id: 2, title: 'Second', nested: { data: [1, 2, 3] } }
        ],
        meta: {
          total: 2,
          flags: {
            active: true,
            tags: ['a', 'b', 'c']
          }
        }
      };
      const cloned = deepClone(complex);
      expect(cloned).toEqual(complex);
      expect(cloned).not.toBe(complex);
      expect(cloned.items).not.toBe(complex.items);
      expect(cloned.items[1].nested).not.toBe(complex.items[1].nested);
      expect(cloned.meta.flags.tags).not.toBe(complex.meta.flags.tags);
    });
  });
});