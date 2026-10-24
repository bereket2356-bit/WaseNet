/**
 * WaseNet API URL Configuration
 * If VITE_API_URL is set in environment (e.g. on Vercel), uses direct backend endpoint.
 * Otherwise defaults to relative '/api' which works with Vercel rewrites and Vite proxy.
 */
export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(endpoint) {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
}
