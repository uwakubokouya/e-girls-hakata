const fs = require('fs');
const files = ['src/app/page.tsx', 'src/app/search/page.tsx', 'src/app/cast/[id]/page.tsx'];

files.forEach(f => {
    if(!fs.existsSync(f)) return;
    let c = fs.readFileSync(f, 'utf-8');
    
    // bumped roop to MIN_GAP logic + cursorM + MIN_GAP condition
    const originalLoop = /let bumped = true;\s*\r?\n\s*while \(bumped\) \{\s*\r?\n\s*bumped = false;\s*\r?\n\s*for \(const b of parsedBookings\) \{\s*\r?\n\s*if \(cursorM >= b\.startM && cursorM < b\.endM\) \{\s*\r?\n\s*cursorM = b\.endM;\s*\r?\n\s*bumped = true;\s*\r?\n\s*\}\s*\r?\n\s*\}\s*\r?\n\s*\}/g;
    
    const newLoop = `const MIN_GAP = 50;
                       let bumped = true;
                       while (bumped && cursorM < seM) {
                           bumped = false;
                           for (const b of parsedBookings) {
                               if (b.startM < (cursorM + MIN_GAP) && b.endM > cursorM) {
                                   if (cursorM < b.endM) {
                                       cursorM = b.endM;
                                       bumped = true;
                                   }
                               }
                           }
                       }`;
                       
    // Replace the loop
    c = c.replace(originalLoop, newLoop);
    
    // Replace the cursorM >= seM condition with cursorM + MIN_GAP > seM
    const originalCondition1 = /if \(cursorM >= seM\) \{\s*\r?\n\s*statusText = "tI";/g;
    const originalCondition2 = /if \(cursorM >= seM\) \{\s*\r?\n\s*if \(am >= seM\)/g;
    
    c = c.replace(originalCondition1, 'if (cursorM + MIN_GAP > seM) {\n                           statusText = "tI";');
    c = c.replace(originalCondition2, 'if (cursorM + MIN_GAP > seM) {\n                            if (am >= seM)');
    
    fs.writeFileSync(f, c);
});
console.log('done');
