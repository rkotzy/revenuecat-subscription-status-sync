// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { fetchAndSyncRevenueCatSubscriber } from "../_shared/helpers.ts";

function verifyWebhook(req: Request): boolean {
  const secret = Deno.env.get("WEBHOOK_SECRET") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${secret}`;
}

async function processTransferEvent(payload: any): Promise<void> {
  const allUserIds = [
    ...(payload?.event?.transferred_from || []),
    ...(payload?.event?.transferred_to || [])
  ].filter(userId => !userId.startsWith("$RCAnonymous:"));

  if (allUserIds.length === 0) return; // No users to process

  // Process all users, collect any failures
  const results = await Promise.allSettled(
    allUserIds.map(userId => 
      fetchAndSyncRevenueCatSubscriber(userId, "webhook-sync-transfer")
    )
  );

  // Throw if any failed (triggers retry)
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    throw new Error("Some users failed to sync");
  }
}

Deno.serve(async (req) => {

  // Verify the webhook authorization header set
  // in the RevenueCat dashboard.
  if (!verifyWebhook(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();

  // Handle transfer events
  if (payload?.event?.type === "TRANSFER") {
    try {
      await processTransferEvent(payload);
      return new Response("Transfer processed successfully");
    } catch (err) {
      console.error("Failed to process transfer event", err);
      return new Response("Failed to process transfer", { status: 500 });
    }
  }

  // Extract the app_user_id from the payload for other event types.
  const appUserId = (payload as any)?.event?.app_user_id as string | undefined;
  if (!appUserId) {
    return new Response("Bad Request: missing app_user_id", { status: 400 });
  }

  // Reject anonymous users
  if (appUserId.startsWith("$RCAnonymous:")) {
    return new Response("Bad Request: anonymous user", { status: 400 });
  }
  
  // Sync subscriber data to Supabase using the convenience function
  try {
    await fetchAndSyncRevenueCatSubscriber(appUserId, "webhook-sync");
  } catch (err) {
    console.error("Failed to sync subscriber with DB", err);
    return new Response("Failed to sync user", { status: 500 });
  }

  return new Response();
})

