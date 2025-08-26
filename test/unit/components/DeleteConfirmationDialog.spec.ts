import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog.vue';
import type { ItemUsageInfo } from '@/services/RelationChecker';
import type { JunctionRecord } from '@/types';

// Mock Directus components
vi.mock('@directus/extensions-sdk', () => ({
  useApi: vi.fn(() => ({}))
}));

const mockComponents = {
  'v-dialog': {
    template: '<div class="v-dialog"><slot /></div>',
    props: ['modelValue']
  },
  'v-card': {
    template: '<div class="v-card"><slot /></div>'
  },
  'v-card-title': {
    template: '<div class="v-card-title"><slot /></div>'
  },
  'v-card-text': {
    template: '<div class="v-card-text"><slot /></div>'
  },
  'v-card-actions': {
    template: '<div class="v-card-actions"><slot /></div>'
  },
  'v-button': {
    template: '<button class="v-button" @click="$emit(\'click\')"><slot /></button>',
    props: ['secondary', 'kind', 'loading']
  },
  'v-icon': {
    template: '<span class="v-icon">{{ name }}</span>',
    props: ['name', 'color', 'small']
  },
  'v-notice': {
    template: '<div class="v-notice"><slot /></div>',
    props: ['type', 'icon']
  },
  'v-chip': {
    template: '<span class="v-chip"><slot /></span>',
    props: ['xSmall', 'outlined']
  },
  'v-divider': {
    template: '<hr class="v-divider" />'
  },
  'v-progress-circular': {
    template: '<div class="v-progress-circular" />',
    props: ['indeterminate']
  }
};

describe('DeleteConfirmationDialog', () => {
  const createWrapper = (props = {}) => {
    return mount(DeleteConfirmationDialog, {
      props: {
        modelValue: true,
        item: null,
        itemTitle: 'Test Item',
        itemIcon: 'box',
        collectionName: 'test_collection',
        usageInfo: null,
        loading: false,
        error: null,
        currentPageId: 'page-123',
        allowForceDelete: false,
        ...props
      },
      global: {
        components: mockComponents
      }
    });
  };

  const mockItem: JunctionRecord = {
    id: 'junction-1',
    collection: 'content_text',
    item: { id: 1, title: 'Test Content' }
  };

  const mockUsageInfo: ItemUsageInfo = {
    totalCount: 3,
    currentPageUsage: true,
    locations: [
      { collection: 'pages', id: 'page-123', field: 'blocks', title: 'Current Page' },
      { collection: 'pages', id: 'page-456', field: 'blocks', title: 'Another Page' },
      { collection: 'posts', id: 'post-789', field: 'content', title: 'Blog Post' }
    ],
    canDelete: false
  };

  describe('Rendering', () => {
    it('should render dialog when modelValue is true', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.v-dialog').exists()).toBe(true);
    });

    it('should display loading state', () => {
      const wrapper = createWrapper({ loading: true });
      expect(wrapper.find('.v-progress-circular').exists()).toBe(true);
      expect(wrapper.text()).toContain('Checking where this item is being used');
    });

    it('should display error state', () => {
      const wrapper = createWrapper({ 
        loading: false,
        error: 'Failed to check usage' 
      });
      expect(wrapper.find('.v-notice').exists()).toBe(true);
      expect(wrapper.text()).toContain('Failed to check usage');
    });

    it('should display item information', () => {
      const wrapper = createWrapper({ 
        item: mockItem,
        itemTitle: 'My Content Block',
        collectionName: 'Content Text',
        usageInfo: {
          totalCount: 0,
          currentPageUsage: false,
          locations: [],
          canDelete: true
        }
      });
      expect(wrapper.text()).toContain('My Content Block');
      expect(wrapper.find('.block-collection-chip').text()).toBe('Content Text');
    });

    it('should show deleted item indicator', () => {
      const deletedItem = { ...mockItem, item: null };
      const wrapper = createWrapper({ 
        item: deletedItem,
        usageInfo: {
          totalCount: 0,
          currentPageUsage: false,
          locations: [],
          canDelete: true
        }
      });
      expect(wrapper.find('.status-indicator.deleted').exists()).toBe(true);
      expect(wrapper.find('.block-display-title.deleted').exists()).toBe(true);
    });
  });

  describe('Usage Information', () => {
    it.skip('should display usage locations', () => {
      const wrapper = createWrapper({ 
        usageInfo: mockUsageInfo,
        item: mockItem 
      });
      
      expect(wrapper.text()).toContain('Used in 3 locations');
      expect(wrapper.findAll('.location-item')).toHaveLength(3);
    });

    it.skip('should highlight current page in usage list', () => {
      const wrapper = createWrapper({ 
        usageInfo: mockUsageInfo,
        item: mockItem,
        currentPageId: 'page-123'
      });
      
      const currentPageItem = wrapper.find('.location-item.current-page');
      expect(currentPageItem.exists()).toBe(true);
      expect(currentPageItem.find('.v-chip').text()).toBe('This Page');
    });

    it.skip('should show warning when item cannot be deleted', () => {
      const wrapper = createWrapper({ 
        usageInfo: mockUsageInfo,
        item: mockItem 
      });
      
      const warning = wrapper.find('.v-notice');
      expect(warning.exists()).toBe(true);
      expect(warning.text()).toContain('cannot be permanently deleted');
      expect(warning.text()).toContain('used in 2 other locations');
    });

    it('should not show warning when item can be deleted', () => {
      const canDeleteInfo = { ...mockUsageInfo, totalCount: 1, canDelete: true };
      const wrapper = createWrapper({ 
        usageInfo: canDeleteInfo,
        item: mockItem 
      });
      
      expect(wrapper.find('.v-notice').exists()).toBe(false);
    });
  });

  describe('Deletion Options', () => {
    it('should show deletion options when canProceed is true', () => {
      const canDeleteInfo = { ...mockUsageInfo, totalCount: 1, canDelete: true };
      const wrapper = createWrapper({ 
        usageInfo: canDeleteInfo,
        item: mockItem 
      });
      
      expect(wrapper.find('.deletion-options').exists()).toBe(true);
      expect(wrapper.findAll('.action-option')).toHaveLength(2);
    });

    it('should have unassign option selected by default', async () => {
      const canDeleteInfo = { ...mockUsageInfo, totalCount: 1, canDelete: true };
      const wrapper = createWrapper({ 
        usageInfo: canDeleteInfo,
        item: mockItem 
      });
      
      const unassignOption = wrapper.findAll('.action-option')[0];
      expect(unassignOption.classes()).toContain('selected');
    });

    it('should toggle between unassign and delete options', async () => {
      const canDeleteInfo = { ...mockUsageInfo, totalCount: 1, canDelete: true };
      const wrapper = createWrapper({ 
        usageInfo: canDeleteInfo,
        item: mockItem 
      });
      
      const deleteOption = wrapper.findAll('input[type="radio"]')[1];
      await deleteOption.setValue(true);
      
      const deleteOptionDiv = wrapper.findAll('.action-option')[1];
      expect(deleteOptionDiv.classes()).toContain('selected');
    });
  });

  describe('Events', () => {
    it('should emit cancel event when cancel button is clicked', async () => {
      const wrapper = createWrapper();
      const cancelButton = wrapper.findAll('.v-button')[0];
      
      await cancelButton.trigger('click');
      
      expect(wrapper.emitted('cancel')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
    });

    it('should emit confirm event with correct options', async () => {
      const canDeleteInfo = { ...mockUsageInfo, totalCount: 1, canDelete: true };
      const wrapper = createWrapper({ 
        usageInfo: canDeleteInfo,
        item: mockItem 
      });
      
      // Select delete permanently option
      const deleteOption = wrapper.findAll('input[type="radio"]')[1];
      await deleteOption.setValue(true);
      
      // Click confirm button
      const confirmButton = wrapper.findAll('.v-button')[1];
      await confirmButton.trigger('click');
      
      expect(wrapper.emitted('confirm')?.[0]).toEqual([{
        deleteContent: true,
        selectedLocations: []
      }]);
    });

    it('should emit confirm with unassign option', async () => {
      const canDeleteInfo = { ...mockUsageInfo, totalCount: 1, canDelete: true };
      const wrapper = createWrapper({ 
        usageInfo: canDeleteInfo,
        item: mockItem 
      });
      
      // Confirm button (unassign is default)
      const confirmButton = wrapper.findAll('.v-button')[1];
      await confirmButton.trigger('click');
      
      expect(wrapper.emitted('confirm')?.[0]).toEqual([{
        deleteContent: false,
        selectedLocations: []
      }]);
    });
  });

  describe('Button States', () => {
    it('should show correct button text for unassign', () => {
      const canDeleteInfo = { ...mockUsageInfo, totalCount: 1, canDelete: true };
      const wrapper = createWrapper({ 
        usageInfo: canDeleteInfo,
        item: mockItem 
      });
      
      const confirmButton = wrapper.findAll('.v-button')[1];
      expect(confirmButton.text()).toBe('Unassign');
    });

    it('should show correct button text for delete', async () => {
      const canDeleteInfo = { ...mockUsageInfo, totalCount: 1, canDelete: true };
      const wrapper = createWrapper({ 
        usageInfo: canDeleteInfo,
        item: mockItem 
      });
      
      // Select delete option
      const deleteOption = wrapper.findAll('input[type="radio"]')[1];
      await deleteOption.setValue(true);
      
      const confirmButton = wrapper.findAll('.v-button')[1];
      expect(confirmButton.text()).toBe('Delete Permanently');
    });

    it('should disable confirm button when loading', () => {
      const wrapper = createWrapper({ 
        loading: true,
        item: mockItem 
      });
      
      const buttons = wrapper.findAll('.v-button');
      expect(buttons.length).toBe(1); // Only cancel button
    });

    it.skip('should not show confirm button when canProceed is false', () => {
      const wrapper = createWrapper({ 
        usageInfo: mockUsageInfo, // canDelete is false
        item: mockItem 
      });
      
      const buttons = wrapper.findAll('.v-button');
      expect(buttons.length).toBe(1); // Only cancel button
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing item gracefully', () => {
      const wrapper = createWrapper({ 
        item: null,
        itemTitle: null,
        collectionName: null,
        usageInfo: {
          totalCount: 0,
          currentPageUsage: false,
          locations: [],
          canDelete: true
        }
      });
      
      // Check that the no-item-display div is rendered with fallback text
      const noItemDisplay = wrapper.find('.no-item-display');
      expect(noItemDisplay.exists()).toBe(true);
      expect(noItemDisplay.text()).toContain('Untitled');
      expect(noItemDisplay.text()).toContain('Unknown');
    });

    it('should handle empty usage locations', () => {
      const emptyUsageInfo = {
        totalCount: 0,
        currentPageUsage: false,
        locations: [],
        canDelete: true
      };
      
      const wrapper = createWrapper({ 
        usageInfo: emptyUsageInfo,
        item: mockItem 
      });
      
      expect(wrapper.find('.location-list').exists()).toBe(false);
      expect(wrapper.find('.usage-summary').exists()).toBe(false);
    });

    it('should reset state when dialog closes', async () => {
      const canDeleteInfo = { ...mockUsageInfo, totalCount: 1, canDelete: true };
      const wrapper = createWrapper({ 
        modelValue: true,
        usageInfo: canDeleteInfo,
        item: mockItem 
      });
      
      // Select delete option
      const deleteOption = wrapper.findAll('input[type="radio"]')[1];
      if (deleteOption) {
        await deleteOption.setValue(true);
      }
      
      // Close and reopen dialog
      await wrapper.setProps({ modelValue: false });
      await wrapper.setProps({ modelValue: true });
      
      // Should reset to unassign option
      const unassignOption = wrapper.findAll('.action-option')[0];
      if (unassignOption) {
        expect(unassignOption.classes()).toContain('selected');
      }
    });
  });
});