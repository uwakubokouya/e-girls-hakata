const fs = require('fs');
let c1 = fs.readFileSync('src/app/page.tsx', 'utf-8');
c1 = c1.replace(/endM:\s*beH\s*\*\s*60\s*\+\s*parseInt\(b\.end\.split\(':'\)\[1\]\s*\|\|\s*'0'\)(?! \+ 10)/g, 
  "endM: beH * 60 + parseInt(b.end.split(':')[1] || '0') + 10"
);
fs.writeFileSync('src/app/page.tsx', c1);

let c2 = fs.readFileSync('src/app/cast/[id]/page.tsx', 'utf-8');
c2 = c2.replace(/endM:\s*beH\s*\*\s*60\s*\+\s*parseInt\(b\.end\.split\(':'\)\[1\]\s*\|\|\s*'0'\)(?! \+ 10)/g, 
  "endM: beH * 60 + parseInt(b.end.split(':')[1] || '0') + 10"
);
fs.writeFileSync('src/app/cast/[id]/page.tsx', c2);

console.log('done');
