import { computed, ref, onMounted, type ComputedRef } from 'vue';
import { useStores, useApi } from '@directus/extensions-sdk';
import { logDebug } from '../utils/logger-wrapper';
import { createApiClient } from '../services/api-client';
import type { IDirectusApiClient } from '../services/api-client.types';
import type { ExpandableBlocksOptions } from '../types';

interface PermissionChecks {
  canChangeStatus: ComputedRef<boolean>;
  canSort: ComputedRef<boolean>;
  canAddBlocks: ComputedRef<boolean>;
  canDelete: ComputedRef<boolean>;
  canDuplicate: ComputedRef<boolean>;
  hasPermission: (roleIds: string[] | undefined) => boolean;
}

/**
 * Composable for checking user permissions based on roles
 * @param mergedOptions - The merged options from the interface configuration
 */
export function usePermissionChecks(mergedOptions: ComputedRef<ExpandableBlocksOptions>): PermissionChecks {
  const { useUserStore } = useStores();
  const userStore = useUserStore();
  const api = useApi();
  const apiClient: IDirectusApiClient = createApiClient(api);
  
  // Get current user and their role
  const currentUser = computed(() => userStore.currentUser);
  const currentUserRole = computed(() => currentUser.value?.role);
  
  // Store for role mappings
  const roleIdToName = ref<Record<string, string>>({});
  let rolesPromise: Promise<void> | null = null;
  
  // Load current user's role information
  const loadUserRole = async () => {
    // If already loading, return the existing promise
    if (rolesPromise) return rolesPromise;
    
    // Create new promise for loading
    rolesPromise = (async () => {
      try {
        // Load current user with populated role
        // We need to explicitly request the role relation to be populated
        const userData = await apiClient.getCurrentUser();
        
        if (userData?.role) {
          const role = userData.role;
          if (role.name && role.id) {
            // Store the mapping
            roleIdToName.value = { [role.id]: role.name };
            
            // Also update the current user info if needed
            if (!currentUserRole.value?.name && currentUserRole.value?.id === role.id) {
              currentUserRole.value.name = role.name;
              currentUserRole.value.admin_access = role.admin_access;
            }
            
            logDebug('Loaded user role from /users/me', { 
              roleId: role.id, 
              roleName: role.name,
              adminAccess: role.admin_access
            });
          }
        }
      } catch (error: any) {
        logDebug('Failed to load user role information', {
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        // Reset promise on error so it can be retried
        rolesPromise = null;
      }
    })();
    
    return rolesPromise;
  };
  
  // Load user role on mount
  onMounted(() => {
    loadUserRole();
  });
  
  // Also trigger loading immediately
  // This ensures we have role info as soon as possible
  loadUserRole();
  
  logDebug('Permission checks initialized - User Details', {
    userId: currentUser.value?.id,
    userName: currentUser.value?.first_name + ' ' + currentUser.value?.last_name,
    email: currentUser.value?.email,
    role: currentUserRole.value,
    roleType: typeof currentUserRole.value,
    roleId: currentUserRole.value?.id || currentUserRole.value,
    roleName: currentUserRole.value?.name,
    roleAdminAccess: currentUser.value?.role?.admin_access,
    fullUser: JSON.stringify(currentUser.value, null, 2)
  });
  
  /**
   * Check if current user's role is in the allowed roles list
   * @param roleNames - Array of allowed role names
   * @returns true if user has permission or no roles are defined (open access)
   */
  function hasPermission(roleNames: string[] | undefined): boolean {
    // If no roles defined, everyone has permission (backward compatibility)
    if (!roleNames || roleNames.length === 0) {
      return true;
    }
    
    // Make sure user role is loaded (but we can't await here in a sync function)
    // So we just trigger the load if needed
    if (!rolesPromise) {
      loadUserRole();
      // For the first check, we might not have role info yet
      // The permissions will be re-evaluated once role is loaded
    }
    
    // Admin always has permission
    if (currentUser.value?.role?.admin_access === true) {
      return true;
    }
    
    // Check if user's role name is in the allowed list
    // Try multiple ways to get the role name
    let userRoleName = null;
    let userRoleId = null;
    
    // Get role ID first
    if (typeof currentUserRole.value === 'string') {
      userRoleId = currentUserRole.value;
    } else if (typeof currentUser.value?.role === 'string') {
      userRoleId = currentUser.value.role;
    } else if (currentUserRole.value?.id) {
      userRoleId = currentUserRole.value.id;
    }
    
    // Try to get role name
    // Method 1: Direct from currentUserRole if it's an object
    if (currentUserRole.value?.name) {
      userRoleName = currentUserRole.value.name;
    }
    // Method 2: From currentUser.role when it's an object
    else if (currentUser.value?.role && typeof currentUser.value.role === 'object' && currentUser.value.role.name) {
      userRoleName = currentUser.value.role.name;
    }
    // Method 3: Look up in roleIdToName map
    else if (userRoleId && roleIdToName.value[userRoleId]) {
      userRoleName = roleIdToName.value[userRoleId];
      logDebug('Found role name from ID map', { roleId: userRoleId, roleName: userRoleName });
    }
    
    const hasAccess = userRoleName ? roleNames.some(roleName => 
      roleName.toLowerCase() === userRoleName.toLowerCase()
    ) : false;
    
    logDebug('Permission check', {
      userRoleId,
      userRoleName,
      roleIdToNameMap: roleIdToName.value,
      currentUserRole: currentUserRole.value,
      allowedRoles: roleNames,
      hasAccess
    });
    
    return hasAccess;
  }
  
  // Computed permissions based on options
  const canChangeStatus = computed(() => {
    return hasPermission(mergedOptions.value?.rolesCanChangeStatus);
  });
  
  const canSort = computed(() => {
    // Also check if sorting is enabled at all
    if (mergedOptions.value?.enableSorting === false) {
      return false;
    }
    return hasPermission(mergedOptions.value?.rolesCanSort);
  });
  
  const canAddBlocks = computed(() => {
    return hasPermission(mergedOptions.value?.rolesCanAddBlocks);
  });
  
  const canDelete = computed(() => {
    // Also check if delete is allowed at all
    if (mergedOptions.value?.isAllowedDelete === false) {
      return false;
    }
    return hasPermission(mergedOptions.value?.rolesCanDelete);
  });
  
  const canDuplicate = computed(() => {
    // Also check if duplicate is allowed at all
    if (mergedOptions.value?.isAllowedDuplicate === false) {
      return false;
    }
    return hasPermission(mergedOptions.value?.rolesCanDuplicate);
  });
  
  return {
    canChangeStatus,
    canSort,
    canAddBlocks,
    canDelete,
    canDuplicate,
    hasPermission
  };
}