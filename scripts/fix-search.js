const fs = require('fs');

function fixSearchPage() {
    let content = fs.readFileSync('src/app/search/page.tsx', 'utf-8');

    // Replace todayStr
    content = content.replace(/const todayStr = new Date\(\)\.toLocaleDateString\('sv-SE'\)\.split\('T'\)\[0\];/,
        'const now = new Date();\n                const businessEndTime = await fetchBusinessEndTime(supabase);\n                const todayStr = getLogicalBusinessDate(now, businessEndTime.hour, businessEndTime.min);');

    // Replace time logic blocks - using simpler string matching or regex for specific blocks
    // Replace: const adjCurrentMin = currentHour < 6 ? ... : ...;
    // But it's easier to just match the `if (avail.shift_end && statusText !== "お休み") {` ... `                 } else {`
    
    // Instead of big blocks, use regex to replace specific problematic lines inside `fetchCasts`:
    
    // The `isWorkingToday` setup logic
    const oldSetup = `                    if (avail.shift_end && statusText !== "お休み") {
                        if (isAbsent) {
                            statusText = "お休み";
                        } else {
                            statusText = null;
                        }
                        isWorkingToday = false;
                        const nextDateRaw = avail.next_shift_date || nextShiftMap.get(cast.id);
                        if (nextDateRaw) {
                            const d = new Date(nextDateRaw);
                            nextAvailableTime = \`次回出勤: \${d.getMonth() + 1}/\${d.getDate()}\`;
                        } else {
                            nextAvailableTime = "次回出勤: 未定";
                        }
                    } else {
                        statusText = "本日出勤中";
                        const eParts = avail.shift_end.split(':');
                        let eH = parseInt(eParts[0]);
                        if (eH < 6) eH += 24;
                        const eMin = eH * 60 + parseInt(eParts[1] || '0');
                        const adjCurrentMin = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                        if (adjCurrentMin >= eMin) {
                            statusText = "受付終了";
                            const nextDateRaw = avail.next_shift_date || nextShiftMap.get(cast.id);
                            if (nextDateRaw) {
                                const d = new Date(nextDateRaw);
                                nextAvailableTime = \`次回出勤: \${d.getMonth() + 1}/\${d.getDate()}\`;
                            } else {
                                nextAvailableTime = "次回出勤: 未定";
                            }
                            isWorkingToday = true; // 表示上の都合でtrueにしておく
                        }
                    }`;

    const newSetup = `                    if (avail.shift_end && statusText !== "お休み") {
                        if (isAbsent) {
                            statusText = "お休み";
                        } else {
                            statusText = null;
                        }
                        isWorkingToday = false;
                        const nextDateRaw = avail.next_shift_date || nextShiftMap.get(cast.id);
                        if (nextDateRaw) {
                            const d = new Date(nextDateRaw);
                            nextAvailableTime = \`次回出勤: \${d.getMonth() + 1}/\${d.getDate()}\`;
                        } else {
                            nextAvailableTime = "次回出勤: 未定";
                        }
                    } else {
                        statusText = "本日出勤中";
                        const eMin = getAdjustedMinutes(avail.shift_end, businessEndTime.hour);
                        const adjCurrentMin = getAdjustedNowMins(now, businessEndTime.hour);
                        if (adjCurrentMin >= eMin) {
                            statusText = "受付終了";
                            const nextDateRaw = avail.next_shift_date || nextShiftMap.get(cast.id);
                            if (nextDateRaw) {
                                const d = new Date(nextDateRaw);
                                nextAvailableTime = \`次回出勤: \${d.getMonth() + 1}/\${d.getDate()}\`;
                            } else {
                                nextAvailableTime = "次回出勤: 未定";
                            }
                            isWorkingToday = true;
                        }
                    }`;

    content = content.split(oldSetup).join(newSetup);
    content = content.split(oldSetup.replace(/\n/g, '\r\n')).join(newSetup.replace(/\n/g, '\r\n'));

    const oldBlock2 = `                    if (statusText === "本日出勤中") {
                        let ssP = avail.shift_start.split(':');
                        let seP = avail.shift_end.split(':');
                        let ssH = parseInt(ssP[0]); if(ssH < 6) ssH += 24;
                        let seH = parseInt(seP[0]); if(seH < 6) seH += 24;
                        const ssM = ssH * 60 + parseInt(ssP[1] || '0');
                        const seM = seH * 60 + parseInt(seP[1] || '0');
                        const am = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                        
                        let cursorM = Math.max(am, ssM);
                        
                        const parsedBookings = avail.bookings.map((b: any) => {
                            let bsH = parseInt(b.start.split(':')[0]); if(bsH < 6) bsH += 24;
                            let beH = parseInt(b.end.split(':')[0]); if(beH < 6) beH += 24;
                            return {
                                startM: bsH * 60 + parseInt(b.start.split(':')[1] || '0'),
                                endM: beH * 60 + parseInt(b.end.split(':')[1] || '0') + 10
                            };
                        }).sort((a: any, b: any) => a.startM - b.startM);`;

    const newBlock2 = `                    if (statusText === "本日出勤中") {
                        const ssM = getAdjustedMinutes(avail.shift_start, businessEndTime.hour);
                        const seM = getAdjustedMinutes(avail.shift_end, businessEndTime.hour);
                        const am = getAdjustedNowMins(now, businessEndTime.hour);
                        
                        let cursorM = Math.max(am, ssM);
                        
                        const parsedBookings = avail.bookings.map((b: any) => {
                            return {
                                startM: getAdjustedMinutes(b.start, businessEndTime.hour),
                                endM: getAdjustedMinutes(b.end, businessEndTime.hour) + 10
                            };
                        }).sort((a: any, b: any) => a.startM - b.startM);`;

    content = content.split(oldBlock2).join(newBlock2);
    content = content.split(oldBlock2.replace(/\n/g, '\r\n')).join(newBlock2.replace(/\n/g, '\r\n'));

    fs.writeFileSync('src/app/search/page.tsx', content);
    console.log('search/page.tsx fixed');
}

fixSearchPage();
