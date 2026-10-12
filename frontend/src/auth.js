/**
 * WaseNet Authentication & RBAC Module (FR-1.1, FR-1.3)
 * JWT session handling with 8-hour absolute expiry, role-based navigation,
 * and form data preservation on session timeout.
 */

const TOKEN_KEY = 'wasenet_jwt';
const USER_KEY = 'wasenet_user';
const UNSAVED_FORM_PREFIX = 'wasenet_unsaved_form_';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

export function getCurrentUser() {
  try {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    const user = JSON.parse(userStr);

    // Validate 8-hour absolute expiry
    if (user.exp && Date.now() / 1000 >= user.exp) {
      clearSession();
      return null;
    }
    return user;
  } catch (e) {
    return null;
  }
}

export function isAuthenticated() {
  return getCurrentUser() !== null;
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (e) {}
}

export async function login(username, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      return { success: false, error: 'Sign-in failed. Check your username and password.' };
    }

    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return { success: true, user: data.user, token: data.token };
  } catch (err) {
    // Offline / Mock fallback for counter testing
    if (
      (username === 'issuer' && password === 'issuer123') ||
      (username === 'admin' && password === 'admin123')
    ) {
      const role = username === 'admin' ? 'administrator' : 'issuer';
      const user = {
        username,
        role,
        office: username === 'admin' ? 'National Registry Directorate' : 'Addis Ababa Sub-city Office 04',
        issuerCode: 'ET-AA-LAND-04',
        exp: Math.floor(Date.now() / 1000) + 8 * 3600 // 8-hour expiry
      };
      const mockToken = 'mock-jwt-' + btoa(JSON.stringify(user));
      localStorage.setItem(TOKEN_KEY, mockToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { success: true, user, token: mockToken };
    }
    return { success: false, error: 'Sign-in failed. Check your username and password.' };
  }
}

export function logout() {
  clearSession();
  window.location.href = 'login.html';
}

/**
 * Saves current form inputs into sessionStorage to preserve work on session timeout
 */
export function saveUnsavedForm(formElement, formId = 'default') {
  if (!formElement) return;
  const formData = {};
  const inputs = formElement.querySelectorAll('input, select, textarea');
  inputs.forEach((input) => {
    if (input.name && input.type !== 'password') {
      formData[input.name] = input.value;
    }
  });
  sessionStorage.setItem(UNSAVED_FORM_PREFIX + formId, JSON.stringify(formData));
}

/**
 * Restores unsaved form values
 */
export function restoreUnsavedForm(formElement, formId = 'default') {
  if (!formElement) return false;
  const raw = sessionStorage.getItem(UNSAVED_FORM_PREFIX + formId);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    for (const [key, val] of Object.entries(data)) {
      const input = formElement.querySelector(`[name="${key}"]`);
      if (input) {
        input.value = val;
      }
    }
    sessionStorage.removeItem(UNSAVED_FORM_PREFIX + formId);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Route protection guard
 */
export function guardPage(requiredRole = 'issuer', formElement = null, formId = 'default') {
  const user = getCurrentUser();

  if (!user) {
    if (formElement) {
      saveUnsavedForm(formElement, formId);
    }
    const target = encodeURIComponent(window.location.pathname.split('/').pop() || 'index.html');
    window.location.href = `login.html?redirect=${target}&session_expired=1`;
    return false;
  }

  // Check role authorization
  if (requiredRole === 'administrator' && user.role !== 'administrator') {
    window.location.href = 'issue.html';
    return false;
  }

  return true;
}
