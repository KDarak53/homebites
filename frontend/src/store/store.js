import { configureStore } from '@reduxjs/toolkit';
import { apiSlice } from '../api/apiSlice';
import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';

// Without this, RTK Query keeps serving cached responses from whoever was
// previously logged in — e.g. a new vendor's dashboard showing the last
// vendor's orders — because query cache keys don't include the auth token.
const resetApiCacheOnAuthChange = (store) => (next) => (action) => {
  const result = next(action);
  if (action.type === 'auth/setCredentials' || action.type === 'auth/logout') {
    // Re-dispatch through the full middleware chain (not just `next`) so
    // RTK Query's own middleware also observes the reset.
    store.dispatch(apiSlice.util.resetApiState());
  }
  return result;
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefault) => getDefault().concat(apiSlice.middleware, resetApiCacheOnAuthChange),
});

let lastCart = store.getState().cart;
store.subscribe(() => {
  const cart = store.getState().cart;
  if (cart !== lastCart) {
    lastCart = cart;
    localStorage.setItem('homebites_cart', JSON.stringify(cart));
  }
});
