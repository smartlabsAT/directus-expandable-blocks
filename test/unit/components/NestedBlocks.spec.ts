import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import NestedBlocks from '@/components/NestedBlocks.vue';

// Mock Directus components
const mockComponents = {
  'v-chip': {
    template: '<span class="v-chip" :x-small="xSmall"><slot /></span>',
    props: ['xSmall']
  },
  'v-icon': {
    template: '<i :name="name" :small="small" />',
    props: ['name', 'small']
  },
  'v-button': {
    template: '<button @click="$emit(\'click\')" :x-small="xSmall" :text="text"><slot /></button>',
    props: ['xSmall', 'text'],
    emits: ['click']
  }
};

// Mock the helpers module
vi.mock('../utils/helpers', () => ({
  extractItemTitle: vi.fn((block) => {
    return block.item?.title || block.item?.name || 'Untitled Block';
  })
}));

describe('NestedBlocks.vue', () => {
  const createWrapper = (props = {}) => {
    return mount(NestedBlocks, {
      props: {
        blocks: [],
        title: 'Nested Content',
        depth: 0,
        ...props
      },
      global: {
        components: {
          ...mockComponents,
          // Self-reference for recursive component
          'nested-blocks': NestedBlocks
        }
      }
    });
  };

  describe('Rendering', () => {
    it('renders nested blocks container when blocks exist', () => {
      const blocks = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Block 1' } }
      ];
      const wrapper = createWrapper({ blocks });
      expect(wrapper.find('.nested-blocks').exists()).toBe(true);
    });

    it('does not render when no blocks', () => {
      const wrapper = createWrapper({ blocks: [] });
      expect(wrapper.find('.nested-blocks').exists()).toBe(false);
    });

    it('does not render when blocks is null', () => {
      const wrapper = createWrapper({ blocks: null });
      expect(wrapper.find('.nested-blocks').exists()).toBe(false);
    });

    it('shows nested header with title and count', () => {
      const blocks = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Block 1' } },
        { id: 2, collection: 'content_image', item: { id: 102, title: 'Block 2' } }
      ];
      const wrapper = createWrapper({ blocks, title: 'Content Blocks' });
      
      const header = wrapper.find('.nested-header');
      expect(header.exists()).toBe(true);
      expect(header.text()).toContain('Content Blocks');
      expect(header.find('.v-chip').text()).toBe('2');
    });

    it('renders subdirectory arrow icon in header', () => {
      const blocks = [{ id: 1, collection: 'content_text', item: {} }];
      const wrapper = createWrapper({ blocks });
      
      const icon = wrapper.find('.nested-header i[name="subdirectory_arrow_right"]');
      expect(icon.exists()).toBe(true);
    });
  });

  describe('Block Items', () => {
    it('renders each block as a nested-block-item', () => {
      const blocks = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Block 1' } },
        { id: 2, collection: 'content_image', item: { id: 102, title: 'Block 2' } },
        { id: 3, collection: 'content_wysiwig', item: { id: 103, title: 'Block 3' } }
      ];
      const wrapper = createWrapper({ blocks });
      
      const blockItems = wrapper.findAll('.nested-block-item');
      expect(blockItems).toHaveLength(3);
    });

    it('shows block icon based on collection type', () => {
      const blocks = [
        { id: 1, collection: 'content_text', item: {} },
        { id: 2, collection: 'content_image', item: {} },
        { id: 3, collection: 'unknown_type', item: {} }
      ];
      const wrapper = createWrapper({ blocks });
      
      const icons = wrapper.findAll('.nested-block-header i');
      expect(icons[0].attributes('name')).toBe('text_fields');
      expect(icons[1].attributes('name')).toBe('image');
      expect(icons[2].attributes('name')).toBe('widgets'); // default icon
    });

    it('displays block label from title', () => {
      const blocks = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'My Text Block' } }
      ];
      const wrapper = createWrapper({ blocks });
      
      expect(wrapper.find('.block-label').text()).toBe('My Text Block');
    });

    it('displays collection name', () => {
      const blocks = [
        { id: 1, collection: 'content_text', item: {} }
      ];
      const wrapper = createWrapper({ blocks });
      
      expect(wrapper.find('.block-collection').text()).toBe('content_text');
    });

    it('shows expand/collapse button for each block', () => {
      const blocks = [
        { id: 1, collection: 'content_text', item: { content: 'Test' } },
        { id: 2, collection: 'content_image', item: { alt: 'Image' } }
      ];
      const wrapper = createWrapper({ blocks });
      
      const buttons = wrapper.findAll('button');
      expect(buttons).toHaveLength(2);
      expect(buttons[0].text()).toBe('Expand');
      expect(buttons[1].text()).toBe('Expand');
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('expands block content when expand button clicked', async () => {
      const blocks = [
        { id: 1, collection: 'content_text', item: { id: 101, content: 'Test content' } }
      ];
      const wrapper = createWrapper({ blocks });
      
      // Initially collapsed
      expect(wrapper.find('.nested-block-content').exists()).toBe(false);
      
      // Click expand
      await wrapper.find('button').trigger('click');
      
      // Should show content
      expect(wrapper.find('.nested-block-content').exists()).toBe(true);
      expect(wrapper.find('button').text()).toBe('Collapse');
    });

    it('collapses block content when collapse button clicked', async () => {
      const blocks = [
        { id: 1, collection: 'content_text', item: { id: 101, content: 'Test content' } }
      ];
      const wrapper = createWrapper({ blocks });
      
      // Expand first
      await wrapper.find('button').trigger('click');
      expect(wrapper.find('.nested-block-content').exists()).toBe(true);
      
      // Then collapse
      await wrapper.find('button').trigger('click');
      expect(wrapper.find('.nested-block-content').exists()).toBe(false);
      expect(wrapper.find('button').text()).toBe('Expand');
    });

    it('maintains separate expand state for each block', async () => {
      const blocks = [
        { id: 1, collection: 'content_text', item: { content: 'Text 1' } },
        { id: 2, collection: 'content_text', item: { content: 'Text 2' } }
      ];
      const wrapper = createWrapper({ blocks });
      
      const buttons = wrapper.findAll('button');
      
      // Expand first block
      await buttons[0].trigger('click');
      
      // First should be expanded, second should be collapsed
      const contents = wrapper.findAll('.nested-block-content');
      expect(contents).toHaveLength(1);
      expect(buttons[0].text()).toBe('Collapse');
      expect(buttons[1].text()).toBe('Expand');
    });
  });

  describe('Field Display', () => {
    it('shows block fields when expanded', async () => {
      const blocks = [
        { 
          id: 1, 
          collection: 'content_text', 
          item: { 
            id: 101, 
            title: 'My Block',
            content: 'Block content',
            status: 'published'
          } 
        }
      ];
      const wrapper = createWrapper({ blocks });
      
      // Expand block
      await wrapper.find('button').trigger('click');
      
      const fields = wrapper.findAll('.nested-field');
      expect(fields.length).toBeGreaterThan(0);
      
      // Should show field labels and values
      const fieldText = wrapper.find('.nested-block-content').text();
      expect(fieldText).toContain('Title');
      expect(fieldText).toContain('My Block');
      expect(fieldText).toContain('Content');
      expect(fieldText).toContain('Block content');
    });

    it('formats field names properly', async () => {
      const blocks = [
        { 
          id: 1, 
          collection: 'content_text', 
          item: { 
            field_with_underscores: 'value'
          } 
        }
      ];
      const wrapper = createWrapper({ blocks });
      
      // Expand block
      await wrapper.find('button').trigger('click');
      
      expect(wrapper.text()).toContain('Field With Underscores');
    });

    it('handles null and undefined field values', async () => {
      const blocks = [
        { 
          id: 1, 
          collection: 'content_text', 
          item: { 
            null_field: null,
            undefined_field: undefined
          } 
        }
      ];
      const wrapper = createWrapper({ blocks });
      
      // Expand block
      await wrapper.find('button').trigger('click');
      
      const fieldValues = wrapper.findAll('.field-value');
      fieldValues.forEach(value => {
        expect(value.text()).toBe('-');
      });
    });
  });

  describe('Recursive M2A Fields', () => {
    it('renders nested M2A fields recursively', async () => {
      const blocks = [
        { 
          id: 1, 
          collection: 'content_text', 
          item: { 
            title: 'Parent Block',
            nested_blocks: [
              { id: 2, collection: 'content_image', item: { alt: 'Nested Image' } }
            ]
          } 
        }
      ];
      const wrapper = createWrapper({ blocks });
      
      // Expand parent block
      await wrapper.find('button').trigger('click');
      
      // Should render nested blocks component
      // Check for nested header which indicates nested blocks
      const nestedHeaders = wrapper.findAll('.nested-header');
      expect(nestedHeaders.length).toBe(2); // Main header + nested header
    });

    it('formats nested field names', async () => {
      const blocks = [
        { 
          id: 1, 
          collection: 'content_text', 
          item: { 
            title: 'Parent',
            child_blocks: [
              { id: 2, collection: 'content_text', item: { title: 'Child' } }
            ]
          } 
        }
      ];
      const wrapper = createWrapper({ blocks });
      
      // Expand parent
      await wrapper.find('button').trigger('click');
      
      // Check nested blocks title
      const nestedHeaders = wrapper.findAll('.nested-header');
      expect(nestedHeaders[1].text()).toContain('Child Blocks');
    });

    it('increments depth for nested blocks', async () => {
      const blocks = [
        { 
          id: 1, 
          collection: 'content_text', 
          item: { 
            nested: [
              { id: 2, collection: 'content_text', item: {} }
            ]
          } 
        }
      ];
      const wrapper = createWrapper({ blocks, depth: 0 });
      
      // Expand to show nested
      await wrapper.find('button').trigger('click');
      
      // The nested blocks will render with incremented depth
      // We can verify this by checking that nested content exists
      const nestedBlocks = wrapper.findAll('.nested-blocks');
      expect(nestedBlocks.length).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles blocks without item property', () => {
      const blocks = [
        { id: 1, collection: 'content_text' }
      ];
      const wrapper = createWrapper({ blocks });
      
      expect(wrapper.find('.block-label').text()).toBe('Block #1');
    });

    it('handles non-object item values', () => {
      const blocks = [
        { id: 1, collection: 'content_text', item: 123 }
      ];
      const wrapper = createWrapper({ blocks });
      
      // Should not crash
      expect(wrapper.find('.nested-block-item').exists()).toBe(true);
    });

    it('generates unique keys for blocks without IDs', async () => {
      const blocks = [
        { collection: 'content_text', item: { title: 'Block 1' } },
        { collection: 'content_text', item: { title: 'Block 2' } }
      ];
      const wrapper = createWrapper({ blocks });
      
      const buttons = wrapper.findAll('button');
      
      // Should be able to expand each independently
      await buttons[0].trigger('click');
      await buttons[1].trigger('click');
      
      const contents = wrapper.findAll('.nested-block-content');
      expect(contents).toHaveLength(2);
    });
  });
});