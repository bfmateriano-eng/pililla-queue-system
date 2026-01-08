import { createBrowserClient } from '@supabase/ssr'

// This creates the connection for the parts of the app the user clicks on
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)