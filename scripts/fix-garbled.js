const fs = require('fs');

function fixGarbled() {
    let content = fs.readFileSync('src/app/cast/[id]/page.tsx','utf-8');
    const lines = content.split('\n');

    const newLines = `                        if (cursorM + MIN_GAP > seM) {
                             if (am >= seM) { statusText = "受付終了"; } else { statusText = "ご予約完売"; }
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

    // 398行目から19行を新しいブロックで置換
    // 注: lines配列の添字397が 398行目
    lines.splice(397, 19, ...newLines.split('\n'));
    
    fs.writeFileSync('src/app/cast/[id]/page.tsx', lines.join('\n'));
    console.log('done');
}
fixGarbled();
