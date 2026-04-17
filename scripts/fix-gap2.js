const fs = require('fs');
let c = fs.readFileSync('src/app/cast/[id]/page.tsx', 'utf-8');

// The original condition is `if (cursorM >= seM) {` followed by `statusText = ` with garbled text.
// Let's replace the if condition and the first assignment.
c = c.replace(/if \(cursorM >= seM\) \{\s*\r?\n\s*statusText = [^;]+;/g, 'if (cursorM + MIN_GAP > seM) {\n                            if (am >= seM) { statusText = "受付終了"; } else { statusText = "ご予約完売"; }');

fs.writeFileSync('src/app/cast/[id]/page.tsx', c);
console.log('done cast page');
