import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase admin client with the service_role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // Get the user's JWT from the Authorization header
    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))

    if (!user) {
      throw new Error('User not authenticated.')
    }

    // Fetch the user's profile to check their role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Could not verify user role.')
    }

    // IMPORTANT: Only allow owners to invite users
    if (profile.role !== 'owner') {
      throw new Error('You do not have permission to invite users.')
    }

    // Get email and role from the request body
    const { email, role } = await req.json()
    if (!email || !role) {
      throw new Error('Email and role are required.')
    }

    // Invite the user using the admin client
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { data: { role: role, full_name: 'Invited User' } }
    )

    if (inviteError) {
      throw inviteError
    }

    return new Response(JSON.stringify(inviteData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
