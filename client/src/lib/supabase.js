import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sans configuration, l'application reste utilisable en mode invité (aucun compte).
export const supabase = url && key ? createClient(url, key) : null;
