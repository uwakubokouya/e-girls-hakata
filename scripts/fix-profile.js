const fs = require('fs');

function fixCastProfilePage() {
    let content = fs.readFileSync('src/app/cast/[id]/page.tsx', 'utf-8');

    if(!content.includes('import { fetchBusinessEndTime')) {
        content = content.replace(/import { supabase } from '@\/lib\/supabase';/, 
            'import { supabase } from \"@/lib/supabase\";\nimport { fetchBusinessEndTime, getLogicalBusinessDate, getAdjustedMinutes, getAdjustedNowMins } from \"@/utils/businessTime\";');
    }

    content = content.replace(/const todayStr = new Date\(\)\.toLocaleDateString\('sv-SE'\)\.split\('T'\)\[0\];/,
        'const now = new Date();\n          const businessEndTime = await fetchBusinessEndTime(supabase);\n          const todayStr = getLogicalBusinessDate(now, businessEndTime.hour, businessEndTime.min);');


    const origin1 = `                  const currentHour = now.getHours();
                  const currentMin = now.getMinutes();
                  const currentMinTotal = currentHour * 60 + currentMin;

                  if (isAbsent) {
                      statusText = "お休み";
                      isWorkingToday = false;
                  } else if (shift_end) {
                      const eParts = shift_end.split(':');
                      let eH = parseInt(eParts[0]);
                      if (eH < 6) eH += 24;
                      const eMin = eH * 60 + parseInt(eParts[1] || '0');
                      const adjCurrentMin = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                      if (adjCurrentMin >= eMin) {
                          statusText = "受付終了";
                          const next_shift_date = myAvails[0].next_shift_date;
                          if (next_shift_date) {
                              const d = new Date(next_shift_date);
                              nextAvailableTime = \`次回出勤: \${d.getMonth() + 1}/\${d.getDate()}\`;
                          } else {
                              nextAvailableTime = "次回出勤: 未定";
                          }
                      }
                  }`;

    const new1 = `                  if (isAbsent) {
                      statusText = "お休み";
                      isWorkingToday = false;
                  } else if (shift_end) {
                      const eMin = getAdjustedMinutes(shift_end, businessEndTime.hour);
                      const adjCurrentMin = getAdjustedNowMins(now, businessEndTime.hour);
                      if (adjCurrentMin >= eMin) {
                          statusText = "受付終了";
                          const next_shift_date = myAvails[0].next_shift_date;
                          if (next_shift_date) {
                              const d = new Date(next_shift_date);
                              nextAvailableTime = \`次回出勤: \${d.getMonth() + 1}/\${d.getDate()}\`;
                          } else {
                              nextAvailableTime = "次回出勤: 未定";
                          }
                      }
                  }`;

    content = content.split(origin1).join(new1);
    content = content.split(origin1.replace(/\n/g, '\r\n')).join(new1.replace(/\n/g, '\r\n'));


    const origin2 = `                  if (statusText === "本日出勤中") {
                      let ssP = shift_start.split(':');
                       let seP = shift_end.split(':');
                       let ssH = parseInt(ssP[0]); if(ssH < 6) ssH += 24;
                       let seH = parseInt(seP[0]); if(seH < 6) seH += 24;
                       const ssM = ssH * 60 + parseInt(ssP[1] || '0');
                       const seM = seH * 60 + parseInt(seP[1] || '0');
                       const am = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                       
                       let cursorM = Math.max(am, ssM);
                       
                       const parsedBookings = bookings.map((b: any) => {
                           let bsH = parseInt(b.start.split(':')[0]); if(bsH < 6) bsH += 24;
                           let beH = parseInt(b.end.split(':')[0]); if(beH < 6) beH += 24;
                           return {
                               startM: bsH * 60 + parseInt(b.start.split(':')[1] || '0'),
                               endM: beH * 60 + parseInt(b.end.split(':')[1] || '0') + 10
                           };
                       }).sort((a: any, b: any) => a.startM - b.startM);`;

    const new2 = `                  if (statusText === "本日出勤中") {
                       const ssM = getAdjustedMinutes(shift_start, businessEndTime.hour);
                       const seM = getAdjustedMinutes(shift_end, businessEndTime.hour);
                       const am = getAdjustedNowMins(now, businessEndTime.hour);
                       
                       let cursorM = Math.max(am, ssM);
                       
                       const parsedBookings = bookings.map((b: any) => {
                           return {
                               startM: getAdjustedMinutes(b.start, businessEndTime.hour),
                               endM: getAdjustedMinutes(b.end, businessEndTime.hour) + 10
                           };
                       }).sort((a: any, b: any) => a.startM - b.startM);`;

    content = content.split(origin2).join(new2);
    content = content.split(origin2.replace(/\n/g, '\r\n')).join(new2.replace(/\n/g, '\r\n'));

    // Fix the garbled strings specifically
    content = content.replace(/nextAvailableTime = \`\ufffd\ufffd\ufffd\ufffdo\ufffd\ufffd: \$\{dt\.getMonth\(\) \+ 1\}\\\/\$\{dt\.getDate\(\)\}\`;/g, 
      "nextAvailableTime = `次回出勤: ${dt.getMonth() + 1}/${dt.getDate()}`;");
    content = content.replace(/nextAvailableTime = \"\ufffd\ufffd\ufffd\ufffdo\ufffd\ufffd: \ufffd\ufffd\ufffd\ufffd\";/g, 
      "nextAvailableTime = \"次回出勤: 未定\";");
    content = content.replace(/nextAvailableTime = \"\ufffd\u048b@\ufffd\ufffd\";/g, 
      "nextAvailableTime = \"待機中\";");

    fs.writeFileSync('src/app/cast/[id]/page.tsx', content);
    console.log('cast/[id]/page.tsx fixed');
}

fixCastProfilePage();
