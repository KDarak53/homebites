import { useState } from 'react';
import {
  useGetMyMenuQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useOpenNextBatchMutation,
  useDeleteProductMutation,
} from '../../api/productApi';
import ImageUploader from '../../components/ImageUploader';

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
      <input placeholder="Item name" required value={form.itemName} onChange={update('itemName')} className="input text-sm py-1.5" />
      <input placeholder="Description" value={form.description} onChange={update('description')} className="input text-sm py-1.5" />
      <div className="flex gap-2">
        <input type="number" placeholder="Price (₹)" required min={0} value={form.price} onChange={update('price')} className="input text-sm py-1.5 flex-1" />
        <input type="number" placeholder="Batch size" required min={1} value={form.maxQuantityPerBatch} onChange={update('maxQuantityPerBatch')} className="input text-sm py-1.5 flex-1" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.isVeg} onChange={update('isVeg')} /> 🌱 Veg</label>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.availableForDirectOrder} onChange={update('availableForDirectOrder')} /> Available for direct order</label>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.availableForPrebook} onChange={update('availableForPrebook')} /> Available for pre-booking</label>
      {error && <p className="text-red-600 text-sm">{error.data?.message || 'Could not create item'}</p>}
      <button disabled={isLoading} className="btn-primary py-2 text-sm mt-1">
        {isLoading ? 'Adding...' : 'Add item'}
      </button>
    </form>
  );
}

function CutoffControl({ product }) {
  const [cutoff, setCutoff] = useState('');
  const [nextBatchQty, setNextBatchQty] = useState(product.maxQuantityPerBatch);
  const [updateProduct] = useUpdateProductMutation();
  const [openNextBatch, { isLoading }] = useOpenNextBatchMutation();

  const isOpen = product.prebookCutoffTime && new Date(product.prebookCutoffTime) > new Date();

  return (
    <div className="mt-2 pt-2 border-t border-slate-100 text-xs flex flex-col gap-1.5">
      <p className={isOpen ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
        {isOpen ? '🟢' : '⚪'} Pre-book: {isOpen ? `open until ${new Date(product.prebookCutoffTime).toLocaleString()}` : 'closed'} · next batch qty: {product.nextBatchQuantity}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="datetime-local"
          value={cutoff}
          onChange={(e) => setCutoff(e.target.value)}
          className="input py-1 text-xs"
        />
        <input
          type="number"
          min={0}
          value={nextBatchQty}
          onChange={(e) => setNextBatchQty(Number(e.target.value))}
          className="input py-1 text-xs w-20"
        />
        <button
          onClick={() => updateProduct({ id: product._id, prebookCutoffTime: cutoff, nextBatchQuantity: nextBatchQty })}
          className="btn-ghost text-xs px-2.5 py-1 bg-slate-100"
        >
          Set cutoff
        </button>
        <button
          disabled={isLoading}
          onClick={() => openNextBatch({ id: product._id, prebookCutoffTime: cutoff || null })}
          className="btn-primary text-xs px-2.5 py-1"
        >
          Open next batch
        </button>
      </div>
    </div>
  );
}

function MenuItemRow({ product }) {
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
          </div>
        </div>
        <div className="flex gap-2 text-xs shrink-0">
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
      {product.availableForPrebook && <CutoffControl product={product} />}
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
