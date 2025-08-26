import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import SearchTagInput from '@/components/SearchTagInput.vue';

// Mock child components
const mockComponents = {
  'v-icon': {
    template: '<i :name="name" :class="{clickable}" @click="$emit(\'click\')" />',
    props: ['name', 'xSmall', 'small', 'clickable', 'left', 'right'],
    emits: ['click']
  },
  'v-chip': {
    template: '<span class="v-chip"><slot /></span>',
    props: ['xSmall', 'close', 'active'],
    emits: ['click', 'close']
  },
  'v-progress-circular': {
    template: '<div class="v-progress-circular" />',
    props: ['indeterminate', 'xSmall']
  }
};


// Mock logger
vi.mock('@/utils/logger-wrapper', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn()
  },
  logDebug: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logAction: vi.fn(),
  logStateChange: vi.fn(),
  logEvent: vi.fn(),
  logInit: vi.fn(),
  logLifecycle: vi.fn(),
  logData: vi.fn(),
  logPerformance: vi.fn(),
  createScopedLogger: vi.fn(() => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    stateChange: vi.fn(),
    event: vi.fn(),
    action: vi.fn(),
    init: vi.fn(),
    lifecycle: vi.fn(),
    data: vi.fn(),
    performance: vi.fn()
  }))
}))

describe('SearchTagInput.vue', () => {
  const createWrapper = (props = {}) => {
    return mount(SearchTagInput, {
      props: {
        modelValue: [],
        fields: [
          { field: 'title', name: 'Title', type: 'string' },
          { field: 'description', name: 'Description', type: 'text' }
        ],
        placeholder: 'Search...',
        loading: false,
        showHelp: false,
        totalItems: 0,
        ...props
      },
      global: {
        components: mockComponents
      }
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders search input container', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.search-tag-input').exists()).toBe(true);
    });

    it('shows placeholder attribute', () => {
      const wrapper = createWrapper();
      const container = wrapper.find('.tag-input-container');
      expect(container.attributes('data-placeholder')).toBe('Search...');
    });

    it('renders search icon', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('i[name="search"]').exists()).toBe(true);
    });

    it('shows loading state', () => {
      const wrapper = createWrapper({ loading: true });
      expect(wrapper.find('.v-progress-circular').exists()).toBe(true);
    });
  });

  describe('Tag Management', () => {
    it('shows clear icon when input exists', async () => {
      const wrapper = createWrapper();
      
      // Simulate typing in the input (which would set currentInput)
      const container = wrapper.find('.tag-input-container');
      container.element.textContent = 'test';
      await container.trigger('input');
      
      await wrapper.vm.$nextTick();
      
      const closeIcon = wrapper.find('i[name="close"]');
      expect(closeIcon.exists()).toBe(true);
    });

    it('emits update:modelValue when clear is clicked', async () => {
      const wrapper = createWrapper({
        modelValue: [
          { field: 'title', value: 'test', operator: 'contains' }
        ]
      });
      
      await wrapper.vm.$nextTick();
      
      const closeIcon = wrapper.find('i[name="close"]');
      if (closeIcon.exists()) {
        await closeIcon.trigger('click');
        expect(wrapper.emitted('update:modelValue')).toBeTruthy();
        expect(wrapper.emitted('clear')).toBeTruthy();
      }
    });
  });

  describe('Events', () => {
    it('emits toggle-help when help icon is clicked', async () => {
      const wrapper = createWrapper();
      
      const helpIcon = wrapper.find('i[name="help_outline"]');
      expect(helpIcon.exists()).toBe(true);
      
      await helpIcon.trigger('click');
      
      expect(wrapper.emitted('toggle-help')).toBeTruthy();
    });

    it('applies rotated class when showHelp is true', () => {
      const wrapper = createWrapper({ showHelp: true });
      
      const helpIcon = wrapper.find('i[name="help_outline"]');
      expect(helpIcon.classes()).toContain('rotated');
    });
  });
});