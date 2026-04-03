import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { LoginForm } from '@/components/auth/login-form';

export const metadata = { title: 'Log ind — CykelPlus' };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/home');

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12 safe-top safe-bottom bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
            <svg viewBox="0 0 32 32" fill="none" className="h-9 w-9 text-white" aria-hidden="true">
              <circle cx="8" cy="22" r="5" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="24" cy="22" r="5" stroke="currentColor" strokeWidth="2.5" />
              <path
                d="M8 22L14 10h6l4 12"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 10l2-4h4"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CykelPlus</h1>
          <p className="mt-1 text-sm text-gray-500">Log ind med dit mobilnummer</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          B-Bikes · Alle rettigheder forbeholdes
        </p>
      </div>
    </main>
  );
}
