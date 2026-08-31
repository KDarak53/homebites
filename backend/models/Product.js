const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile', required: true },
    itemName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    isVeg: { type: Boolean, required: true, default: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: '' },

    // Inventory / batch control
    maxQuantityPerBatch: { type: Number, required: true, min: 1 },
    currentQuantity: { type: Number, required: true, min: 0 },

    // Fulfillment support for this item
    availableForDirectOrder: { type: Boolean, default: true },
    availableForPrebook: { type: Boolean, default: true },

    // Pre-book window: customers can reserve from the NEXT batch only between
    // these two timestamps. prebookOpensAt is optional — leaving it unset
    // means the window is open immediately and only prebookCutoffTime (the
    // close time) gates it, preserving the old cutoff-only behavior.
    prebookOpensAt: { type: Date, default: null },
    prebookCutoffTime: { type: Date, default: null },
    nextBatchQuantity: { type: Number, default: 0, min: 0 },

    // When the pre-ordered batch will actually be ready to hand over —
    // distinct from the order window above (which is when customers can
    // *place* the order). Shown to customers and used to bound the
    // pickup/delivery time they pick at checkout.
    collectionStartTime: { type: Date, default: null },
    collectionEndTime: { type: Date, default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ vendor: 1, isActive: 1 });

productSchema.virtual('isPrebookOpen').get(function isPrebookOpen() {
  const now = Date.now();
  return Boolean(
    this.availableForPrebook &&
      this.prebookCutoffTime &&
      this.prebookCutoffTime.getTime() > now &&
      (!this.prebookOpensAt || this.prebookOpensAt.getTime() <= now)
  );
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
