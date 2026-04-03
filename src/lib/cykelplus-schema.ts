import { createServiceClient } from '@/lib/supabase/server';
import { bookingDebug, bookingDebugError } from '@/lib/booking-debug';

type CykelPlusSchemaScope = 'auth' | 'app';
type SchemaCheckKey =
  | 'users'
  | 'userProfiles'
  | 'userSessions'
  | 'bikes'
  | 'bikeImages'
  | 'bikeExternalRefs'
  | 'bookingFormsSlug'
  | 'bookingExtensions'
  | 'bookingEvents'
  | 'bookingPaymentStatus'
  | 'bikeHistoryCache'
  | 'serviceReminderRules'
  | 'serviceReminders'
  | 'trackerAddons'
  | 'supportContactSettings';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

interface SchemaCheckError {
  code?: string;
  message: string;
}

interface SchemaCheckResult {
  error: SchemaCheckError | null;
}

interface SchemaCheck {
  label: string;
  run: (supabase: ServiceClient) => PromiseLike<SchemaCheckResult>;
}

const SCHEMA_CHECKS: Record<SchemaCheckKey, SchemaCheck> = {
  users: {
    label: 'public.users',
    run: (supabase) => supabase.from('users').select('id, phone').limit(1),
  },
  userProfiles: {
    label: 'public.user_profiles',
    run: (supabase) => supabase.from('user_profiles').select('id').limit(1),
  },
  userSessions: {
    label: 'public.user_sessions',
    run: (supabase) => supabase.from('user_sessions').select('id, user_id, token_hash').limit(1),
  },
  bikes: {
    label: 'public.bikes',
    run: (supabase) => supabase.from('bikes').select('id, user_id').limit(1),
  },
  bikeImages: {
    label: 'public.bike_images',
    run: (supabase) => supabase.from('bike_images').select('id, bike_id').limit(1),
  },
  bikeExternalRefs: {
    label: 'public.bike_external_refs',
    run: (supabase) => supabase.from('bike_external_refs').select('id, bike_id').limit(1),
  },
  bookingFormsSlug: {
    label: 'public.booking_forms.slug',
    run: (supabase) => supabase.from('booking_forms').select('id, slug').limit(1),
  },
  bookingExtensions: {
    label: 'public.bookings.user_id/bike_id/payment_link_url/payment_expires_at',
    run: (supabase) =>
      supabase
        .from('bookings')
        .select('id, user_id, bike_id, payment_link_url, payment_expires_at')
        .limit(1),
  },
  bookingEvents: {
    label: 'public.booking_events',
    run: (supabase) => supabase.from('booking_events').select('id, booking_id').limit(1),
  },
  bookingPaymentStatus: {
    label: 'public.booking_payment_status',
    run: (supabase) =>
      supabase.from('booking_payment_status').select('id, booking_id').limit(1),
  },
  bikeHistoryCache: {
    label: 'public.bike_history_cache',
    run: (supabase) => supabase.from('bike_history_cache').select('id, bike_id').limit(1),
  },
  serviceReminderRules: {
    label: 'public.service_reminder_rules',
    run: (supabase) => supabase.from('service_reminder_rules').select('id').limit(1),
  },
  serviceReminders: {
    label: 'public.service_reminders',
    run: (supabase) => supabase.from('service_reminders').select('id, user_id, bike_id').limit(1),
  },
  trackerAddons: {
    label: 'public.tracker_addons',
    run: (supabase) => supabase.from('tracker_addons').select('id, user_id, bike_id').limit(1),
  },
  supportContactSettings: {
    label: 'public.support_contact_settings',
    run: (supabase) => supabase.from('support_contact_settings').select('id').limit(1),
  },
};

const SCHEMA_SCOPES: Record<CykelPlusSchemaScope, SchemaCheckKey[]> = {
  auth: [
    'users',
    'userProfiles',
    'userSessions',
    'bikes',
    'bikeImages',
    'bikeExternalRefs',
    'bookingFormsSlug',
    'bookingExtensions',
  ],
  app: [
    'users',
    'userProfiles',
    'userSessions',
    'bikes',
    'bikeImages',
    'bikeExternalRefs',
    'bookingFormsSlug',
    'bookingExtensions',
    'bookingEvents',
    'bookingPaymentStatus',
    'bikeHistoryCache',
    'serviceReminderRules',
    'serviceReminders',
    'trackerAddons',
    'supportContactSettings',
  ],
};

const readinessCache = new Map<CykelPlusSchemaScope, Promise<void>>();

function isMissingSchemaError(error: SchemaCheckError | null | undefined): boolean {
  return error?.code === 'PGRST205' || error?.code === '42703';
}

export class CykelPlusSchemaError extends Error {
  readonly scope: CykelPlusSchemaScope;
  readonly missingObjects: string[];

  constructor(scope: CykelPlusSchemaScope, missingObjects: string[]) {
    super(
      `CykelPlus-setup mangler i Supabase: ${missingObjects.join(
        ', '
      )}. Kør reparationsmigrationen for CykelPlus.`
    );
    this.name = 'CykelPlusSchemaError';
    this.scope = scope;
    this.missingObjects = missingObjects;
  }
}

async function runSchemaChecks(scope: CykelPlusSchemaScope): Promise<void> {
  const supabase = await createServiceClient();
  const missingObjects: string[] = [];

  for (const key of SCHEMA_SCOPES[scope]) {
    const { error } = await SCHEMA_CHECKS[key].run(supabase);

    if (!error) {
      continue;
    }

    if (isMissingSchemaError(error)) {
      missingObjects.push(SCHEMA_CHECKS[key].label);
      continue;
    }

    throw new Error(`CykelPlus schema-check fejlede for ${SCHEMA_CHECKS[key].label}: ${error.message}`);
  }

  if (missingObjects.length > 0) {
    throw new CykelPlusSchemaError(scope, missingObjects);
  }
}

export async function ensureCykelPlusSchemaReady(
  scope: CykelPlusSchemaScope,
  options: { traceId?: string; source?: string } = {}
): Promise<void> {
  let promise = readinessCache.get(scope);

  if (!promise) {
    promise = runSchemaChecks(scope);
    readinessCache.set(scope, promise);
  }

  try {
    await promise;

    if (options.traceId) {
      bookingDebug(options.traceId, 'cykelplus_schema.ready', {
        scope,
        source: options.source ?? null,
      });
    }
  } catch (error) {
    readinessCache.delete(scope);

    if (options.traceId) {
      bookingDebugError(options.traceId, 'cykelplus_schema.failed', error, {
        scope,
        source: options.source ?? null,
      });
    }

    throw error;
  }
}
