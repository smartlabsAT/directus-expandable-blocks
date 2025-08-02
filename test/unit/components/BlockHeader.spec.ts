import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BlockHeader from '@/components/BlockHeader.vue';

// Mock child components
const mockComponents = {
  'v-icon': { 
    template: '<i :name="name" class="v-icon" @click.stop="handleClick" />',
    props: ['name'],
    emits: ['click'],
    methods: {
      handleClick(e) {
        this.$emit('click', e);
      }
    }
  },
  'v-chip': {
    template: '<span class="v-chip"><slot /></span>',
    props: ['xSmall', 'outline']
  }
};

// Mock directives
const mockDirectives = {
  tooltip: {
    mounted(el, binding) {
      el.setAttribute('data-tooltip', binding.value);
    }
  }
};

describe('BlockHeader.vue', () => {
  const createWrapper = (props = {}, options = {}) => {
    return mount(BlockHeader, {
      props: {
        sortable: true,
        disabled: false,
        collectionIcon: 'text_format',
        isNew: false,
        isDirty: false,
        title: 'Test Block',
        collectionName: 'Text Block',
        showItemId: true,
        showCollectionName: true,
        itemId: 1,
        isExpanded: false,
        usageCount: 0,
        usageData: null,
        hasAnyUsageIndicator: false,
        canRead: true,
        ...props
      },
      global: {
        components: mockComponents,
        directives: mockDirectives
      },
      ...options
    });
  };

  describe('Rendering', () => {
    it('renders drag handle when sortable', () => {
      const wrapper = createWrapper({ sortable: true, disabled: false });
      const dragHandle = wrapper.find('.drag-handle');
      expect(dragHandle.exists()).toBe(true);
      expect(dragHandle.attributes('name')).toBe('drag_indicator');
    });

    it('shows collection icon', () => {
      const wrapper = createWrapper({ collectionIcon: 'text_format' });
      const icon = wrapper.find('.collection-icon');
      expect(icon.exists()).toBe(true);
      expect(icon.attributes('name')).toBe('text_format');
    });

    it('hides drag handle when not sortable', () => {
      const wrapper = createWrapper({ sortable: false });
      expect(wrapper.find('.drag-handle').exists()).toBe(false);
    });

    it('hides drag handle when disabled', () => {
      const wrapper = createWrapper({ sortable: true, disabled: true });
      expect(wrapper.find('.drag-handle').exists()).toBe(false);
    });

    it('shows item ID when showItemId is true', () => {
      const wrapper = createWrapper({ showItemId: true, isNew: false, itemId: 1 });
      expect(wrapper.find('.item-id').exists()).toBe(true);
      expect(wrapper.find('.item-id').text()).toBe('ID: 1');
    });

    it('hides item ID when showItemId is false', () => {
      const wrapper = createWrapper({ showItemId: false });
      expect(wrapper.find('.item-id').exists()).toBe(false);
    });

    it('shows collection name in chip', () => {
      const wrapper = createWrapper({ collectionName: 'Text Block' });
      expect(wrapper.find('.collection-chip').exists()).toBe(true);
      expect(wrapper.find('.collection-chip').text()).toBe('Text Block');
    });

    it('shows item title', () => {
      const wrapper = createWrapper({ title: 'Test Block' });
      expect(wrapper.find('.block-title').exists()).toBe(true);
      expect(wrapper.find('.block-title').text()).toBe('Test Block');
    });
  });

  describe('Click Handling', () => {
    it('emits toggle-expand when expand icon is clicked', async () => {
      const wrapper = createWrapper({ isExpanded: true });
      const expandIcon = wrapper.find('.expand-indicator');
      
      // Trigger click with event object to avoid stopPropagation error
      await expandIcon.trigger('click', { 
        stopPropagation: () => {} 
      });
      
      expect(wrapper.emitted('toggle-expand')).toBeTruthy();
      expect(wrapper.emitted('toggle-expand')[0]).toEqual([]);
    });

    it('does not show expand icon when collapsed', () => {
      const wrapper = createWrapper({ isExpanded: false });
      expect(wrapper.find('.expand-indicator').exists()).toBe(false);
    });
  });

  describe('Status and Action Slots', () => {
    it('renders status slot content', () => {
      const wrapper = createWrapper({}, {
        slots: {
          status: '<div class="custom-status">Published</div>'
        }
      });
      
      expect(wrapper.find('.custom-status').exists()).toBe(true);
      expect(wrapper.find('.custom-status').text()).toBe('Published');
    });

    it('renders actions slot content', () => {
      const wrapper = createWrapper({}, {
        slots: {
          actions: '<div class="custom-actions">Actions</div>'
        }
      });
      
      expect(wrapper.find('.custom-actions').exists()).toBe(true);
      expect(wrapper.find('.custom-actions').text()).toBe('Actions');
    });
  });

  describe('Indicators', () => {
    it('shows new indicator when item is new', () => {
      const wrapper = createWrapper({ isNew: true });
      const indicator = wrapper.find('.new-indicator');
      
      expect(indicator.exists()).toBe(true);
      expect(indicator.attributes('data-tooltip')).toBe('New block');
    });

    it('shows dirty indicator when item has unsaved changes', () => {
      const wrapper = createWrapper({ isDirty: true, isNew: false });
      const indicator = wrapper.find('.dirty-indicator');
      
      expect(indicator.exists()).toBe(true);
      expect(indicator.attributes('data-tooltip')).toBe('Unsaved changes');
    });

    it('shows new indicator over dirty indicator', () => {
      const wrapper = createWrapper({ isNew: true, isDirty: true });
      
      expect(wrapper.find('.new-indicator').exists()).toBe(true);
      expect(wrapper.find('.dirty-indicator').exists()).toBe(false);
    });
  });

  describe('Icon Fallback', () => {
    it('uses box icon as fallback when collection icon is null', () => {
      const wrapper = createWrapper({ collectionIcon: null });
      const icon = wrapper.find('.collection-icon');
      
      expect(icon.exists()).toBe(true);
      expect(icon.attributes('name')).toBe('box');
    });
  });

  describe('Edge Cases', () => {
    it('hides item ID for new items even when showItemId is true', () => {
      const wrapper = createWrapper({
        isNew: true,
        showItemId: true,
        itemId: 'new_123'
      });
      
      expect(wrapper.find('.item-id').exists()).toBe(false);
    });

    it('handles numeric item IDs', () => {
      const wrapper = createWrapper({
        showItemId: true,
        itemId: 123,
        isNew: false
      });
      
      expect(wrapper.find('.item-id').text()).toBe('ID: 123');
    });

    it('handles string item IDs', () => {
      const wrapper = createWrapper({
        showItemId: true,
        itemId: 'abc-123',
        isNew: false
      });
      
      expect(wrapper.find('.item-id').text()).toBe('ID: abc-123');
    });
  });
});