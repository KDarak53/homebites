// Derives a single status badge from a vendor's independent flags — order
// matters: a suspension overrides everything else, a rejection only counts
// if never subsequently approved, etc. Shared by the admin vendor list and
// the per-vendor detail page so the two can't drift out of sync.
export function vendorStatus(vendor) {
  if (vendor.isSuspendedByAdmin) return { label: '⏸️ Suspended', tone: 'badge-red' };
  if (!vendor.isApproved && vendor.rejectedAt) return { label: '❌ Rejected', tone: 'badge-slate' };
  if (!vendor.isApproved && vendor.changesRequestedReason) {
    const resubmitted = vendor.resubmittedAt && new Date(vendor.resubmittedAt) > new Date(vendor.changesRequestedAt);
    return resubmitted
      ? { label: '🔄 Resubmitted', tone: 'badge-blue' }
      : { label: '✏️ Changes requested', tone: 'badge-amber' };
  }
  if (!vendor.isApproved) return { label: '⏳ Pending', tone: 'badge-amber' };
  if (!vendor.isOpen) return { label: '🌙 Closed (by vendor)', tone: 'badge-slate' };
  return { label: '✅ Live', tone: 'badge-green' };
}
