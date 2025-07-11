import type { DefineComponent } from 'vue';

declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    // Directus Vue Components
    VButton: DefineComponent<any, any, any>;
    VIcon: DefineComponent<any, any, any>;
    VMenu: DefineComponent<any, any, any>;
    VList: DefineComponent<any, any, any>;
    VListItem: DefineComponent<any, any, any>;
    VListItemIcon: DefineComponent<any, any, any>;
    VListItemContent: DefineComponent<any, any, any>;
    VDialog: DefineComponent<any, any, any>;
    VCard: DefineComponent<any, any, any>;
    VCardTitle: DefineComponent<any, any, any>;
    VCardText: DefineComponent<any, any, any>;
    VCardActions: DefineComponent<any, any, any>;
    VForm: DefineComponent<any, any, any>;
    VChip: DefineComponent<any, any, any>;
    VNotice: DefineComponent<any, any, any>;
    VProgressCircular: DefineComponent<any, any, any>;
    VDivider: DefineComponent<any, any, any>;
    VTooltip: DefineComponent<any, any, any>;
  }
}

// Make this a module
export {};