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
 * Converts a date string to a Firestore Timestamp in the user's timezone
 * When user picks "Feb 18, 2024", they mean Feb 18 in THEIR timezone, not UTC
 * @param dateString - YYYY-MM-DD format
 * @param timezone - User's timezone (e.g., 'America/New_York')
 */
export function dateToFirestoreTimestamp(dateString: string, timezone: string = 'America/New_York'): Timestamp {
  // For date-only storage, we use midnight in the user's timezone
  // This ensures consistent date boundaries regardless of browser timezone
  return localDateTimeToFirestoreTimestamp(dateString, '00:00', timezone);
}

/**
 * Converts a local date/time string to a Firestore Timestamp in the user's timezone
 * This properly handles timezone conversion when storing start/end times
 * 
 * @param dateString - Date in YYYY-MM-DD format (as entered by user)
 * @param timeString - Time in HH:MM format (24-hour, as entered by user) 
 * @param timezone - User's timezone (e.g., 'America/New_York')
 * @returns Firestore Timestamp in UTC
 */
export function localDateTimeToFirestoreTimestamp(dateString: string, timeString: string, timezone: string = 'America/New_York'): Timestamp {
  // Parse the date components
  const [year, month, day] = dateString.split('-').map(Number);
  const [hour, minute] = timeString.split(':').map(Number);
  
  // Create date string that represents this exact time in the user's timezone
  // We'll create multiple candidate UTC times and check which one matches
  const baseTime = new Date(`${dateString}T${timeString}:00`).getTime();
  
  // Try different UTC offsets (-12 to +14 hours covers all timezones)
  for (let offsetHours = -14; offsetHours <= 12; offsetHours++) {
    const candidateUTC = new Date(baseTime - (offsetHours * 60 * 60 * 1000));
    
    // Check if this UTC time produces the correct local time in the user's timezone
    const localStr = candidateUTC.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit', 
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // Parse the local string to compare
    const [localDate, localTime] = localStr.split(', ');
    const [localMonth, localDay, localYear] = localDate.split('/').map(Number);
    const [localHour, localMinute] = localTime.split(':').map(Number);
    
    // Check if this matches our target local time
    if (localYear === year && 
        localMonth === month && 
        localDay === day && 
        localHour === hour && 
        localMinute === minute) {
      return Timestamp.fromDate(candidateUTC);
    }
  }
  
  // Fallback: If we can't find exact match, use a more direct approach
  // This creates a date in the local timezone and adjusts for the offset
  console.warn(`Could not find exact timezone match for ${dateString} ${timeString} in ${timezone}, using fallback method`);
  
  // Get the timezone offset for this specific date
  const tempLocal = new Date(`${dateString}T${timeString}:00`);
  const tempUTC = new Date(`${dateString}T${timeString}:00Z`);
  
  // Format both dates in the target timezone to find the offset
  const localInTz = new Date(tempLocal.toLocaleString('en-US', { timeZone: timezone }));
  const utcInTz = new Date(tempUTC.toLocaleString('en-US', { timeZone: timezone }));
  
  const offsetMs = utcInTz.getTime() - localInTz.getTime();
  const resultDate = new Date(tempLocal.getTime() - offsetMs);
  
  return Timestamp.fromDate(resultDate);
}

/**
 * Formats a Date object to YYYY-MM-DD string using the user's timezone
 * This is used for displaying dates to the user
 */
export function formatDateToString(date: Date | any, timezone?: string): string {
  // Handle Firestore Timestamp objects
  const dateObj = date?.toDate ? date.toDate() : date;
  
  if (timezone) {
    // Format in the user's timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(dateObj);
  }
  
  // Fallback to local date components
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
 * Formats a timestamp to HH:MM string in the user's timezone
 * This is used for displaying times to the user
 */
export function formatTimeToString(timestamp: Date | any, timezone: string): string {
  // Handle Firestore Timestamp objects
  const dateObj = timestamp?.toDate ? timestamp.toDate() : timestamp;
  
  // Format in the user's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  return formatter.format(dateObj);
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
 * Gets the start of the current week based on startOfWeek setting in user's timezone
 * @param startOfWeek - Day of week (0 = Sunday, 1 = Monday, etc.)
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 */
export function getWeekStart(startOfWeek: number = 1, timezone: string = 'America/New_York'): Date {
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
 * Gets the end of the current week based on startOfWeek setting in user's timezone
 * @param startOfWeek - Day of week (0 = Sunday, 1 = Monday, etc.)
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 */
export function getWeekEnd(startOfWeek: number = 1, timezone: string = 'America/New_York'): Date {
  const weekStart = getWeekStart(startOfWeek, timezone);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Gets timezone-aware week boundaries for comparing with UTC stored dates
 * This converts the user's local week boundaries to UTC for proper comparison
 */
export function getWeekBoundariesInUTC(startOfWeek: number = 1, timezone: string = 'America/New_York'): { weekStart: Date; weekEnd: Date } {
  // Get current date in the user's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(part => part.type === 'year')?.value || '');
  const month = parseInt(parts.find(part => part.type === 'month')?.value || '') - 1;
  const day = parseInt(parts.find(part => part.type === 'day')?.value || '');
  
  // Create date object representing "today" in user's timezone
  const todayInUserTz = new Date();
  todayInUserTz.setFullYear(year, month, day);
  todayInUserTz.setHours(0, 0, 0, 0);
  
  const dayOfWeek = todayInUserTz.getDay();
  const diff = (dayOfWeek - startOfWeek + 7) % 7;
  
  const weekStart = new Date(todayInUserTz);
  weekStart.setDate(todayInUserTz.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { weekStart, weekEnd };
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