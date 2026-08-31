import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  useGetMyNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '../api/notificationApi';
import { connectSocket, getSocket } from '../api/socket';
import { apiSlice } from '../api/apiSlice';

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { token } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const { data } = useGetMyNotificationsQuery(undefined, { pollingInterval: 60000 });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();

  useEffect(() => {
    if (!token) return;
    let socket = getSocket();
    if (!socket) socket = connectSocket(token);
    const handler = () => dispatch(apiSlice.util.invalidateTags(['Notifications']));
    socket.on('notification:new', handler);
    return () => socket.off('notification:new', handler);
  }, [token, dispatch]);

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative text-slate-600 hover:text-orange-600 text-lg" aria-label="Notifications">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2.5 bg-orange-600 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 min-w-[18px] px-1 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] max-h-96 overflow-y-auto card p-2 z-40 shadow-lg">
            <div className="flex justify-between items-center px-2 py-1 mb-1">
              <p className="text-sm font-semibold text-slate-700">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={() => markAllRead()} className="text-xs text-orange-600 font-medium hover:text-orange-700">
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 && <p className="text-sm text-slate-400 px-2 py-4 text-center">No notifications yet.</p>}
            {notifications.map((n) => (
              <button
                key={n._id}
                onClick={() => !n.read && markRead(n._id)}
                className={`w-full text-left px-2 py-2 rounded-lg text-sm mb-0.5 ${n.read ? 'text-slate-500' : 'bg-orange-50 text-slate-800 font-medium'}`}
              >
                <p>{n.title}</p>
                {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
