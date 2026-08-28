// Matches backend/utils/seed.js's BASE location, so the demo vendors show up
// as "nearby" by default without requiring real browser geolocation to
// happen to line up with wherever the seed data was generated.
export const DEFAULT_LOCATION = { latitude: 12.573853983599701, longitude: 80.1385725280079 }; // Chennai

// Uploaded images are returned as paths like "/uploads/xyz.png" relative to
// the API server (not the frontend dev server) — prefix with this to render them.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
