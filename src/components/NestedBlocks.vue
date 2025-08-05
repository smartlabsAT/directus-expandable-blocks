<template>
  <div class="nested-blocks" v-if="blocks && blocks.length > 0">
    <div class="nested-header">
      <v-icon name="subdirectory_arrow_right" small />
      <span class="nested-title">{{ title }}</span>
      <v-chip x-small>{{ blocks.length }}</v-chip>
    </div>
    
    <div class="nested-items">
      <div 
        v-for="(block, index) in blocks" 
        :key="getBlockKey(block, index)"
        class="nested-block-item"
      >
        <div class="nested-block-header">
          <v-icon :name="getBlockIcon(block)" small />
          <span class="block-label">{{ getBlockLabel(block) }}</span>
          <span class="block-collection">{{ block.collection }}</span>
        </div>
        
        <!-- Show nested fields if expanded -->
        <div v-if="expandedNested.includes(getBlockKey(block, index))" class="nested-block-content">
          <div v-for="field in getBlockFields(block)" :key="field.field" class="nested-field">
            <label>{{ field.name || field.field }}</label>
            <div class="field-value">{{ getFieldValue(block, field.field) }}</div>
          </div>
          
          <!-- Recursively show nested M2A if present -->
          <template v-for="(value, key) in block.item" :key="key">
            <nested-blocks 
              v-if="isM2AField(value)"
              :blocks="value"
              :title="formatFieldName(String(key))"
              :depth="depth + 1"
            />
          </template>
        </div>
        
        <v-button 
          x-small 
          text 
          @click="toggleNested(getBlockKey(block, index))"
        >
          {{ expandedNested.includes(getBlockKey(block, index)) ? 'Collapse' : 'Expand' }}
        </v-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { extractItemTitle } from '../utils/helpers';

interface Props {
  blocks: any[] | null;
  title: string;
  depth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0
});

const expandedNested = ref<string[]>([]);

function getBlockKey(block: any, index: number): string {
  return `${block.id || index}_${props.depth}`;
}

function toggleNested(key: string) {
  const index = expandedNested.value.indexOf(key);
  if (index > -1) {
    expandedNested.value.splice(index, 1);
  } else {
    expandedNested.value.push(key);
  }
}

function getBlockIcon(block: any): string {
  const icons: Record<string, string> = {
    content_headline: 'title',
    content_text: 'text_fields',
    content_image: 'image',
    content_wysiwig: 'edit_note',
    content_button: 'smart_button'
  };
  return icons[block.collection] || 'widgets';
}

function getBlockLabel(block: any): string {
  if (!block.item) return `Block #${block.id}`;
  
  const title = extractItemTitle(block);
  return title !== 'Untitled Block' ? title : `${block.collection} #${block.id}`;
}

function getBlockFields(block: any): any[] {
  if (!block.item || typeof block.item !== 'object') return [];
  
  // Filter out system fields and M2A fields
  return Object.keys(block.item)
    .filter(key => !['id', 'status', 'sort', 'user_created', 'date_created', 'user_updated', 'date_updated'].includes(key))
    .filter(key => !isM2AField(block.item[key]))
    .map(key => ({ field: key, name: formatFieldName(key) }));
}

function getFieldValue(block: any, field: string): any {
  const value = block.item?.[field];
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function isM2AField(value: any): boolean {
  return Array.isArray(value) && 
         value.length > 0 && 
         value[0]?.collection && 
         value[0]?.item;
}

function formatFieldName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}
</script>

<style scoped>
.nested-blocks {
  margin-top: 12px;
  padding-left: 20px;
  border-left: 2px solid var(--border-normal);
}

.nested-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--foreground-subdued);
  font-size: 13px;
  font-weight: 600;
}

.nested-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nested-block-item {
  background: var(--background-normal);
  border: 1px solid var(--border-subdued);
  border-radius: var(--border-radius);
  padding: 8px 12px;
}

.nested-block-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.block-label {
  flex: 1;
  font-weight: 500;
}

.block-collection {
  font-size: 11px;
  color: var(--foreground-subdued);
}

.nested-block-content {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subdued);
}

.nested-field {
  margin-bottom: 8px;
}

.nested-field label {
  display: block;
  font-size: 12px;
  color: var(--foreground-subdued);
  margin-bottom: 4px;
}

.field-value {
  font-size: 13px;
  color: var(--foreground-normal);
}
</style>