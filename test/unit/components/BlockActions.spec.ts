import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import BlockActions from '@/components/BlockActions.vue';

// Mock Directus components
const mockComponents = {
  'v-button': { 
    template: '<button @click.stop="handleClick" :disabled="disabled"><slot /></button>', 
    props: ['disabled', 'xSmall', 'icon', 'secondary'],
    emits: ['click'],
    methods: {
      handleClick(e) {
        this.$emit('click', e);
      }
    }
  },
  'v-icon': { template: '<i :name="name" />', props: ['name'] },
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
    template: '<li @click="handleClick" :class="{ disabled: disabled, danger: $attrs.class?.includes(\'danger\') }" :disabled="disabled"><slot /></li>', 
    props: ['clickable', 'disabled'],
    emits: ['click'],
    methods: {
      handleClick() {
        if (!this.disabled) {
          this.$emit('click');
        }
      }
    }
  },
  'v-list-item-icon': { template: '<span><slot /></span>' },
  'v-list-item-content': { template: '<span><slot /></span>' },
  'v-divider': { template: '<hr />' }
};

describe('BlockActions.vue', () => {
  const createWrapper = (props = {}) => {
    return mount(BlockActions, {
      props: {
        allowDuplicate: true,
        allowDelete: true,
        isDirty: false,
        ...props
      },
      global: {
        components: mockComponents,
        directives: {
          tooltip: {
            mounted(el, binding) {
              el.setAttribute('data-tooltip', binding.value);
            }
          }
        }
      }
    });
  };

  describe('Rendering', () => {
    it('renders v-menu component', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.v-menu').exists()).toBe(true);
    });

    it('shows duplicate menu item when allowed', async () => {
      const wrapper = createWrapper({ allowDuplicate: true });
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      expect(wrapper.text()).toContain('Duplicate');
      expect(wrapper.find('i[name="content_copy"]').exists()).toBe(true);
    });

    it('hides duplicate menu item when not allowed', async () => {
      const wrapper = createWrapper({ allowDuplicate: false });
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      expect(wrapper.text()).not.toContain('Duplicate');
      expect(wrapper.find('i[name="content_copy"]').exists()).toBe(false);
    });

    it('shows delete menu item when allowed', async () => {
      const wrapper = createWrapper({ allowDelete: true });
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      expect(wrapper.text()).toContain('Delete');
      expect(wrapper.find('i[name="delete"]').exists()).toBe(true);
    });

    it('hides delete menu item when not allowed', async () => {
      const wrapper = createWrapper({ allowDelete: false });
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      expect(wrapper.text()).not.toContain('Delete');
      expect(wrapper.find('i[name="delete"]').exists()).toBe(false);
    });
  });

  describe('Discard Changes', () => {
    it('shows discard changes option always', async () => {
      const wrapper = createWrapper();
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      expect(wrapper.text()).toContain('Discard Changes');
      expect(wrapper.find('i[name="undo"]').exists()).toBe(true);
    });

    it('disables discard changes when not dirty', async () => {
      const wrapper = createWrapper({ isDirty: false });
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      const discardItem = wrapper.findAll('li').find(li => li.text().includes('Discard Changes'));
      expect(discardItem?.classes()).toContain('disabled');
    });

    it('enables discard changes when dirty', async () => {
      const wrapper = createWrapper({ isDirty: true });
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      const discardItem = wrapper.findAll('li').find(li => li.text().includes('Discard Changes'));
      expect(discardItem?.classes()).not.toContain('disabled');
    });
  });

  describe('Events', () => {
    it('emits duplicate event when duplicate item clicked', async () => {
      const wrapper = createWrapper({ allowDuplicate: true });
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      // Click duplicate item
      const duplicateItem = wrapper.findAll('li').find(li => li.text().includes('Duplicate'));
      await duplicateItem?.trigger('click');
      
      expect(wrapper.emitted('duplicate')).toBeTruthy();
      expect(wrapper.emitted('duplicate')[0]).toEqual([]);
    });

    it('emits discard-changes event when discard item clicked', async () => {
      const wrapper = createWrapper({ isDirty: true });
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      // Click discard changes item
      const discardItem = wrapper.findAll('li').find(li => li.text().includes('Discard Changes'));
      await discardItem?.trigger('click');
      
      expect(wrapper.emitted('discard-changes')).toBeTruthy();
      expect(wrapper.emitted('discard-changes')[0]).toEqual([]);
    });

    it('emits delete event when delete item clicked', async () => {
      const wrapper = createWrapper({ allowDelete: true });
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      // Click delete item
      const deleteItem = wrapper.findAll('li').find(li => li.text().includes('Delete'));
      await deleteItem?.trigger('click');
      
      expect(wrapper.emitted('delete')).toBeTruthy();
      expect(wrapper.emitted('delete')[0]).toEqual([]);
    });
  });

  describe('Menu Button', () => {
    it('shows more options button with tooltip', () => {
      const wrapper = createWrapper();
      const button = wrapper.find('button');
      
      expect(button.exists()).toBe(true);
      expect(button.attributes('data-tooltip')).toBe('More options');
      expect(wrapper.find('i[name="more_vert"]').exists()).toBe(true);
    });
  });

  describe('Divider', () => {
    it('shows divider when delete is allowed', async () => {
      const wrapper = createWrapper({ allowDelete: true });
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      expect(wrapper.find('hr').exists()).toBe(true);
    });

    it('hides divider when delete is not allowed', async () => {
      const wrapper = createWrapper({ allowDelete: false });
      
      // Open menu
      const menuButton = wrapper.find('button');
      await menuButton.trigger('click');
      
      expect(wrapper.find('hr').exists()).toBe(false);
    });
  });
});