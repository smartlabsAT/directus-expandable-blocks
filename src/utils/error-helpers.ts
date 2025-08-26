/**
 * Error helper utilities for consistent error handling and user-friendly messages
 */

import { logError } from './logger-wrapper';
import type { NotificationsStore } from './notifications';
import { notifyError } from './notifications';

/**
 * Error types that we handle differently
 */
export enum ErrorType {
  PERMISSION = 'permission',
  NOT_FOUND = 'not_found',
  SERVER = 'server',
  NETWORK = 'network',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

/**
 * Determine the type of error based on response
 */
export function getErrorType(error: any): ErrorType {
  if (!error.response) {
    return ErrorType.NETWORK;
  }
  
  const status = error.response.status;
  
  if (status === 403 || status === 401) {
    return ErrorType.PERMISSION;
  }
  
  if (status === 404) {
    return ErrorType.NOT_FOUND;
  }
  
  if (status >= 500) {
    return ErrorType.SERVER;
  }
  
  if (status === 400 || status === 422) {
    return ErrorType.VALIDATION;
  }
  
  return ErrorType.UNKNOWN;
}

/**
 * Get a user-friendly error message based on error type
 */
export function getUserFriendlyErrorMessage(
  error: any,
  context: 'load' | 'save' | 'delete' | 'search' = 'load'
): string {
  const errorType = getErrorType(error);
  
  // Check for specific error messages from API
  if (error.response?.data?.errors?.[0]?.message) {
    return error.response.data.errors[0].message;
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  // Generate message based on error type and context
  const messages = {
    load: {
      [ErrorType.PERMISSION]: 'Sie haben keine Berechtigung, diese Daten anzuzeigen.',
      [ErrorType.NOT_FOUND]: 'Die angeforderten Daten wurden nicht gefunden.',
      [ErrorType.SERVER]: 'Ein Serverfehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
      [ErrorType.NETWORK]: 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.',
      [ErrorType.VALIDATION]: 'Die Anfrage enthält ungültige Parameter.',
      [ErrorType.UNKNOWN]: 'Ein unerwarteter Fehler ist aufgetreten.'
    },
    save: {
      [ErrorType.PERMISSION]: 'Sie haben keine Berechtigung, diese Änderungen zu speichern.',
      [ErrorType.NOT_FOUND]: 'Das zu aktualisierende Element wurde nicht gefunden.',
      [ErrorType.SERVER]: 'Speichern fehlgeschlagen. Der Server ist momentan nicht verfügbar.',
      [ErrorType.NETWORK]: 'Speichern fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.',
      [ErrorType.VALIDATION]: 'Die Daten konnten nicht gespeichert werden. Bitte überprüfen Sie Ihre Eingaben.',
      [ErrorType.UNKNOWN]: 'Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.'
    },
    delete: {
      [ErrorType.PERMISSION]: 'Sie haben keine Berechtigung, dieses Element zu löschen.',
      [ErrorType.NOT_FOUND]: 'Das zu löschende Element wurde nicht gefunden.',
      [ErrorType.SERVER]: 'Löschen fehlgeschlagen. Der Server ist momentan nicht verfügbar.',
      [ErrorType.NETWORK]: 'Löschen fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.',
      [ErrorType.VALIDATION]: 'Das Element kann nicht gelöscht werden. Es wird möglicherweise noch verwendet.',
      [ErrorType.UNKNOWN]: 'Löschen fehlgeschlagen. Bitte versuchen Sie es erneut.'
    },
    search: {
      [ErrorType.PERMISSION]: 'Sie haben keine Berechtigung, in dieser Collection zu suchen.',
      [ErrorType.NOT_FOUND]: 'Die Collection für die Suche wurde nicht gefunden.',
      [ErrorType.SERVER]: 'Die Suche ist momentan nicht verfügbar. Bitte versuchen Sie es später erneut.',
      [ErrorType.NETWORK]: 'Suche fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.',
      [ErrorType.VALIDATION]: 'Ungültige Suchparameter.',
      [ErrorType.UNKNOWN]: 'Suche fehlgeschlagen. Bitte versuchen Sie es erneut.'
    }
  };
  
  return messages[context][errorType] || messages[context][ErrorType.UNKNOWN];
}

/**
 * Handle an error with logging and optional notification
 */
export function handleApiError(
  error: any,
  context: 'load' | 'save' | 'delete' | 'search' = 'load',
  options: {
    notificationsStore?: NotificationsStore | null;
    showNotification?: boolean;
    logContext?: Record<string, any>;
  } = {}
): string {
  const { notificationsStore = null, showNotification = false, logContext = {} } = options;
  
  // Log the error
  logError(`API Error during ${context}`, error, logContext);
  
  // Get user-friendly message
  const userMessage = getUserFriendlyErrorMessage(error, context);
  
  // Show notification if requested
  if (showNotification && notificationsStore) {
    const title = context === 'load' ? 'Fehler beim Laden' :
                  context === 'save' ? 'Fehler beim Speichern' :
                  context === 'delete' ? 'Fehler beim Löschen' :
                  'Fehler bei der Suche';
                  
    notifyError(title, userMessage, notificationsStore);
  }
  
  return userMessage;
}

/**
 * Create a retry-able request with exponential backoff
 */
export async function retryWithBackoff<T>(
  request: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => getErrorType(error) === ErrorType.NETWORK || getErrorType(error) === ErrorType.SERVER
  } = options;
  
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}