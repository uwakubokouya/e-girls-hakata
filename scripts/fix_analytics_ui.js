const fs = require('fs');

let content = fs.readFileSync('src/app/admin/analytics/page.tsx', 'utf8');

// 1. Change tab name "店舗別" to {user?.role === 'store' ? 'アクセス' : '店舗別'}
const tabTarget = `                    <button 
                        onClick={() => setActiveTab('home')}
                        className={\`flex-1 py-3 text-xs tracking-widest uppercase transition-colors \${activeTab === 'home' ? 'bg-black text-white font-medium' : 'bg-white text-black hover:bg-[#F9F9F9]'}\`}
                    >
                        店舗別
                    </button>`;
const tabReplace = `                    <button 
                        onClick={() => setActiveTab('home')}
                        className={\`flex-1 py-3 text-xs tracking-widest uppercase transition-colors \${activeTab === 'home' ? 'bg-black text-white font-medium' : 'bg-white text-black hover:bg-[#F9F9F9]'}\`}
                    >
                        {user?.role === 'store' ? 'アクセス' : '店舗別'}
                    </button>`;

if (content.includes(tabTarget)) {
    content = content.replace(tabTarget, tabReplace);
    console.log("Updated tab name.");
} else {
    // maybe spacing is different
    const fallbackTabTarget = '>\\s*店舗別\\s*</button>';
    if (new RegExp(fallbackTabTarget).test(content)) {
        content = content.replace(/>\s*店舗別\s*<\/button>/, ">\n                        {user?.role === 'store' ? 'アクセス' : '店舗別'}\n                    </button>");
        console.log("Updated tab name (fallback).");
    } else {
        console.log("Could not find tab name target.");
    }
}

// 2. Hide Target Area Dropdown for stores
const dropdownTarget = `{(activeTab === 'cast' || activeTab === 'home') && (
                        <div className="pt-4 border-t border-[#E5E5E5]">
                            <label className="text-[10px] uppercase tracking-widest text-[#777777] mb-2 block">対象エリア</label>`;
const dropdownReplace = `{user?.role !== 'store' && (activeTab === 'cast' || activeTab === 'home') && (
                        <div className="pt-4 border-t border-[#E5E5E5]">
                            <label className="text-[10px] uppercase tracking-widest text-[#777777] mb-2 block">対象エリア</label>`;
if (content.includes(dropdownTarget)) {
    content = content.replace(dropdownTarget, dropdownReplace);
    console.log("Updated dropdown visibility.");
} else {
    console.log("Could not find dropdown target.");
}

// 3. Hide Store Ranking for stores
const rankingTarget = `{activeTab === 'home' && (
                            <div className="bg-white border border-[#E5E5E5]">
                                <div className="p-4 border-b border-[#E5E5E5] bg-[#F9F9F9] flex items-center justify-between">
                                    <h3 className="text-xs font-bold tracking-widest flex items-center gap-2">
                                        <BarChart2 size={14} className="stroke-[2]" />
                                        店舗別 {rankingTab === 'pv' ? 'PV' : '予約数'}ランキング`;
const rankingReplace = `{user?.role !== 'store' && activeTab === 'home' && (
                            <div className="bg-white border border-[#E5E5E5]">
                                <div className="p-4 border-b border-[#E5E5E5] bg-[#F9F9F9] flex items-center justify-between">
                                    <h3 className="text-xs font-bold tracking-widest flex items-center gap-2">
                                        <BarChart2 size={14} className="stroke-[2]" />
                                        店舗別 {rankingTab === 'pv' ? 'PV' : '予約数'}ランキング`;
if (content.includes(rankingTarget)) {
    content = content.replace(rankingTarget, rankingReplace);
    console.log("Updated ranking visibility.");
} else {
    console.log("Could not find ranking target.");
}

fs.writeFileSync('src/app/admin/analytics/page.tsx', content, 'utf8');
console.log('Done modifying analytics page');
