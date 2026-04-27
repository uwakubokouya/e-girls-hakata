const fs = require('fs');
const path = 'src/app/cast/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '<h1 className="text-2xl font-normal text-black flex items-center gap-2 uppercase tracking-widest mb-2">',
  '<h1 className="text-2xl font-normal text-black flex items-center gap-2 uppercase tracking-widest mb-3">'
);

content = content.replace(
  '<Link href={{/cast/${storeInfo.id}}} className="inline-block mt-0 mb-4">',
  '<Link href={{/cast/${storeInfo.id}}} className="inline-block mt-0 mb-3">'
);

content = content.replace(
  '            <p className="text-sm text-[#333333] whitespace-pre-wrap leading-relaxed font-light">\r\n                {cast.bio || ""}\r\n            </p>',
  '          {cast.bio && (\r\n            <p className="text-sm text-[#333333] whitespace-pre-wrap leading-relaxed font-light">\r\n                {cast.bio}\r\n            </p>\r\n          )}'
);

content = content.replace(
  '            <p className="text-sm text-[#333333] whitespace-pre-wrap leading-relaxed font-light">\n                {cast.bio || ""}\n            </p>',
  '          {cast.bio && (\n            <p className="text-sm text-[#333333] whitespace-pre-wrap leading-relaxed font-light">\n                {cast.bio}\n            </p>\n          )}'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Done');