import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BlockStatus from '@/components/BlockStatus.vue';

// Mock Directus components
const mockComponents = {
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
    template: '<li @click="handleClick" :class="{ active: active }" :active="active"><slot /></li>',
    props: ['clickable', 'active'],
    emits: ['click'],
    methods: {
      handleClick() {
        this.$emit('click');
      }
    }
  },
  'v-list-item-icon': { template: '<span><slot /></span>' },
  'v-list-item-content': { template: '<span><slot /></span>' }
};

describe('BlockStatus.vue', () => {
  const createWrapper = (props = {}) => {
    return mount(BlockStatus, {
      props: {
        hasStatus: true,
        compactMode: false,
        currentStatus: 'published',
        statusLabel: 'Published',
        statuses: [
          { value: 'published', label: 'Published' },
          { value: 'draft', label: 'Draft' },
          { value: 'archived', label: 'Archived' }
        ],
        ...props
      },
      global: {
        components: mockComponents
      }
    });
  };

  describe('Rendering', () => {
    it('renders menu when hasStatus is true and not compact mode', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.v-menu').exists()).toBe(true);
    });

    it('does not render when hasStatus is false', () => {
      const wrapper = createWrapper({ hasStatus: false });
      expect(wrapper.find('.v-menu').exists()).toBe(false);
    });

    it('does not render in compact mode', () => {
      const wrapper = createWrapper({ compactMode: true });
      expect(wrapper.find('.v-menu').exists()).toBe(false);
    });

    it('displays status dot with correct class', () => {
      const wrapper = createWrapper({ currentStatus: 'published' });
      const statusDot = wrapper.find('.status-display .status-dot');
      expect(statusDot.exists()).toBe(true);
      expect(statusDot.classes()).toContain('status-published');
    });

    it('displays status label', () => {
      const wrapper = createWrapper({ statusLabel: 'Published' });
      expect(wrapper.find('.status-text').text()).toBe('Published');
    });
  });

  describe('Menu Interaction', () => {
    it('opens menu when status display is clicked', async () => {
      const wrapper = createWrapper();
      const statusDisplay = wrapper.find('.status-display');
      
      await statusDisplay.trigger('click', {
        stopPropagation: () => {}
      });
      
      expect(wrapper.find('.menu-content').exists()).toBe(true);
    });

    it('renders all status options in menu', async () => {
      const wrapper = createWrapper();
      
      // Open menu
      await wrapper.find('.status-display').trigger('click', {
        stopPropagation: () => {}
      });
      
      const listItems = wrapper.findAll('li');
      expect(listItems).toHaveLength(3);
      expect(wrapper.text()).toContain('Published');
      expect(wrapper.text()).toContain('Draft');
      expect(wrapper.text()).toContain('Archived');
    });

    it('shows status dots for each option', async () => {
      const wrapper = createWrapper();
      
      // Open menu
      await wrapper.find('.status-display').trigger('click', {
        stopPropagation: () => {}
      });
      
      const statusDots = wrapper.findAll('.menu-content .status-dot');
      expect(statusDots).toHaveLength(3);
      expect(statusDots[0].classes()).toContain('status-published');
      expect(statusDots[1].classes()).toContain('status-draft');
      expect(statusDots[2].classes()).toContain('status-archived');
    });

    it('marks current status as active', async () => {
      const wrapper = createWrapper({ currentStatus: 'draft' });
      
      // Open menu
      await wrapper.find('.status-display').trigger('click', {
        stopPropagation: () => {}
      });
      
      const listItems = wrapper.findAll('li');
      expect(listItems[1].classes()).toContain('active');
    });
  });

  describe('Events', () => {
    it('emits update-status when option is clicked', async () => {
      const wrapper = createWrapper();
      
      // Open menu
      await wrapper.find('.status-display').trigger('click', {
        stopPropagation: () => {}
      });
      
      // Click draft option
      const draftOption = wrapper.findAll('li')[1];
      await draftOption.trigger('click');
      
      expect(wrapper.emitted('update-status')).toBeTruthy();
      expect(wrapper.emitted('update-status')[0]).toEqual(['draft']);
    });

    it('emits correct status value for each option', async () => {
      const wrapper = createWrapper();
      
      // Open menu
      await wrapper.find('.status-display').trigger('click', {
        stopPropagation: () => {}
      });
      
      // Click each option
      const listItems = wrapper.findAll('li');
      
      await listItems[0].trigger('click');
      expect(wrapper.emitted('update-status')[0]).toEqual(['published']);
      
      await listItems[1].trigger('click');
      expect(wrapper.emitted('update-status')[1]).toEqual(['draft']);
      
      await listItems[2].trigger('click');
      expect(wrapper.emitted('update-status')[2]).toEqual(['archived']);
    });
  });

  describe('Different Status Values', () => {
    it('handles different current status values', () => {
      const testCases = [
        { currentStatus: 'published', statusLabel: 'Published' },
        { currentStatus: 'draft', statusLabel: 'Draft' },
        { currentStatus: 'archived', statusLabel: 'Archived' },
        { currentStatus: 'custom', statusLabel: 'Custom Status' }
      ];

      testCases.forEach(({ currentStatus, statusLabel }) => {
        const wrapper = createWrapper({ currentStatus, statusLabel });
        const statusDot = wrapper.find('.status-display .status-dot');
        
        expect(statusDot.classes()).toContain(`status-${currentStatus}`);
        expect(wrapper.find('.status-text').text()).toBe(statusLabel);
      });
    });

    it('handles custom status list', async () => {
      const customStatuses = [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' }
      ];
      
      const wrapper = createWrapper({ 
        statuses: customStatuses,
        currentStatus: 'pending',
        statusLabel: 'Pending'
      });
      
      // Open menu
      await wrapper.find('.status-display').trigger('click', {
        stopPropagation: () => {}
      });
      
      const listItems = wrapper.findAll('li');
      expect(listItems).toHaveLength(3);
      expect(wrapper.text()).toContain('Pending');
      expect(wrapper.text()).toContain('Approved');
      expect(wrapper.text()).toContain('Rejected');
    });
  });
});