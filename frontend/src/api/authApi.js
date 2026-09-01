import { apiSlice } from './apiSlice';

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({ url: '/auth/login', method: 'POST', body: credentials }),
    }),
    loginVendor: builder.mutation({
      query: (credentials) => ({ url: '/auth/login-vendor', method: 'POST', body: credentials }),
    }),
    registerCustomer: builder.mutation({
      query: (data) => ({ url: '/auth/register', method: 'POST', body: data }),
    }),
    registerVendor: builder.mutation({
      query: (data) => ({ url: '/auth/register-vendor', method: 'POST', body: data }),
    }),
    verifyEmail: builder.mutation({
      query: (token) => ({ url: '/auth/verify-email', method: 'POST', body: { token } }),
    }),
    resendVerification: builder.mutation({
      query: (body) => ({ url: '/auth/resend-verification', method: 'POST', body }),
    }),
    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['Me'],
    }),
    updateMe: builder.mutation({
      query: (body) => ({ url: '/auth/me', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
    }),
  }),
});

export const {
  useLoginMutation,
  useLoginVendorMutation,
  useRegisterCustomerMutation,
  useRegisterVendorMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useGetMeQuery,
  useUpdateMeMutation,
} = authApi;
