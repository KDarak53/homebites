import { apiSlice } from './apiSlice';

export const productApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMenuByVendor: builder.query({
      query: (vendorId) => `/products/vendor/${vendorId}`,
      providesTags: ['Product'],
    }),
    getMyMenu: builder.query({
      query: () => '/products/me',
      providesTags: ['Product'],
    }),
    createProduct: builder.mutation({
      query: (body) => ({ url: '/products', method: 'POST', body }),
      invalidatesTags: ['Product'],
    }),
    updateProduct: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/products/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Product'],
    }),
    openNextBatch: builder.mutation({
      query: ({ id, prebookOpensAt, prebookCutoffTime, collectionStartTime, collectionEndTime }) => ({
        url: `/products/${id}/open-next-batch`,
        method: 'POST',
        body: { prebookOpensAt, prebookCutoffTime, collectionStartTime, collectionEndTime },
      }),
      invalidatesTags: ['Product'],
    }),
    deleteProduct: builder.mutation({
      query: (id) => ({ url: `/products/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Product'],
    }),
  }),
});

export const {
  useGetMenuByVendorQuery,
  useGetMyMenuQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useOpenNextBatchMutation,
  useDeleteProductMutation,
} = productApi;
