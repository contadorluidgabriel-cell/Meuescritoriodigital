import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://pbwnzkmbcuoyyoojgnay.supabase.co',
  'sb_publishable_dP8vlwqtkoP3M_Otf8aJoQ_Ev052pDD',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)
