const AUTH_TOKEN_STORAGE_KEY = 'vtc_access_token_fallback';
const AUTH_TOKEN_COOKIE_KEY = 'vtc_session';

export const getStoredAuthToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const fromStorage = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (fromStorage) return fromStorage;
  } catch {
    // ignore localStorage failures in privacy modes
  }

  const cookieToken = getCookie(AUTH_TOKEN_COOKIE_KEY);
  return cookieToken;
};

export const setStoredAuthToken = (token: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    window.dispatchEvent(new Event('vtc:auth-changed'));
  } catch {
    // ignore localStorage failures
  }
};

export const removeStoredAuthToken = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.dispatchEvent(new Event('vtc:auth-changed'));
  } catch {
    // ignore localStorage failures
  }
};

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length < 2) return null;

  const raw = parts.pop()?.split(';').shift();
  if (!raw) return null;

  return decodeURIComponent(raw);
}
