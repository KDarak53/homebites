import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { resolveImageUrl } from '../constants';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// A minimal file-upload control: picks an image, uploads it to
// POST /api/uploads/image, and hands the resulting URL back via onUploaded.
// Shows a preview of whatever URL is already set (existing photo) or was
// just uploaded.
export default function ImageUploader({ value, onUploaded, label = 'Photo' }) {
  const { token } = useSelector((s) => s.auth);
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${API_BASE}/uploads/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      onUploaded(data.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <img src={resolveImageUrl(value)} alt="" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-xl text-slate-300 shrink-0">📷</div>
      )}
      <div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-ghost text-xs px-3 py-1.5 bg-slate-100">
          {uploading ? 'Uploading...' : value ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" />
        {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
}
