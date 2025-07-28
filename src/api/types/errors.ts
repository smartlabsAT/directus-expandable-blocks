export class RelationAnalyzerError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'RelationAnalyzerError';
  }
}

export class InvalidCollectionError extends RelationAnalyzerError {
  constructor(collection: string) {
    super(`Invalid collection: ${collection}`, 'INVALID_COLLECTION');
  }
}

export class DatabaseQueryError extends RelationAnalyzerError {
  constructor(message: string, public query?: string) {
    super(message, 'DATABASE_QUERY_ERROR');
  }
}