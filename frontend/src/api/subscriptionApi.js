import { apiSlice } from './apiSlice';

export const subscriptionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createPlan: builder.mutation({
      query: (body) => ({ url: '/subscriptions/plans', method: 'POST', body }),
      invalidatesTags: ['SubscriptionPlans'],
    }),
    getMyPlans: builder.query({
      query: () => '/subscriptions/plans/me',
      providesTags: ['SubscriptionPlans'],
    }),
    updatePlan: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/subscriptions/plans/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['SubscriptionPlans'],
    }),
    getVendorPlans: builder.query({
      query: (vendorId) => `/subscriptions/plans/vendor/${vendorId}`,
      providesTags: ['SubscriptionPlans'],
    }),
    getRoster: builder.query({
      query: () => '/subscriptions/vendor/roster',
    }),
    initiateSubscriptionPayment: builder.mutation({
      query: (body) => ({ url: '/subscriptions/initiate', method: 'POST', body }),
    }),
    confirmSubscriptionPayment: builder.mutation({
      query: (body) => ({ url: '/subscriptions/confirm', method: 'POST', body }),
      invalidatesTags: ['Subscriptions'],
    }),
    getMySubscriptions: builder.query({
      query: () => '/subscriptions/my',
      providesTags: ['Subscriptions'],
    }),
    skipSubscriptionDate: builder.mutation({
      query: ({ id, date }) => ({ url: `/subscriptions/${id}/skip`, method: 'PATCH', body: { date } }),
      invalidatesTags: ['Subscriptions'],
    }),
    cancelSubscription: builder.mutation({
      query: (id) => ({ url: `/subscriptions/${id}/cancel`, method: 'PATCH' }),
      invalidatesTags: ['Subscriptions'],
    }),
  }),
});

export const {
  useCreatePlanMutation,
  useGetMyPlansQuery,
  useUpdatePlanMutation,
  useGetVendorPlansQuery,
  useGetRosterQuery,
  useInitiateSubscriptionPaymentMutation,
  useConfirmSubscriptionPaymentMutation,
  useGetMySubscriptionsQuery,
  useSkipSubscriptionDateMutation,
  useCancelSubscriptionMutation,
} = subscriptionApi;
