export const OTP_LENGTH = 4;

export function normalizeVerificationCode(code: string): string {
  return code.replace(/\D/g, '').slice(0, OTP_LENGTH);
}
