import { apiSlice } from './apiSlice';

// Approve/reject/suspend/unsuspend all change a vendor's status, so each
// invalidates both list tags — whichever view (pending queue or full
// directory) the action was taken from, both stay in sync.
const VENDOR_LIST_TAGS = ['AdminPendingVendors', 'AdminAllVendors'];

export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllVendors: builder.query({
      query: () => '/admin/vendors',
      providesTags: VENDOR_LIST_TAGS,
    }),
    getVendorDetails: builder.query({
      query: (id) => `/admin/vendors/${id}/details`,
      // Plain (not id-scoped) tag, matching VENDOR_LIST_TAGS below — so a
      // suspend/approve/etc. on this vendor also refetches its open detail
      // panel, not just the list views.
      providesTags: VENDOR_LIST_TAGS,
    }),
    getItemHistory: builder.query({
      query: ({ vendorId, productId }) => `/admin/vendors/${vendorId}/items/${productId}/history`,
      providesTags: VENDOR_LIST_TAGS,
    }),
    getPendingVendors: builder.query({
      query: () => '/admin/vendors/pending',
      providesTags: VENDOR_LIST_TAGS,
    }),
    approveVendor: builder.mutation({
      query: (id) => ({ url: `/admin/vendors/${id}/approve`, method: 'POST' }),
      invalidatesTags: VENDOR_LIST_TAGS,
    }),
    rejectVendor: builder.mutation({
      query: ({ id, reason }) => ({ url: `/admin/vendors/${id}/reject`, method: 'POST', body: { reason } }),
      invalidatesTags: VENDOR_LIST_TAGS,
    }),
    requestVendorChanges: builder.mutation({
      query: ({ id, reason }) => ({ url: `/admin/vendors/${id}/request-changes`, method: 'POST', body: { reason } }),
      invalidatesTags: VENDOR_LIST_TAGS,
    }),
    suspendVendor: builder.mutation({
      query: ({ id, reason }) => ({ url: `/admin/vendors/${id}/suspend`, method: 'POST', body: { reason } }),
      invalidatesTags: VENDOR_LIST_TAGS,
    }),
    unsuspendVendor: builder.mutation({
      query: (id) => ({ url: `/admin/vendors/${id}/unsuspend`, method: 'POST' }),
      invalidatesTags: VENDOR_LIST_TAGS,
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
      providesTags: VENDOR_LIST_TAGS,
    }),
  }),
});

export const {
  useGetAllVendorsQuery,
  useGetVendorDetailsQuery,
  useGetItemHistoryQuery,
  useGetPendingVendorsQuery,
  useApproveVendorMutation,
  useRejectVendorMutation,
  useRequestVendorChangesMutation,
  useSuspendVendorMutation,
  useUnsuspendVendorMutation,
  useGetAdminSettingsQuery,
  useUpdateAdminSettingsMutation,
  useGetAdminOverviewQuery,
} = adminApi;
