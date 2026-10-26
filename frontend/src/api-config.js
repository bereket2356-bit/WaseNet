/**
 * WaseNet API URL Configuration
 * If VITE_API_URL is set in environment (e.g. on Vercel), uses direct backend endpoint.
 * Otherwise defaults to relative '/api' which works with Vercel rewrites and Vite proxy.
 */
export const BACKEND_BASE = 'https://wasenet-backend.onrender.com';
export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(endpoint) {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
}

let cachedAuthToken = null;

export async function getAuthToken() {
  if (cachedAuthToken) return cachedAuthToken;
  const loginPayload = { username: 'admin', password: 'Admin@WaseNet2026!' };
  const targets = [
    '/api/v1/auth/login',
    `${BACKEND_BASE}/api/v1/auth/login`
  ];
  for (const t of targets) {
    try {
      const res = await fetch(t, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPayload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          cachedAuthToken = data.access_token;
          return cachedAuthToken;
        }
      }
    } catch (e) {}
  }
  return null;
}

export async function fetchApi(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const opt = { ...options, headers: { ...(options.headers || {}) } };

  // Ensure Authorization header is present for document issuance/queue sync
  if (cleanEndpoint.includes('/documents') && (opt.method === 'POST' || opt.method === 'PUT')) {
    if (!opt.headers['Authorization']) {
      const token = await getAuthToken();
      if (token) {
        opt.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  const paths = [];

  // 1. Direct path (relative to origin, works through Vite proxy or same-host deployment)
  paths.push(cleanEndpoint);

  // 2. Direct OnRender backend URL
  paths.push(`${BACKEND_BASE}${cleanEndpoint}`);

  // 3. Fallback to direct local backend port if running on Vite dev (5173) or file
  if (typeof window !== 'undefined' && window.location.port !== '5000') {
    paths.push(`http://localhost:5000${cleanEndpoint}`);
  }

  let lastErr = null;
  for (const p of paths) {
    try {
      const res = await fetch(p, opt);
      if (res.status < 500) {
        return res;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Network error');
}

