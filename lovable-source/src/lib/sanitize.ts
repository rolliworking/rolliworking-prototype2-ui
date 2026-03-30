/**
 * Sanitization utilities for preventing SQL injection and XSS attacks
 */

/**
 * Escapes SQL LIKE/ILIKE wildcards to prevent pattern injection
 * Use this before passing user input to Supabase .ilike() or .like() queries
 */
export function escapeSqlWildcards(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

/**
 * Sanitizes a search term for safe use in SQL queries
 * Trims whitespace and escapes wildcards
 */
export function sanitizeSearchTerm(input: string): string {
  return escapeSqlWildcards(input.trim());
}

/**
 * Validates and sanitizes a UUID string
 * Returns null if invalid
 */
export function sanitizeUUID(input: string): string | null {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const trimmed = input.trim();
  return uuidRegex.test(trimmed) ? trimmed : null;
}

/**
 * Sanitizes a string for safe use in URLs
 */
export function sanitizeForUrl(input: string): string {
  return encodeURIComponent(input.trim());
}

/**
 * Removes HTML tags from a string (basic XSS prevention)
 * For full protection, use DOMPurify for HTML content
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Validates that input is within safe length limits
 */
export function validateLength(input: string, maxLength: number): boolean {
  return input.length <= maxLength;
}

/**
 * Truncates a string to a maximum length (useful for preventing DoS via large inputs)
 */
export function truncate(input: string, maxLength: number): string {
  return input.length > maxLength ? input.slice(0, maxLength) : input;
}
