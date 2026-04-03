import twilio from 'twilio';
import { toE164, toDanishPhone } from './phone';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID!;
const MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

export async function sendVerificationCode(phone: string): Promise<void> {
  const e164 = toE164(phone);
  await client.verify.v2.services(VERIFY_SERVICE_SID).verifications.create({
    to: e164,
    channel: 'sms',
  });
}

export async function checkVerificationCode(phone: string, code: string): Promise<boolean> {
  const e164 = toE164(phone);
  const result = await client.verify.v2
    .services(VERIFY_SERVICE_SID)
    .verificationChecks.create({ to: e164, code });
  return result.status === 'approved';
}

export async function sendSms(to: string, body: string): Promise<void> {
  const e164 = toE164(to);
  await client.messages.create({
    to: e164,
    body,
    ...(MESSAGING_SERVICE_SID
      ? { messagingServiceSid: MESSAGING_SERVICE_SID }
      : { from: process.env.TWILIO_FROM_NUMBER! }),
  });
}

export { toE164, toDanishPhone };
