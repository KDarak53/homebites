import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Vendor', 'Product', 'Order', 'VendorProfile', 'Me', 'AdminPendingVendors', 'AdminAllVendors', 'AdminSettings', 'Notifications', 'SubscriptionPlans', 'Subscriptions'],
  endpoints: () => ({}),
});
