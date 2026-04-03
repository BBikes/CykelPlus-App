'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bike, Home, User, Wrench } from 'lucide-react';

const navItems = [
  {
    href: '/home',
    label: 'Hjem',
    icon: Home,
    match: (pathname: string) => pathname === '/home',
  },
  {
    href: '/garage',
    label: 'Garage',
    icon: Bike,
    match: (pathname: string) => pathname === '/garage' || pathname.startsWith('/garage/'),
  },
  {
    href: '/book',
    label: 'Service',
    icon: Wrench,
    match: (pathname: string) =>
      pathname === '/book' || pathname.startsWith('/book/') || pathname.startsWith('/bookings'),
  },
  {
    href: '/profile',
    label: 'Profil',
    icon: User,
    match: (pathname: string) => pathname === '/profile' || pathname.startsWith('/help'),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 left-0 right-0 z-50 border-t border-white/80 bg-white/92 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.8rem)] pt-3 backdrop-blur-xl">
      <div className="grid grid-cols-4 gap-2">
        {navItems.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);

          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[0.72rem] font-medium transition-all',
                active
                  ? 'bg-slate-900 text-white shadow-[0_14px_30px_-20px_rgba(15,23,42,0.9)]'
                  : 'text-slate-400 hover:bg-white hover:text-slate-700',
              ].join(' ')}
            >
              <Icon className={['h-5 w-5', active ? 'scale-105' : ''].join(' ')} strokeWidth={2.2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
