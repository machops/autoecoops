export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

export function generateId(): string {
  // Use crypto.randomUUID() which is available in Node.js 16+ and modern browsers
  // For older environments, you may need to use a polyfill or UUID library
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for Node.js environments where global crypto is not available
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomUUID } = require('crypto');
  return randomUUID();
}