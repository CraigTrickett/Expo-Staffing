import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ShiftBooking, StoredEventData, TimeSlot } from '@/types';

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
 * Concurrency Testing Flag:
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
  updatedSlot?: TimeSlot;
}

/**
 * Hybrid Shift Claim with 409 Conflict Protection:
 * Checks remote database (or simulation flag). If the slot has become full
 * or was already claimed by another user concurrently, returns a 409 conflict.
 */
export async function remoteClaimShiftGuard(
  eventId: string,
  slotId: string,
  booking: ShiftBooking,
  currentSlot: TimeSlot
): Promise<RemoteClaimResult> {
  // Check if developer/user activated simulated 409 conflict
  if (simulateConflictFlag) {
    // Reset simulation flag so subsequent attempts can succeed
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
    // Graceful offline/localStorage fallback: local checks pass
    return { success: true, status: 200 };
  }

  try {
    // 1. Fetch live slot state from Supabase to ensure slot capacity hasn't been saturated
    const { data, error } = await client
      .from('booth_slots')
      .select('bookings, capacity')
      .eq('id', slotId)
      .eq('event_id', eventId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // Non-critical network warning, allow local optimistic persistence
      console.warn('[Supabase Hybrid Sync] Remote check warning, proceeding locally:', error.message);
      return { success: true, status: 200 };
    }

    if (data) {
      const liveBookings: ShiftBooking[] = data.bookings || [];
      const capacity: number = data.capacity || currentSlot.capacity;

      // 409 Conflict: Remote slot is already full!
      if (liveBookings.length >= capacity) {
        return {
          success: false,
          status: 409,
          conflict: true,
          message: 'Slot was just claimed by someone else! Matrix updated.',
        };
      }

      // 409 Conflict: Staff member already booked remotely
      if (liveBookings.some((b) => b.staffId === booking.staffId)) {
        return {
          success: false,
          status: 409,
          conflict: true,
          message: 'You are already booked for this slot on another device.',
        };
      }

      // Remote write
      const updatedBookings = [...liveBookings, booking];
      const { error: updateError } = await client
        .from('booth_slots')
        .update({ bookings: updatedBookings, updated_at: new Date().toISOString() })
        .eq('id', slotId)
        .eq('event_id', eventId);

      if (updateError) {
        return {
          success: false,
          status: 409,
          conflict: true,
          message: 'Slot was just claimed by someone else! Matrix updated.',
        };
      }
    }

    return { success: true, status: 200 };
  } catch (err: any) {
    console.warn('[Supabase] Concurrency check caught exception:', err);
    return { success: true, status: 200 };
  }
}

/**
 * Hybrid Sync to Supabase for events (if configured)
 */
export async function syncEventToSupabase(eventData: StoredEventData): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('booth_events').upsert({
      id: eventData.config.id,
      title: eventData.config.title,
      config: eventData.config,
      slots: eventData.slots,
      roster: eventData.roster,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('[Supabase] Event sync failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Event sync exception:', err);
    return false;
  }
}
