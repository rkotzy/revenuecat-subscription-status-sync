// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { checkUserPremiumStatus } from "../_shared/helpers.ts";

Deno.serve(async (req) => {

  // In real life, we would get the user ID
  // from a JWT or proper auth system.
  const { app_user_id } = await req.json()

  try {
    const premium = await checkUserPremiumStatus(app_user_id);
    return new Response(premium ? "Premium" : "Free")
  } catch (error) {
    console.error("Error checking premium status:", error);
    return new Response("Error checking premium status", { status: 500 });
  }
})