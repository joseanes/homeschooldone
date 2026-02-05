// Generate a random 8-character alphanumeric string for public dashboard URLs
export const generatePublicDashboardId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Validate that a public dashboard ID format is correct
export const isValidPublicDashboardId = (id: string): boolean => {
  return /^[a-zA-Z0-9]{8}$/.test(id);
};