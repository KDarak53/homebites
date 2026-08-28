import { useState } from 'react';
import { useGetMyMenuQuery } from '../../api/productApi';
import { useCreatePlanMutation, useGetMyPlansQuery, useUpdatePlanMutation, useGetRosterQuery } from '../../api/subscriptionApi';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function NewPlanForm() {
  const { data: menu } = useGetMyMenuQuery();
  const [createPlan, { isLoading, error }] = useCreatePlanMutation();
  const [form, setForm] = useState({ name: '', productId: '', quantity: 1, daysOfWeek: [1, 2, 3, 4, 5], pricePerWeek: '', fulfillmentMethod: 'Takeaway' });

  const toggleDay = (d) =>
    setForm((f) => ({ ...f, daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d].sort() }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.productId) return;
    await createPlan({
      name: form.name,
      items: [{ productId: form.productId, quantity: Number(form.quantity) }],
      daysOfWeek: form.daysOfWeek,
      pricePerWeek: Number(form.pricePerWeek),
      fulfillmentMethod: form.fulfillmentMethod,
    }).unwrap();
    setForm({ name: '', productId: '', quantity: 1, daysOfWeek: [1, 2, 3, 4, 5], pricePerWeek: '', fulfillmentMethod: 'Takeaway' });
  };

  return (
    <form onSubmit={handleSubmit} className="card p-5 mb-6 flex flex-col gap-2.5">
      <h2 className="font-semibold text-slate-800 mb-1">✚ Create a subscription plan</h2>
      <input placeholder="Plan name (e.g. Weekday Thali)" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input text-sm py-1.5" />
      <div className="flex gap-2">
        <select required value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} className="input text-sm py-1.5 flex-1">
          <option value="">Select item...</option>
          {menu?.map((p) => <option key={p._id} value={p._id}>{p.itemName} (₹{p.price})</option>)}
        </select>
        <input type="number" min="1" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className="input text-sm py-1.5 w-20" />
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1">Days of week</p>
        <div className="flex gap-1">
          {DAYS.map((label, d) => (
            <button
              type="button"
              key={d}
              onClick={() => toggleDay(d)}
              className={`text-xs w-9 h-9 rounded-full font-semibold ${form.daysOfWeek.includes(d) ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              {label[0]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <input type="number" min="0" placeholder="Price per week (₹)" required value={form.pricePerWeek} onChange={(e) => setForm((f) => ({ ...f, pricePerWeek: e.target.value }))} className="input text-sm py-1.5 flex-1" />
        <select value={form.fulfillmentMethod} onChange={(e) => setForm((f) => ({ ...f, fulfillmentMethod: e.target.value }))} className="input text-sm py-1.5">
          <option value="Takeaway">🥡 Takeaway</option>
          <option value="Delivery">🛵 Delivery</option>
        </select>
      </div>
      {error && <p className="text-red-600 text-sm">{error.data?.message || 'Could not create plan'}</p>}
      <button disabled={isLoading} className="btn-primary py-2 text-sm mt-1">{isLoading ? 'Creating...' : 'Create plan'}</button>
    </form>
  );
}

function PlanRow({ plan }) {
  const [updatePlan] = useUpdatePlanMutation();
  return (
    <div className={`card p-4 ${!plan.isActive ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-slate-800">{plan.name}</p>
          <p className="text-sm text-slate-500">{plan.items.map((i) => `${i.itemName} ×${i.quantity}`).join(', ')}</p>
          <p className="text-xs text-slate-400 mt-1">
            {plan.daysOfWeek.map((d) => DAYS[d]).join(', ')} · ₹{plan.pricePerWeek}/week · {plan.fulfillmentMethod}
          </p>
        </div>
        <button onClick={() => updatePlan({ id: plan._id, isActive: !plan.isActive })} className="btn-ghost text-xs px-2.5 py-1 bg-slate-100 shrink-0">
          {plan.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  );
}

export default function VendorSubscriptions() {
  const { data: plans, isLoading } = useGetMyPlansQuery();
  const { data: roster } = useGetRosterQuery();

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">📅 Subscription plans</h1>
      <p className="text-sm text-slate-500 mb-4">
        Sell a recurring weekly plan instead of one-off orders — customers prepay for the week and it auto-generates each day's order against your batch.
      </p>
      <NewPlanForm />

      {isLoading && <p className="text-slate-500 text-sm">Loading plans...</p>}
      <div className="flex flex-col gap-3 mb-8">
        {plans?.map((p) => <PlanRow key={p._id} plan={p} />)}
        {plans && plans.length === 0 && <p className="text-slate-500 text-sm">No plans yet — create one above.</p>}
      </div>

      <h2 className="font-semibold text-slate-800 mb-3">👥 Active subscribers</h2>
      <div className="flex flex-col gap-2">
        {roster?.map((s) => (
          <div key={s._id} className="card p-3 flex justify-between items-center text-sm">
            <div>
              <p className="font-medium text-slate-800">{s.user?.name}</p>
              <p className="text-xs text-slate-400">{s.plan?.name} &middot; {s.user?.phone}</p>
            </div>
            <span className="badge-green">{s.creditsRemaining} day(s) left</span>
          </div>
        ))}
        {roster && roster.length === 0 && <p className="text-slate-500 text-sm">No active subscribers yet.</p>}
      </div>
    </div>
  );
}
