"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/providers/UserProvider";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ChevronLeft, ChevronRight, BarChart2, X } from "lucide-react";

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
];

export default function AnalyticsAdminPage() {
    const { user, isLoading } = useUser();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'home' | 'cast' | 'users'>('home');
    const [rankingTab, setRankingTab] = useState<'pv' | 'reserve'>('pv');
    const [selectedDate, setSelectedDate] = useState(new Date());
    
    const [pageViews, setPageViews] = useState<any[]>([]);
    const [casts, setCasts] = useState<any[]>([]);
    const [selectedArea, setSelectedArea] = useState<string | 'all'>('all');
    const [castAreaMap, setCastAreaMap] = useState<Map<string, string>>(new Map());
    const [stores, setStores] = useState<any[]>([]);
    const [castStoreMap, setCastStoreMap] = useState<Map<string, string>>(new Map());
    const [usersData, setUsersData] = useState<any[]>([]);
    const [totalUsers, setTotalUsers] = useState<number>(0);
    
    const [isFetching, setIsFetching] = useState(false);
    const [selectedCastForModal, setSelectedCastForModal] = useState<{id: string, name: string} | null>(null);

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.replace('/login');
            } else if (!user.is_admin && user.role !== 'store') {
                alert("アクセス権限がありません。");
                router.replace('/mypage');
            }
        }
    }, [user, isLoading, router]);

    // Fetch user context and target casts
    const [storeCastIds, setStoreCastIds] = useState<string[]>([]);
    
    useEffect(() => {
        if (!user || (!user.is_admin && user.role !== 'store')) return;

        const initContext = async () => {
            if (user.role === 'store') {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('store_id, id')
                    .eq('username', user.phone)
                    .maybeSingle();

                if (profileData && profileData.store_id) {
                    const { data: castsData } = await supabase
                        .from('casts')
                        .select('id, name, login_id')
                        .eq('store_id', profileData.store_id);
                    
                    const loginIds = castsData?.map(c => c.login_id).filter(Boolean) || [];

                    let query = supabase.from('sns_profiles').select('id, name, phone').in('role', ['cast', 'store']);
                    let orFilters = [`id.eq.${user.id}`];
                    if (loginIds.length > 0) {
                        orFilters.push(`phone.in.(${loginIds.join(',')})`);
                    }
                    query = query.or(orFilters.join(','));
                    
                    const { data: snsCasts } = await query;
                    const combinedCasts = [...(snsCasts || [])];
                    const snsIds = new Set(combinedCasts.map(c => c.id));
                    
                    if (castsData) {
                        castsData.forEach(cti => {
                            if (!snsIds.has(cti.id)) {
                                combinedCasts.push({
                                    id: cti.id,
                                    name: cti.name,
                                    phone: cti.login_id || ''
                                });
                            }
                        });
                    }

                    setCasts(combinedCasts);
                    setStoreCastIds(combinedCasts.map(c => c.id));
                }
            } else {
                const { data } = await supabase.from('sns_profiles').select('id, name, phone').eq('role', 'cast');
                if (data) {
                    const combinedCasts = [...data];
                    
                    // キャストの都道府県を解決するためのマップを作成
                    const { data: allProfiles } = await supabase.from('profiles').select('store_id, prefecture, username').not('prefecture', 'is', null);
                    const storePrefMap = new Map();
                    if (allProfiles) {
                        setStores(allProfiles);
                        allProfiles.forEach(p => {
                            if (p.prefecture) {
                                storePrefMap.set(p.store_id, p.prefecture);
                            }
                        });
                    }
                    
                    const { data: allCasts } = await supabase.from('casts').select('id, name, login_id, store_id');
                    const areaMap = new Map();
                    const storeMap = new Map();
                    if (allCasts) {
                        const snsIds = new Set(data.map(c => c.id));
                        allCasts.forEach(cti => {
                            if (!snsIds.has(cti.id)) {
                                combinedCasts.push({
                                    id: cti.id,
                                    name: cti.name,
                                    phone: cti.login_id || ''
                                });
                            }
                        });

                        data.forEach(snsCast => {
                            const ctiCast = allCasts.find(c => c.login_id === snsCast.phone);
                            if (ctiCast && ctiCast.store_id) {
                                storeMap.set(snsCast.id, ctiCast.store_id);
                                const pref = storePrefMap.get(ctiCast.store_id);
                                if (pref) {
                                    const matchedPref = PREFECTURES.find(p => pref.startsWith(p)) || pref;
                                    areaMap.set(snsCast.id, matchedPref);
                                }
                            }
                        });

                        allCasts.forEach(cti => {
                            if (!snsIds.has(cti.id) && cti.store_id) {
                                storeMap.set(cti.id, cti.store_id);
                                const pref = storePrefMap.get(cti.store_id);
                                if (pref) {
                                    const matchedPref = PREFECTURES.find(p => pref.startsWith(p)) || pref;
                                    areaMap.set(cti.id, matchedPref);
                                }
                            }
                        });
                    }
                    setCasts(combinedCasts);
                    setCastAreaMap(areaMap);
                    setCastStoreMap(storeMap);
                }
            }
        };
        initContext();
    }, [user]);

    // Fetch total users
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
    useEffect(() => {
        if (!user || (!user.is_admin && user.role !== 'store')) return;

        const fetchData = async () => {
            setIsFetching(true);
            try {
                const year = selectedDate.getFullYear();
                const month = selectedDate.getMonth();
                
                // Using UTC boundaries locally
                const startDate = new Date(year, month, 1, 0, 0, 0);
                const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
                
                let query = supabase
                    .from('page_views')
                    .select('created_at, target_id, page_type')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString());

                if (user?.role === 'store') {
                    if (storeCastIds.length > 0) {
                        query = query.in('target_id', storeCastIds);
                    } else {
                        query = query.eq('target_id', '00000000-0000-0000-0000-000000000000');
                    }
                    query = query.in('page_type', ['cast_profile', 'reserve_click']);
                } else {
                    query = query.in('page_type', ['cast_profile', 'reserve_click']);
                }

                const { data, error } = await query;
                if (error) throw error;
                
                setPageViews(data || []);

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
            } catch (e) {
                console.error("Fetch analytics error:", JSON.stringify(e, null, 2), e);
            } finally {
                setIsFetching(false);
            }
        };
        fetchData();
    }, [selectedDate, activeTab, user, storeCastIds]);

    if (isLoading || (!user?.is_admin && user?.role !== 'store')) {
        return <div className="min-h-screen bg-white" />;
    }

    const prevMonth = () => {
        setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
    };

    // Calculate aggregated data
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const dailyCounts = new Array(daysInMonth).fill(0);
    const dailyReserveCounts = new Array(daysInMonth).fill(0);
    
    let filteredViews = pageViews;
    if ((activeTab === 'cast' || activeTab === 'home') && selectedArea !== 'all') {
        filteredViews = pageViews.filter(v => castAreaMap.get(v.target_id) === selectedArea);
    }
    
    filteredViews.forEach(v => {
        const d = new Date(v.created_at);
        const dayIdx = d.getDate() - 1; 
        if (dayIdx >= 0 && dayIdx < daysInMonth) {
            if (v.page_type === 'reserve_click') {
                dailyReserveCounts[dayIdx]++;
            } else {
                dailyCounts[dayIdx]++;
            }
        }
    });

    const totalViews = dailyCounts.reduce((sum, count) => sum + count, 0);
    const totalReserves = dailyReserveCounts.reduce((sum, count) => sum + count, 0);

    const modalDailyCounts = new Array(daysInMonth).fill(0);
    const modalDailyReserves = new Array(daysInMonth).fill(0);
    if (selectedCastForModal) {
        pageViews.filter(v => v.target_id === selectedCastForModal.id).forEach(v => {
            const d = new Date(v.created_at);
            const dayIdx = d.getDate() - 1;
            if (dayIdx >= 0 && dayIdx < daysInMonth) {
                if (v.page_type === 'reserve_click') {
                    modalDailyReserves[dayIdx]++;
                } else {
                    modalDailyCounts[dayIdx]++;
                }
            }
        });
    }

    const dailyUserCounts = new Array(daysInMonth).fill(0);
    usersData.forEach(u => {
        const d = new Date(u.created_at);
        const dayIdx = d.getDate() - 1;
        if (dayIdx >= 0 && dayIdx < daysInMonth) {
            dailyUserCounts[dayIdx]++;
        }
    });
    const monthTotalUsers = dailyUserCounts.reduce((sum, count) => sum + count, 0);

    // If 'all' casts is selected, we can also show a ranking
    const castRanking = new Map<string, {pv: number, reserve: number}>();
    const storeRanking = new Map<string, {pv: number, reserve: number}>();
    
    if (activeTab === 'cast' || activeTab === 'home') {
        filteredViews.forEach(v => {
            if (v.target_id) {
                if (activeTab === 'cast') {
                    const current = castRanking.get(v.target_id) || {pv: 0, reserve: 0};
                    if (v.page_type === 'reserve_click') {
                        current.reserve++;
                    } else {
                        current.pv++;
                    }
                    castRanking.set(v.target_id, current);
                } else if (activeTab === 'home') {
                    const storeId = castStoreMap.get(v.target_id);
                    if (storeId) {
                        const current = storeRanking.get(storeId) || {pv: 0, reserve: 0};
                        if (v.page_type === 'reserve_click') {
                            current.reserve++;
                        } else {
                            current.pv++;
                        }
                        storeRanking.set(storeId, current);
                    }
                }
            }
        });
    }

    const rankedCasts = Array.from(castRanking.entries())
        .map(([id, counts]) => {
            const cast = casts.find(c => c.id === id);
            return { name: cast ? cast.name : null, count: counts.pv, reserve: counts.reserve, id };
        })
        .filter(c => c.name !== null && (rankingTab === 'pv' ? c.count > 0 : c.reserve > 0))
        .sort((a, b) => rankingTab === 'pv' ? b.count - a.count : b.reserve - a.reserve)
        .slice(0, 20);

    const rankedStores = Array.from(storeRanking.entries())
        .map(([id, counts]) => {
            const store = stores.find(s => s.store_id === id);
            return { name: store ? store.username : null, count: counts.pv, reserve: counts.reserve, id };
        })
        .filter(s => s.name !== null && (rankingTab === 'pv' ? s.count > 0 : s.reserve > 0))
        .sort((a, b) => rankingTab === 'pv' ? b.count - a.count : b.reserve - a.reserve)
        .slice(0, 20);

    return (
        <div className="min-h-screen bg-[#F9F9F9] flex flex-col font-light pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white border-b border-[#E5E5E5] flex items-center px-4 py-4">
                <button onClick={() => router.push('/mypage')} className="text-black hover:text-[#777777] p-2 -ml-2 transition-colors">
                    <ChevronLeft size={24} className="stroke-[1.5]" />
                </button>
                <h1 className="text-sm font-bold tracking-widest absolute left-1/2 -translate-x-1/2">アクセス解析</h1>
            </header>

            <main className="p-6">
                {/* Tabs */}
                <div className="flex border border-black mb-6">
                    <button 
                        onClick={() => setActiveTab('home')}
                        className={`flex-1 py-3 text-xs tracking-widest uppercase transition-colors ${activeTab === 'home' ? 'bg-black text-white font-medium' : 'bg-white text-black hover:bg-[#F9F9F9]'}`}
                    >
                        {user?.role === 'store' ? 'アクセス' : '店舗別'}
                    </button>
                    <button 
                        onClick={() => setActiveTab('cast')}
                        className={`flex-1 py-3 border-l border-black text-xs tracking-widest uppercase transition-colors ${activeTab === 'cast' ? 'bg-black text-white font-medium' : 'bg-white text-black hover:bg-[#F9F9F9]'}`}
                    >
                        キャスト別
                    </button>
                    {user?.role !== 'store' && (
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`flex-1 py-3 border-l border-black text-xs tracking-widest uppercase transition-colors ${activeTab === 'users' ? 'bg-black text-white font-medium' : 'bg-white text-black hover:bg-[#F9F9F9]'}`}
                    >
                        会員推移
                    </button>
                    )}
                </div>

                {/* Filter / Month Selector */}
                <div className="bg-white border border-[#E5E5E5] p-4 mb-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <button onClick={prevMonth} className="p-2 border border-[#E5E5E5] hover:bg-[#F9F9F9] transition-colors">
                            <ChevronLeft size={16} className="text-[#777777]" />
                        </button>
                        <h2 className="text-sm font-bold tracking-widest">
                            {selectedDate.getFullYear()}年 {selectedDate.getMonth() + 1}月
                        </h2>
                        <button 
                            onClick={nextMonth} 
                            disabled={selectedDate.getMonth() === new Date().getMonth() && selectedDate.getFullYear() === new Date().getFullYear()}
                            className="p-2 border border-[#E5E5E5] hover:bg-[#F9F9F9] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={16} className="text-[#777777]" />
                        </button>
                    </div>

                    {user?.role !== 'store' && (activeTab === 'cast' || activeTab === 'home') && (
                        <div className="pt-4 border-t border-[#E5E5E5]">
                            <label className="text-[10px] uppercase tracking-widest text-[#777777] mb-2 block">対象エリア</label>
                            <div className="relative">
                                <select 
                                    value={selectedArea}
                                    onChange={e => setSelectedArea(e.target.value)}
                                    className="w-full border border-[#E5E5E5] p-3 text-sm outline-none focus:border-black transition-colors bg-white appearance-none cursor-pointer"
                                >
                                    <option value="all">全国エリア（総合ランキング）</option>
                                    {PREFECTURES.map(pref => (
                                        <option key={pref} value={pref}>{pref}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#777777]">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Loading State */}
                {isFetching ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-8 h-8 border border-black border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
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
                                                <div key={i} className={`flex items-center justify-between text-[10px] uppercase px-2 py-1.5 border-b border-[#E5E5E5] last:border-b-0 ${isToday ? 'bg-white' : 'bg-[#F9F9F9]'}`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[#777777] font-bold">{i + 1}日 {isToday && <span className="bg-black text-white px-1 ml-1 text-[8px] rounded-none">TODAY</span>}</span>
                                                    </div>
                                                    <div className="font-bold text-black flex items-center gap-2">
                                                        <span className="w-12 text-right">{count.toLocaleString()}</span>
                                                        <span className="w-8 text-right text-[#777777]">人</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                        {/* Summary Card */}
                        <div className="bg-black text-white p-6 flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] tracking-widest uppercase text-[#AAAAAA] mb-2">
                                {(activeTab === 'cast' || activeTab === 'home') ? (selectedArea === 'all' ? '全体合計 PV' : 'エリア合計 PV') : '月間合計 PV'}
                            </p>
                            <div className="flex items-end gap-2 mb-4">
                                <span className="text-4xl font-light tracking-wider">{totalViews.toLocaleString()}</span>
                                <span className="text-xs mb-1 tracking-widest text-[#CCCCCC]">PV</span>
                            </div>
                            <div className="flex items-center gap-2 text-[#AAAAAA] text-[10px] tracking-widest border-t border-white/20 pt-4 w-full justify-center">
                                予約クリック合計: <span className="text-white font-bold text-xs">{totalReserves.toLocaleString()}</span> 回
                            </div>
                        </div>

                        {/* Cast Ranking - show only if Cast tab */}
                        {activeTab === 'cast' && (
                            <div className="bg-white border border-[#E5E5E5]">
                                <div className="p-4 border-b border-[#E5E5E5] bg-[#F9F9F9] flex items-center justify-between">
                                    <h3 className="text-xs font-bold tracking-widest flex items-center gap-2">
                                        <BarChart2 size={14} className="stroke-[2]" />
                                        キャスト別 {rankingTab === 'pv' ? 'PV' : '予約数'}ランキング
                                    </h3>
                                    <div className="flex border border-black text-[10px] shrink-0">
                                        <button onClick={() => setRankingTab('pv')} className={`px-3 py-1 ${rankingTab === 'pv' ? 'bg-black text-white' : 'bg-white text-black'}`}>PV</button>
                                        <button onClick={() => setRankingTab('reserve')} className={`px-3 py-1 border-l border-black ${rankingTab === 'reserve' ? 'bg-black text-white' : 'bg-white text-black'}`}>予約数</button>
                                    </div>
                                </div>
                                <div>
                                    {rankedCasts.length > 0 ? (
                                        rankedCasts.map((c, idx) => (
                                            <div 
                                                key={c.id} 
                                                onClick={() => setSelectedCastForModal({ id: c.id, name: c.name || 'Unknown' })}
                                                className="flex items-center justify-between text-[10px] uppercase bg-[#F9F9F9] px-2 py-1.5 border-b border-[#E5E5E5] last:border-b-0 hover:bg-white transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-3.5 h-3.5 rounded-none shrink-0 flex items-center justify-center text-[8px] font-bold ${idx < 3 ? 'bg-black text-white' : 'bg-[#E5E5E5] text-[#777777]'}`}>{idx + 1}</span>
                                                    <span className="text-[#777777] font-bold truncate max-w-[120px]">{c.name}</span>
                                                </div>
                                                <div className="font-bold text-black flex items-center justify-end gap-2 w-24 shrink-0">
                                                    {rankingTab === 'pv' ? (
                                                        <span className="text-right">{c.count.toLocaleString()} <span className="text-[8px] font-normal text-[#777777]">PV</span></span>
                                                    ) : (
                                                        <span className="text-right">{c.reserve.toLocaleString()} <span className="text-[8px] font-normal text-[#777777]">予約</span></span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-xs text-[#777777] tracking-widest">データがありません</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Store Ranking - show only if Home tab */}
                        {user?.role !== 'store' && activeTab === 'home' && (
                            <div className="bg-white border border-[#E5E5E5]">
                                <div className="p-4 border-b border-[#E5E5E5] bg-[#F9F9F9] flex items-center justify-between">
                                    <h3 className="text-xs font-bold tracking-widest flex items-center gap-2">
                                        <BarChart2 size={14} className="stroke-[2]" />
                                        店舗別 {rankingTab === 'pv' ? 'PV' : '予約数'}ランキング
                                    </h3>
                                    <div className="flex border border-black text-[10px] shrink-0">
                                        <button onClick={() => setRankingTab('pv')} className={`px-3 py-1 ${rankingTab === 'pv' ? 'bg-black text-white' : 'bg-white text-black'}`}>PV</button>
                                        <button onClick={() => setRankingTab('reserve')} className={`px-3 py-1 border-l border-black ${rankingTab === 'reserve' ? 'bg-black text-white' : 'bg-white text-black'}`}>予約数</button>
                                    </div>
                                </div>
                                <div>
                                    {rankedStores.length > 0 ? (
                                        rankedStores.map((s, idx) => (
                                            <div 
                                                key={s.id} 
                                                className="flex items-center justify-between text-[10px] uppercase bg-[#F9F9F9] px-2 py-1.5 border-b border-[#E5E5E5] last:border-b-0 hover:bg-white transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-3.5 h-3.5 rounded-none shrink-0 flex items-center justify-center text-[8px] font-bold ${idx < 3 ? 'bg-black text-white' : 'bg-[#E5E5E5] text-[#777777]'}`}>{idx + 1}</span>
                                                    <span className="text-[#777777] font-bold truncate max-w-[120px]">{s.name}</span>
                                                </div>
                                                <div className="font-bold text-black flex items-center justify-end gap-2 w-24 shrink-0">
                                                    {rankingTab === 'pv' ? (
                                                        <span className="text-right">{s.count.toLocaleString()} <span className="text-[8px] font-normal text-[#777777]">PV</span></span>
                                                    ) : (
                                                        <span className="text-right">{s.reserve.toLocaleString()} <span className="text-[8px] font-normal text-[#777777]">予約</span></span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-xs text-[#777777] tracking-widest">データがありません</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Daily List - Show for home tab only */}
                        {activeTab === 'home' && (
                            <div className="bg-white border border-[#E5E5E5]">
                                <div className="p-4 border-b border-[#E5E5E5] bg-[#F9F9F9]">
                                    <h3 className="text-xs font-bold tracking-widest flex items-center gap-2">
                                        <BarChart2 size={14} className="stroke-[2]" />
                                        日別アクセス数
                                    </h3>
                                </div>
                                <div>
                                    {dailyCounts.map((count, i) => {
                                        const isToday = new Date().getDate() === (i + 1) && new Date().getMonth() === selectedDate.getMonth();
                                        return (
                                        <div key={i} className={`flex items-center justify-between text-[10px] uppercase px-2 py-1.5 border-b border-[#E5E5E5] last:border-b-0 ${isToday ? 'bg-white' : 'bg-[#F9F9F9]'}`}>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[#777777] font-bold">{i + 1}日 {isToday && <span className="bg-black text-white px-1 ml-1 text-[8px] rounded-none">TODAY</span>}</span>
                                            </div>
                                            <div className="font-bold text-black flex items-center gap-2">
                                                <span className="w-14 text-right">{count.toLocaleString()} <span className="text-[8px] font-normal text-[#777777] ml-0.5">PV</span></span>
                                                <span className="w-18 text-right text-[#777777] border-l border-[#E5E5E5] pl-2">予約: {dailyReserveCounts[i].toLocaleString()}</span>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        )}
                            </>
                        )}
                    </div>
                )}
            
            {/* Selected Cast Modal */}
            {selectedCastForModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm border border-black shadow-2xl relative max-h-[80vh] flex flex-col">
                        <button onClick={() => setSelectedCastForModal(null)} className="absolute top-4 right-4 p-2 bg-[#F9F9F9] text-[#777] hover:text-black transition-colors z-10">
                            <X size={18} />
                        </button>
                        <div className="p-6 pb-4 border-b border-[#E5E5E5] shrink-0">
                            <h2 className="text-sm font-bold tracking-widest text-center truncate pr-8">{selectedCastForModal.name}</h2>
                            <p className="text-[10px] text-center text-[#777777] mt-1 tracking-widest uppercase">{selectedDate.getFullYear()}年 {selectedDate.getMonth() + 1}月 日別アクセス</p>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {modalDailyCounts.map((count, i) => {
                                const isToday = new Date().getDate() === (i + 1) && new Date().getMonth() === selectedDate.getMonth();
                                return (
                                <div key={i} className={`flex items-center justify-between text-[10px] uppercase px-4 py-2 border-b border-[#E5E5E5] last:border-b-0 ${isToday ? 'bg-white' : 'bg-[#F9F9F9]'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[#777777] font-bold">{i + 1}日 {isToday && <span className="bg-black text-white px-1 ml-1 text-[8px] rounded-none">TODAY</span>}</span>
                                    </div>
                                    <div className="font-bold text-black flex items-center gap-2">
                                        <span className="w-14 text-right">{count.toLocaleString()} <span className="text-[8px] font-normal text-[#777777] ml-0.5">PV</span></span>
                                        <span className="w-18 text-right text-[#777777] border-l border-[#E5E5E5] pl-2">予約: {modalDailyReserves[i].toLocaleString()}</span>
                                    </div>
                                </div>
                            )})}
                            {/* Total Row */}
                            <div className="flex items-center justify-between text-[10px] uppercase px-4 py-3 bg-black text-white">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold tracking-widest text-white">合計</span>
                                </div>
                                <div className="font-bold flex items-center gap-2">
                                    <span className="w-14 text-right">{modalDailyCounts.reduce((a, b) => a + b, 0).toLocaleString()} <span className="text-[8px] font-normal text-[#AAAAAA] ml-0.5">PV</span></span>
                                    <span className="w-18 text-right text-[#AAAAAA] border-l border-[#555555] pl-2">予約: {modalDailyReserves.reduce((a, b) => a + b, 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-[#F9F9F9] p-4 border-t border-[#E5E5E5] shrink-0">
                            <button onClick={() => setSelectedCastForModal(null)} className="w-full bg-black text-white py-3 text-[11px] font-bold tracking-widest hover:bg-[#333] transition-colors uppercase">
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </main>
        </div>
    );
}
