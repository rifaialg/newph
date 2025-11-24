// This function is deprecated and should be removed from Supabase Edge Functions.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  return new Response(JSON.stringify({ error: "Service Deprecated" }), {
    headers: { 'Content-Type': 'application/json' },
    status: 410,
  })
})
