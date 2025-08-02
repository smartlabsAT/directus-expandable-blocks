import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AddBlockButton from '@/components/AddBlockButton.vue';

// Mock Directus components
const mockComponents = {
  'v-button': { 
    template: '<button @click="$emit(\'click\')" :disabled="disabled"><slot /></button>', 
    props: ['disabled'],
    emits: ['click'] 
  },
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

describe('AddBlockButton.vue', () => {
  const createWrapper = (props = {}) => {
    return mount(AddBlockButton, {
      props: {
        disabled: false,
        collections: [
          { collection: 'content_text', name: 'Text Block', icon: 'text_format' },
          { collection: 'content_image', name: 'Image Block', icon: 'image' }
        ],
        canAdd: true,
        ...props
      },
      global: {
        components: mockComponents
      }
    });
  };

  describe('Rendering', () => {
    it('renders add block wrapper', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.add-block-wrapper').exists()).toBe(true);
    });

    it('does not render button when disabled', () => {
      const wrapper = createWrapper({ disabled: true });
      expect(wrapper.find('button').exists()).toBe(false);
    });

    it('shows single button for single collection', () => {
      const wrapper = createWrapper({
        collections: [{ collection: 'content_text', name: 'Text Block' }]
      });
      
      expect(wrapper.find('button').exists()).toBe(true);
      expect(wrapper.find('.v-menu').exists()).toBe(false);
      expect(wrapper.text()).toContain('Create New');
    });

    it('shows dropdown menu for multiple collections', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.v-menu').exists()).toBe(true);
      expect(wrapper.find('.with-dropdown').exists()).toBe(true);
    });

    it('shows max blocks message when canAdd is false', () => {
      const wrapper = createWrapper({ canAdd: false });
      expect(wrapper.find('.max-blocks-message').exists()).toBe(true);
      expect(wrapper.text()).toContain('Maximum blocks reached');
    });
  });

  describe('Single Collection Mode', () => {
    it('shows add icon in button', () => {
      const wrapper = createWrapper({
        collections: [{ collection: 'content_text' }]
      });
      
      const icon = wrapper.find('button i[name="add"]');
      expect(icon.exists()).toBe(true);
    });

    it('emits add-item when button clicked', async () => {
      const wrapper = createWrapper({
        collections: [{ collection: 'content_text' }]
      });
      
      await wrapper.find('button').trigger('click');
      
      expect(wrapper.emitted('add-item')).toBeTruthy();
      expect(wrapper.emitted('add-item')[0]).toEqual(['content_text']);
    });
  });

  describe('Multiple Collections Mode', () => {
    it('shows dropdown arrow in button', () => {
      const wrapper = createWrapper();
      const icon = wrapper.find('.with-dropdown i[name="arrow_drop_down"]');
      expect(icon.exists()).toBe(true);
    });

    it('opens menu when button clicked', async () => {
      const wrapper = createWrapper();
      const button = wrapper.find('.with-dropdown');
      
      await button.trigger('click');
      
      expect(wrapper.find('.menu-content').exists()).toBe(true);
    });

    it('renders menu items for each collection', async () => {
      const wrapper = createWrapper();
      
      // Open menu
      await wrapper.find('.with-dropdown').trigger('click');
      
      const listItems = wrapper.findAll('li');
      expect(listItems).toHaveLength(2);
      expect(wrapper.text()).toContain('Text Block');
      expect(wrapper.text()).toContain('Image Block');
    });

    it('shows collection icons in menu items', async () => {
      const wrapper = createWrapper();
      
      // Open menu
      await wrapper.find('.with-dropdown').trigger('click');
      
      const icons = wrapper.findAll('li i');
      expect(icons[0].attributes('name')).toBe('text_format');
      expect(icons[1].attributes('name')).toBe('image');
    });

    it('uses default icon when collection icon is missing', async () => {
      const wrapper = createWrapper({
        collections: [
          { collection: 'content_custom', name: 'Custom Block' }
        ]
      });
      
      // This should render single button mode
      const icon = wrapper.find('button i');
      expect(icon.attributes('name')).toBe('add');
    });

    it('emits add-item with collection when menu item clicked', async () => {
      const wrapper = createWrapper();
      
      // Open menu
      await wrapper.find('.with-dropdown').trigger('click');
      
      // Click first item
      const firstItem = wrapper.findAll('li')[0];
      await firstItem.trigger('click');
      
      expect(wrapper.emitted('add-item')).toBeTruthy();
      expect(wrapper.emitted('add-item')[0]).toEqual(['content_text']);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty collections array', () => {
      const wrapper = createWrapper({ collections: [] });
      expect(wrapper.find('button').exists()).toBe(false);
      expect(wrapper.find('.v-menu').exists()).toBe(false);
    });

    it('uses collection name as fallback when name is missing', async () => {
      const wrapper = createWrapper({
        collections: [
          { collection: 'content_text' },
          { collection: 'content_image' }
        ]
      });
      
      // Open menu
      await wrapper.find('.with-dropdown').trigger('click');
      
      expect(wrapper.text()).toContain('content_text');
      expect(wrapper.text()).toContain('content_image');
    });

    it('does not show max blocks message when disabled', () => {
      const wrapper = createWrapper({ 
        canAdd: false,
        disabled: true 
      });
      
      expect(wrapper.find('.max-blocks-message').exists()).toBe(false);
    });
  });
});