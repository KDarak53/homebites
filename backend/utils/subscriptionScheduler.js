const CustomerSubscription = require('../models/CustomerSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const VendorProfile = require('../models/VendorProfile');
const Product = require('../models/Product');
const Order = require('../models/Order');
const generatePickupCode = require('./generatePickupCode');
const { computeCommission } = require('./commission');
const { notify } = require('../services/notify');

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Runs once a day: for every active, credited subscription whose plan runs
// today, draws one credit and creates a real Order against the vendor's
// current batch — this is what actually "smooths vendor batch planning"
// rather than a subscription being just a label over ad-hoc ordering.
// Exported (not just scheduled) so it can also be triggered manually/tested.
async function runDailySubscriptionCycle(io) {
  const today = new Date();
  const subs = await CustomerSubscription.find({ status: 'active', creditsRemaining: { $gt: 0 } });

  const results = { generated: 0, skippedNoStock: 0, skippedNotScheduledToday: 0, skippedAlreadyDoneToday: 0 };

  for (const sub of subs) {
    if (sub.lastGeneratedDate && isSameDay(new Date(sub.lastGeneratedDate), today)) {
      results.skippedAlreadyDoneToday += 1;
      continue;
    }
    if (sub.skippedDates.some((d) => isSameDay(new Date(d), today))) {
      continue;
    }

    const plan = await SubscriptionPlan.findById(sub.plan);
    if (!plan || !plan.isActive || !plan.daysOfWeek.includes(today.getDay())) {
      results.skippedNotScheduledToday += 1;
      continue;
    }

    const vendor = await VendorProfile.findById(sub.vendor);
    if (!vendor || !vendor.isOpen || !vendor.isApproved) continue;

    // Try to atomically reserve every item's quantity from today's batch.
    // If any item is short, roll back what was already reserved for this
    // subscriber and skip them for today without spending a credit.
    const reserved = [];
    let itemsTotal = 0;
    let shortItem = null;

    for (const line of plan.items) {
      const updated = await Product.findOneAndUpdate(
        { _id: line.product, currentQuantity: { $gte: line.quantity }, isActive: true },
        { $inc: { currentQuantity: -line.quantity } },
        { new: true }
      );
      if (!updated) {
        shortItem = line.itemName;
        break;
      }
      reserved.push({ product: updated._id, itemName: line.itemName, unitPrice: updated.price, quantity: line.quantity, fromBatch: 'current' });
      itemsTotal += updated.price * line.quantity;
    }

    if (shortItem) {
      for (const r of reserved) {
        await Product.updateOne({ _id: r.product }, { $inc: { currentQuantity: r.quantity } });
      }
      results.skippedNoStock += 1;
      await notify(io, {
        userId: sub.user,
        type: 'subscription',
        title: "Today's subscription meal is unavailable",
        body: `${plan.name}: "${shortItem}" is out of stock today. No credit was used.`,
      });
      continue;
    }

    const { platformCommissionRate, platformCommissionAmount, vendorPayoutAmount } = await computeCommission(vendor, itemsTotal);
    const deliveryFee = sub.fulfillmentMethod === 'Delivery' ? vendor.deliveryFee || 0 : 0;

    const order = await Order.create({
      user: sub.user,
      vendor: vendor._id,
      items: reserved,
      orderType: 'Direct',
      fulfillmentMethod: sub.fulfillmentMethod,
      subscription: sub._id,
      deliveryAddress: sub.fulfillmentMethod === 'Delivery' ? sub.deliveryAddress : undefined,
      itemsTotal,
      deliveryFee,
      totalAmount: itemsTotal + deliveryFee,
      platformCommissionRate,
      platformCommissionAmount,
      vendorPayoutAmount,
      paymentStatus: 'paid', // already covered by the subscription's prepaid credits
      status: 'Pending',
      pickupCode: generatePickupCode(),
    });

    sub.creditsRemaining -= 1;
    sub.lastGeneratedDate = today;
    await sub.save();
    results.generated += 1;

    io?.to(`vendor:${vendor._id}`).emit('order:new', order);
    await notify(io, {
      userId: vendor.user,
      type: 'new_order',
      title: 'New subscription order',
      body: `${plan.name} · ${order.items.length} item(s)`,
      relatedOrder: order._id,
    });
    await notify(io, {
      userId: sub.user,
      type: 'subscription',
      title: "Today's meal is confirmed",
      body: `${plan.name} from your subscription. ${sub.creditsRemaining} day(s) of credit left.`,
      relatedOrder: order._id,
    });

    if (sub.creditsRemaining === 0) {
      await notify(io, {
        userId: sub.user,
        type: 'subscription',
        title: 'Subscription credits used up',
        body: `Your "${plan.name}" subscription has run out of prepaid days — recharge to keep it going.`,
      });
    }
  }

  return results;
}

module.exports = { runDailySubscriptionCycle };
