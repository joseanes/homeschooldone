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

/**
 * Gets today's date at start of day (00:00:00)
 */
export function getTodayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Gets tomorrow's date at start of day (00:00:00)
 */
export function getTomorrowStart(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * Gets end of today (23:59:59.999)
 */
export function getTodayEnd(): Date {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

/**
 * Gets the start of the current week based on startOfWeek setting
 * @param startOfWeek - Day of week (0 = Sunday, 1 = Monday, etc.)
 */
export function getWeekStart(startOfWeek: number = 1): Date {
  const today = new Date();
  const day = today.getDay();
  // Calculate how many days back to go to reach the start of week
  const diff = (day - startOfWeek + 7) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Gets the end of the current week based on startOfWeek setting
 * @param startOfWeek - Day of week (0 = Sunday, 1 = Monday, etc.)
 */
export function getWeekEnd(startOfWeek: number = 1): Date {
  const weekStart = getWeekStart(startOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Gets the current date in a specific timezone as YYYY-MM-DD
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 */
export function getCurrentDateInTimezone(timezone: string = 'America/New_York'): string {
  const now = new Date();
  // Create a formatter for the selected timezone
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
}