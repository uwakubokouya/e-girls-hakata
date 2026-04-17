const fs = require('fs');

let c = fs.readFileSync('src/app/admin/analytics/page.tsx', 'utf-8');

const tQ = `                    .in('page_type', activeTab === 'home' ? ['home'] : ['cast_profile', 'reserve_click'])`;
                    
const rQ = `                    .in('page_type', activeTab === 'home' ? ['home', 'reserve_click'] : ['cast_profile', 'reserve_click'])`;

let newC = c.split(tQ).join(rQ);
if(newC === c) {
    newC = c.split(tQ.replace(/\n/g, '\r\n')).join(rQ.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('src/app/admin/analytics/page.tsx', newC);
console.log('fixed home tab query to include reserve_clicks');
