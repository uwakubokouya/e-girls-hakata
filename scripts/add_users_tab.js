const fs = require('fs');

let c = fs.readFileSync('src/app/admin/analytics/page.tsx', 'utf-8');

// 1. Add activeTab 'users'
c = c.replace(
    `const [activeTab, setActiveTab] = useState<'home' | 'cast'>('home');`,
    `const [activeTab, setActiveTab] = useState<'home' | 'cast' | 'users'>('home');`
);

// 2. Add usersData & totalUsers state
c = c.replace(
    `const [selectedCastId, setSelectedCastId] = useState<string | 'all'>('all');`,
    `const [selectedCastId, setSelectedCastId] = useState<string | 'all'>('all');\n    const [usersData, setUsersData] = useState<any[]>([]);\n    const [totalUsers, setTotalUsers] = useState<number>(0);`
);

// 3. Add total users fetcher
const fetcherHook = `    // Fetch analytics data
    useEffect(() => {`;
const newFetcherHook = `    // Fetch total users
    useEffect(() => {
        if (!user?.is_admin) return;
        if (activeTab !== 'users') return;
        const fetchTotalUsers = async () => {
            const { count } = await supabase
                .from('sns_profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'customer');
            if (count !== null) setTotalUsers(count);
        };
        fetchTotalUsers();
    }, [activeTab, user]);

    // Fetch analytics data
    useEffect(() => {`;
c = c.split(fetcherHook).join(newFetcherHook);
if (!c.includes('fetchTotalUsers')) {
    c = c.split(fetcherHook.replace(/\n/g, '\r\n')).join(newFetcherHook.replace(/\n/g, '\r\n'));
}

// 4. Update fetchData internally
const fetchDataInner = `                setPageViews(data || []);
            } catch (e) {`;
const newFetchDataInner = `                setPageViews(data || []);

                if (activeTab === 'users') {
                    const { data: usersInfo, error: uError } = await supabase
                        .from('sns_profiles')
                        .select('created_at, role')
                        .eq('role', 'customer')
                        .gte('created_at', startDate.toISOString())
                        .lte('created_at', endDate.toISOString());
                        
                    if (uError) throw uError;
                    setUsersData(usersInfo || []);
                }
            } catch (e) {`;
c = c.split(fetchDataInner).join(newFetchDataInner);
if (!c.includes('activeTab === \'users\'')) {
    c = c.split(fetchDataInner.replace(/\n/g, '\r\n')).join(newFetchDataInner.replace(/\n/g, '\r\n'));
}

// 5. Add dailyUserCounts calculation
const calcData = `    const totalReserves = dailyReserveCounts.reduce((sum, count) => sum + count, 0);`;
const newCalcData = `    const totalReserves = dailyReserveCounts.reduce((sum, count) => sum + count, 0);

    const dailyUserCounts = new Array(daysInMonth).fill(0);
    usersData.forEach(u => {
        const d = new Date(u.created_at);
        const dayIdx = d.getDate() - 1;
        if (dayIdx >= 0 && dayIdx < daysInMonth) {
            dailyUserCounts[dayIdx]++;
        }
    });
    const monthTotalUsers = dailyUserCounts.reduce((sum, count) => sum + count, 0);`;
c = c.split(calcData).join(newCalcData);
if (!c.includes('dailyUserCounts')) {
    c = c.split(calcData.replace(/\n/g, '\r\n')).join(newCalcData.replace(/\n/g, '\r\n'));
}

// 6. Update Tabs UI
const tabsUI = `                {/* Tabs */}
                <div className="flex border border-black mb-6">
                    <button 
                        onClick={() => setActiveTab('home')}
                        className={\`flex-1 py-3 text-xs tracking-widest uppercase transition-colors \${activeTab === 'home' ? 'bg-black text-white font-medium' : 'bg-white text-black hover:bg-[#F9F9F9]'}\`}
                    >
                        店舗アクセス
                    </button>
                    <button 
                        onClick={() => setActiveTab('cast')}
                        className={\`flex-1 py-3 text-xs tracking-widest uppercase transition-colors \${activeTab === 'cast' ? 'bg-black text-white font-medium' : 'bg-white text-black hover:bg-[#F9F9F9]'}\`}
                    >
                        キャスト別
                    </button>
                </div>`;
const newTabsUI = `                {/* Tabs */}
                <div className="flex border border-black mb-6">
                    <button 
                        onClick={() => setActiveTab('home')}
                        className={\`flex-1 py-3 text-xs tracking-widest uppercase transition-colors \${activeTab === 'home' ? 'bg-black text-white font-medium' : 'bg-white text-black hover:bg-[#F9F9F9]'}\`}
                    >
                        店舗アクセス
                    </button>
                    <button 
                        onClick={() => setActiveTab('cast')}
                        className={\`flex-1 py-3 border-l border-black text-xs tracking-widest uppercase transition-colors \${activeTab === 'cast' ? 'bg-black text-white font-medium' : 'bg-white text-black hover:bg-[#F9F9F9]'}\`}
                    >
                        キャスト別
                    </button>
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={\`flex-1 py-3 border-l border-black text-xs tracking-widest uppercase transition-colors \${activeTab === 'users' ? 'bg-black text-white font-medium' : 'bg-white text-black hover:bg-[#F9F9F9]'}\`}
                    >
                        会員推移
                    </button>
                </div>`;
c = c.split(tabsUI).join(newTabsUI);
if (!c.includes('会員推移')) {
    c = c.split(tabsUI.replace(/\n/g, '\r\n')).join(newTabsUI.replace(/\n/g, '\r\n'));
}

// 7. Render Users List
const renderViewsState = `                    <div className="space-y-6">
                        {/* Summary Card */}`;

const newRenderViewsState = `                    <div className="space-y-6">
                        {activeTab === 'users' ? (
                            <div className="space-y-6">
                                <div className="bg-black text-white p-6 flex flex-col items-center justify-center text-center">
                                    <p className="text-[10px] tracking-widest uppercase text-[#AAAAAA] mb-2">総会員数（累計）</p>
                                    <div className="flex items-end gap-2 mb-4">
                                        <span className="text-4xl font-light tracking-wider">{totalUsers.toLocaleString()}</span>
                                        <span className="text-xs mb-1 tracking-widest text-[#CCCCCC]">人</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[#AAAAAA] text-[10px] tracking-widest border-t border-white/20 pt-4 w-full justify-center">
                                        当月新規登録: <span className="text-white font-bold text-xs">{monthTotalUsers.toLocaleString()}</span> 人
                                    </div>
                                </div>
                                <div className="bg-white border border-[#E5E5E5]">
                                    <div className="p-4 border-b border-[#E5E5E5] bg-[#F9F9F9]">
                                        <h3 className="text-xs font-bold tracking-widest flex items-center gap-2">
                                            <BarChart2 size={14} className="stroke-[2]" />
                                            日別 新規会員登録数
                                        </h3>
                                    </div>
                                    <div>
                                        {dailyUserCounts.map((count, i) => {
                                            const isToday = new Date().getDate() === (i + 1) && new Date().getMonth() === selectedDate.getMonth();
                                            return (
                                                <div key={i} className={\`flex items-center justify-between p-4 border-b border-[#E5E5E5] last:border-b-0 \${isToday ? 'bg-[#F9F9F9]' : ''}\`}>
                                                    <span className={\`text-sm tracking-widest \${isToday ? 'font-bold' : ''}\`}>
                                                        {i + 1}日
                                                    </span>
                                                    <div className="flex items-end gap-1 w-16 justify-end">
                                                        <span className={\`text-base tracking-wider \${isToday ? 'font-bold' : ''}\`}>
                                                            {count.toLocaleString()}
                                                        </span>
                                                        <span className="text-[10px] text-[#777777] mb-[2px]">人</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                        {/* Summary Card */}`;

const endOfPVRenders = `                            </div>
                        )}
                    </div>
                )}`;
const newEndOfPVRenders = `                            </div>
                        )}
                            </>
                        )}
                    </div>
                )}`;

c = c.split(renderViewsState).join(newRenderViewsState);
if (!c.includes('総会員数')) {
    c = c.split(renderViewsState.replace(/\n/g, '\r\n')).join(newRenderViewsState.replace(/\n/g, '\r\n'));
}

c = c.split(endOfPVRenders).join(newEndOfPVRenders);
if (!c.includes('</>\n                        )}')) {
    c = c.split(endOfPVRenders.replace(/\n/g, '\r\n')).join(newEndOfPVRenders.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('src/app/admin/analytics/page.tsx', c);
console.log('Added Users tab successfully');
