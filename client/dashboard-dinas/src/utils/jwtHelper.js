// Helper function to decode JWT token and extract claims
export const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('[JWT] Error decoding token:', error);
    return null;
  }
};

// Get department from stored admin user
export const getDepartmentFromStorage = () => {
  try {
    const adminUser = localStorage.getItem('admin_user');
    if (adminUser) {
      const user = JSON.parse(adminUser);
      return user.department || 'general';
    }
  } catch (error) {
    console.error('[JWT] Error getting department from storage:', error);
  }
  return 'general';
};
