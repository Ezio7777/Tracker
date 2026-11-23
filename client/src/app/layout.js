import './globals.css';
import Providers from '@/components/Providers';

export const metadata = { title: 'Task & Ticket Tracker', description: 'Unified team task and support ticket tracker' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
