import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Check if Supabase credentials are configured
const hasSupabaseConfig = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined';

// Create Supabase client - always create one (either real or will throw clear errors)
export const supabase: SupabaseClient = hasSupabaseConfig 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

export const supabaseAdmin = hasSupabaseConfig && supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Export config status for error handling
export const isSupabaseConfigured = hasSupabaseConfig;
