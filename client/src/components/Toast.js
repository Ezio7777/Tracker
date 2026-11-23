'use client';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/context/SocketContext';

export default function Toast() {
  const { toast, setToast, markRead } = useNotifications();
  const router = useRouter();
  if (!toast) return null;
  return (
    <div className="toast" role="status" onClick={() => { markRead(toast); setToast(null); router.push(`/work-items/${toast.entityId}`); }}>
      🔔 {toast.message}
    </div>
  );
}
