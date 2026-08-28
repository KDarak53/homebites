import { apiSlice } from './apiSlice';

export const orderApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    initiateOrderPayment: builder.mutation({
      query: (body) => ({ url: '/orders/initiate', method: 'POST', body }),
    }),
    confirmOrderPayment: builder.mutation({
      query: (body) => ({ url: '/orders/confirm', method: 'POST', body }),
      invalidatesTags: ['Order', 'Product'],
    }),
    getMyOrders: builder.query({
      query: () => '/orders/my',
      providesTags: ['Order'],
    }),
    getVendorDashboard: builder.query({
      query: () => '/orders/vendor/dashboard',
      providesTags: ['Order'],
    }),
    updateOrderStatus: builder.mutation({
      query: ({ id, status }) => ({ url: `/orders/${id}/status`, method: 'PATCH', body: { status } }),
      // Completing an order also bumps VendorProfile.totalOrdersCompleted.
      invalidatesTags: ['Order', 'VendorProfile'],
    }),
    rateOrder: builder.mutation({
      query: ({ id, rating, comment }) => ({ url: `/orders/${id}/rate`, method: 'POST', body: { rating, comment } }),
      // Rating also updates VendorProfile.averageRating.
      invalidatesTags: ['Order', 'VendorProfile', 'Vendor'],
    }),
    verifyPickup: builder.mutation({
      query: (code) => ({ url: '/orders/vendor/verify-pickup', method: 'POST', body: { code } }),
      invalidatesTags: ['Order', 'VendorProfile'],
    }),
  }),
});

export const {
  useInitiateOrderPaymentMutation,
  useConfirmOrderPaymentMutation,
  useGetMyOrdersQuery,
  useGetVendorDashboardQuery,
  useUpdateOrderStatusMutation,
  useRateOrderMutation,
  useVerifyPickupMutation,
} = orderApi;
