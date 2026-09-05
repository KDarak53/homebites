const mongoose = require('mongoose');

const vendorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    fssaiLicense: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    kitchenPhotoUrl: { type: String, default: '' },
    kitchenLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      address: { type: String, default: '' },
    },
    deliveryEnabled: { type: Boolean, default: false },
    maxDeliveryRadiusKm: { type: Number, default: 5, min: 0, max: 50 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    isVegOnly: { type: Boolean, default: false },
    totalOrdersCompleted: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    // A real moderation queue now exists (see adminController) — new vendors
    // wait for admin approval before appearing in customer-facing discovery
    // or being able to receive orders.
    isApproved: { type: Boolean, default: false },
    isOpen: { type: Boolean, default: true },
    // Distinguishes "explicitly rejected" from "not yet reviewed" — both
    // otherwise look identical (isApproved: false), which meant a rejected
    // vendor never left the admin's pending-approval queue. Cleared back to
    // null on a later approval, in case a re-submitted application is
    // eventually accepted.
    rejectedAt: { type: Date, default: null },

    // "Please fix X and resubmit" — a softer, constructive alternative to
    // outright rejection during onboarding review. Distinct from rejectedAt:
    // this keeps the vendor in the same pending pool (still isApproved:
    // false, rejectedAt: null) rather than marking them rejected, and
    // carries specific feedback the vendor's own dashboard can surface.
    // reason/At are kept as history even after resubmission (not cleared),
    // so the admin can still see what was originally asked for; resubmittedAt
    // tells them whether the vendor has acted on it since.
    changesRequestedReason: { type: String, default: '' },
    changesRequestedAt: { type: Date, default: null },
    resubmittedAt: { type: Date, default: null },

    // A platform-level override, separate from the vendor's own `isOpen`
    // toggle (Settings) — if these were the same field, a vendor the admin
    // paused could just flip their own kitchen back "open" and undo it.
    // Discovery and order placement both check this in addition to isOpen.
    isSuspendedByAdmin: { type: Boolean, default: false },
    suspensionReason: { type: String, default: '' },

    // Optional paid tier: a lower per-order commission in exchange for a
    // flat monthly fee, plus priority placement — a second, volume-independent
    // revenue lever alongside per-order commission (see Order.platformCommissionRate).
    subscriptionPlan: { type: String, enum: ['free', 'pro'], default: 'free' },
    subscriptionExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

vendorProfileSchema.index({ kitchenLocation: '2dsphere' });

module.exports = mongoose.model('VendorProfile', vendorProfileSchema);
