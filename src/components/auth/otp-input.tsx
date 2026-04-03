'use client';

import { useEffect } from 'react';
import { normalizeVerificationCode, OTP_LENGTH } from '@/lib/auth';

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function OtpInput({ value, onChange, onComplete, disabled, error }: OtpInputProps) {
  useEffect(() => {
    if (!('credentials' in navigator) || typeof (navigator as { credentials?: { get?: unknown } }).credentials?.get !== 'function') return;

    let abortController: AbortController | null = new AbortController();

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const otp = await (navigator as any).credentials.get({
          otp: { transport: ['sms'] },
          signal: abortController?.signal,
        });

        if (otp?.code) {
          const code = normalizeVerificationCode(String(otp.code));
          onChange(code);
          if (code.length === OTP_LENGTH) onComplete?.(code);
        }
      } catch {
        // Aborted or unavailable - ignore
      }
    })();

    return () => {
      abortController?.abort();
      abortController = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedValue = normalizeVerificationCode(value);

  const handleChange = (nextValue: string) => {
    const nextCode = normalizeVerificationCode(nextValue);
    onChange(nextCode);
    if (nextCode.length === OTP_LENGTH) onComplete?.(nextCode);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      name="one-time-code"
      pattern={`\\d{${OTP_LENGTH}}`}
      maxLength={OTP_LENGTH}
      value={normalizedValue}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={(e) => e.target.select()}
      disabled={disabled}
      placeholder={'0'.repeat(OTP_LENGTH)}
      aria-label="Engangskode"
      className={[
        'w-full rounded-xl border px-4 py-3 text-center font-mono text-2xl tracking-[0.5em]',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        'transition-colors touch-manipulation',
        error
          ? 'border-red-400 bg-red-50 text-red-600 placeholder:text-red-300'
          : normalizedValue
          ? 'border-blue-500 bg-blue-50 text-blue-700 placeholder:text-blue-300'
          : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-300',
        disabled ? 'opacity-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
