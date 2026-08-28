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

    // Pre-book cut-off: customers can reserve from the NEXT batch until this
    // timestamp; vendor resets it each cycle (e.g. "today 8:00 PM" for
    // tomorrow's batch).
    prebookCutoffTime: { type: Date, default: null },
    nextBatchQuantity: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ vendor: 1, isActive: 1 });

productSchema.virtual('isPrebookOpen').get(function isPrebookOpen() {
  return Boolean(
    this.availableForPrebook && this.prebookCutoffTime && this.prebookCutoffTime.getTime() > Date.now()
  );
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
