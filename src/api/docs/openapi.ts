/**
 * OpenAPI 3.0 specification for Expandable Blocks API
 */

export const openAPISpec = {
  openapi: '3.0.3',
  info: {
    title: 'Expandable Blocks API',
    version: '1.0.0',
    description: 'API for managing M2A relationships with inline expandable editing capabilities in Directus',
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: '/expandable-blocks-api',
      description: 'Production server'
    }
  ],
  tags: [
    {
      name: 'metadata',
      description: 'Collection metadata operations'
    },
    {
      name: 'search',
      description: 'Item search operations'
    },
    {
      name: 'detail',
      description: 'Item detail operations with usage information'
    }
  ],
  paths: {
    '/{collection}/metadata': {
      get: {
        tags: ['metadata'],
        summary: 'Get collection metadata',
        description: 'Returns metadata about a collection including possible usage locations, searchable fields, and translation information',
        operationId: 'getCollectionMetadata',
        parameters: [
          {
            name: 'collection',
            in: 'path',
            required: true,
            description: 'Collection name',
            schema: {
              type: 'string',
              pattern: '^[a-zA-Z][a-zA-Z0-9_]*$',
              minLength: 1,
              maxLength: 64
            }
          },
          {
            name: 'x-cache-enabled',
            in: 'header',
            required: false,
            description: 'Enable/disable caching for this request',
            schema: {
              type: 'string',
              enum: ['true', 'false'],
              default: 'true'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MetadataResponse'
                }
              }
            }
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError'
          },
          '500': {
            $ref: '#/components/responses/InternalError'
          }
        }
      }
    },
    '/{collection}/search': {
      get: {
        tags: ['search'],
        summary: 'Search collection items',
        description: 'Search and retrieve items from a collection with optional filtering, sorting, and pagination',
        operationId: 'searchCollectionItems',
        parameters: [
          {
            name: 'collection',
            in: 'path',
            required: true,
            description: 'Collection name',
            schema: {
              type: 'string',
              pattern: '^[a-zA-Z][a-zA-Z0-9_]*$',
              minLength: 1,
              maxLength: 64
            }
          },
          {
            name: 'search',
            in: 'query',
            required: false,
            description: 'Search query string',
            schema: {
              type: 'string'
            }
          },
          {
            name: 'filter',
            in: 'query',
            required: false,
            description: 'Filter object (JSON string)',
            schema: {
              type: 'string'
            }
          },
          {
            name: 'fields',
            in: 'query',
            required: false,
            description: 'Fields to return (comma-separated or array)',
            schema: {
              oneOf: [
                {
                  type: 'string',
                  default: '*'
                },
                {
                  type: 'array',
                  items: {
                    type: 'string'
                  }
                }
              ]
            }
          },
          {
            name: 'sort',
            in: 'query',
            required: false,
            description: 'Sort fields (comma-separated, prefix with - for descending)',
            schema: {
              type: 'string'
            }
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Maximum number of items to return',
            schema: {
              type: 'integer',
              minimum: -1,
              maximum: 1000,
              default: 10
            }
          },
          {
            name: 'offset',
            in: 'query',
            required: false,
            description: 'Number of items to skip',
            schema: {
              type: 'integer',
              minimum: 0,
              default: 0
            }
          },
          {
            name: 'x-cache-enabled',
            in: 'header',
            required: false,
            description: 'Enable/disable caching for this request',
            schema: {
              type: 'string',
              enum: ['true', 'false'],
              default: 'true'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SearchResponse'
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/ValidationError'
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError'
          },
          '500': {
            $ref: '#/components/responses/InternalError'
          }
        }
      }
    },
    '/{collection}/detail': {
      post: {
        tags: ['detail'],
        summary: 'Get item details with usage information',
        description: 'Retrieve detailed information about specific items including their usage locations',
        operationId: 'getItemDetails',
        parameters: [
          {
            name: 'collection',
            in: 'path',
            required: true,
            description: 'Collection name',
            schema: {
              type: 'string',
              pattern: '^[a-zA-Z][a-zA-Z0-9_]*$',
              minLength: 1,
              maxLength: 64
            }
          },
          {
            name: 'x-cache-enabled',
            in: 'header',
            required: false,
            description: 'Enable/disable caching for this request',
            schema: {
              type: 'string',
              enum: ['true', 'false'],
              default: 'true'
            }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DetailRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DetailResponse'
                }
              }
            }
          },
          '400': {
            $ref: '#/components/responses/ValidationError'
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError'
          },
          '500': {
            $ref: '#/components/responses/InternalError'
          }
        }
      }
    }
  },
  components: {
    schemas: {
      MetadataResponse: {
        type: 'object',
        required: ['collection', 'possibleLocations', 'searchableFields', 'translationInfo', 'collectionMetadata', 'cached_at'],
        properties: {
          collection: {
            type: 'string',
            description: 'Collection name'
          },
          possibleLocations: {
            type: 'array',
            description: 'Possible usage locations for items in this collection',
            items: {
              $ref: '#/components/schemas/PossibleLocation'
            }
          },
          searchableFields: {
            type: 'array',
            description: 'Fields that can be searched',
            items: {
              $ref: '#/components/schemas/SearchableField'
            }
          },
          translationInfo: {
            type: 'object',
            properties: {
              hasTranslations: {
                type: 'boolean'
              }
            }
          },
          collectionMetadata: {
            type: 'object',
            properties: {
              totalFields: {
                type: 'integer'
              },
              translatableCount: {
                type: 'integer'
              },
              systemFieldsCount: {
                type: 'integer'
              }
            }
          },
          cached_at: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when data was cached'
          }
        }
      },
      PossibleLocation: {
        type: 'object',
        properties: {
          collection: {
            type: 'string'
          },
          collection_name: {
            type: 'string'
          },
          collection_icon: {
            type: 'string'
          },
          fields: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          relation_details: {
            type: 'array',
            items: {
              type: 'object'
            }
          }
        }
      },
      SearchableField: {
        type: 'object',
        properties: {
          field: {
            type: 'string'
          },
          field_name: {
            type: 'string'
          },
          type: {
            type: 'string'
          }
        }
      },
      SearchResponse: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: {
            type: 'array',
            description: 'Array of items',
            items: {
              type: 'object'
            }
          },
          meta: {
            $ref: '#/components/schemas/SearchMeta'
          }
        }
      },
      SearchMeta: {
        type: 'object',
        required: ['total_count', 'filter_count', 'limit', 'offset'],
        properties: {
          total_count: {
            type: 'integer',
            description: 'Total number of items in collection'
          },
          filter_count: {
            type: 'integer',
            description: 'Number of items matching filter'
          },
          limit: {
            type: 'integer',
            description: 'Maximum items per page'
          },
          offset: {
            type: 'integer',
            description: 'Number of items skipped'
          },
          page: {
            type: 'integer',
            description: 'Current page number'
          },
          page_count: {
            type: 'integer',
            description: 'Total number of pages'
          }
        }
      },
      DetailRequest: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: {
            type: 'array',
            description: 'Array of item IDs to retrieve',
            items: {
              oneOf: [
                {
                  type: 'string'
                },
                {
                  type: 'integer'
                }
              ]
            },
            minItems: 1,
            maxItems: 100
          },
          fields: {
            oneOf: [
              {
                type: 'string',
                description: 'Comma-separated list of fields or "*" for all',
                default: '*'
              },
              {
                type: 'array',
                items: {
                  type: 'string'
                }
              }
            ]
          }
        }
      },
      DetailResponse: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/DetailItem'
            }
          }
        }
      },
      DetailItem: {
        type: 'object',
        properties: {
          id: {
            oneOf: [
              {
                type: 'string'
              },
              {
                type: 'integer'
              }
            ]
          },
          usage_locations: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/UsageLocation'
            }
          },
          usage_summary: {
            $ref: '#/components/schemas/UsageSummary'
          },
          _no_permission: {
            type: 'boolean',
            description: 'Indicates if user lacks permission to view full item details'
          }
        }
      },
      UsageLocation: {
        type: 'object',
        properties: {
          id: {
            oneOf: [
              {
                type: 'string'
              },
              {
                type: 'integer'
              }
            ]
          },
          collection: {
            type: 'string'
          },
          collection_display: {
            type: 'string'
          },
          title: {
            type: 'string'
          },
          status: {
            type: 'string',
            nullable: true
          },
          field: {
            type: 'string'
          },
          field_display: {
            type: 'string'
          },
          sort: {
            type: 'integer',
            nullable: true
          },
          path: {
            type: 'array',
            nullable: true,
            items: {
              type: 'object'
            }
          },
          edit_url: {
            type: 'string'
          }
        }
      },
      UsageSummary: {
        type: 'object',
        properties: {
          total_count: {
            type: 'integer'
          },
          by_collection: {
            type: 'object',
            additionalProperties: {
              type: 'integer'
            }
          },
          by_status: {
            type: 'object',
            additionalProperties: {
              type: 'integer'
            }
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        required: ['errors'],
        properties: {
          errors: {
            type: 'array',
            items: {
              type: 'object',
              required: ['message', 'extensions'],
              properties: {
                message: {
                  type: 'string',
                  description: 'Human-readable error message'
                },
                extensions: {
                  type: 'object',
                  required: ['code'],
                  properties: {
                    code: {
                      type: 'string',
                      description: 'Error code',
                      enum: [
                        'VALIDATION_ERROR',
                        'INVALID_PAYLOAD',
                        'FORBIDDEN',
                        'INTERNAL_SERVER_ERROR'
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    responses: {
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            },
            example: {
              errors: [{
                message: 'ids: At least one ID is required',
                extensions: {
                  code: 'VALIDATION_ERROR'
                }
              }]
            }
          }
        }
      },
      ForbiddenError: {
        description: 'Permission denied',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            },
            example: {
              errors: [{
                message: 'You do not have permission to access this resource',
                extensions: {
                  code: 'FORBIDDEN'
                }
              }]
            }
          }
        }
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            },
            example: {
              errors: [{
                message: 'An unexpected error occurred',
                extensions: {
                  code: 'INTERNAL_SERVER_ERROR'
                }
              }]
            }
          }
        }
      }
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'directus_session_token'
      }
    }
  },
  security: [
    {
      bearerAuth: []
    },
    {
      cookieAuth: []
    }
  ]
};