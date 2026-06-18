// Generate a cryptographically random 8-character alphanumeric string for public dashboard URLs
export const generatePublicDashboardId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
};

// Validate that a public dashboard ID format is correct
export const isValidPublicDashboardId = (id: string): boolean => {
  return /^[a-zA-Z0-9]{8}$/.test(id);
};