const LEGACY_AUTH_TOKEN_STORAGE_KEY = 'vtc_access_token_fallback';

export const removeStoredAuthToken = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
    window.dispatchEvent(new Event('vtc:auth-changed'));
  } catch {
    // ignore localStorage failures
  }
};
