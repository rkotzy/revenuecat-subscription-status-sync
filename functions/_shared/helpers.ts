// Fetches subscriber details from RevenueCat
// Requires the environment variable `REVENUECAT_API_KEY` to be set.
// Docs: https://www.revenuecat.com/docs/api-v1#tag/customers/operation/subscribers


// Convenience function that combines fetching RevenueCat subscriber data and syncing it to the database
export async function fetchAndSyncRevenueCatSubscriber(appUserId: string, syncReason: string) {
  const subscriber = await fetchRevenueCatSubscriber(appUserId);
  const updates = await syncRevenueCatSubscriberWithDb(appUserId, subscriber, syncReason);
  return updates;
}


async function fetchRevenueCatSubscriber(appUserId: string): Promise<unknown> {

  const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("REVENUECAT_API_KEY")}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`RevenueCat request failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// Syncs selected subscriber data into the `users` table.
// Fields synced:
// - entitlement_id (first entitlement key)
// - expires_at (expires_date of that entitlement)
// - last_synced_at (now)
// - last_synced_reason ('webhook')
// Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars.
import { createClient } from "npm:@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncRevenueCatSubscriberWithDb(appUserId: string, rcSubscriber: any, syncReason: string) {
  const updates: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    last_synced_reason: syncReason,
  };

  // This just gets the first entitlement key.
  // TODO: handle multiple entitlements if necessary.
  const entitlements = rcSubscriber?.subscriber?.entitlements ?? {};
  const firstKey = Object.keys(entitlements)[0];

  if (firstKey) {
    const entitlement = entitlements[firstKey];
    updates.entitlement_id = firstKey;
    updates.expires_at = entitlement?.expires_date ?? null;
  } else {
    // No entitlements – clear fields.
    updates.entitlement_id = null;
    updates.expires_at = null;
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("app_user_id", appUserId)
    .select("app_user_id");

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error("User not found");
  }

  return updates;
}

const PREMIUM_STATUS_BUFFER_HOURS = 8;

export async function checkUserPremiumStatus(appUserId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("expires_at")
    .eq("app_user_id", appUserId);

  if (error) {
    console.error("Error fetching user:", error);
    throw error;
  }

  const expiresAt = data?.[0]?.expires_at;
  
  // No expiration date means no premium access
  if (!expiresAt) {
    return false;
  }

  // Convert to Date and add buffer hours
  const expiresAtDate = new Date(expiresAt);
  const expiresAtWithBuffer = new Date(expiresAtDate.getTime() + PREMIUM_STATUS_BUFFER_HOURS * 60 * 60 * 1000);
  const now = new Date();

  return now < expiresAtWithBuffer;
}