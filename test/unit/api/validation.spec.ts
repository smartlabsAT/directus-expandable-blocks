import { describe, it, expect } from 'vitest';
import { 
  validateCollection, 
  validateIds,
  validateFields,
  validateFilter,
  validateSort,
  validatePagination
} from '../../../src/api/utils/validation';
import { ValidationError } from '../../../src/api/errors';

describe('API Validation', () => {
  describe('validateCollection', () => {
    it('should accept valid collection names', () => {
      expect(() => validateCollection('test_collection')).not.toThrow();
      expect(() => validateCollection('users')).not.toThrow();
      expect(() => validateCollection('page_blocks')).not.toThrow();
    });

    it('should throw for invalid collection names', () => {
      expect(() => validateCollection('')).toThrow(ValidationError);
      expect(() => validateCollection(null as any)).toThrow(ValidationError);
      expect(() => validateCollection('123-invalid')).toThrow(ValidationError);
      expect(() => validateCollection('invalid space')).toThrow(ValidationError);
    });

    it('should throw for SQL injection attempts', () => {
      expect(() => validateCollection('users; DROP TABLE')).toThrow(ValidationError);
      expect(() => validateCollection("users' OR 1=1")).toThrow(ValidationError);
    });
  });

  describe('validateIds', () => {
    it('should accept valid ID arrays', () => {
      expect(validateIds([1, 2, 3])).toEqual([1, 2, 3]);
      expect(validateIds(['uuid-123', 'uuid-456'])).toEqual(['uuid-123', 'uuid-456']);
      expect(validateIds([1, 'uuid-123'])).toEqual([1, 'uuid-123']);
    });

    it('should throw for invalid inputs', () => {
      expect(() => validateIds([])).toThrow(ValidationError);
      expect(() => validateIds(null as any)).toThrow(ValidationError);
      expect(() => validateIds('not-array' as any)).toThrow(ValidationError);
    });

    it('should throw for too many IDs', () => {
      const tooManyIds = Array.from({ length: 1001 }, (_, i) => i + 1);
      expect(() => validateIds(tooManyIds)).toThrow(ValidationError);
    });

    it('should validate numeric IDs', () => {
      expect(validateIds([1, 2, 3])).toEqual([1, 2, 3]);
      expect(() => validateIds([0, -1])).toThrow(ValidationError);
    });
  });

  describe('validateFields', () => {
    it('should accept valid field arrays', () => {
      expect(validateFields(['id', 'title', 'status'])).toEqual(['id', 'title', 'status']);
      expect(validateFields('*')).toEqual(['*']);
    });

    it('should handle string input', () => {
      expect(validateFields('id,title,status')).toEqual(['id', 'title', 'status']);
    });

    it('should accept nested fields', () => {
      expect(validateFields(['author.name', 'author.email'])).toEqual(['author.name', 'author.email']);
    });

    it('should throw for invalid field names', () => {
      expect(() => validateFields(['invalid field'])).toThrow(ValidationError);
      expect(() => validateFields(['123invalid'])).toThrow(ValidationError);
    });
  });

  describe('validatePagination', () => {
    it('should validate limit and offset', () => {
      const result = validatePagination(25, 50);
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(50);
    });

    it('should apply default values', () => {
      const result = validatePagination(undefined, undefined);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('should enforce limit boundaries', () => {
      const result1 = validatePagination(0, 0);
      expect(result1.limit).toBe(0);
      
      expect(() => validatePagination(10000, 0)).toThrow(ValidationError);
    });

    it('should handle string inputs', () => {
      const result = validatePagination('25', '100');
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(100);
    });

    it('should handle invalid inputs', () => {
      expect(() => validatePagination('invalid', null)).toThrow(ValidationError);
      expect(() => validatePagination(null, 'invalid')).toThrow(ValidationError);
    });
  });

  describe('validateSort', () => {
    it('should parse simple sort fields', () => {
      const result = validateSort('title');
      expect(result).toEqual(['title']);
    });

    it('should handle descending sort', () => {
      const result = validateSort('-created_at');
      expect(result).toEqual(['-created_at']);
    });

    it('should handle multiple sort fields', () => {
      const result = validateSort(['status', '-created_at']);
      expect(result).toEqual(['status', '-created_at']);
    });

    it('should handle comma-separated strings', () => {
      const result = validateSort('title,-date,status');
      expect(result).toEqual(['title', '-date', 'status']);
    });

    it('should return undefined for no input', () => {
      expect(validateSort(null)).toBeUndefined();
      expect(validateSort(undefined)).toBeUndefined();
      expect(validateSort('')).toBeUndefined();
    });

    it('should throw for invalid field names', () => {
      expect(() => validateSort(['valid_field', 'invalid field'])).toThrow(ValidationError);
    });
  });

  describe('validateFilter', () => {
    it('should accept valid filter objects', () => {
      const filter = { status: { _eq: 'published' } };
      expect(validateFilter(filter)).toEqual(filter);
    });

    it('should parse JSON string filters', () => {
      const filter = { title: { _contains: 'test' } };
      expect(validateFilter(JSON.stringify(filter))).toEqual(filter);
    });

    it('should return undefined for no filter', () => {
      expect(validateFilter(null)).toBeUndefined();
      expect(validateFilter(undefined)).toBeUndefined();
    });

    it('should throw for invalid JSON', () => {
      expect(() => validateFilter('invalid json')).toThrow(ValidationError);
    });
  });
});