import { describe, it, expect } from 'vitest';
import {
  isValidPrimaryKey,
  isItemObject,
  isNotNullish,
  isTemporaryId,
  isValidCollection,
  isValidM2AField
} from '../../../src/utils/validation';

describe('validation', () => {
  describe('isValidPrimaryKey', () => {
    it('validates numeric primary keys', () => {
      expect(isValidPrimaryKey(123)).toBe(true);
      expect(isValidPrimaryKey(0)).toBe(false); // 0 is falsy
      expect(isValidPrimaryKey(999999)).toBe(true);
    });

    it('validates string primary keys', () => {
      expect(isValidPrimaryKey('123')).toBe(true);
      expect(isValidPrimaryKey('uuid-string')).toBe(true);
      expect(isValidPrimaryKey('custom-key')).toBe(true);
    });

    it('validates numeric string primary keys', () => {
      expect(isValidPrimaryKey('456')).toBe(true);
      expect(isValidPrimaryKey('0')).toBe(true); // '0' is truthy as a string
    });

    it('invalidates undefined', () => {
      expect(isValidPrimaryKey(undefined)).toBe(false);
    });

    it('invalidates empty string', () => {
      expect(isValidPrimaryKey('')).toBe(false);
    });

    it('invalidates null when passed as any', () => {
      expect(isValidPrimaryKey(null as any)).toBe(false);
    });
  });

  describe('isItemObject', () => {
    it('validates plain objects', () => {
      expect(isItemObject({})).toBe(true);
      expect(isItemObject({ id: 1 })).toBe(true);
      expect(isItemObject({ title: 'Test', nested: { value: 1 } })).toBe(true);
    });

    it('validates arrays as objects', () => {
      expect(isItemObject([])).toBe(true); // Arrays are objects in JS
      expect(isItemObject([1, 2, 3])).toBe(true); // Arrays are objects in JS
    });

    it('invalidates primitives', () => {
      expect(isItemObject(123)).toBe(false);
      expect(isItemObject('string')).toBe(false);
      expect(isItemObject(true)).toBe(false);
    });

    it('invalidates null and undefined', () => {
      expect(isItemObject(null)).toBe(false);
      expect(isItemObject(undefined)).toBe(false);
    });

    it('invalidates functions', () => {
      expect(isItemObject(() => {})).toBe(false);
      expect(isItemObject(function() {})).toBe(false);
    });

    it('validates class instances as objects', () => {
      class TestClass {}
      expect(isItemObject(new TestClass())).toBe(true); // Class instances are objects
    });

    it('validates objects with null prototype', () => {
      const obj = Object.create(null);
      obj.test = 'value';
      expect(isItemObject(obj)).toBe(true);
    });
  });

  describe('isNotNullish', () => {
    it('returns true for defined values', () => {
      expect(isNotNullish(0)).toBe(true);
      expect(isNotNullish('')).toBe(true);
      expect(isNotNullish(false)).toBe(true);
      expect(isNotNullish([])).toBe(true);
      expect(isNotNullish({})).toBe(true);
    });

    it('returns false for null', () => {
      expect(isNotNullish(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isNotNullish(undefined)).toBe(false);
    });

    it('preserves type information', () => {
      const value: string | null | undefined = 'test';
      if (isNotNullish(value)) {
        // TypeScript should know value is string here
        expect(value.length).toBe(4);
      }
    });
  });

  describe('isTemporaryId', () => {
    it('identifies temporary IDs with new_ prefix', () => {
      expect(isTemporaryId('new_123')).toBe(true);
      expect(isTemporaryId('new_abc')).toBe(true);
      expect(isTemporaryId('new_')).toBe(true);
    });

    it('identifies temporary IDs with temp_ prefix', () => {
      expect(isTemporaryId('temp_123')).toBe(true);
      expect(isTemporaryId('temp_abc')).toBe(true);
      expect(isTemporaryId('temp_')).toBe(true);
    });

    it('identifies temporary IDs with dup_ prefix', () => {
      expect(isTemporaryId('dup_123')).toBe(true);
      expect(isTemporaryId('dup_abc')).toBe(true);
      expect(isTemporaryId('dup_')).toBe(true);
    });

    it('returns false for permanent numeric IDs', () => {
      expect(isTemporaryId(123)).toBe(false);
      expect(isTemporaryId(0)).toBe(true); // 0 is falsy
      expect(isTemporaryId(-1)).toBe(false);
    });

    it('returns false for permanent string IDs', () => {
      expect(isTemporaryId('123')).toBe(false);
      expect(isTemporaryId('uuid-123')).toBe(false);
      expect(isTemporaryId('permanent')).toBe(false);
    });

    it('returns true for undefined', () => {
      expect(isTemporaryId(undefined)).toBe(true);
    });

    it('returns true for empty string', () => {
      expect(isTemporaryId('')).toBe(true);
    });

    it('is case sensitive', () => {
      expect(isTemporaryId('NEW_123')).toBe(false);
      expect(isTemporaryId('TEMP_123')).toBe(false);
      expect(isTemporaryId('DUP_123')).toBe(false);
    });
  });

  describe('isValidCollection', () => {
    it('validates non-empty strings', () => {
      expect(isValidCollection('content_text')).toBe(true);
      expect(isValidCollection('pages')).toBe(true);
      expect(isValidCollection('a')).toBe(true);
    });

    it('invalidates empty string', () => {
      expect(isValidCollection('')).toBe(false);
    });

    it('invalidates undefined', () => {
      expect(isValidCollection(undefined)).toBe(false);
    });

    it('invalidates non-string values when passed as any', () => {
      expect(isValidCollection(123 as any)).toBe(false);
      expect(isValidCollection(null as any)).toBe(false);
      expect(isValidCollection({} as any)).toBe(false);
    });

    it('validates collections with special characters', () => {
      expect(isValidCollection('content-text')).toBe(true);
      expect(isValidCollection('content_text_v2')).toBe(true);
      expect(isValidCollection('content.text')).toBe(true);
    });

    it('provides type guard', () => {
      const collection: string | undefined = 'test';
      if (isValidCollection(collection)) {
        // TypeScript should know collection is string here
        expect(collection.length).toBe(4);
      }
    });
  });

  describe('isValidM2AField', () => {
    it('validates basic M2A field structure', () => {
      const field = {
        collection: 'pages_content_blocks',
        field: 'item',
        related_collection: null
      };
      expect(isValidM2AField(field)).toBe(true);
    });

    it('validates M2A field with minimal structure', () => {
      const field = {
        field: 'item'
      };
      expect(isValidM2AField(field)).toBe(true);
    });

    it('validates M2A field with additional properties', () => {
      const field = {
        field: 'content',
        collection: 'junction_table',
        meta: {
          one_allowed_collections: ['content_text']
        }
      };
      expect(isValidM2AField(field)).toBe(true);
    });

    it('invalidates field without field property', () => {
      const field = {
        collection: 'junction_table',
        related_collection: null
      };
      expect(isValidM2AField(field)).toBe(false);
    });

    it('invalidates field with empty field property', () => {
      const field = {
        field: '',
        collection: 'junction_table'
      };
      expect(isValidM2AField(field)).toBe(false);
    });

    it('invalidates field with non-string field property', () => {
      const field = {
        field: 123,
        collection: 'junction_table'
      };
      expect(isValidM2AField(field)).toBe(false);
    });

    it('invalidates non-object fields', () => {
      expect(isValidM2AField(null)).toBeFalsy();
      expect(isValidM2AField(undefined)).toBeFalsy();
      expect(isValidM2AField('field')).toBeFalsy();
      expect(isValidM2AField(123)).toBeFalsy();
      expect(isValidM2AField([])).toBeFalsy();
    });

    it('validates field with long field name', () => {
      const field = {
        field: 'very_long_field_name_for_content_items'
      };
      expect(isValidM2AField(field)).toBe(true);
    });
  });
});