const fs = require('fs');

function fixPageTsx() {
    let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

    // Remove duplicates of new import
    content = content.replace(/import { fetchBusinessEndTime, getLogicalBusinessDate, getAdjustedMinutes, getAdjustedNowMins } from "@\/utils\/businessTime";\r?\nimport { fetchBusinessEndTime, getLogicalBusinessDate, getAdjustedMinutes, getAdjustedNowMins } from "@\/utils\/businessTime";/g,
        'import { fetchBusinessEndTime, getLogicalBusinessDate, getAdjustedMinutes, getAdjustedNowMins } from "@/utils/businessTime";');

    // Replace todayStr
    content = content.replace(/const todayStr = new Date\(\)\.toLocaleDateString\('sv-SE'\)\.split\('T'\)\[0\];/g,
        'const now = new Date();\n       const businessEndTime = await fetchBusinessEndTime(supabase);\n       const todayStr = getLogicalBusinessDate(now, businessEndTime.hour, businessEndTime.min);');

    // Replace time logic block
    const origin1 = `               const now = new Date();
               // Note: Timezone is Japanese local for users, but logic here assumes server/client roughly same
               const currentHour = now.getHours();
               const currentMin = now.getMinutes();
               const currentMinTotal = currentHour * 60 + currentMin;

               if (isAbsent) {
                   statusText = "お休み";
                   isWorkingToday = false; // Hide from standard "Working Today" logic
               } else if (avail.shift_end) {
                   const eParts = avail.shift_end.split(':');
                   let eH = parseInt(eParts[0]);
                   if (eH < 6) eH += 24; // If shift ends at 01:00 am, treat as 25:00
                   const eMin = eH * 60 + parseInt(eParts[1] || '0');
                   const adjCurrentMin = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                   if (adjCurrentMin >= eMin) {
                       statusText = "受付終了";
                       if (avail.next_shift_date) {
                           const d = new Date(avail.next_shift_date);
                           nextAvailableTime = \`次回出勤: \${d.getMonth() + 1}/\${d.getDate()}\`;
                       } else {
                           nextAvailableTime = "次回出勤: 未定";
                       }
                   }
               }
               
               if (statusText === "本日出勤中") {
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

    const origin1_crlf = origin1.replace(/\n/g, '\r\n');
    
    const new1 = `               const now = new Date();

               if (isAbsent) {
                   statusText = "お休み";
                   isWorkingToday = false;
               } else if (avail.shift_end) {
                   const eMin = getAdjustedMinutes(avail.shift_end, businessEndTime.hour);
                   const adjCurrentMin = getAdjustedNowMins(now, businessEndTime.hour);
                   if (adjCurrentMin >= eMin) {
                       statusText = "受付終了";
                       if (avail.next_shift_date) {
                           const d = new Date(avail.next_shift_date);
                           nextAvailableTime = \`次回出勤: \${d.getMonth() + 1}/\${d.getDate()}\`;
                       } else {
                           nextAvailableTime = "次回出勤: 未定";
                       }
                   }
               }
               
               if (statusText === "本日出勤中") {
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

    content = content.replace(origin1, new1);
    content = content.replace(origin1_crlf, new1.replace(/\n/g, '\r\n'));

    fs.writeFileSync('src/app/page.tsx', content);
    console.log('page.tsx fixed');
}

fixPageTsx();
