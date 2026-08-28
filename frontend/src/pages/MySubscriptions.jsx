import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useGetMySubscriptionsQuery,
  useSkipSubscriptionDateMutation,
  useCancelSubscriptionMutation,
  useInitiateSubscriptionPaymentMutation,
  useConfirmSubscriptionPaymentMutation,
} from '../api/subscriptionApi';
import { collectPayment } from '../utils/razorpay';

function SubscriptionCard({ sub }) {
  const { user } = useSelector((s) => s.auth);
  const [skipDate] = useSkipSubscriptionDateMutation();
  const [cancelSubscription] = useCancelSubscriptionMutation();
  const [initiate] = useInitiateSubscriptionPaymentMutation();
  const [confirm, { isLoading: recharging }] = useConfirmSubscriptionPaymentMutation();
  const [skipDay, setSkipDay] = useState('');
  const [rechargeError, setRechargeError] = useState('');

  const handleRecharge = async () => {
    setRechargeError('');
    try {
      const paymentOrder = await initiate({ subscriptionId: sub._id, weeks: 1 }).unwrap();
      const { paymentId, signature } = await collectPayment(paymentOrder, {
        description: `${sub.plan?.name} recharge`,
        prefillEmail: user?.email,
      });
      await confirm({ subscriptionId: sub._id, weeks: 1, gatewayOrderId: paymentOrder.gatewayOrderId, paymentId, signature }).unwrap();
    } catch (err) {
      setRechargeError(err?.data?.message || err?.message || 'Could not recharge');
    }
  };

  return (
    <div className="card p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-slate-800">{sub.plan?.name}</p>
          <p className="text-xs text-slate-400">{sub.vendor?.businessName} &middot; ₹{sub.plan?.pricePerWeek}/week</p>
        </div>
        <span className={sub.status === 'active' ? 'badge-green' : sub.status === 'paused' ? 'badge-amber' : 'badge-slate'}>{sub.status}</span>
      </div>
      <p className="text-sm text-slate-600 mb-3">
        <b>{sub.creditsRemaining}</b> day(s) of credit remaining
        {sub.creditsRemaining === 0 && <span className="text-amber-600"> — recharge to keep it going</span>}
      </p>

      {sub.status !== 'cancelled' && (
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={skipDay} onChange={(e) => setSkipDay(e.target.value)} className="input py-1 text-xs" />
          <button
            disabled={!skipDay}
            onClick={() => { skipDate({ id: sub._id, date: skipDay }); setSkipDay(''); }}
            className="btn-ghost text-xs px-2.5 py-1 bg-slate-100"
          >
            Skip that day
          </button>
          <button onClick={() => handleRecharge()} disabled={recharging} className="btn-primary text-xs px-2.5 py-1">
            {recharging ? 'Processing...' : '+1 week recharge'}
          </button>
          <button onClick={() => cancelSubscription(sub._id)} className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 hover:bg-red-100 font-semibold">
            Cancel
          </button>
        </div>
      )}
      {rechargeError && <p className="text-red-600 text-xs mt-2">{rechargeError}</p>}
    </div>
  );
}

export default function MySubscriptions() {
  const { data: subs, isLoading } = useGetMySubscriptionsQuery();

  if (isLoading) return <p className="p-4 text-slate-500">Loading subscriptions...</p>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">📅 Your subscriptions</h1>
      <div className="flex flex-col gap-3">
        {subs?.map((s) => <SubscriptionCard key={s._id} sub={s} />)}
      </div>
      {subs && subs.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">📅</p>
          <p className="text-slate-500 mb-4">No subscriptions yet — visit a vendor's menu to see their plans.</p>
          <Link to="/" className="btn-primary px-5 py-2 inline-flex">Browse kitchens</Link>
        </div>
      )}
    </div>
  );
}
