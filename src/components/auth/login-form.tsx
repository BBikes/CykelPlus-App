'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { OtpInput } from './otp-input';
import { normalizeVerificationCode, OTP_LENGTH } from '@/lib/auth';

type Step = 'phone' | 'otp';

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Kunne ikke sende kode');
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const codeToVerify = normalizeVerificationCode(code ?? otp);
    setOtp(codeToVerify);
    if (codeToVerify.length !== OTP_LENGTH) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: codeToVerify }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Forkert kode');
      router.replace('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl');
      setOtp('');
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <p className="text-gray-600">
            Vi har sendt en kode til{' '}
            <span className="font-semibold text-gray-900">{phone}</span>
          </p>
        </div>

        <OtpInput
          value={otp}
          onChange={setOtp}
          onComplete={handleVerifyOtp}
          disabled={loading}
          error={!!error}
        />

        {error && (
          <p className="text-center text-sm text-red-600">{error}</p>
        )}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          onClick={() => handleVerifyOtp()}
          disabled={normalizeVerificationCode(otp).length !== OTP_LENGTH}
        >
          Bekræft kode
        </Button>

        <button
          className="text-center text-sm text-gray-500 underline-offset-2 hover:underline touch-manipulation"
          onClick={() => {
            setStep('phone');
            setOtp('');
            setError(null);
          }}
          disabled={loading}
        >
          Brug et andet nummer
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium text-gray-700">
          Mobilnummer
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-4 flex items-center text-gray-500 select-none pointer-events-none">
            +45
          </span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="12 34 56 78"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
            className={[
              'w-full rounded-xl border px-4 py-3 pl-14 text-gray-900 placeholder-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'transition-colors text-lg',
              error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white',
            ].join(' ')}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={loading}
        disabled={phone.length < 8}
      >
        Send kode
      </Button>
    </form>
  );
}
