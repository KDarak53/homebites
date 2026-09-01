// Matches backend/utils/seed.js's BASE location, so the demo vendors show up
// as "nearby" by default without requiring real browser geolocation to
// happen to line up with wherever the seed data was generated.
// 6 decimal places is already sub-meter precision — the extra digits this
// carried before just made every lat/lng input field longer than it needed
// to be for no real benefit.
export const DEFAULT_LOCATION = { latitude: 12.573854, longitude: 80.138573 }; // Chennai

// Uploaded images are returned as paths like "/uploads/xyz.png" relative to
// the API server (not the frontend dev server) — prefix with this to render them.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

// Menu/kitchen photos are either an uploaded file (a relative "/uploads/..."
// path, needing the API origin prefixed) or a seeded external URL (already
// absolute) — this handles both so seed data can point straight at stock
// photo URLs without needing to upload anything.
export const resolveImageUrl = (url) => (/^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`);

// A <input type="datetime-local"> value (e.g. "2026-09-01T09:15") has no
// timezone attached — `new Date(...)` on THIS browser correctly reads it as
// this browser's local wall-clock time (which is what the user actually
// picked), but sending that raw string to the API is a trap: the server
// re-parses it as ITS OWN local time. Locally that's a no-op if dev server
// and browser share a timezone, but in production the API runs in a
// different timezone (e.g. UTC on Render) than the browser (e.g. IST) — the
// same clock-face string then means a different real moment, silently
// shifting order windows by whole hours. Always convert to a real UTC
// instant client-side before it leaves the browser.
export const localDatetimeToISO = (value) => (value ? new Date(value).toISOString() : null);
