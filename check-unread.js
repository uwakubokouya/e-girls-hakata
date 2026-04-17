const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: n } = await supabase.from('sns_notifications').select('*');
  const { data: m } = await supabase.from('sns_messages').select('*').eq('is_read', false);
  console.log("Unread Notifications:", n);
  console.log("Unread Messages:", m);
}
check();
