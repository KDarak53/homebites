// Deterministic decorative emoji + gradient per vendor (hashed from its id),
// so the same kitchen always gets the same "avatar" without needing a photo.
const EMOJIS = ['🍛', '🍜', '🥘', '🍲', '🥗', '🍚', '🍱', '🫓', '🍢', '🍙'];
const GRADIENTS = [
  'from-orange-400 to-red-400',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
  'from-emerald-400 to-teal-500',
  'from-lime-400 to-green-500',
  'from-yellow-400 to-amber-500',
];

function hashOf(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function getVendorVisual(id) {
  const h = hashOf(id);
  return { emoji: EMOJIS[h % EMOJIS.length], gradient: GRADIENTS[h % GRADIENTS.length] };
}
