'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Bike, CalendarDays, HelpCircle, User } from 'lucide-react';

const navItems = [
  { href: '/home', label: 'Hjem', icon: Home },
  { href: '/garage', label: 'Garage', icon: Bike },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/help', label: 'Hjælp', icon: HelpCircle },
  { href: '/profile', label: 'Profil', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white safe-bottom">
      <div className="mx-auto flex max-w-[428px] items-center justify-around">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2',
                'transition-colors touch-manipulation',
                active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              <Icon
                className={['h-6 w-6 transition-transform', active ? 'scale-110' : ''].join(' ')}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={['text-[10px] font-medium', active ? 'text-blue-600' : ''].join(' ')}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
