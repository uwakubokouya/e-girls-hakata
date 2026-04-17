const fs = require('fs');

function fixReservePage() {
    let content = fs.readFileSync('src/app/reserve/[castId]/page.tsx', 'utf-8');

    if(!content.includes('import { fetchBusinessEndTime')) {
        content = content.replace(/import { supabase } from '@\/lib\/supabase';/, 
            'import { supabase } from \"@/lib/supabase\";\nimport { fetchBusinessEndTime, getLogicalBusinessDate, getAdjustedMinutes, getAdjustedNowMins } from \"@/utils/businessTime\";');
    }

    // Add state for businessEndTime
    if(!content.includes('const [businessEndTime, setBusinessEndTime]')) {
        content = content.replace(/const \[isLoadingSlots, setIsLoadingSlots\] = useState\(false\);/,
            'const [isLoadingSlots, setIsLoadingSlots] = useState(false);\n    const [businessEndTime, setBusinessEndTime] = useState<{hour: number, min: number}>({hour: 6, min: 0});');
    }

    // Update parseMins to use businessEndTime logic. Actually, we can just replace parseMins calls with getAdjustedMinutes, but let's redefine parseMins locally if we must, or just pass businessEndTime.hour to it.
    // Instead of replacing parseMins globally, let's redefine parseMins inside the component or just use getAdjustedMinutes directly.
    content = content.replace(/const sStart = parseMins\(baseShift\.shift_start\);/g, 'let sStart = getAdjustedMinutes(baseShift.shift_start, businessEndTime.hour);');
    content = content.replace(/let sStart = parseMins\(baseShift\.shift_start\);/g, 'let sStart = getAdjustedMinutes(baseShift.shift_start, businessEndTime.hour);');
    content = content.replace(/const sEnd = parseMins\(baseShift\.shift_end\);/g, 'const sEnd = getAdjustedMinutes(baseShift.shift_end, businessEndTime.hour);');
    content = content.replace(/const bStart = parseMins\(b\.start\);/g, 'const bStart = getAdjustedMinutes(b.start, businessEndTime.hour);');
    content = content.replace(/const bEnd = parseMins\(b\.end\);/g, 'const bEnd = getAdjustedMinutes(b.end, businessEndTime.hour);');


    // Replace the dates fetching inside fetchInitialData
    const old14days = `                // Fetch shifts for the next 14 days via RPC (bypasses RLS safely)
                const next14DaysPromises = Array.from({length: 14}, async (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() + i);
                    const dateStr = d.toLocaleDateString('sv-SE').split('T')[0]; `;

    const new14days = `                // Fetch business time once on init
                const bTime = await fetchBusinessEndTime(supabase);
                setBusinessEndTime(bTime);

                // Fetch shifts for the next 14 days via RPC (bypasses RLS safely)
                const next14DaysPromises = Array.from({length: 14}, async (_, i) => {
                    const now = new Date();
                    const logicalTodayStr = getLogicalBusinessDate(now, bTime.hour, bTime.min);
                    const d = new Date(logicalTodayStr);
                    d.setDate(d.getDate() + i);
                    const dateStr = d.toLocaleDateString('sv-SE').split('T')[0];`;

    content = content.split(old14days).join(new14days);
    content = content.split(old14days.replace(/\n/g, '\r\n')).join(new14days.replace(/\n/g, '\r\n'));

    // Replace the specific date comparisons
    const oldTodayCheck = `                        // If selectedDate is today, ensure we don't show past times
                        const now = new Date();
                        const todayStr = now.toLocaleDateString('sv-SE').split('T')[0];
                        if (selectedDate === todayStr) {
                            const currentMins = now.getHours() * 60 + now.getMinutes();
                            const adjCurrentMins = now.getHours() < 6 ? currentMins + 24 * 60 : currentMins;`;

    const newTodayCheck = `                        // If selectedDate is today, ensure we don't show past times
                        const now = new Date();
                        const todayStr = getLogicalBusinessDate(now, businessEndTime.hour, businessEndTime.min);
                        if (selectedDate === todayStr) {
                            const adjCurrentMins = getAdjustedNowMins(now, businessEndTime.hour);`;

    content = content.split(oldTodayCheck).join(newTodayCheck);
    content = content.split(oldTodayCheck.replace(/\n/g, '\r\n')).join(newTodayCheck.replace(/\n/g, '\r\n'));

    fs.writeFileSync('src/app/reserve/[castId]/page.tsx', content);
    console.log('reserve page.tsx fixed');
}
fixReservePage();
