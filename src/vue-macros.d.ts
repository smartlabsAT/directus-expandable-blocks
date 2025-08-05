/// <reference types="@vue/runtime-core" />

/**
 * Vue 3 Compiler Macros
 * These are compile-time macros that are automatically available in Vue SFCs
 * This file helps IDEs and static analyzers understand these globals
 */

import type { 
  DefineComponent, 
  ComponentPublicInstance,
  PropType,
  Ref,
  ComputedRef,
  WritableComputedRef,
  UnwrapRef,
  ShallowRef,
  ToRefs,
  ToRef
} from 'vue';

declare global {
  // Vue 3 Compiler Macros - these are auto-imported by Vue compiler
  const defineProps: typeof import('vue')['defineProps'];
  const defineEmits: typeof import('vue')['defineEmits'];
  const defineExpose: typeof import('vue')['defineExpose'];
  const defineOptions: typeof import('vue')['defineOptions'];
  const defineSlots: typeof import('vue')['defineSlots'];
  const defineModel: typeof import('vue')['defineModel'];
  const withDefaults: typeof import('vue')['withDefaults'];
  
  // Vue 3 Reactivity APIs - commonly used in components
  const ref: typeof import('vue')['ref'];
  const computed: typeof import('vue')['computed'];
  const reactive: typeof import('vue')['reactive'];
  const readonly: typeof import('vue')['readonly'];
  const watchEffect: typeof import('vue')['watchEffect'];
  const watchPostEffect: typeof import('vue')['watchPostEffect'];
  const watchSyncEffect: typeof import('vue')['watchSyncEffect'];
  const watch: typeof import('vue')['watch'];
  
  // Vue 3 Lifecycle Hooks
  const onBeforeMount: typeof import('vue')['onBeforeMount'];
  const onMounted: typeof import('vue')['onMounted'];
  const onBeforeUpdate: typeof import('vue')['onBeforeUpdate'];
  const onUpdated: typeof import('vue')['onUpdated'];
  const onBeforeUnmount: typeof import('vue')['onBeforeUnmount'];
  const onUnmounted: typeof import('vue')['onUnmounted'];
  const onActivated: typeof import('vue')['onActivated'];
  const onDeactivated: typeof import('vue')['onDeactivated'];
  const onErrorCaptured: typeof import('vue')['onErrorCaptured'];
  
  // Vue 3 Dependency Injection
  const inject: typeof import('vue')['inject'];
  const provide: typeof import('vue')['provide'];
  
  // Vue 3 Utilities
  const nextTick: typeof import('vue')['nextTick'];
  const toRef: typeof import('vue')['toRef'];
  const toRefs: typeof import('vue')['toRefs'];
  const toValue: typeof import('vue')['toValue'];
  const unref: typeof import('vue')['unref'];
  const isRef: typeof import('vue')['isRef'];
  const isReactive: typeof import('vue')['isReactive'];
  const isReadonly: typeof import('vue')['isReadonly'];
  const isProxy: typeof import('vue')['isProxy'];
  
  // Component Instance Type
  type ComponentInstance = ComponentPublicInstance;
}

// Export types for use in other files
export type {
  DefineComponent,
  ComponentPublicInstance,
  PropType,
  Ref,
  ComputedRef,
  WritableComputedRef,
  UnwrapRef,
  ShallowRef,
  ToRefs,
  ToRef
};

// Ensure this file is treated as a module
export {};