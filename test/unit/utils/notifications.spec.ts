import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  notify, 
  notifySuccess, 
  notifyError, 
  notifyWarning, 
  notifyInfo,
  createNotificationHelpers,
  type NotificationsStore,
  type NotificationOptions 
} from '@/utils/notifications';

// Mock logger-wrapper
vi.mock('@/utils/logger-wrapper', () => ({
  logWarn: vi.fn()
}));

describe('notifications', () => {
  let mockNotificationsStore: NotificationsStore;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationsStore = {
      add: vi.fn()
    };
  });

  describe('notify', () => {
    it('creates a notification with title only', () => {
      notify({ title: 'Test Notification' }, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Test Notification'
      });
    });

    it('creates a notification with all options', () => {
      const options: NotificationOptions = {
        title: 'Complete Notification',
        text: 'This is the notification text',
        type: 'success',
        persist: true,
        closeable: false
      };
      
      notify(options, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith(options);
    });

    it('defaults type to info when not specified', () => {
      notify({ title: 'Default type' }, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Default type'
      });
    });

    it('logs warning when notifications store is null', async () => {
      const { logWarn } = vi.mocked(await import('@/utils/logger-wrapper'));
      
      notify({ title: 'Test', text: 'Message' }, null);
      
      expect(logWarn).toHaveBeenCalledWith('Notifications store not available', {
        title: 'Test',
        text: 'Message',
        type: 'info'
      });
      expect(mockNotificationsStore.add).not.toHaveBeenCalled();
    });

    it('logs warning when notifications store lacks add method', async () => {
      const { logWarn } = vi.mocked(await import('@/utils/logger-wrapper'));
      const invalidStore = {} as NotificationsStore;
      
      notify({ title: 'Test' }, invalidStore);
      
      expect(logWarn).toHaveBeenCalledWith('Notifications store not available', {
        title: 'Test',
        text: '',
        type: 'info'
      });
    });
  });

  describe('notifySuccess', () => {
    it('creates success notification', () => {
      notifySuccess('Success!', 'Operation completed', mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Success!',
        text: 'Operation completed',
        type: 'success'
      });
    });

    it('creates success notification without text', () => {
      notifySuccess('Success!', undefined, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Success!',
        text: undefined,
        type: 'success'
      });
    });

    it('handles null store', async () => {
      const { logWarn } = vi.mocked(await import('@/utils/logger-wrapper'));
      
      notifySuccess('Success!', 'Text', null);
      
      expect(logWarn).toHaveBeenCalled();
      expect(mockNotificationsStore.add).not.toHaveBeenCalled();
    });
  });

  describe('notifyError', () => {
    it('creates error notification', () => {
      notifyError('Error occurred', 'Something went wrong', mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Error occurred',
        text: 'Something went wrong',
        type: 'error'
      });
    });

    it('creates error notification without text', () => {
      notifyError('Error', undefined, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Error',
        text: undefined,
        type: 'error'
      });
    });
  });

  describe('notifyWarning', () => {
    it('creates warning notification', () => {
      notifyWarning('Warning', 'Be careful', mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Warning',
        text: 'Be careful',
        type: 'warning'
      });
    });
  });

  describe('notifyInfo', () => {
    it('creates info notification', () => {
      notifyInfo('Information', 'Just FYI', mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Information',
        text: 'Just FYI',
        type: 'info'
      });
    });
  });

  describe('createNotificationHelpers', () => {
    it('creates bound notification functions', () => {
      const helpers = createNotificationHelpers(mockNotificationsStore);
      
      expect(helpers).toHaveProperty('notify');
      expect(helpers).toHaveProperty('notifySuccess');
      expect(helpers).toHaveProperty('notifyError');
      expect(helpers).toHaveProperty('notifyWarning');
      expect(helpers).toHaveProperty('notifyInfo');
    });

    it('bound notify function works correctly', () => {
      const helpers = createNotificationHelpers(mockNotificationsStore);
      
      helpers.notify({ title: 'Test', type: 'success' });
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Test',
        type: 'success'
      });
    });

    it('bound notifySuccess function works correctly', () => {
      const helpers = createNotificationHelpers(mockNotificationsStore);
      
      helpers.notifySuccess('Success', 'Details');
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Success',
        text: 'Details',
        type: 'success'
      });
    });

    it('bound notifyError function works correctly', () => {
      const helpers = createNotificationHelpers(mockNotificationsStore);
      
      helpers.notifyError('Error', 'Details');
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Error',
        text: 'Details',
        type: 'error'
      });
    });

    it('bound notifyWarning function works correctly', () => {
      const helpers = createNotificationHelpers(mockNotificationsStore);
      
      helpers.notifyWarning('Warning', 'Details');
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Warning',
        text: 'Details',
        type: 'warning'
      });
    });

    it('bound notifyInfo function works correctly', () => {
      const helpers = createNotificationHelpers(mockNotificationsStore);
      
      helpers.notifyInfo('Info', 'Details');
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Info',
        text: 'Details',
        type: 'info'
      });
    });

    it('handles null store in helpers', async () => {
      const { logWarn } = vi.mocked(await import('@/utils/logger-wrapper'));
      const helpers = createNotificationHelpers(null);
      
      helpers.notify({ title: 'Test' });
      
      expect(logWarn).toHaveBeenCalled();
      expect(mockNotificationsStore.add).not.toHaveBeenCalled();
    });
  });

  describe('Special cases', () => {
    it('handles persistent notifications', () => {
      notify({
        title: 'Persistent',
        persist: true
      }, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Persistent',
        persist: true
      });
    });

    it('handles non-closeable notifications', () => {
      notify({
        title: 'Cannot close',
        closeable: false
      }, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Cannot close',
        closeable: false
      });
    });

    it('handles empty text', () => {
      notify({
        title: 'Title only',
        text: ''
      }, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Title only',
        text: ''
      });
    });

    it('handles long text', () => {
      const longText = 'Lorem ipsum '.repeat(50);
      notify({
        title: 'Long notification',
        text: longText
      }, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Long notification',
        text: longText
      });
    });

    it('handles special characters in title and text', () => {
      notify({
        title: 'Special <>&"\'',
        text: 'Contains special chars: <>&"\''
      }, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Special <>&"\'',
        text: 'Contains special chars: <>&"\''
      });
    });
  });

  describe('Common use cases', () => {
    it('shows success after save', () => {
      notifySuccess('Saved successfully', undefined, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Saved successfully',
        text: undefined,
        type: 'success'
      });
    });

    it('shows error with details', () => {
      notify({
        title: 'Failed to save',
        text: 'Network error: Unable to reach server',
        type: 'error',
        persist: true
      }, mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Failed to save',
        text: 'Network error: Unable to reach server',
        type: 'error',
        persist: true
      });
    });

    it('shows warning for validation', () => {
      notifyWarning('Validation warning', 'Some fields are incomplete', mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Validation warning',
        text: 'Some fields are incomplete',
        type: 'warning'
      });
    });

    it('shows info for limits', () => {
      notifyInfo('Maximum blocks reached', 'You cannot add more than 10 blocks', mockNotificationsStore);
      
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Maximum blocks reached',
        text: 'You cannot add more than 10 blocks',
        type: 'info'
      });
    });
  });

  describe('Error handling', () => {
    it('handles store add method throwing', () => {
      mockNotificationsStore.add = vi.fn().mockImplementation(() => {
        throw new Error('Add failed');
      });
      
      // Should throw the error up
      expect(() => notify({ title: 'Test' }, mockNotificationsStore)).toThrow('Add failed');
    });
  });
});