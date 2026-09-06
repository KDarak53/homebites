import { useEffect, useState } from 'react';
import {
  useGetMyMenuQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} from '../../api/productApi';
import ImageUploader from '../../components/ImageUploader';
import { localDatetimeToISO } from '../../constants';

const emptyForm = {
  itemName: '',
  description: '',
  isVeg: true,
  price: '',
  maxQuantityPerBatch: '',
  availableForDirectOrder: true,
  availableForPrebook: false,
  imageUrl: '',
};

// Shared by both the "add item" form and the inline "edit item" form — the
// fields are identical, only what happens on submit (create vs. patch) differs.
function ItemFields({ form, update }) {
  return (
    <>
      <input placeholder="Item name" required value={form.itemName} onChange={update('itemName')} className="input text-sm py-1.5" />
      <input placeholder="Description" value={form.description} onChange={update('description')} className="input text-sm py-1.5" />
      <div className="flex gap-2">
        <input type="number" placeholder="Price (₹)" required min={0} value={form.price} onChange={update('price')} className="input text-sm py-1.5 flex-1" />
        <input type="number" placeholder="Batch size" required min={1} value={form.maxQuantityPerBatch} onChange={update('maxQuantityPerBatch')} className="input text-sm py-1.5 flex-1" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.isVeg} onChange={update('isVeg')} /> 🌱 Veg</label>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">How can this item be ordered?</div>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.availableForDirectOrder} onChange={update('availableForDirectOrder')} /> 🛒 Normal order — sold right away from current stock</label>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.availableForPrebook} onChange={update('availableForPrebook')} /> 📅 Pre-order — reserved from the next batch within a time window you set below</label>
    </>
  );
}

function NewItemForm() {
  const [form, setForm] = useState(emptyForm);
  const [createProduct, { isLoading, error }] = useCreateProductMutation();

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createProduct({
      ...form,
      price: Number(form.price),
      maxQuantityPerBatch: Number(form.maxQuantityPerBatch),
    }).unwrap();
    setForm(emptyForm);
  };

  return (
    <form onSubmit={handleSubmit} className="card p-5 mb-6 flex flex-col gap-2.5">
      <h2 className="font-semibold text-slate-800 mb-1">✚ Add menu item</h2>
      <ImageUploader value={form.imageUrl} onUploaded={(url) => setForm((f) => ({ ...f, imageUrl: url }))} label="Dish photo" />
      <ItemFields form={form} update={update} />
      {error && <p className="text-red-600 text-sm">{error.data?.message || 'Could not create item'}</p>}
      <button disabled={isLoading} className="btn-primary py-2 text-sm mt-1">
        {isLoading ? 'Adding...' : 'Add item'}
      </button>
    </form>
  );
}

function EditItemForm({ product, onDone }) {
  const [form, setForm] = useState({
    itemName: product.itemName,
    description: product.description || '',
    isVeg: product.isVeg,
    price: product.price,
    maxQuantityPerBatch: product.maxQuantityPerBatch,
    availableForDirectOrder: product.availableForDirectOrder,
    availableForPrebook: product.availableForPrebook,
  });
  const [updateProduct, { isLoading, error }] = useUpdateProductMutation();

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await updateProduct({
      id: product._id,
      ...form,
      price: Number(form.price),
      maxQuantityPerBatch: Number(form.maxQuantityPerBatch),
    }).unwrap();
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 border-t border-slate-100 mt-3 pt-3">
      <ItemFields form={form} update={update} />
      {error && <p className="text-red-600 text-sm">{error.data?.message || 'Could not save changes'}</p>}
      <div className="flex gap-2 mt-1">
        <button disabled={isLoading} className="btn-primary text-sm px-4 py-1.5">
          {isLoading ? 'Saving...' : 'Save changes'}
        </button>
        <button type="button" onClick={onDone} className="btn-ghost text-sm px-4 py-1.5 bg-slate-100">
          Cancel
        </button>
      </div>
    </form>
  );
}

// Converts a Date (or null) to the value a <input type="datetime-local">
// expects, in local time — new Date().toISOString() is UTC and would shift
// the displayed time, so this builds the string from local getters instead.
function toDatetimeLocalValue(date) {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// One unified action: the vendor sets the order window, the collection
// window and the batch quantity together and saves them in a single request.
// Once the cycle ends (collection window closes, or the order cutoff passes
// if no collection window was set) the backend automatically zeroes all of
// it out — see resetProductIfPrebookCycleEnded in productController.js — so
// a finished cycle never lingers and looks like it's still live; the vendor
// just fills this form in again to open the next one.
function PrebookWindowControl({ product }) {
  const [opensAt, setOpensAt] = useState(toDatetimeLocalValue(product.prebookOpensAt));
  const [closesAt, setClosesAt] = useState(toDatetimeLocalValue(product.prebookCutoffTime));
  const [collectFrom, setCollectFrom] = useState(toDatetimeLocalValue(product.collectionStartTime));
  const [collectUntil, setCollectUntil] = useState(toDatetimeLocalValue(product.collectionEndTime));
  const [qty, setQty] = useState(product.nextBatchQuantity || '');
  const [updateProduct, { isLoading: saving }] = useUpdateProductMutation();

  // Keep the form in sync when the product changes from outside this form —
  // most notably when the backend auto-resets a finished cycle back to zero,
  // which should clear these fields here too rather than leaving stale values.
  useEffect(() => {
    setOpensAt(toDatetimeLocalValue(product.prebookOpensAt));
    setClosesAt(toDatetimeLocalValue(product.prebookCutoffTime));
    setCollectFrom(toDatetimeLocalValue(product.collectionStartTime));
    setCollectUntil(toDatetimeLocalValue(product.collectionEndTime));
    setQty(product.nextBatchQuantity || '');
  }, [product.prebookOpensAt, product.prebookCutoffTime, product.collectionStartTime, product.collectionEndTime, product.nextBatchQuantity]);

  const now = new Date();
  const opensAtDate = product.prebookOpensAt ? new Date(product.prebookOpensAt) : null;
  const cutoffDate = product.prebookCutoffTime ? new Date(product.prebookCutoffTime) : null;
  const isConfigured = cutoffDate && product.nextBatchQuantity > 0;

  let status = { icon: '⚪', tone: 'text-slate-400', label: 'Not set up — fill in the details below to open a batch' };
  if (isConfigured) {
    if (cutoffDate <= now) {
      status = { icon: '🔴', tone: 'text-slate-400', label: 'Closed — will reset to zero shortly, set a new batch below' };
    } else if (opensAtDate && opensAtDate > now) {
      status = { icon: '🕒', tone: 'text-amber-600 font-medium', label: `Opens ${opensAtDate.toLocaleString()} · closes ${cutoffDate.toLocaleString()} · ${product.nextBatchQuantity} to pre-book` };
    } else {
      status = { icon: '🟢', tone: 'text-emerald-600 font-medium', label: `Open now · closes ${cutoffDate.toLocaleString()} · ${product.nextBatchQuantity} to pre-book` };
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    updateProduct({
      id: product._id,
      prebookOpensAt: localDatetimeToISO(opensAt),
      prebookCutoffTime: localDatetimeToISO(closesAt),
      collectionStartTime: localDatetimeToISO(collectFrom),
      collectionEndTime: localDatetimeToISO(collectUntil),
      nextBatchQuantity: Number(qty) || 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 pt-2 border-t border-slate-100 text-xs flex flex-col gap-2">
      <p className={status.tone}>{status.icon} {status.label}</p>
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-slate-500">
          Order opens
          <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className="input py-1.5 text-xs w-full" />
        </label>
        <label className="flex flex-col gap-1 text-slate-500">
          Order closes
          <input type="datetime-local" required value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="input py-1.5 text-xs w-full" />
        </label>
        <label className="flex flex-col gap-1 text-slate-500">
          Collect from
          <input type="datetime-local" value={collectFrom} onChange={(e) => setCollectFrom(e.target.value)} className="input py-1.5 text-xs w-full" />
        </label>
        <label className="flex flex-col gap-1 text-slate-500">
          Collect until
          <input type="datetime-local" required value={collectUntil} onChange={(e) => setCollectUntil(e.target.value)} className="input py-1.5 text-xs w-full" />
        </label>
      </div>
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-slate-500 flex-1">
          Quantity for this batch
          <input type="number" min={1} required value={qty} onChange={(e) => setQty(e.target.value)} className="input py-1.5 text-xs w-full" />
        </label>
        <button disabled={saving} className="btn-primary text-xs px-3.5 py-2">
          {saving ? 'Saving...' : isConfigured ? 'Update batch' : 'Open batch'}
        </button>
      </div>
    </form>
  );
}

function MenuItemRow({ product }) {
  const [isEditing, setIsEditing] = useState(false);
  const [updateProduct] = useUpdateProductMutation();
  const [deleteProduct] = useDeleteProductMutation();
  const stockRatio = product.maxQuantityPerBatch ? product.currentQuantity / product.maxQuantityPerBatch : 0;

  return (
    <div className={`card p-4 ${!product.isActive ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex gap-3 min-w-0">
          <ImageUploader value={product.imageUrl} onUploaded={(url) => updateProduct({ id: product._id, imageUrl: url })} label="photo" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">{product.itemName} {product.isVeg ? '🟢' : '🔴'}</p>
            <p className="text-sm text-slate-500 mt-0.5">
              ₹{product.price} &middot; <span className={stockRatio === 0 ? 'text-red-500 font-medium' : stockRatio < 0.3 ? 'text-amber-600 font-medium' : 'text-slate-500'}>
                {product.currentQuantity}/{product.maxQuantityPerBatch} left
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {product.availableForDirectOrder && '🛒 Normal'}
              {product.availableForDirectOrder && product.availableForPrebook && ' · '}
              {product.availableForPrebook && '📅 Pre-order'}
              {!product.availableForDirectOrder && !product.availableForPrebook && 'Not orderable — enable an order mode'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-xs shrink-0">
          <button onClick={() => setIsEditing((v) => !v)} className="btn-ghost text-xs px-2.5 py-1 bg-slate-100">
            {isEditing ? 'Close' : 'Edit'}
          </button>
          <button
            onClick={() => updateProduct({ id: product._id, isActive: !product.isActive })}
            className="btn-ghost text-xs px-2.5 py-1 bg-slate-100"
          >
            {product.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => deleteProduct(product._id)} className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 hover:bg-red-100 font-semibold">
            Delete
          </button>
        </div>
      </div>
      {isEditing && <EditItemForm product={product} onDone={() => setIsEditing(false)} />}
      {product.availableForPrebook && <PrebookWindowControl product={product} />}
    </div>
  );
}

export default function MenuManagement() {
  const { data: menu, isLoading } = useGetMyMenuQuery();

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">📋 Menu management</h1>
      <NewItemForm />
      {isLoading && <p className="text-slate-500">Loading menu...</p>}
      <div className="flex flex-col gap-3">
        {menu?.map((p) => <MenuItemRow key={p._id} product={p} />)}
      </div>
      {menu && menu.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">🍽️</p>
          <p className="text-slate-500">No items yet — add your first one above.</p>
        </div>
      )}
    </div>
  );
}
