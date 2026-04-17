const fs = require('fs');

let c = fs.readFileSync('src/app/admin/analytics/page.tsx', 'utf-8');

const tCasts = `    // Fetch casts for dropdown
    useEffect(() => {
        const fetchCasts = async () => {
            const { data } = await supabase.from('sns_profiles').select('id, name');
            if (data) {
                const { data: castsData } = await supabase.from('casts').select('id');
                const castIds = new Set(castsData?.map(c => c.id) || []);
                setCasts(data.filter(c => castIds.has(c.id)));
            }
        };
        fetchCasts();
    }, []);`;

const rCasts = `    // Fetch casts for dropdown
    useEffect(() => {
        const fetchCasts = async () => {
            const { data } = await supabase.from('sns_profiles').select('id, name').eq('role', 'cast');
            if (data) {
                setCasts(data);
            }
        };
        fetchCasts();
    }, []);`;

let newC = c.split(tCasts).join(rCasts);
if(newC === c) {
    newC = c.split(tCasts.replace(/\n/g, '\r\n')).join(rCasts.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('src/app/admin/analytics/page.tsx', newC);
console.log('fixed cast filter using role eq cast');
