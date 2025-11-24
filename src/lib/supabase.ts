import { createClient } from '@supabase/supabase-js'

// Trim to remove any accidental whitespace from env vars
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

// Strict validation helper
const isValidUrl = (urlString: string) => {
  try {
    const url = new URL(urlString)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (e) {
    return false
  }
}

if (!supabaseUrl || !isValidUrl(supabaseUrl)) {
  console.error('Supabase Configuration Error: Invalid URL provided.', { supabaseUrl })
  throw new Error(
    'Invalid Supabase URL. Please check your .env file and ensure VITE_SUPABASE_URL is set to a valid HTTP/HTTPS URL.'
  )
}

if (!supabaseAnonKey) {
  console.error('Supabase Configuration Error: Missing Anon Key.')
  throw new Error('Supabase Anon Key is missing. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  // Increase global fetch timeout/retry if needed
  global: {
    headers: { 'x-application-name': 'artirasa-inventory' }
  }
})
