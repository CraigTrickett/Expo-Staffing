import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { EventConfig, ShiftBooking, StoredEventData, TimeSlot, StaffMember } from '@/types';

// Read optional Supabase environment credentials
const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.trim().length > 0 &&
  supabaseAnonKey.trim().length > 0
);

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!supabaseInstance && supabaseUrl && supabaseAnonKey) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    } catch (err) {
      console.warn('[Supabase] Failed to initialize client, falling back to local mode:', err);
      return null;
    }
  }

  return supabaseInstance;
}

/**
 * Concurrency Testing Flag (dev/QA only — never exposed in production UI):
 * When enabled, the next shift claim will simulate a remote 409 Conflict
 * (as if another booth staff member tapped the exact same second).
 */
let simulateConflictFlag = false;

export const concurrencyTester = {
  isSimulatingConflict: () => simulateConflictFlag,
  setSimulateConflict: (val: boolean) => {
    simulateConflictFlag = val;
  },
  toggleSimulateConflict: () => {
    simulateConflictFlag = !simulateConflictFlag;
    return simulateConflictFlag;
  },
};

export interface RemoteClaimResult {
  success: boolean;
  status: 200 | 409 | 500;
  message?: string;
  conflict?: boolean;
}

interface BoothEventRow {
  id: string;
  admin_key: string;
  public_key: string;
  config: EventConfig;
  slots: TimeSlot[];
  roster: StaffMember[];
  updated_at: string;
}

function rowToStoredEvent(row: BoothEventRow): StoredEventData {
  return { config: row.config, slots: row.slots, roster: row.roster };
}

/**
 * Fetches a single event by its admin key or public key directly from
 * Supabase. Returns null on a genuine "not found" as well as on any
 * network/config failure — callers should fall back to local storage
 * in either case, since this is the single source of truth only when
 * reachable.
 */
export async function fetchEventByKey(
  key: string
): Promise<{ data: StoredEventData; role: 'admin' | 'staff' } | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('booth_events')
      .select('*')
      .or(`admin_key.eq.${key},public_key.eq.${key}`)
      .maybeSingle<BoothEventRow>();

    if (error || !data) {
      if (error) console.warn('[Supabase] fetchEventByKey failed, falling back to local:', error.message);
      return null;
    }

    const role: 'admin' | 'staff' = data.admin_key === key ? 'admin' : 'staff';
    return { data: rowToStoredEvent(data), role };
  } catch (err) {
    console.warn('[Supabase] fetchEventByKey exception, falling back to local:', err);
    return null;
  }
}

/**
 * Pushes the full current event state (config + slots + roster) to Supabase.
 * Fire-and-forget from the caller's perspective: failures are logged but
 * never block the local-first UX, since localStorage already has the
 * authoritative local copy.
 */
export async function pushEventToSupabase(eventData: StoredEventData): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('booth_events').upsert({
      id: eventData.config.id,
      admin_key: eventData.config.adminKey,
      public_key: eventData.config.publicKey,
      config: eventData.config,
      slots: eventData.slots,
      roster: eventData.roster,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('[Supabase] Event push failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Event push exception:', err);
    return false;
  }
}

/**
 * Re-fetches the live event from Supabase immediately before a shift claim
 * commits, to catch a real concurrent claim from another device. Falls
 * back to optimistic local success when Supabase isn't configured or is
 * unreachable, matching the app's offline-first design.
 */
export async function remoteClaimShiftGuard(
  eventId: string,
  slotId: string,
  booking: ShiftBooking,
  currentSlot: TimeSlot
): Promise<RemoteClaimResult> {
  if (simulateConflictFlag) {
    simulateConflictFlag = false;
    return {
      success: false,
      status: 409,
      conflict: true,
      message: 'Slot was just claimed by someone else! Matrix updated.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: true, status: 200 };
  }

  try {
    const { data, error } = await client
      .from('booth_events')
      .select('slots')
      .eq('id', eventId)
      .maybeSingle<{ slots: TimeSlot[] }>();

    if (error) {
      console.warn('[Supabase] Remote conflict check warning, proceeding locally:', error.message);
      return { success: true, status: 200 };
    }

    const liveSlot = data?.slots?.find((s) => s.id === slotId) || currentSlot;

    if (liveSlot.bookings.length >= liveSlot.capacity) {
      return {
        success: false,
        status: 409,
        conflict: true,
        message: 'Slot was just claimed by someone else! Matrix updated.',
      };
    }

    if (liveSlot.bookings.some((b) => b.staffId === booking.staffId)) {
      return {
        success: false,
        status: 409,
        conflict: true,
        message: 'You are already booked for this slot on another device.',
      };
    }

    return { success: true, status: 200 };
  } catch (err) {
    console.warn('[Supabase] Concurrency check exception, proceeding locally:', err);
    return { success: true, status: 200 };
  }
}
