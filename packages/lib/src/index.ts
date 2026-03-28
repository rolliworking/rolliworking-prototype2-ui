// ==============================================
// Shared Utility Functions for RolliSuite
// ==============================================
// These utilities are used across frontend and backend
// ==============================================

/**
 * Normalize estimate number by stripping prefixes (EST-, E)
 * Critical for RolliWorking webhook matching
 */
export function normalizeEstimateNumber(estimateNumber: string): string {
  return estimateNumber.replace(/^(EST-|E)/, '');
}

/**
 * Format estimate number with E prefix
 */
export function formatEstimateNumber(number: number | string): string {
  const num = typeof number === 'string' ? parseInt(number, 10) : number;
  return `E${num.toString().padStart(5, '0')}`;
}

/**
 * Format currency (USD)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(
    'en-US',
    options || {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  ).format(d);
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize string for XSS prevention
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Generate short code (for URLs, verification codes)
 */
export function generateShortCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar chars
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if value is empty
 */
export function isEmpty(value: any): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  );
}

// More utilities to be added as needed
