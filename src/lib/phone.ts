/** Convert Danish 8-digit number to E.164 format */
export function toE164(phone: string): string {
  const digits = phone.replace(/\s/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.length === 8) return `+45${digits}`;
  return digits;
}

/** Convert E.164 to 8-digit Danish format for BikeDesk */
export function toDanishPhone(phone: string): string {
  return phone.replace(/^\+45/, '').replace(/\s/g, '');
}
