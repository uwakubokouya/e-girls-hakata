const fs = require('fs');
const path = './src/app/cast/[id]/page.tsx';
let txt = fs.readFileSync(path, 'utf8');

const regex = /let isBookedNow = false;[\s\S]*?nextAvailableTime = nextEnd \|\| shift_start;\s*\}/;

const replacement = `let ssP = shift_start.split(':');
                       let seP = shift_end.split(':');
                       let ssH = parseInt(ssP[0]); if(ssH < 6) ssH += 24;
                       let seH = parseInt(seP[0]); if(seH < 6) seH += 24;
                       const ssM = ssH * 60 + parseInt(ssP[1] || '0');
                       const seM = seH * 60 + parseInt(seP[1] || '0');
                       const am = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                       
                       let cursorM = Math.max(am, ssM);
                       
                       const parsedBookings = bookings.map((b) => {
                           let bsH = parseInt(b.start.split(':')[0]); if(bsH < 6) bsH += 24;
                           let beH = parseInt(b.end.split(':')[0]); if(beH < 6) beH += 24;
                           return {
                               startM: bsH * 60 + parseInt(b.start.split(':')[1] || '0'),
                               endM: beH * 60 + parseInt(b.end.split(':')[1] || '0')
                           };
                       }).sort((a, b) => a.startM - b.startM);

                       let bumped = true;
                       while (bumped) {
                           bumped = false;
                           for (const b of parsedBookings) {
                               if (cursorM >= b.startM && cursorM < b.endM) {
                                   cursorM = b.endM;
                                   bumped = true;
                               }
                           }
                       }

                       if (cursorM >= seM) {
                           statusText = "受付終了";
                           if (myAvails[0] && myAvails[0].next_shift_date) {
                               const dt = new Date(myAvails[0].next_shift_date);
                               nextAvailableTime = \`次回出勤: \${dt.getMonth() + 1}/\${dt.getDate()}\`;
                           } else {
                               nextAvailableTime = "次回出勤: 未定";
                           }
                       } else {
                           if (cursorM <= am) {
                               nextAvailableTime = "待機中";
                           } else {
                               let h = Math.floor(cursorM / 60);
                               let m = cursorM % 60;
                               if (h >= 24) h -= 24;
                               nextAvailableTime = \`\${h.toString().padStart(2, '0')}:\${m.toString().padStart(2, '0')}\`;
                           }
                       }`;

if (regex.test(txt)) {
    const newTxt = txt.replace(regex, replacement);
    fs.writeFileSync(path, newTxt.replace(/\n/g, '\r\n'), 'utf8');
    console.log('Successfully replaced');
} else {
    console.log('Target not found via regex');
}
