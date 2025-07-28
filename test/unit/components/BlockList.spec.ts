import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import BlockList from '@/components/BlockList.vue';

// Mock vuedraggable
vi.mock('vuedraggable', () => ({
  default: {
    name: 'draggable',
    props: ['modelValue', 'disabled', 'itemKey', 'handle', 'animation'],
    emits: ['update:modelValue', 'end'],
    template: `<div class="draggable">
      <div v-for="(element, index) in modelValue" :key="element.id">
        <slot name="item" :element="element" :index="index" />
      </div>
    </div>`
  }
}));

// Mock child components
const mockComponents = {
  'block-item': {
    template: '<div class="block-item"><slot name="header" /><slot name="nested-blocks" /></div>',
    props: ['item', 'isExpanded', 'loading', 'fields', 'disabled', 'compactMode', 'canRead', 'canUpdate', 'usageData'],
    emits: ['toggle-expand', 'update-item']
  },
  'block-header': {
    template: '<div class="block-header"><slot name="status" /><slot name="actions" /></div>',
    props: ['sortable', 'disabled', 'collectionIcon', 'isNew', 'isDirty', 'title', 'collectionName', 'showItemId', 'showCollectionName', 'itemId', 'isExpanded', 'usageCount', 'usageData', 'hasAnyUsageIndicator', 'canRead'],
    emits: ['toggle-expand']
  },
  'block-status': {
    template: '<div class="block-status"></div>',
    props: ['hasStatus', 'compactMode', 'currentStatus', 'statusLabel', 'statuses', 'allowStatusChange'],
    emits: ['update-status']
  },
  'block-actions': {
    template: '<div class="block-actions"></div>',
    props: ['allowDuplicate', 'allowDelete', 'isDirty', 'canUnlink', 'canUpdate'],
    emits: ['duplicate', 'discard-changes', 'delete', 'unlink']
  },
  'nested-blocks': {
    template: '<div class="nested-blocks"></div>',
    props: ['blocks', 'title']
  },
  'v-notice': {
    template: '<div class="v-notice"><slot /></div>',
    props: ['type']
  }
};

// Mock expandableBlocks instance
const mockExpandableBlocks = {
  getItemId: vi.fn((item) => item.id),
  getActualItemId: vi.fn((item) => item.item?.id || 'new'),
  isNewItem: vi.fn((item) => !item.item?.id),
  isBlockDirty: vi.fn(() => false),
  getItemTitle: vi.fn((item) => item.item?.title || 'Untitled'),
  getCollectionName: vi.fn((item) => {
    const groups = [
      { collection: 'content_text', name: 'Text Block' },
      { collection: 'content_image', name: 'Image Block' }
    ];
    const group = groups.find(g => g.collection === item.collection);
    return group?.name || item.collection;
  }),
  getCollectionIcon: vi.fn((item) => {
    const icons = { content_text: 'text_format', content_image: 'image' };
    return icons[item.collection] || 'box';
  }),
  getFieldsForItem: vi.fn((item) => []),
  hasStatusField: vi.fn(() => false),
  getItemStatus: vi.fn(() => 'published'),
  getStatusLabel: vi.fn((status) => status),
  hasNestedM2A: vi.fn(() => false),
  getM2AFields: vi.fn(() => ({})),
  formatFieldName: vi.fn((name) => name),
  canReadItem: vi.fn(() => true),
  canUpdateItem: vi.fn(() => true),
  canDeleteItem: vi.fn(() => true),
  getBlockUsageData: vi.fn(() => null),
  hasAnyUsageIndicator: false
};

describe('BlockList.vue', () => {
  const createWrapper = (props = {}) => {
    return mount(BlockList, {
      global: {
        components: mockComponents
      },
      props: {
        modelValue: [],
        expandedItems: [],
        loading: {},
        sortable: true,
        disabled: false,
        compactMode: false,
        showItemId: false,
        showCollectionName: true,
        allowStatusChange: true,
        allowDuplicate: true,
        allowDelete: true,
        allowUnlink: false,
        availableStatuses: [],
        expandableBlocks: mockExpandableBlocks,
        ...props
      }
    });
  };

  describe('Rendering', () => {
    it('renders block list container', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.block-list').exists()).toBe(true);
    });

    it('shows empty state when no items', () => {
      const wrapper = createWrapper({ modelValue: [] });
      
      expect(wrapper.find('.empty-state').exists()).toBe(true);
      expect(wrapper.text()).toContain('No blocks yet');
    });

    it('renders draggable component when items exist', () => {
      const modelValue = [
        { id: '1', collection: 'content_text', item: { id: 1, title: 'Block 1' } },
        { id: '2', collection: 'content_text', item: { id: 2, title: 'Block 2' } }
      ];
      const wrapper = createWrapper({ modelValue });
      
      expect(wrapper.find('.draggable').exists()).toBe(true);
    });

    it('renders block items for each item', () => {
      const modelValue = [
        { id: '1', collection: 'content_text', item: { id: 1, title: 'Block 1' } },
        { id: '2', collection: 'content_image', item: { id: 2, title: 'Block 2' } }
      ];
      
      const wrapper = createWrapper({ modelValue });
      
      const blockItems = wrapper.findAllComponents({ name: 'block-item' });
      expect(blockItems).toHaveLength(2);
    });
  });

  describe('Draggable Configuration', () => {
    it('enables dragging when sortable and not disabled', () => {
      const modelValue = [{ id: '1', collection: 'content_text', item: {} }];
      const wrapper = createWrapper({ modelValue, sortable: true, disabled: false });
      const draggable = wrapper.findComponent({ name: 'draggable' });
      
      expect(draggable.props('disabled')).toBe(false);
    });

    it('disables dragging when not sortable', () => {
      const modelValue = [{ id: '1', collection: 'content_text', item: {} }];
      const wrapper = createWrapper({ modelValue, sortable: false, disabled: false });
      const draggable = wrapper.findComponent({ name: 'draggable' });
      
      expect(draggable.props('disabled')).toBe(true);
    });

    it('disables dragging when component is disabled', () => {
      const modelValue = [{ id: '1', collection: 'content_text', item: {} }];
      const wrapper = createWrapper({ modelValue, sortable: true, disabled: true });
      const draggable = wrapper.findComponent({ name: 'draggable' });
      
      expect(draggable.props('disabled')).toBe(true);
    });

    it('uses correct drag handle', () => {
      const modelValue = [{ id: '1', collection: 'content_text', item: {} }];
      const wrapper = createWrapper({ modelValue });
      const draggable = wrapper.findComponent({ name: 'draggable' });
      
      expect(draggable.props('handle')).toBe('.drag-handle');
    });

    it('sets animation duration', () => {
      const modelValue = [{ id: '1', collection: 'content_text', item: {} }];
      const wrapper = createWrapper({ modelValue });
      const draggable = wrapper.findComponent({ name: 'draggable' });
      
      expect(draggable.props('animation')).toBe(200);
    });
  });

  describe('Event Handling', () => {
    it('emits sort event on drag end', async () => {
      const modelValue = [
        { id: '1', collection: 'content_text', item: {} },
        { id: '2', collection: 'content_text', item: {} }
      ];
      
      const wrapper = createWrapper({ modelValue });
      const draggable = wrapper.findComponent({ name: 'draggable' });
      
      await draggable.vm.$emit('end');
      
      expect(wrapper.emitted('sort')).toBeTruthy();
    });

    it('updates when modelValue changes', async () => {
      const wrapper = createWrapper({ 
        modelValue: [{ id: '1', collection: 'content_text', item: {} }]
      });
      
      // Verify initial state
      expect(wrapper.findAllComponents({ name: 'block-item' })).toHaveLength(1);
      
      // Update modelValue
      await wrapper.setProps({
        modelValue: [
          { id: '1', collection: 'content_text', item: {} },
          { id: '2', collection: 'content_text', item: {} }
        ]
      });
      
      expect(wrapper.findAllComponents({ name: 'block-item' })).toHaveLength(2);
    });
  });

  describe('Props Passing', () => {
    it('passes correct props to BlockItem', () => {
      const modelValue = [
        { id: '1', collection: 'content_text', item: { title: 'Test' } }
      ];
      const expandedItems = ['1'];
      const loading = { '1': false };
      
      // Mock expandableBlocks to return expected values
      const customExpandableBlocks = {
        ...mockExpandableBlocks,
        getFieldsForItem: vi.fn(() => [{ field: 'title', type: 'string' }])
      };
      
      const wrapper = createWrapper({ 
        modelValue,
        expandedItems,
        loading,
        disabled: false,
        compactMode: true,
        expandableBlocks: customExpandableBlocks
      });
      
      const blockItem = wrapper.findComponent({ name: 'block-item' });
      
      expect(blockItem.props('item')).toEqual(modelValue[0]);
      expect(blockItem.props('isExpanded')).toBe(true);
      expect(blockItem.props('loading')).toBe(false);
      expect(blockItem.props('fields')).toEqual([{ field: 'title', type: 'string' }]);
      expect(blockItem.props('disabled')).toBe(false);
      expect(blockItem.props('compactMode')).toBe(true);
    });

    it('handles missing fields gracefully', () => {
      const modelValue = [
        { id: '1', collection: 'unknown_collection', item: {} }
      ];
      
      const wrapper = createWrapper({ modelValue });
      const blockItem = wrapper.findComponent({ name: 'block-item' });
      
      // expandableBlocks.getFieldsForItem should return empty array by default
      expect(blockItem.props('fields')).toEqual([]);
    });

    it('emits events from block items correctly', async () => {
      const modelValue = [
        { id: '1', collection: 'content_text', item: { title: 'Test' } }
      ];
      
      const wrapper = createWrapper({ modelValue });
      const blockItem = wrapper.findComponent({ name: 'block-item' });
      
      // Test toggle-expand event
      await blockItem.vm.$emit('toggle-expand', '1');
      expect(wrapper.emitted('toggle-expand')).toBeTruthy();
      expect(wrapper.emitted('toggle-expand')[0]).toEqual(['1']);
      
      // Test update-item event
      const updateData = { title: 'Updated' };
      await blockItem.vm.$emit('update-item', updateData);
      expect(wrapper.emitted('update-item')).toBeTruthy();
      expect(wrapper.emitted('update-item')[0]).toEqual([0, updateData]);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when disabled is false and no items', () => {
      const wrapper = createWrapper({ modelValue: [], disabled: false });
      
      expect(wrapper.find('.empty-state').exists()).toBe(true);
      expect(wrapper.text()).toContain('No blocks yet');
    });
    
    it('does not show empty state when disabled', () => {
      const wrapper = createWrapper({ modelValue: [], disabled: true });
      
      expect(wrapper.find('.empty-state').exists()).toBe(false);
    });
  });
});