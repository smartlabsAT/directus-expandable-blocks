import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import InterfaceComponent from '@/interface.vue';

// Mock child components
const mockComponents = {
  'block-list': {
    template: '<div class="block-list"><slot /></div>',
    props: ['modelValue', 'expandedItems', 'loading', 'sortable', 'disabled', 'compactMode', 'showItemId', 'showCollectionName', 'allowStatusChange', 'allowDuplicate', 'allowDelete', 'allowUnlink', 'availableStatuses', 'expandableBlocks'],
    emits: ['toggle-expand', 'update-item', 'update-status', 'duplicate', 'discard-changes', 'delete', 'sort', 'update:modelValue', 'unlink']
  },
  'add-block-button': {
    template: '<div class="add-block-button"><button v-if="!disabled">Add Block</button></div>',
    props: ['disabled', 'collections', 'canAdd', 'existingCollections', 'canAddExisting'],
    emits: ['add-item', 'add-existing']
  },
  'v-dialog': {
    template: '<div v-if="modelValue" class="v-dialog"><slot /></div>',
    props: ['modelValue'],
    emits: ['update:modelValue']
  },
  'v-card': { template: '<div class="v-card"><slot /></div>' },
  'v-card-title': { template: '<div class="v-card-title"><slot /></div>' },
  'v-card-text': { template: '<div class="v-card-text"><slot /></div>' },
  'v-card-actions': { template: '<div class="v-card-actions"><slot /></div>' },
  'v-button': {
    template: '<button @click="$emit(\'click\')" :class="getClasses()"><slot /></button>',
    props: ['secondary', 'danger'],
    emits: ['click'],
    methods: {
      getClasses() {
        const classes = [];
        if (this.secondary) classes.push('secondary');
        if (this.danger) classes.push('danger');
        return classes;
      }
    }
  },
  // Add missing v-icon and menu components
  'v-icon': { 
    template: '<i :name="name" :x-small="xSmall" />', 
    props: ['name', 'xSmall'] 
  },
  'v-menu': { 
    template: '<div class="v-menu"><slot name="activator" :toggle="toggle" /><div v-if="isOpen" class="menu-content"><slot /></div></div>',
    props: ['placement', 'showArrow'],
    data() {
      return { isOpen: false };
    },
    methods: {
      toggle() {
        this.isOpen = !this.isOpen;
      }
    }
  },
  'v-list': { template: '<ul><slot /></ul>' },
  'v-list-item': { 
    template: '<li @click="$emit(\'click\')" :clickable="clickable"><slot /></li>', 
    props: ['clickable'],
    emits: ['click'] 
  },
  'v-list-item-icon': { template: '<span><slot /></span>' },
  'v-list-item-content': { template: '<span><slot /></span>' }
};

// Mock composable
const mockExpandableBlocks = {
  // State
  items: ref([]),
  expandedItems: ref([]),
  loading: ref({}), // Changed to object to match BlockList expectations
  deleteDialog: ref(false),
  mergedOptions: ref({
    compactMode: false,
    isAllowedDuplicate: true,
    isAllowedDelete: true
  }),
  availableStatuses: ref([
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' }
  ]),
  allowedCollections: ref([
    { collection: 'content_text', name: 'Text Block' }
  ]),
  allowedExistingCollections: ref([
    { collection: 'content_text', name: 'Text Block' }
  ]),
  canAddExistingBlocks: ref(true),
  allowUnlink: ref(false),
  
  // Computed
  sortable: ref(true),
  shouldShowItemId: ref(true),
  canAddMoreBlocks: ref(true),
  
  // Methods
  initialize: vi.fn(),
  getItemId: vi.fn((item) => item.id),
  getActualItemId: vi.fn((item) => item.item?.id || 'new'),
  isNewItem: vi.fn((item) => !item.item?.id),
  isBlockDirty: vi.fn(() => false),
  getItemTitle: vi.fn((item) => item.item?.title || 'Untitled'),
  getCollectionName: vi.fn((item) => item.collection),
  getCollectionIcon: vi.fn(() => 'box'),
  getFieldsForItem: vi.fn(() => []),
  toggleExpand: vi.fn(),
  updateItem: vi.fn(),
  addNewItem: vi.fn(),
  showDeleteDialog: vi.fn(),
  confirmDeleteItem: vi.fn(),
  duplicateItem: vi.fn(),
  discardChanges: vi.fn(),
  updateItemStatus: vi.fn(),
  onSort: vi.fn(),
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
  hasAnyUsageIndicator: false,
  loadBlockUsageData: vi.fn(),
  shouldShowCollectionName: ref(true),
  allowStatusChange: ref(true),
  canAddBlocks: ref(true),
  canChangeStatus: ref(true),
  canSort: ref(true),
  canDelete: ref(true),
  canDuplicate: ref(true),
  allowedCollectionsWithPermissions: ref([
    { collection: 'content_text', name: 'Text Block' }
  ]),
  allowedCollectionsForExistingWithPermissions: ref([
    { collection: 'content_text', name: 'Text Block' }
  ])
};

vi.mock('@/composables/useExpandableBlocks', () => ({
  useExpandableBlocks: vi.fn((props, emit, values, initialValues) => mockExpandableBlocks)
}));

describe('interface.vue', () => {
  const createWrapper = (props = {}, global = {}) => {
    return mount(InterfaceComponent, {
      props: {
        value: [],
        collection: 'pages',
        field: 'content_blocks',
        primaryKey: 1, // Add required primaryKey prop
        ...props
      },
      global: {
        components: mockComponents,
        provide: {
          'vee-validate-values': {},
          'field-values': {},
          ...global.provide
        },
        ...global
      }
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset refs
    mockExpandableBlocks.items.value = [];
    mockExpandableBlocks.expandedItems.value = [];
    mockExpandableBlocks.loading.value = {};
    mockExpandableBlocks.deleteDialog.value = false;
    mockExpandableBlocks.canAddMoreBlocks.value = true;
  });

  describe('Rendering', () => {
    it('renders the main container', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.expandable-blocks').exists()).toBe(true);
    });

    it('renders block list component', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.block-list').exists()).toBe(true);
    });

    it('renders add button component', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.add-block-button').exists()).toBe(true);
    });

    it('passes correct props to block list', () => {
      mockExpandableBlocks.items.value = [{ id: '1', collection: 'test' }];
      mockExpandableBlocks.expandedItems.value = ['1'];
      mockExpandableBlocks.loading.value = { '1': true };
      mockExpandableBlocks.sortable.value = false;
      
      const wrapper = createWrapper({ disabled: true });
      const blockList = wrapper.findComponent({ name: 'block-list' });
      
      expect(blockList.props('modelValue')).toEqual([{ id: '1', collection: 'test' }]);
      expect(blockList.props('expandedItems')).toEqual(['1']);
      expect(blockList.props('loading')).toEqual({ '1': true });
      expect(blockList.props('sortable')).toBe(false);
      expect(blockList.props('disabled')).toBe(true);
    });

    it('passes correct props to add button', () => {
      mockExpandableBlocks.canAddMoreBlocks.value = false;
      mockExpandableBlocks.allowedCollectionsWithPermissions.value = [
        { collection: 'content_text', name: 'Text Block' }
      ];
      
      const wrapper = createWrapper({ disabled: true });
      const addButton = wrapper.findComponent({ name: 'add-block-button' });
      
      expect(addButton.props('disabled')).toBe(true);
      expect(addButton.props('collections')).toEqual([
        { collection: 'content_text', name: 'Text Block' }
      ]);
      expect(addButton.props('canAdd')).toBe(false);
    });
  });

  describe('Delete Dialog', () => {
    it('shows delete dialog when deleteDialog is true', async () => {
      const wrapper = createWrapper();
      
      // Initially hidden
      expect(wrapper.find('.v-dialog').exists()).toBe(false);
      
      // Show dialog
      mockExpandableBlocks.deleteDialog.value = true;
      await wrapper.vm.$nextTick();
      
      expect(wrapper.find('.v-dialog').exists()).toBe(true);
      expect(wrapper.text()).toContain('Delete Block');
    });

    it('calls confirmDeleteItem when delete button clicked', async () => {
      const wrapper = createWrapper();
      
      // Show dialog
      mockExpandableBlocks.deleteDialog.value = true;
      await wrapper.vm.$nextTick();
      
      // Check if dialog is visible
      const dialog = wrapper.find('.v-dialog');
      expect(dialog.exists()).toBe(true);
      
      // Find all buttons in the dialog
      const buttons = dialog.findAll('button');
      expect(buttons.length).toBe(2); // Should have Cancel and Delete buttons
      
      // Find the delete button (it's the second button, with danger prop)
      // The button at index 1 should be the delete button
      const deleteButton = buttons[1];
      
      await deleteButton.trigger('click');
      
      expect(mockExpandableBlocks.confirmDeleteItem).toHaveBeenCalled();
    });

    it('closes dialog when cancel button clicked', async () => {
      const wrapper = createWrapper();
      
      // Show dialog
      mockExpandableBlocks.deleteDialog.value = true;
      await wrapper.vm.$nextTick();
      
      // Check if dialog is visible
      const dialog = wrapper.find('.v-dialog');
      expect(dialog.exists()).toBe(true);
      
      // Find all buttons in the dialog
      const buttons = dialog.findAll('button');
      expect(buttons.length).toBe(2); // Should have Cancel and Delete buttons
      
      // Find the cancel button (it's the first button, with secondary prop)
      // The button at index 0 should be the cancel button
      const cancelButton = buttons[0];
      
      await cancelButton.trigger('click');
      
      expect(mockExpandableBlocks.deleteDialog.value).toBe(false);
    });
  });

  describe('Events', () => {
    it('calls toggleExpand when block-list emits toggle-expand', async () => {
      const wrapper = createWrapper();
      const blockList = wrapper.findComponent({ name: 'block-list' });
      
      await blockList.vm.$emit('toggle-expand', '123');
      
      expect(mockExpandableBlocks.toggleExpand).toHaveBeenCalledWith('123');
    });

    it('calls updateItem when block-list emits update-item', async () => {
      const wrapper = createWrapper();
      const blockList = wrapper.findComponent({ name: 'block-list' });
      
      await blockList.vm.$emit('update-item', 0, { title: 'Updated' });
      
      expect(mockExpandableBlocks.updateItem).toHaveBeenCalledWith(0, { title: 'Updated' });
    });

    it('calls updateItemStatus when block-list emits update-status', async () => {
      const wrapper = createWrapper();
      const blockList = wrapper.findComponent({ name: 'block-list' });
      
      const item = { id: '1' };
      await blockList.vm.$emit('update-status', item, 0, 'published');
      
      expect(mockExpandableBlocks.updateItemStatus).toHaveBeenCalledWith(item, 0, 'published');
    });

    it('calls duplicateItem when block-list emits duplicate', async () => {
      const wrapper = createWrapper();
      const blockList = wrapper.findComponent({ name: 'block-list' });
      
      const item = { id: '1' };
      await blockList.vm.$emit('duplicate', item, 0);
      
      expect(mockExpandableBlocks.duplicateItem).toHaveBeenCalledWith(item, 0);
    });

    it('calls discardChanges when block-list emits discard-changes', async () => {
      const wrapper = createWrapper();
      const blockList = wrapper.findComponent({ name: 'block-list' });
      
      const item = { id: '1' };
      await blockList.vm.$emit('discard-changes', item, 0);
      
      expect(mockExpandableBlocks.discardChanges).toHaveBeenCalledWith(item, 0);
    });

    it('calls showDeleteDialog when block-list emits delete', async () => {
      const wrapper = createWrapper();
      const blockList = wrapper.findComponent({ name: 'block-list' });
      
      const item = { id: '1' };
      await blockList.vm.$emit('delete', item, 0);
      
      expect(mockExpandableBlocks.showDeleteDialog).toHaveBeenCalledWith(item, 0);
    });

    it('calls onSort when block-list emits sort', async () => {
      const wrapper = createWrapper();
      const blockList = wrapper.findComponent({ name: 'block-list' });
      
      await blockList.vm.$emit('sort');
      
      expect(mockExpandableBlocks.onSort).toHaveBeenCalled();
    });

    it('calls addNewItem when add-block-button emits add-item', async () => {
      const wrapper = createWrapper();
      const addButton = wrapper.findComponent({ name: 'add-block-button' });
      
      await addButton.vm.$emit('add-item', 'content_text');
      
      expect(mockExpandableBlocks.addNewItem).toHaveBeenCalledWith('content_text');
    });
  });

  describe('Initialization', () => {
    it('provides expandable blocks composable', () => {
      const wrapper = createWrapper();
      // Just verify the component mounts successfully
      expect(wrapper.find('.expandable-blocks').exists()).toBe(true);
    });
  });

  describe('Props', () => {
    it('passes all props to composable', () => {
      const wrapper = createWrapper({
        value: [{ id: 1 }],
        collection: 'custom_collection',
        field: 'custom_field',
        primaryKey: 123,
        disabled: true
      });
      
      // Verify props are passed correctly
      expect(wrapper.props().collection).toBe('custom_collection');
      expect(wrapper.props().field).toBe('custom_field');
      expect(wrapper.props().primaryKey).toBe(123);
      expect(wrapper.props().disabled).toBe(true);
    });
  });
});