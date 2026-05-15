import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ubvgrxtxtelulwjtfudd.supabase.co'
const SUPABASE_KEY = 'sb_publishable_yJI4GSwD-b606xNKs2rXkg_cijJdGFm'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
