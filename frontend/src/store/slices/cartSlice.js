import { createSlice } from '@reduxjs/toolkit';

const defaultState = {
  vendorId: null,
  vendorName: null,
  items: [], // { productId, itemName, price, quantity, orderType }
  fulfillmentMethod: null, // 'Delivery' | 'Takeaway'
  scheduledFor: null,
};

// Persisted so a page refresh (or accidental navigation) doesn't silently
// wipe an in-progress order — the cart otherwise lived only in memory.
const initialState = JSON.parse(localStorage.getItem('homebites_cart') || 'null') || defaultState;

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action) => {
      const { productId, itemName, price, quantity, orderType, vendorId, vendorName } = action.payload;

      // Cart is single-vendor and single-orderType: the backend creates one
      // order per checkout with one orderType, so switching vendor or
      // switching between Direct/Prebook clears the existing cart.
      const existingOrderType = state.items[0]?.orderType;
      if ((state.vendorId && state.vendorId !== vendorId) || (existingOrderType && existingOrderType !== orderType)) {
        state.items = [];
      }
      state.vendorId = vendorId;
      state.vendorName = vendorName;

      const existing = state.items.find((i) => i.productId === productId && i.orderType === orderType);
      if (existing) {
        existing.quantity += quantity;
      } else {
        state.items.push({ productId, itemName, price, quantity, orderType });
      }
    },
    removeItem: (state, action) => {
      state.items = state.items.filter((i) => i.productId !== action.payload);
    },
    updateQuantity: (state, action) => {
      const { productId, quantity } = action.payload;
      const item = state.items.find((i) => i.productId === productId);
      if (item) item.quantity = Math.max(1, quantity);
    },
    setFulfillmentMethod: (state, action) => {
      state.fulfillmentMethod = action.payload;
    },
    setScheduledFor: (state, action) => {
      state.scheduledFor = action.payload;
    },
    clearCart: () => defaultState,
  },
});

export const { addItem, removeItem, updateQuantity, setFulfillmentMethod, setScheduledFor, clearCart } =
  cartSlice.actions;
export default cartSlice.reducer;
