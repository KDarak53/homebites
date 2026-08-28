const crypto = require('crypto');

// Unambiguous alphabet (no 0/O, 1/I/L) since this may be typed in manually as
// a fallback when a camera isn't available to scan the QR.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generatePickupCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

module.exports = generatePickupCode;
