const fs = require('fs');

const files = ['src/app/page.tsx', 'src/app/cast/[id]/page.tsx'];

files.forEach(f => {
    if(!fs.existsSync(f)) return;
    let c = fs.readFileSync(f, 'utf-8');
    
    // 1. 判定ロジックの修正
    // 緩い正規表現で "受付終了" の代入を見つけて置き換える。
    c = c.replace(
        /if\s*\(\s*cursorM\s*>=\s*seM\s*\)\s*\{\s*statusText\s*=\s*[\"']受付終了[\"'];/g, 
        'if (cursorM >= seM) {\n                            if (am >= seM) { statusText = "受付終了"; } else { statusText = "ご予約完売"; }'
    );

    // 2. JSX のバッジ部分の修正
    // app/page.tsx 用
    // ) : post.statusText === '本日出勤中' ? (
    // ) : cast.statusText === '本日出勤中' ? (
    const badgeRegex = /(受付終了\s*<\/div>\s*\)\s*:\s*)([a-zA-Z]+\.statusText === ['\"]本日出勤中['\"] \?)/g;
    c = c.replace(badgeRegex, '$1$2.split(".")[0].statusText === "ご予約完売" ? ( <div className="bg-[#E5E5E5]/90 backdrop-blur text-black text-[9px] px-2 py-1 font-bold tracking-widest border border-black/20">ご予約完売</div> ) : $2');

    // 置換結果を手動で直すため、置換前の $2 そのものを利用する
    // 上の $2.split(".")等は機能しないので、関数を渡す。
    c = c.replace(/(受付終了\s*<\/div>\s*\)\s*:\s*)([a-zA-Z]+\.statusText === ['\"]本日出勤中['\"] \?)/g, (match, p1, p2) => {
        const objName = p2.split('.')[0]; // "post" or "cast"
        return p1 + objName + '.statusText === "ご予約完売" ? ( <div className="bg-[#E5E5E5]/90 backdrop-blur text-black text-[9px] px-2 py-1 font-bold tracking-widest border border-black/20">ご予約完売</div> ) : ' + p2;
    });

    // 3. TSエラーのついで直し
    c = c.replace(/\.sort\(\(a, b\)/g, '.sort((a: any, b: any)');

    fs.writeFileSync(f, c);
});
console.log('done');
