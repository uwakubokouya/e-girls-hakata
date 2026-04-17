const fs = require('fs');

const files = ['src/app/search/page.tsx', 'src/app/page.tsx', 'src/app/cast/[id]/page.tsx'];

files.forEach(f => {
    if(!fs.existsSync(f)) return;
    let c = fs.readFileSync(f, 'utf-8');
    
    // 1. 判定ロジックの修正
    c = c.replace(
        /if\s*\(\s*cursorM\s*>=\s*seM\s*\)\s*\{\s*\r?\n\s*statusText\s*=\s*[\"']受付終了[\"'];/g, 
        'if (cursorM >= seM) {\n                            if (am >= seM) { statusText = "受付終了"; } else { statusText = "ご予約完売"; }'
    );

    // 2. スコア算出ロジックの修正
    c = c.replace(
        /\} else if \(c\.statusText === '受付終了'\) \{\s*\r?\n\s*score \+\= ([0-9]+) \+ nextShiftScore;\s*\r?\n\s*\} else if \(c\.statusText === 'お休み'\) \{/g,
        `} else if (c.statusText === '受付終了') {\n                    score += $1 + nextShiftScore;\n                } else if (c.statusText === 'ご予約完売') {\n                    score += 250000 + nextShiftScore;\n                } else if (c.statusText === 'お休み') {`
    );

    // 3. JSX のバッジ部分の修正
    const badgeRegex = /(受付終了\s*\r?\n\s*<\/div>\s*\r?\n\s*\)\s*:\s*)(cast\.statusText === ['\"]本日出勤中['\"] \?)/g;
    c = c.replace(badgeRegex, '$1cast.statusText === "ご予約完売" ? ( <div className="bg-[#E5E5E5]/90 backdrop-blur text-black text-[9px] px-2 py-1 font-bold tracking-widest border border-black/20">ご予約完売</div> ) : $2');

    fs.writeFileSync(f, c);
});
console.log('done');
