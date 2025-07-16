# Security Considerations

This page outlines the security measures, best practices, and considerations implemented in the Expandable Blocks extension.

## 🔐 Overview

The Expandable Blocks extension is designed with security as a fundamental principle. All operations respect Directus' built-in security model while adding additional layers of protection.

## 🛡️ Permission System

### Directus Permission Integration

The extension fully respects Directus' role-based access control (RBAC):

```typescript
// All API calls use authenticated user context
const items = await api.get(`/items/${collection}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Permission Checks

1. **Collection-Level Permissions**
   - Read permissions required to view blocks
   - Create permissions required to add blocks
   - Update permissions required to edit blocks
   - Delete permissions required to remove blocks

2. **Field-Level Permissions**
   - Hidden fields are not displayed
   - Read-only fields cannot be edited
   - Field permissions cascade to nested relationships

3. **Custom Permission Options**
   ```typescript
   interface SecurityOptions {
     isAllowedDelete?: boolean;     // Additional delete restriction
     isAllowedDuplicate?: boolean;  // Additional duplicate restriction
     maxBlocks?: number | null;     // Enforce block limits
   }
   ```

## 🔒 Data Validation

### Server-Side Validation

All data modifications are validated server-side:

```typescript
// Client-side prepares data
const preparedData = prepareItemsForEmit(items);

// Server validates before saving
// - Field types
// - Required fields
// - Relationship integrity
// - Custom validation rules
```

### Input Sanitization

1. **No Direct HTML Rendering**
   ```vue
   <!-- Safe: Uses text interpolation -->
   <span>{{ userInput }}</span>
   
   <!-- Never used: Direct HTML -->
   <span v-html="userInput"></span>
   ```

2. **Attribute Binding Safety**
   ```vue
   <!-- Safe attribute binding -->
   <div :class="sanitizedClass" :data-id="escapeHtml(id)">
   ```

3. **Template Security**
   - All user inputs are escaped
   - No dynamic template compilation
   - Safe interpolation only

## 🚫 XSS Prevention

### Content Security Policy Compliance

The extension follows CSP best practices:

```javascript
// No inline scripts
// No eval() usage
// No dynamic code execution
// All scripts loaded from trusted sources
```

### Safe Data Handling

```typescript
// Example: Safe title rendering
const getSafeTitle = (item: any): string => {
  const title = getBlockTitle(item);
  // Title is automatically escaped by Vue
  return title || 'Untitled';
};
```

### Event Handler Safety

```vue
<!-- Safe event handling -->
<button @click="handleClick($event)">
  Click me
</button>

<!-- Methods validate all inputs -->
<script>
const handleClick = (event: MouseEvent) => {
  // Validate and sanitize any user input
  const target = event.target as HTMLElement;
  const safeData = sanitizeInput(target.dataset.value);
  processAction(safeData);
};
</script>
```

## 🔑 CSRF Protection

### Token-Based Authentication

The extension uses Directus' authentication system:

```typescript
// Tokens are managed by Directus
// Automatic CSRF protection
// Secure session handling
// Token refresh handled by core
```

### State Management Security

```typescript
// State is isolated per component instance
const blockStates = ref<Map<string, any>>(new Map());

// No global state pollution
// No cross-component data leakage
// Proper cleanup on unmount
```

## 🛡️ API Security

### Secure API Calls

All API interactions follow security best practices:

```typescript
class SecureAPIClient {
  async fetchData(collection: string, id: string) {
    // Validate inputs
    if (!isValidCollection(collection)) {
      throw new Error('Invalid collection');
    }
    
    // Use parameterized queries
    const response = await api.get(
      `/items/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`
    );
    
    // Validate response
    return validateResponse(response);
  }
}
```

### Query Parameter Safety

```typescript
// Safe query building
const buildSafeQuery = (params: QueryParams): string => {
  const safe = {
    fields: sanitizeFields(params.fields),
    filter: sanitizeFilter(params.filter),
    limit: Math.min(params.limit || 100, 1000),
    page: Math.max(params.page || 1, 1)
  };
  
  return new URLSearchParams(safe).toString();
};
```

## 🔐 Sensitive Data Handling

### Password Fields

```typescript
// Password fields are never displayed
const isPasswordField = (field: Field): boolean => {
  return field.type === 'password' || 
         field.meta?.interface === 'input-hash';
};

// Filter out sensitive fields
const displayableFields = fields.filter(
  field => !isPasswordField(field) && !field.meta?.hidden
);
```

### Personal Data Protection

1. **No Client-Side Storage**
   - No sensitive data in localStorage
   - No sensitive data in sessionStorage
   - No sensitive data in cookies

2. **Memory Cleanup**
   ```typescript
   onUnmounted(() => {
     // Clear sensitive data from memory
     blockStates.value.clear();
     blockOriginalStates.value.clear();
     loadingStates.value.clear();
   });
   ```

## 🚨 Error Handling Security

### Safe Error Messages

```typescript
const handleError = (error: any) => {
  // Don't expose internal details
  const safeMessage = error.response?.status === 403 
    ? 'Permission denied' 
    : 'An error occurred';
    
  notificationsStore.add({
    title: 'Error',
    text: safeMessage,
    type: 'error'
  });
  
  // Log full error for debugging (dev only)
  if (process.env.NODE_ENV === 'development') {
    console.error('Full error:', error);
  }
};
```

### Graceful Degradation

```typescript
// Fail safely without exposing system details
try {
  await riskyOperation();
} catch (error) {
  // Log securely
  logger.error('Operation failed', { 
    context: 'expandable-blocks',
    // Don't log sensitive data
    error: sanitizeError(error)
  });
  
  // Show user-friendly message
  showSafeError();
}
```

## 🔒 Development Security

### Secure Development Practices

1. **Dependencies**
   - Regular dependency updates
   - Security audit via `npm audit`
   - Only trusted packages used
   - Minimal dependency footprint

2. **Code Review**
   - Security-focused code reviews
   - Automated security scanning
   - Regular penetration testing
   - Community security reports

3. **Build Process**
   ```bash
   # Production builds with security flags
   npm run build -- --mode production
   
   # Minification obscures code
   # Source maps disabled in production
   # Development tools stripped
   ```

## 🛡️ Security Checklist

### For Administrators

- [ ] Configure Directus permissions properly
- [ ] Set appropriate field-level restrictions
- [ ] Enable rate limiting on API
- [ ] Use HTTPS in production
- [ ] Regular security updates
- [ ] Monitor access logs

### For Developers

- [ ] Validate all inputs
- [ ] Escape all outputs
- [ ] Use parameterized queries
- [ ] Follow OWASP guidelines
- [ ] Regular security training
- [ ] Security-first mindset

## 🚨 Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Email security concerns to: security@smartlabs.at
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We follow responsible disclosure practices and will:
- Acknowledge receipt within 48 hours
- Provide regular updates on progress
- Credit researchers (if desired)
- Release patches promptly

## 📚 Security Resources

### References
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Directus Security Docs](https://docs.directus.io/security)
- [Vue.js Security Guide](https://vuejs.org/guide/best-practices/security.html)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

### Tools
- `npm audit` - Dependency vulnerability scanning
- ESLint security plugins
- OWASP ZAP for penetration testing
- Snyk for continuous monitoring