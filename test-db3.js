const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envRaw = fs.readFileSync('.env.local', 'utf8');
const lines = envRaw.split('\n');
const env = {};
for(const line of lines) {
    if(line.includes('=')) {
        const [a, ...b] = line.split('=');
        env[a.trim()] = b.join('=').trim().replace(/["']/g, '');
    }
}
const s = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
async function run() {
  const { data: p } = await s.from('sns_profiles').select('id, phone, name').eq('name', 'さや');
  const { data: c } = await s.from('casts').select('id, login_id, phone, name').eq('name', 'さや');
  console.log("SNS さや:", p);
  console.log("Casts さや:", c);
}
run();
