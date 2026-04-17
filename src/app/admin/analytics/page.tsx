"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/providers/UserProvider";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";

export default function AnalyticsAdminPage() {
    const { user, isLoading } = useUser();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'home' | 'cast'>('home');
    const [selectedDate, setSelectedDate] = useState(new Date());
    
    const [pageViews, setPageViews] = useState<any[]>([]);
    const [casts, setCasts] = useState<any[]>([]);
    const [selectedCastId, setSelectedCastId] = useState<string | 'all'>('all');
    
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.replace('/login');
            } else if (!user.is_admin) {
                alert("アクセス権限がありません。");
                router.replace('/mypage');
            }
        }
    }, [user, isLoading, router]);

    // Fetch casts for dropdown
    useEffect(() => {
        const fetchCasts = async () => {
            const { data } = await supabase.from('sns_profiles').select('id, name');
            if (data) {
                setCasts(data);
                // Also get actual casts table to merge real cast status if needed, but sns_profiles is enough for name mapping
            }
        };
        fetchCasts();
    }, []);

    // Fetch analytics data
    useEffect(() => {
        if (!user?.is_admin) return;

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
                    .select('created_at, target_id')
                    .eq('page_type', activeTab === 'home' ? 'home' : 'cast_profile')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString());

                const { data, error } = await query;
                if (error) throw error;
                
                setPageViews(data || []);
            } catch (e) {
                console.error("Fetch analytics error:", e);
            } finally {
                setIsFetching(false);
            }
        };
        fetchData();
    }, [selectedDate, activeTab, user]);

    if (isLoading || !user?.is_admin) {
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
    
    let filteredViews = pageViews;
    if (activeTab === 'cast' && selectedCastId !== 'all') {
        filteredViews = pageViews.filter(v => v.target_id === selectedCastId);
    }
    
    filteredViews.forEach(v => {
        const d = new Date(v.created_at);
        // timezone adjustments might be needed depending on DB, but assume UTC->Local works fine here
        const dayIdx = d.getDate() - 1; 
        if (dayIdx >= 0 && dayIdx < daysInMonth) {
            dailyCounts[dayIdx]++;
        }
    });

    const totalViews = dailyCounts.reduce((sum, count) => sum + count, 0);

    // If 'all' casts is selected, we can also show a ranking
    const castRanking = new Map<string, number>();
    if (activeTab === 'cast' && selectedCastId === 'all') {
        filteredViews.forEach(v => {
            if (v.target_id) {
                castRanking.set(v.target_id, (castRanking.get(v.target_id) || 0) + 1);
            }
        });
    }
    const rankedCasts = Array.from(castRanking.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => {
            const cast = casts.find(c => c.id === id);
            return { name: cast ? cast.name : 'Unknown', count, id };
        });

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
                        ホーム画面
                    </button>
                    <button 
                        onClick={() => setActiveTab('cast')}
                        className={`flex-1 py-3 text-xs tracking-widest uppercase transition-colors ${activeTab === 'cast' ? 'bg-black text-white font-medium' : 'bg-white text-black hover:bg-[#F9F9F9]'}`}
                    >
                        キャスト別
                    </button>
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

                    {activeTab === 'cast' && (
                        <div className="pt-4 border-t border-[#E5E5E5]">
                            <label className="text-[10px] uppercase tracking-widest text-[#777777] mb-2 block">対象キャスト</label>
                            <div className="relative">
                                <select 
                                    value={selectedCastId}
                                    onChange={e => setSelectedCastId(e.target.value)}
                                    className="w-full border border-[#E5E5E5] p-3 text-sm outline-none focus:border-black transition-colors bg-white appearance-none cursor-pointer"
                                >
                                    <option value="all">キャスト全体（ランキング）</option>
                                    {casts.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
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
                        {/* Summary Card */}
                        <div className="bg-black text-white p-6 flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] tracking-widest uppercase text-[#AAAAAA] mb-2">
                                {activeTab === 'cast' && selectedCastId === 'all' ? '全体合計 PV' : '月間合計 PV'}
                            </p>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-light tracking-wider">{totalViews.toLocaleString()}</span>
                                <span className="text-xs mb-1 tracking-widest text-[#CCCCCC]">PV</span>
                            </div>
                        </div>

                        {/* Cast Ranking - show only if Cast tab and 'all' is selected */}
                        {activeTab === 'cast' && selectedCastId === 'all' && (
                            <div className="bg-white border border-[#E5E5E5]">
                                <div className="p-4 border-b border-[#E5E5E5] bg-[#F9F9F9]">
                                    <h3 className="text-xs font-bold tracking-widest flex items-center gap-2">
                                        <BarChart2 size={14} className="stroke-[2]" />
                                        キャスト別 PVランキング
                                    </h3>
                                </div>
                                <div>
                                    {rankedCasts.length > 0 ? (
                                        rankedCasts.map((c, idx) => (
                                            <div 
                                                key={c.id} 
                                                onClick={() => setSelectedCastId(c.id)}
                                                className="flex items-center justify-between p-4 border-b border-[#E5E5E5] last:border-b-0 hover:bg-[#F9F9F9] transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center border ${idx < 3 ? 'bg-black text-white border-black' : 'bg-[#E5E5E5] text-[#777777] border-[#E5E5E5]'}`}>
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-sm tracking-widest">{c.name}</span>
                                                </div>
                                                <div className="flex items-end gap-1">
                                                    <span className="text-lg font-medium tracking-wider">{c.count.toLocaleString()}</span>
                                                    <span className="text-[10px] text-[#777777] mb-[2px]">PV</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-xs text-[#777777] tracking-widest">データがありません</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Daily List - Hide when showing all cast ranking */}
                        {!(activeTab === 'cast' && selectedCastId === 'all') && (
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
                                        <div key={i} className={`flex items-center justify-between p-4 border-b border-[#E5E5E5] last:border-b-0 ${isToday ? 'bg-[#F9F9F9]' : ''}`}>
                                            <span className={`text-sm tracking-widest ${isToday ? 'font-bold' : ''}`}>
                                                {i + 1}日
                                            </span>
                                            <div className="flex items-end gap-1">
                                                <span className={`text-base tracking-wider ${isToday ? 'font-bold' : ''}`}>
                                                    {count.toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-[#777777]">PV</span>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
