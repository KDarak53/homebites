import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useVerifyPickupMutation } from '../api/orderApi';

// Lets a vendor confirm order handoff either by scanning the customer's QR
// with the device camera, or by typing the pickup code manually — the camera
// path needs a real device camera and user permission, so the manual path is
// the reliable fallback (and the only option on desktops without a webcam).
export default function PickupScanner() {
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [verifyPickup, { isLoading, data: result, error, reset }] = useVerifyPickupMutation();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stopCamera(), []);

  const submitCode = (code) => {
    reset();
    verifyPickup(code);
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      // The <video> element is always mounted (see JSX below) — just hidden
      // until scanning starts — specifically so videoRef.current is already
      // attached here. Flipping `scanning` on first and assigning srcObject
      // after would race: the element the ref points to gets swapped out by
      // the re-render before the stream is ever attached to it.
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const tick = () => {
        const video = videoRef.current;
        if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            stopCamera();
            submitCode(code.data);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      stopCamera();
      setCameraError(err.message || 'Could not access camera');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) submitCode(manualCode.trim());
  };

  return (
    <div className="card p-5 mb-6 bg-gradient-to-br from-orange-50/60 to-white">
      <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">📷 Confirm pickup</h2>
      <p className="text-xs text-slate-400 mb-3">
        Scan the customer's QR code, or type the code they show you, to mark that order Completed.
      </p>

      {!scanning && (
        <button onClick={startCamera} className="btn-primary text-sm px-4 py-2 mb-3">
          📸 Start camera scanner
        </button>
      )}
      {/* Always mounted (just hidden) so videoRef is attached before the
          camera stream needs it — see the comment in startCamera above. */}
      <div className={scanning ? 'mb-3' : 'hidden'}>
        <video ref={videoRef} className="w-full max-w-xs rounded-xl border-2 border-orange-300 shadow-sm" muted playsInline />
        <button onClick={stopCamera} className="text-xs text-slate-500 mt-1.5 hover:text-slate-700">
          Stop camera
        </button>
      </div>
      {cameraError && (
        <p className="text-xs text-amber-700 mb-3 bg-amber-50 rounded-lg px-3 py-1.5">
          Camera unavailable ({cameraError}) — use the manual code entry below instead.
        </p>
      )}

      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.toUpperCase())}
          placeholder="Enter pickup code"
          className="input text-sm font-mono tracking-wider flex-1"
        />
        <button type="submit" disabled={isLoading || !manualCode.trim()} className="btn-dark text-sm px-4 py-2">
          {isLoading ? 'Checking...' : 'Verify'}
        </button>
      </form>

      {result && (
        <p className="text-sm text-green-700 font-medium mt-3 bg-green-50 rounded-lg px-3 py-2">
          ✅ Order for {result.user?.name || 'customer'} confirmed and marked Completed.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 font-medium mt-3 bg-red-50 rounded-lg px-3 py-2">
          {error.data?.message || 'Invalid or unusable code'}
        </p>
      )}
    </div>
  );
}
