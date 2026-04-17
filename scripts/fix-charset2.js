const fs = require('fs');
let c = fs.readFileSync('src/app/cast/[id]/page.tsx','utf-8');

c = c.replace(/nextAvailableTime = `o: \$\{dt\.getMonth\(\) \+ 1\}\/\$\{dt\.getDate\(\)\}`;/g, 'nextAvailableTime = `次回出勤: ${dt.getMonth() + 1}/${dt.getDate()}`;');
c = c.replace(/nextAvailableTime = "o: ";/g, 'nextAvailableTime = "次回出勤: 未定";');
c = c.replace(/nextAvailableTime = "ҋ@";/g, 'nextAvailableTime = "待機中";');

fs.writeFileSync('src/app/cast/[id]/page.tsx', c);
