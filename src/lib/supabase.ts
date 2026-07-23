import { createClient } from '@supabase/supabase-js';
import { createLocalClient } from './supabaseLocal';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

const realSupabase = createClient(supabaseUrl, supabaseAnonKey);
const localSupabase = createLocalClient();

// Resolve active client based on localStorage setting (default: local)
const getClient = () => {
  const mode = localStorage.getItem('hospital_db_mode') || 'local';
  return mode === 'supabase' ? realSupabase : localSupabase;
};

export const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
}) as any;
