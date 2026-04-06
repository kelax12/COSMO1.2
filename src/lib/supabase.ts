import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabaseConfig = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined');

export const supabase: SupabaseClient = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

export const isSupabaseConfigured = hasSupabaseConfig;
export let isDemoMode = !hasSupabaseConfig;
export const setDemoMode = (v: boolean) => { isDemoMode = v; };
