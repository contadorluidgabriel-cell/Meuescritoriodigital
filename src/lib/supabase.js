import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://pbwnzkmbcuoyyoojgnay.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dP8vlwqtkoP3M_Otf8aJoQ_Ev052pDD'

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)
