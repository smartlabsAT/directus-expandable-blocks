/**
 * Directus API Helpers for E2E Testing
 * Provides Admin and Editor API contexts with proper authentication
 */

import { APIRequestContext, BrowserContext, Page } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// DIRECTUS_URL may be a full URL ("http://localhost:8058") or a bare host
// ("backend.smartlabs.dev"). Bare hosts default to https for backwards compatibility.
function resolveBaseURL(): string {
  const url = process.env.DIRECTUS_URL ?? '';
  return url.includes('://') ? url : `https://${url}`;
}

export interface DirectusUser {
  role: 'admin' | 'editor';
  token: string;
  baseURL: string;
}

/**
 * Get Admin API context for test setup/teardown
 */
export function getAdminUser(): DirectusUser {
  const token = process.env.DIRECTUS_API_TOKEN_ADMIN;
  if (!token) {
    throw new Error('DIRECTUS_API_TOKEN_ADMIN not found in environment variables');
  }
  
  return {
    role: 'admin',
    token,
    baseURL: resolveBaseURL()
  };
}

/**
 * Get Editor API context for permission testing
 */
export function getEditorUser(): DirectusUser {
  const token = process.env.DIRECTUS_API_TOKEN_EDITOR;
  if (!token) {
    throw new Error('DIRECTUS_API_TOKEN_EDITOR not found in environment variables');
  }
  
  return {
    role: 'editor',
    token,
    baseURL: resolveBaseURL()
  };
}

/**
 * Create authenticated API request context
 */
export async function createAPIContext(user: DirectusUser, requestContext: APIRequestContext): Promise<APIRequestContext> {
  return requestContext.newContext({
    baseURL: user.baseURL,
    extraHTTPHeaders: {
      'Authorization': `Bearer ${user.token}`,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Simple API request helper - alternative to createAPIContext
 */
export function getAPIHeaders(user: DirectusUser): Record<string, string> {
  return {
    'Authorization': `Bearer ${user.token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Test current user's permissions and identity
 */
export async function testUserAccess(api: APIRequestContext): Promise<any> {
  const response = await api.get('/users/me');
  
  if (!response.ok()) {
    throw new Error(`Failed to get user info: ${response.status()} ${response.statusText()}`);
  }
  
  return response.json();
}

/**
 * Create a test collection for testing
 */
export async function createTestCollection(api: APIRequestContext, collectionName: string): Promise<any> {
  const collectionData = {
    collection: collectionName,
    meta: {
      collection: collectionName,
      note: 'Test collection for E2E tests',
      hidden: false,
      singleton: false,
      icon: 'article',
      translations: [
        {
          language: 'en-US',
          translation: `Test ${collectionName}`,
          singular: `Test ${collectionName.slice(0, -1)}`,
          plural: `Test ${collectionName}`
        }
      ]
    },
    schema: {
      name: collectionName
    },
    fields: [
      {
        field: 'id',
        type: 'integer',
        meta: {
          hidden: true,
          interface: 'input',
          readonly: true
        },
        schema: {
          is_primary_key: true,
          has_auto_increment: true
        }
      },
      {
        field: 'title',
        type: 'string',
        meta: {
          interface: 'input',
          required: true,
          options: {
            placeholder: 'Enter title...'
          }
        },
        schema: {
          default_value: null,
          is_nullable: false
        }
      },
      {
        field: 'content',
        type: 'text',
        meta: {
          interface: 'input-multiline',
          options: {
            placeholder: 'Enter content...'
          }
        },
        schema: {
          default_value: null,
          is_nullable: true
        }
      },
      {
        field: 'status',
        type: 'string',
        meta: {
          interface: 'select-dropdown',
          options: {
            choices: [
              { text: 'Draft', value: 'draft' },
              { text: 'Published', value: 'published' }
            ]
          }
        },
        schema: {
          default_value: 'draft',
          is_nullable: false
        }
      }
    ]
  };

  const response = await api.post('/collections', {
    data: collectionData
  });

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Failed to create collection: ${response.status()} ${error}`);
  }

  return response.json();
}

/**
 * Delete a test collection
 */
export async function deleteTestCollection(api: APIRequestContext, collectionName: string): Promise<void> {
  const response = await api.delete(`/collections/${collectionName}`);
  
  if (!response.ok() && response.status() !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete collection: ${response.status()} ${error}`);
  }
}

/**
 * Create test items in a collection
 */
export async function createTestItems(api: APIRequestContext, collectionName: string, items: any[]): Promise<any> {
  const response = await api.post(`/items/${collectionName}`, {
    data: items
  });

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Failed to create items: ${response.status()} ${error}`);
  }

  return response.json();
}

/**
 * Login admin via API and attach the session cookie to the browser context.
 * Bearer tokens cannot drive the Directus admin SPA (it reads from cookies/localStorage),
 * so UI tests must establish a real session.
 */
export async function loginAdminUI(page: Page, request: APIRequestContext): Promise<void> {
  const email = process.env.DIRECTUS_ADMIN_EMAIL;
  const password = process.env.DIRECTUS_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('DIRECTUS_ADMIN_EMAIL or DIRECTUS_ADMIN_PASSWORD missing in environment');
  }

  const baseURL = resolveBaseURL();
  const response = await request.post(`${baseURL}/auth/login`, {
    data: { email, password, mode: 'session' },
  });
  if (!response.ok()) {
    throw new Error(`Admin login failed: ${response.status()} ${await response.text()}`);
  }

  const setCookie = response.headers()['set-cookie'] ?? '';
  const match = setCookie.match(/directus_session_token=([^;]+)/);
  if (!match) {
    throw new Error('directus_session_token cookie not found in login response');
  }

  const url = new URL(baseURL);
  await (page.context() as BrowserContext).addCookies([
    {
      name: 'directus_session_token',
      value: match[1],
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Get all items from a collection
 */
export async function getItems(api: APIRequestContext, collectionName: string): Promise<any> {
  const response = await api.get(`/items/${collectionName}`);

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Failed to get items: ${response.status()} ${error}`);
  }

  return response.json();
}