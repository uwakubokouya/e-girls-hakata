const fs = require('fs');

let c = fs.readFileSync('src/app/reserve/[castId]/page.tsx', 'utf-8');

// 1. Add useUser import
if (!c.includes('import { useUser }')) {
    c = c.replace(
        "import { useRouter } from 'next/navigation';",
        "import { useRouter } from 'next/navigation';\nimport { useUser } from \"@/providers/UserProvider\";"
    );
}

// 2. Add useUser hook into component
const tHook = `    const router = useRouter();
    
    // UI steps`;
const rHook = `    const router = useRouter();
    const { user } = useUser();
    
    // UI steps`;
let newC = c.split(tHook).join(rHook);
if(newC === c) {
    newC = c.split(tHook.replace(/\n/g, '\r\n')).join(rHook.replace(/\n/g, '\r\n'));
}
c = newC;

// 3. Add tracking useEffect
const tEffect = `    // 1. Initial Data Fetch
    useEffect(() => {`;
    
const rEffect = `    // 0. Tracking
    useEffect(() => {
        if (!castId) return;
        if (user?.role === 'cast' || user?.is_admin) return;
        
        const trackPV = async () => {
            const TRACK_KEY = \`last_reserve_click_\${castId}\`;
            const lastTracked = sessionStorage.getItem(TRACK_KEY);
            const now = Date.now();
            
            if (!lastTracked || now - parseInt(lastTracked) > 600000) {
              sessionStorage.setItem(TRACK_KEY, now.toString());
              try {
                  const sessionObj = localStorage.getItem('anon_session_id');
                  supabase.from('page_views').insert({
                      page_type: 'reserve_click',
                      target_id: castId,
                      viewer_id: user?.id || null,
                      session_id: sessionObj
                  }).then(() => {});
              } catch(e) {}
            }
        };
        trackPV();
    }, [castId, user]);

    // 1. Initial Data Fetch
    useEffect(() => {`;

newC = c.split(tEffect).join(rEffect);
if(newC === c) {
    newC = c.split(tEffect.replace(/\n/g, '\r\n')).join(rEffect.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('src/app/reserve/[castId]/page.tsx', newC);
console.log('reserve tracking log moved to reserve page load');
