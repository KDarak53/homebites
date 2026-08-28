import { io } from 'socket.io-client';

let socket;
let currentToken;

// Idempotent: several components (Orders, VendorDashboard, NotificationBell)
// each want "a live socket" without knowing about each other. Reusing the
// existing connection when the token hasn't changed avoids a reconnect storm
// where each newly-mounted page tears down the previous page's listeners.
export const connectSocket = (token) => {
  if (socket && currentToken === token) return socket;
  if (socket) socket.disconnect();
  currentToken = token;
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
    auth: { token },
    autoConnect: true,
  });
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = undefined;
  currentToken = undefined;
};
