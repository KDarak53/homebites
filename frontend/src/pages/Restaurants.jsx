import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useGetNearbyVendorsQuery } from '../api/vendorApi';
import useGeolocation from '../hooks/useGeolocation';
import { DEFAULT_LOCATION } from '../constants';
import { getVendorVisual } from '../utils/vendorVisuals';

function VendorCardSkeleton() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-xl bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-slate-200 rounded w-2/3" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-200 rounded w-1/3" />
        </div>
      </div>
    </div>
  );
}

export default function Restaurants() {
  const { coords } = useGeolocation();
  // Filters live in the URL (not component state) so they survive navigating
  // to a vendor page and back — component state would reset on remount.
  const [searchParams, setSearchParams] = useSearchParams();
  const [showLocationEditor, setShowLocationEditor] = useState(false);

  const radiusKm = Number(searchParams.get('radius')) || 10;
  const veg = searchParams.get('veg') === 'true';
  const sort = searchParams.get('sort') || 'rating';
  const location = searchParams.has('lat')
    ? { latitude: Number(searchParams.get('lat')), longitude: Number(searchParams.get('lng')) }
    : DEFAULT_LOCATION;

  // replace (not push) so tweaking filters doesn't pile up history entries —
  // one "back" from a vendor page should return here in one step.
  const updateParams = (updates) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([k, v]) => next.set(k, String(v)));
        return next;
      },
      { replace: true }
    );
  };

  // Once real browser geolocation resolves, prefer it — but only if the user
  // hasn't already set/edited a location (e.g. via back-navigation).
  useEffect(() => {
    if (coords && !searchParams.has('lat')) {
      updateParams({ lat: coords.latitude, lng: coords.longitude });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  const { data: vendors, isLoading, isFetching, error } = useGetNearbyVendorsQuery({
    lng: location.longitude,
    lat: location.latitude,
    radiusKm,
    veg,
    sort,
  });

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6 pt-2">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
          Home kitchens near you <span className="text-2xl">🏡</span>
        </h1>
        <p className="text-slate-500 mt-1">Fresh, home-cooked meals from local kitchens — ready when you are.</p>
      </div>

      <div className="flex flex-wrap gap-4 items-center card p-4 mb-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          📍 Within
          <select value={radiusKm} onChange={(e) => updateParams({ radius: e.target.value })} className="input py-1.5">
            {[2, 5, 10, 15, 25].map((r) => (
              <option key={r} value={r}>{r} km</option>
            ))}
          </select>
        </label>

        <button
          onClick={() => updateParams({ veg: !veg })}
          className={veg ? 'badge-green !py-1.5 !px-3' : 'badge-slate !py-1.5 !px-3'}
        >
          🌱 Veg only
        </button>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          Sort by
          <select value={sort} onChange={(e) => updateParams({ sort: e.target.value })} className="input py-1.5">
            <option value="rating">⭐ Rating</option>
            <option value="orders">🔥 Orders completed</option>
            <option value="distance">📍 Nearest first</option>
          </select>
        </label>

        <button
          onClick={() => setShowLocationEditor((s) => !s)}
          className="text-sm text-orange-600 font-semibold ml-auto hover:text-orange-700"
        >
          {showLocationEditor ? 'Hide location' : '✎ Change location'}
        </button>
      </div>

      {showLocationEditor && (
        <div className="flex flex-wrap items-end gap-3 card p-4 mb-6 text-sm">
          <label className="flex flex-col gap-1">
            Latitude
            <input
              type="number"
              step="0.0001"
              value={location.latitude}
              onChange={(e) => updateParams({ lat: e.target.value })}
              className="input w-32 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            Longitude
            <input
              type="number"
              step="0.0001"
              value={location.longitude}
              onChange={(e) => updateParams({ lng: e.target.value })}
              className="input w-32 py-1.5"
            />
          </label>
          <button onClick={() => updateParams({ lat: DEFAULT_LOCATION.latitude, lng: DEFAULT_LOCATION.longitude })} className="text-slate-500 underline">
            Reset to default location
          </button>
        </div>
      )}

      {error && <p className="text-red-600">Could not load vendors.</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        {(isLoading || isFetching) && !vendors
          ? Array.from({ length: 4 }).map((_, i) => <VendorCardSkeleton key={i} />)
          : vendors?.map((v) => {
              const { emoji, gradient } = getVendorVisual(v._id);
              return (
                <Link
                  key={v._id}
                  to={`/vendors/${v._id}`}
                  className="card card-hover p-4 flex gap-3 group"
                >
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} shrink-0 flex items-center justify-center text-2xl shadow-inner`}
                  >
                    {emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-start gap-2">
                      <h2 className="font-semibold text-slate-800 truncate group-hover:text-orange-600 transition-colors">
                        {v.businessName}
                      </h2>
                      <span className="flex gap-1 shrink-0">
                        {v.isPro && <span className="badge-amber">⭐ Pro</span>}
                        {v.isNew && <span className="badge-blue">✨ New</span>}
                        {v.isVegOnly && <span className="badge-veg">VEG</span>}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      <span className="text-amber-500">★</span> {v.averageRating.toFixed(1)} ({v.ratingCount}) &middot; {v.totalOrdersCompleted} orders
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                      <span className={v.deliveryEnabled ? 'badge-blue' : 'badge-slate'}>
                        {v.deliveryEnabled ? `🛵 Up to ${v.maxDeliveryRadiusKm}km` : '🥡 Takeaway only'}
                      </span>
                      {v.distanceKm != null && (
                        <span title="Straight-line distance — actual travel distance by road may be longer" className="badge-slate">
                          ~{v.distanceKm}km away
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              );
            })}
      </div>

      {vendors && vendors.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">🔍🍽️</p>
          <p className="text-slate-500">No vendors found in this radius. Try widening your search or changing location.</p>
        </div>
      )}
    </div>
  );
}
