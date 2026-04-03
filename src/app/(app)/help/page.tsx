import { Phone, Mail, ChevronDown } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import type { SupportContactSettings } from '@/types';

export const metadata = { title: 'Hjælp — CykelPlus' };

const FAQ = [
  {
    q: 'Hvornår kan jeg hente min cykel?',
    a: 'Du modtager en SMS, når din cykel er klar. Typisk 3-5 hverdage efter indlevering.',
  },
  {
    q: 'Hvad koster afhentning og levering?',
    a: 'Prisen fremgår ved booking. Betaling sker via det link, du modtager på SMS.',
  },
  {
    q: 'Kan jeg ændre eller annullere min booking?',
    a: 'Ja, du kan annullere din booking under Bookings i appen, så længe den ikke er igangsat.',
  },
  {
    q: 'Hvad er CykelPlus tracker?',
    a: 'CykelPlus Tracker er et tilvalg, der giver dig GPS-sporing af din cykel. Kontakt os for mere info.',
  },
];

async function getContactSettings(): Promise<SupportContactSettings> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('support_contact_settings')
    .select('phone, email, faq_url')
    .maybeSingle();

  return {
    phone: data?.phone ?? '+4529837883',
    email: data?.email ?? 'service@b-bikes.dk',
    faq_url: data?.faq_url ?? null,
  };
}

export default async function HelpPage() {
  const contact = await getContactSettings();

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 page-bottom-padding safe-top">
      <h1 className="text-2xl font-bold text-gray-900">Hjælp</h1>

      {/* Contact */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Kontakt os
        </h2>
        <Card padding="none" className="overflow-hidden divide-y divide-gray-100">
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
                <Phone className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Ring til os</p>
                <p className="text-sm text-gray-500">{contact.phone}</p>
              </div>
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Send en mail</p>
                <p className="text-sm text-gray-500">{contact.email}</p>
              </div>
            </a>
          )}
        </Card>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Ofte stillede spørgsmål
        </h2>
        <Card padding="none" className="overflow-hidden divide-y divide-gray-100">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-4 py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3 font-medium text-gray-900 list-none touch-manipulation">
                {q}
                <ChevronDown className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{a}</p>
            </details>
          ))}
        </Card>
      </section>
    </div>
  );
}
