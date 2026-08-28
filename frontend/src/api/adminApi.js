import { apiSlice } from './apiSlice';

export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPendingVendors: builder.query({
      query: () => '/admin/vendors/pending',
      providesTags: ['AdminPendingVendors'],
    }),
    approveVendor: builder.mutation({
      query: (id) => ({ url: `/admin/vendors/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['AdminPendingVendors'],
    }),
    rejectVendor: builder.mutation({
      query: ({ id, reason }) => ({ url: `/admin/vendors/${id}/reject`, method: 'POST', body: { reason } }),
      invalidatesTags: ['AdminPendingVendors'],
    }),
    getAdminSettings: builder.query({
      query: () => '/admin/settings',
      providesTags: ['AdminSettings'],
    }),
    updateAdminSettings: builder.mutation({
      query: (body) => ({ url: '/admin/settings', method: 'PATCH', body }),
      invalidatesTags: ['AdminSettings'],
    }),
    getAdminOverview: builder.query({
      query: () => '/admin/overview',
      providesTags: ['AdminPendingVendors'],
    }),
  }),
});

export const {
  useGetPendingVendorsQuery,
  useApproveVendorMutation,
  useRejectVendorMutation,
  useGetAdminSettingsQuery,
  useUpdateAdminSettingsMutation,
  useGetAdminOverviewQuery,
} = adminApi;
