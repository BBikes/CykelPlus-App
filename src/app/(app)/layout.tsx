import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { BottomNav } from '@/components/layout/bottom-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="relative flex min-h-svh flex-col">
      <main className="flex-1 mx-auto w-full max-w-[428px]">{children}</main>
      <BottomNav />
    </div>
  );
}
