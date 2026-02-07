import { Timestamp } from 'firebase/firestore';

/**
 * Creates a UTC date from a date string (YYYY-MM-DD) at midnight UTC
 */
export function createUTCDateFromString(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Gets the start of day in UTC for a given date
 */
export function getStartOfDayUTC(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Gets the end of day in UTC for a given date
 */
export function getEndOfDayUTC(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

/**
 * Converts a date string to a Firestore Timestamp for consistent storage
 */
export function dateToFirestoreTimestamp(dateString: string): Timestamp {
  const utcDate = createUTCDateFromString(dateString);
  return Timestamp.fromDate(utcDate);
}

/**
 * Formats a Date object to YYYY-MM-DD string using local date
 */
export function formatDateToString(date: Date | any): string {
  // Handle Firestore Timestamp objects
  const dateObj = date?.toDate ? date.toDate() : date;
  // Use local date components to avoid timezone issues
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date object to YYYY-MM-DD string using UTC date
 * This is used when we need to match dates stored as UTC in Firestore
 */
export function formatDateToStringUTC(date: Date | any): string {
  // Handle Firestore Timestamp objects
  const dateObj = date?.toDate ? date.toDate() : date;
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}