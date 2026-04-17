const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envRaw = fs.readFileSync('.env.local', 'utf8');
const lines = envRaw.split('\n');
const env = {};
for(const line of lines) {
    if(line.includes('=')) {
        const [a, ...b] = line.split('=');
        env[a.trim()] = b.join('=').trim().replace(/["']/g, '');
    }
}

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function check() {
  const { data, error } = await supabase.from('sns_messages').select('*').eq('is_read', false);
  console.log("Unread Messages Count:", data?.length);
  const likes = data?.filter(m => m.content.includes('[SYSTEM_LIKE]'));
  console.log("Unread LIKES:", likes?.length);

  if (likes && likes.length > 0) {
      console.log("Attempting to mark read...");
      const { data: u, error: e } = await supabase.from('sns_messages')
         .update({ is_read: true })
         .in('id', likes.map(l => l.id)).select();
      
      console.log("Update result:", e ? e : u);
  }
}
check();
