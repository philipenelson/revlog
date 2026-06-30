export const WEB_APP_URL = import.meta.env.PUBLIC_WEB_APP_URL || 'http://localhost:3000/login';
export const WEB_APP_BASE_URL = WEB_APP_URL.replace(/\/login$/, '');
export const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';
