const Notification = require('../models/Notification');

// Writes a durable notification (so it's there next time the user opens the
// app even if they weren't connected) and, if a socket.io instance is passed,
// also pushes it live for anyone connected right now.
async function notify(io, { userId, type = 'general', title, body = '', relatedOrder = null }) {
  const notification = await Notification.create({ user: userId, type, title, body, relatedOrder });
  io?.to(`user:${userId}`).emit('notification:new', notification);
  return notification;
}

module.exports = { notify };
