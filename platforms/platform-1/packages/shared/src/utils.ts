import { randomUUID } from 'crypto';

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

export function generateId(): string {
  return randomUUID();
}