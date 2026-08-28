import { useEffect, useState } from 'react';

// Returns { longitude, latitude } once the browser geolocation resolves,
// falling back to null so callers can show a manual-entry prompt.
export default function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ longitude: pos.coords.longitude, latitude: pos.coords.latitude }),
      (err) => setError(err.message)
    );
  }, []);

  return { coords, error };
}
