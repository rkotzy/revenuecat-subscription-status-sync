// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { fetchAndSyncRevenueCatSubscriber } from "../_shared/helpers.ts";

console.log("Hello from Functions!")

Deno.serve(async (req) => {
   // In real life, we would get the user ID
  // from a JWT or proper auth system.
  const { app_user_id } = await req.json()

  try {
    const updates = await fetchAndSyncRevenueCatSubscriber(app_user_id, "verify-purchase");
    return new Response(JSON.stringify(updates))
  } catch (error) {
    console.error("Error verifying purchase:", error);
    return new Response("Error verifying purchase", { status: 500 });
  }
})