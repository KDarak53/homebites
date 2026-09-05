import { apiSlice } from './apiSlice';

export const vendorApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getNearbyVendors: builder.query({
      query: ({ lng, lat, radiusKm, veg, sort }) => ({
        url: '/vendors',
        params: { lng, lat, radiusKm, veg, sort },
      }),
      providesTags: ['Vendor'],
    }),
    getVendorById: builder.query({
      query: (id) => `/vendors/${id}`,
      providesTags: ['Vendor'],
    }),
    getMyVendorProfile: builder.query({
      query: () => '/vendors/me/profile',
      providesTags: ['VendorProfile'],
    }),
    updateFulfillmentSettings: builder.mutation({
      query: (body) => ({ url: '/vendors/me/settings', method: 'PATCH', body }),
      invalidatesTags: ['VendorProfile'],
    }),
    resubmitForApproval: builder.mutation({
      query: () => ({ url: '/vendors/me/resubmit', method: 'POST' }),
      invalidatesTags: ['VendorProfile'],
    }),
    getVendorAnalytics: builder.query({
      query: (range) => ({ url: '/vendors/me/analytics', params: { range } }),
      providesTags: ['Order'],
    }),
    initiateProUpgrade: builder.mutation({
      query: () => ({ url: '/vendors/me/upgrade/initiate', method: 'POST' }),
    }),
    confirmProUpgrade: builder.mutation({
      query: (body) => ({ url: '/vendors/me/upgrade/confirm', method: 'POST', body }),
      invalidatesTags: ['VendorProfile', 'Vendor'],
    }),
  }),
});

export const {
  useGetNearbyVendorsQuery,
  useGetVendorByIdQuery,
  useGetMyVendorProfileQuery,
  useUpdateFulfillmentSettingsMutation,
  useResubmitForApprovalMutation,
  useGetVendorAnalyticsQuery,
  useInitiateProUpgradeMutation,
  useConfirmProUpgradeMutation,
} = vendorApi;
