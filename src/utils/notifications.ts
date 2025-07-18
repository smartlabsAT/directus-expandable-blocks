/**
 * Notification utilities for the expandable blocks extension
 * 
 * This module provides a centralized notification system that integrates
 * with Directus notifications store when available.
 */

import { logWarn } from './logger-wrapper';

export type NotificationType = 'success' | 'warning' | 'error' | 'info';

export interface NotificationOptions {
  title: string;
  text?: string;
  type?: NotificationType;
  persist?: boolean;
  closeable?: boolean;
}

export interface NotificationsStore {
  add: (notification: NotificationOptions) => void;
}

/**
 * Send a notification to the user
 * @param notification - The notification to display
 * @param notificationsStore - The Directus notifications store instance
 */
export function notify(
  notification: NotificationOptions,
  notificationsStore: NotificationsStore | null
): void {
  const { title, text = '', type = 'info' } = notification;
  
  if (notificationsStore && typeof notificationsStore.add === 'function') {
    notificationsStore.add(notification);
  } else {
    logWarn('Notifications store not available', { title, text, type });
  }
}

/**
 * Send a success notification
 */
export function notifySuccess(
  title: string,
  text?: string,
  notificationsStore: NotificationsStore | null = null
): void {
  notify({ title, text, type: 'success' }, notificationsStore);
}

/**
 * Send an error notification
 */
export function notifyError(
  title: string,
  text?: string,
  notificationsStore: NotificationsStore | null = null
): void {
  notify({ title, text, type: 'error' }, notificationsStore);
}

/**
 * Send a warning notification
 */
export function notifyWarning(
  title: string,
  text?: string,
  notificationsStore: NotificationsStore | null = null
): void {
  notify({ title, text, type: 'warning' }, notificationsStore);
}

/**
 * Send an info notification
 */
export function notifyInfo(
  title: string,
  text?: string,
  notificationsStore: NotificationsStore | null = null
): void {
  notify({ title, text, type: 'info' }, notificationsStore);
}

/**
 * Create notification helpers bound to a specific notifications store
 * This is useful for composables that have access to the notifications store
 */
export function createNotificationHelpers(notificationsStore: NotificationsStore | null) {
  return {
    notify: (notification: NotificationOptions) => notify(notification, notificationsStore),
    notifySuccess: (title: string, text?: string) => notifySuccess(title, text, notificationsStore),
    notifyError: (title: string, text?: string) => notifyError(title, text, notificationsStore),
    notifyWarning: (title: string, text?: string) => notifyWarning(title, text, notificationsStore),
    notifyInfo: (title: string, text?: string) => notifyInfo(title, text, notificationsStore),
  };
}