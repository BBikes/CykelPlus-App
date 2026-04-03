'use client';

import { useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { normalizeVerificationCode, OTP_LENGTH } from '@/lib/auth';

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function OtpInput({ value, onChange, onComplete, disabled, error }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // WebOTP API autofill — feature-detected, no crash if unavailable
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
        // Aborted or unavailable — ignore
      }
    })();
    return () => {
      abortController?.abort();
      abortController = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedValue = normalizeVerificationCode(value);
  const digits = normalizedValue.padEnd(OTP_LENGTH, '').slice(0, OTP_LENGTH).split('');

  const handleChange = (index: number, char: string) => {
    const d = char.replace(/\D/g, '').slice(-1);
    const next = digits.map((v, i) => (i === index ? d : v)).join('').replace(/ /g, '');
    onChange(next);
    if (d && index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus();
    if (next.length === OTP_LENGTH) onComplete?.(next);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = normalizeVerificationCode(e.clipboardData.getData('text'));
    onChange(pasted);
    if (pasted.length === OTP_LENGTH) onComplete?.(pasted);
    inputsRef.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center" aria-label="Engangskode">
      {Array.from({ length: OTP_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digits[i] === ' ' ? '' : digits[i]}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          className={[
            'h-14 w-14 rounded-xl border-2 text-center text-2xl font-semibold',
            'focus:outline-none focus:ring-2 focus:ring-offset-1',
            'transition-colors touch-manipulation',
            error
              ? 'border-red-400 bg-red-50 text-red-600 focus:ring-red-500'
              : digits[i] && digits[i] !== ' '
              ? 'border-blue-500 bg-blue-50 text-blue-700 focus:ring-blue-500'
              : 'border-gray-200 bg-white text-gray-900 focus:ring-blue-500',
            disabled ? 'opacity-50' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </div>
  );
}
