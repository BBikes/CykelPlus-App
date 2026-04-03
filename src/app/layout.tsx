import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CykelPlus',
  description: 'Din cykelapp fra B-Bikes',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CykelPlus',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da" className={`${geist.variable} h-full`}>
      <body className="h-full bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
