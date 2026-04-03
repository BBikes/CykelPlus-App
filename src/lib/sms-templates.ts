// Re-export the booking SMS template system, extended with app-specific templates

export interface SmsTemplateRenderContext {
  customer_name?: string | null;
  bike_title?: string | null;
  booking_date?: string | null;
  booking_time?: string | null;
  booking_method?: string | null;
  payment_link?: string | null;
  task_no?: string | null;
  store_title?: string | null;
  store_phone?: string | null;
}

export function renderSmsTemplate(body: string, context: SmsTemplateRenderContext): string {
  return body
    .replace(/\[([a-z_]+)\]/gi, (match, rawKey: string) => {
      const key = rawKey.toLowerCase() as keyof SmsTemplateRenderContext;
      const value = context[key];
      if (value === undefined) return match;
      return value?.trim() ?? '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Standard app SMS templates
export const SMS_TEMPLATES = {
  bookingCreatedDropOff: (ctx: SmsTemplateRenderContext) =>
    renderSmsTemplate(
      [
        'Hej [customer_name]',
        '',
        'Din booking er bekræftet.',
        'Cykel: [bike_title]',
        'Dato: [booking_date] kl. [booking_time]',
        'Opgave-nr: [task_no]',
        '',
        'Venlig hilsen [store_title]',
      ].join('\n'),
      ctx
    ),

  bookingCreatedPickup: (ctx: SmsTemplateRenderContext) =>
    renderSmsTemplate(
      [
        'Hej [customer_name]',
        '',
        'Din booking er modtaget.',
        'Cykel: [bike_title]',
        'Dato: [booking_date]',
        '',
        'Betal for afhentning & levering her: [payment_link]',
        'Bookingnummer bekræftes når betaling er registreret.',
        '',
        'Venlig hilsen [store_title]',
      ].join('\n'),
      ctx
    ),

  bookingConfirmedAfterPayment: (ctx: SmsTemplateRenderContext) =>
    renderSmsTemplate(
      [
        'Hej [customer_name]',
        '',
        'Din betaling er modtaget og din booking er nu bekræftet.',
        'Cykel: [bike_title]',
        'Dato: [booking_date]',
        'Opgave-nr: [task_no]',
        '',
        'Vi henter din cykel på den aftalte dato.',
        'Venlig hilsen [store_title]',
      ].join('\n'),
      ctx
    ),

  bookingCancelled: (ctx: SmsTemplateRenderContext) =>
    renderSmsTemplate(
      [
        'Hej [customer_name]',
        '',
        'Din booking (opgave-nr: [task_no]) er annulleret.',
        'Kontakt os på [store_phone] hvis du har spørgsmål.',
        '',
        'Venlig hilsen [store_title]',
      ].join('\n'),
      ctx
    ),
};
