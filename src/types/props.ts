/**
 * Component prop types for the expandable-blocks extension
 */

import type { ExpandableBlocksOptions } from './options';

export interface UseExpandableBlocksProps {
  value: any[] | null;
  disabled?: boolean;
  field: any;
  collection: string;
  primaryKey: string | number;
  options?: ExpandableBlocksOptions;
}