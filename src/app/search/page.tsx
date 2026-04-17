"use client";
import Link from 'next/link';
import { Search as SearchIcon, SlidersHorizontal, X, Check, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filter Modal States
  const [ageRange, setAgeRange] = useState({ min: "", max: "" });
  const [cupRange, setCupRange] = useState({ min: "A", max: "H" });
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedPlays, setSelectedPlays] = useState<string[]>([]);
  const [selectedOpOptions, setSelectedOpOptions] = useState<string[]>([]);
  const [selectedSM, setSelectedSM] = useState<string[]>([]);
  const [selectedBodyTypes, setSelectedBodyTypes] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>([]);

  // Custom Date Filtering State
  const [workingCastIdsForDate, setWorkingCastIdsForDate] = useState<string[]>([]);

  const filters = [
    { id: 'all', label: 'すべて' },
    { id: 'working', label: '本日出勤' },
    { id: 'new', label: '新人' }
  ];

  const [casts, setCasts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCasts = async () => {
      const { data: activeCasts } = await supabase
        .from('casts')
        .select('*')
        .eq('store_id', 'ef92279f-3f19-47e7-b542-69de5906ab9b')
        .eq('status', 'active');
      
      console.log("Fetched casts raw:", activeCasts); // Debug log to see if any casts are returned
      if (activeCasts) {
        // SNSのプロフィール画像（sns_profilesテーブル）を取得して結合する
        const phones = activeCasts.map(c => c.login_id).filter(Boolean);
        let profilesData: any[] = [];
        
        if (phones.length > 0) {
            const { data: pData } = await supabase
              .from('sns_profiles')
              .select('id, phone, avatar_url')
              .in('phone', phones);
            if (pData) profilesData = pData;
        }

        let prefsData: any[] = [];
        if (profilesData.length > 0) {
            const profileIds = profilesData.map(p => p.id);
            const { data: prefDataRes } = await supabase
              .from('sns_user_preferences')
              .select('*')
              .in('user_id', profileIds);
            if (prefDataRes) prefsData = prefDataRes;
        }
        
        // 本日の日付（YYYY-MM-DD）を取得
        const todayStr = new Date().toLocaleDateString('sv-SE').split('T')[0];
        let workingCastIds: string[] = [];
        
        const { data: availabilityData } = await supabase
           .rpc('get_public_availability', {
               p_store_id: 'ef92279f-3f19-47e7-b542-69de5906ab9b',
               p_date: todayStr
           });
           
        const availabilityMap = new Map();
        if (availabilityData) {
           availabilityData.forEach((row: any) => {
               if (!availabilityMap.has(row.cast_id)) {
                   availabilityMap.set(row.cast_id, {
                       shift_start: row.shift_start, 
                       shift_end: row.shift_end, 
                       attendance_status: row.attendance_status,
                       next_shift_date: row.next_shift_date,
                       bookings: []
                   });
               }
               if (row.booked_start) {
                   availabilityMap.get(row.cast_id).bookings.push({ start: row.booked_start, end: row.booked_end });
               }
           });
        }

        const next7DaysPromises = Array.from({length: 14}, async (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i + 1); // 明日からの14日間
            const dateStr = d.toLocaleDateString('sv-SE').split('T')[0];
            const { data } = await supabase.rpc('get_public_availability', {
               p_store_id: 'ef92279f-3f19-47e7-b542-69de5906ab9b',
               p_date: dateStr
            });
            return { dateStr, data };
        });
        
        const next7DaysResults = await Promise.all(next7DaysPromises);
        
        const nextShiftMap = new Map();
        next7DaysResults.forEach((result) => {
            if (result.data) {
                result.data.forEach((row: any) => {
                    const hasValidShift = row.attendance_status !== 'absent' && (!!row.shift_start || !!row.shift_end);
                    if (hasValidShift && !nextShiftMap.has(row.cast_id)) {
                        nextShiftMap.set(row.cast_id, result.dateStr);
                    }
                });
            }
        });

        const mergedCasts = activeCasts.map(cast => {
            const profile = profilesData.find(p => p.phone === cast.login_id);
            let isWorkingToday = availabilityMap.has(cast.id);
                
                let slotsLeft = null;
                let nextAvailableTime = null;
                let statusText = null;
                
                if (isWorkingToday) {
                   const avail = availabilityMap.get(cast.id);
                   
                   let isAbsent = avail.attendance_status === 'absent';
                   const hasShift = !!avail.shift_start || !!avail.shift_end;
                   
                   const now = new Date();
                   const currentHour = now.getHours();
                   const currentMin = now.getMinutes();
                   const currentMinTotal = currentHour * 60 + currentMin;

                   if (isAbsent || !hasShift) {
                       if (isAbsent) {
                           statusText = "お休み";
                       } else {
                           statusText = null;
                       }
                       isWorkingToday = false;
                       const nextDateRaw = avail.next_shift_date || nextShiftMap.get(cast.id);
                       if (nextDateRaw) {
                           const d = new Date(nextDateRaw);
                           nextAvailableTime = `次回出勤: ${d.getMonth() + 1}/${d.getDate()}`;
                       } else {
                           nextAvailableTime = "次回出勤: 未定";
                       }
                   } else {
                       statusText = "本日出勤中";
                       const eParts = avail.shift_end.split(':');
                       let eH = parseInt(eParts[0]);
                       if (eH < 6) eH += 24;
                       const eMin = eH * 60 + parseInt(eParts[1] || '0');
                       const adjCurrentMin = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                       if (adjCurrentMin >= eMin) {
                           statusText = "受付終了";
                           const nextDateRaw = avail.next_shift_date || nextShiftMap.get(cast.id);
                           if (nextDateRaw) {
                               const d = new Date(nextDateRaw);
                               nextAvailableTime = `次回出勤: ${d.getMonth() + 1}/${d.getDate()}`;
                           } else {
                               nextAvailableTime = "次回出勤: 未定";
                           }
                           isWorkingToday = true; // 表示上の都合でtrueにしておく
                       }
                   }
                   
                   if (statusText === "本日出勤中") {
                       let ssP = avail.shift_start.split(':');
                       let seP = avail.shift_end.split(':');
                       let ssH = parseInt(ssP[0]); if(ssH < 6) ssH += 24;
                       let seH = parseInt(seP[0]); if(seH < 6) seH += 24;
                       const ssM = ssH * 60 + parseInt(ssP[1] || '0');
                       const seM = seH * 60 + parseInt(seP[1] || '0');
                       const am = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                       
                       let cursorM = Math.max(am, ssM);
                       
                       const parsedBookings = avail.bookings.map((b: any) => {
                           let bsH = parseInt(b.start.split(':')[0]); if(bsH < 6) bsH += 24;
                           let beH = parseInt(b.end.split(':')[0]); if(beH < 6) beH += 24;
                           return {
                               startM: bsH * 60 + parseInt(b.start.split(':')[1] || '0'),
                               endM: beH * 60 + parseInt(b.end.split(':')[1] || '0')
                           };
                       }).sort((a: any, b: any) => a.startM - b.startM);

                       let bumped = true;
                       while (bumped) {
                           bumped = false;
                           for (const b of parsedBookings) {
                               if (cursorM >= b.startM && cursorM < b.endM) {
                                   cursorM = b.endM;
                                   bumped = true;
                               }
                           }
                       }

                       if (cursorM >= seM) {
                           statusText = "受付終了";
                           const nextDateRaw = avail.next_shift_date || nextShiftMap.get(cast.id);
                           if (nextDateRaw) {
                               const dt = new Date(nextDateRaw);
                               nextAvailableTime = `次回出勤: ${dt.getMonth() + 1}/${dt.getDate()}`;
                           } else {
                               nextAvailableTime = "次回出勤: 未定";
                           }
                       } else {
                           if (cursorM <= am) {
                               nextAvailableTime = "待機中";
                           } else {
                               let h = Math.floor(cursorM / 60);
                               let m = cursorM % 60;
                               if (h >= 24) h -= 24;
                               nextAvailableTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                           }
                       }
                       
                       if (avail.shift_start && avail.shift_end) {
                           const sH = parseInt(avail.shift_start.split(':')[0]);
                           const eH = parseInt(avail.shift_end.split(':')[0]) || 24;
                           const totalSlots = (eH <= sH ? eH + 24 - sH : eH - sH);
                           slotsLeft = Math.max(0, totalSlots - avail.bookings.length);
                       }
                   }
                } else {
                   const nextDateRaw = nextShiftMap.get(cast.id);
                   if (nextDateRaw) {
                       const d = new Date(nextDateRaw);
                       nextAvailableTime = `次回出勤: ${d.getMonth() + 1}/${d.getDate()}`;
                   } else {
                       nextAvailableTime = "次回出勤: 未定";
                   }
                }
                
                const now = new Date();
                let isNew = false;
                if (cast.join_date) {
                    const joinDate = new Date(cast.join_date);
                    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
                    if (now.getTime() - joinDate.getTime() < thirtyDaysMs) {
                        isNew = true;
                    }
                }

                const pref = profile ? prefsData.find(pr => pr.user_id === profile.id) : null;

                return {
                    ...cast,
                    sns_avatar_url: profile?.avatar_url || null,
                    preferences: pref || null,
                    isWorkingToday,
                    slotsLeft,
                    nextAvailableTime,
                    statusText,
                    isNew
                };
            });

        // 並び順： 新人 > 待機中 > 次回早い順 > 受付終了 > お休み > 次回出勤日の近い順 > シフト未定
        mergedCasts.sort((a, b) => {
            const getScore = (c: any) => {
                let score = 0;
                
                if (c.isNew) {
                    score += 1000000; // 新人は常に最優先
                }
                
                let nextShiftScore = 0;
                if (c.nextAvailableTime && c.nextAvailableTime.includes('次回出勤: ') && !c.nextAvailableTime.includes('未定')) {
                    const match = c.nextAvailableTime.match(/次回出勤: (\d+)\/(\d+)/);
                    if (match) {
                        const m = parseInt(match[1]);
                        const d = parseInt(match[2]);
                        const currentMonth = new Date().getMonth() + 1;
                        let targetMonth = m;
                        if (targetMonth < currentMonth - 2) targetMonth += 12;
                        const daysApprox = targetMonth * 31 + d;
                        nextShiftScore = 1000 - daysApprox; 
                        if (nextShiftScore < 0) nextShiftScore = 0;
                    }
                }
                
                if (c.statusText === '本日出勤中') {
                    if (c.nextAvailableTime === '待機中') {
                        score += 500000;
                    } else {
                        score += 400000;
                        if (c.nextAvailableTime && c.nextAvailableTime.includes && c.nextAvailableTime.includes(':') && !c.nextAvailableTime.includes('次回出勤')) {
                            const parts = c.nextAvailableTime.split(':');
                            let h = parseInt(parts[0]);
                            const m = parseInt(parts[1]);
                            if (!isNaN(h) && !isNaN(m)) {
                                if (h < 6) h += 24;
                                const minutes = h * 60 + m;
                                score += (2000 - minutes);
                            }
                        }
                    } 
                } else if (c.statusText === '受付終了') {
                    score += 300000 + nextShiftScore;
                } else if (c.statusText === 'お休み') {
                    score += 200000 + nextShiftScore;
                } else {
                    if (nextShiftScore > 0) {
                        score += 100000 + nextShiftScore;
                    } else {
                        score += 0;
                    }
                }
                
                return score;
            };
            return getScore(b) - getScore(a);
        });

        setCasts(mergedCasts);
      }
      setIsLoading(false);
    };

    fetchCasts();
  }, []);

  // Selected Date Change Listener for Custom Dates
  useEffect(() => {
     if (selectedDate && selectedDate !== 'today') {
         const fetchShiftsForDate = async () => {
             const { data: availabilityData } = await supabase
               .rpc('get_public_availability', {
                   p_store_id: 'ef92279f-3f19-47e7-b542-69de5906ab9b',
                   p_date: selectedDate
               });
             if (availabilityData) {
                 // 欠勤（absent）以外のキャストIDを抽出
                 setWorkingCastIdsForDate(
                     availabilityData.filter((r: any) => r.attendance_status !== 'absent').map((r: any) => r.cast_id)
                 );
             } else {
                 setWorkingCastIdsForDate([]);
             }
         };
         fetchShiftsForDate();
     }
  }, [selectedDate]);

  // Options
  const playOptions = ["コスプレ", "ディープキス", "全身リップ", "手コキ", "足コキ", "フェラチオ", "イラマチオ", "玉舐め", "乳首舐め", "クンニ", "シックスナイン", "顔面騎乗", "聖水", "洗体", "マットプレイ", "目隠し（お客様）", "イメージプレイ", "焦らしプレイ", "赤ちゃんプレイ", "男の潮吹き・亀頭責め", "アナル舐め・前立腺マッサージ", "口内射精", "射精管理"];
  const opOptions = ["即尺", "ローター", "電マ", "写真・動画撮影", "オナニー鑑賞", "ノースキン"];
  const smOptions = ["ドＳ", "S", "Sより", "両方", "Mより", "M", "ドＭ"];
  const bodyTypeOptions = ["スレンダー", "ぷよっこ", "小柄", "長身", "普通", "グラマー", "ぽっちゃり"];
  const featureOptions = ["素人", "巨乳", "美乳", "美脚", "美尻", "パイパン", "ギャル系", "モデル系", "現役学生", "セクシー女優", "ハーフ", "アニメ声", "黒髪", "レズビアン", "乳首ピンク", "乳輪大きい", "喫煙しない"];
  const personalityOptions = ["明るい", "癒し系", "甘えん坊", "天然", "ツンデレ", "おっとり", "恥ずかしがり屋", "人懐っこい", "エロい", "空気を読む", "オタク", "しっかり者"];

  const toggleItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
      setter(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const handleReset = () => {
      setAgeRange({ min: "", max: "" });
      setCupRange({ min: "A", max: "H" });
      setSelectedDate("");
      setSelectedPlays([]);
      setSelectedOpOptions([]);
      setSelectedSM([]);
      setSelectedBodyTypes([]);
      setSelectedFeatures([]);
      setSelectedPersonalities([]);
  };

  // リアルタイムに条件を反映させて該当キャストを計算
  const displayedCasts = casts.filter(cast => {
      // 1. Quick Tabs
      if (activeFilter === 'working' && !cast.isWorkingToday) return false;
      if (activeFilter === 'new' && !cast.isNew) return false;
      
      // 2. Keyword Search
      if (searchQuery && !cast.name.includes(searchQuery)) return false;
      
      // 3. Detailed Filters
      const pref = cast.preferences || {};
      
      // Age filtering
      if (ageRange.min !== "" || ageRange.max !== "") {
          const castAge = parseInt(pref.age_min || "0");
          if (!castAge) return false; // 除外：検索条件が設定されているが年齢未設定のキャスト
          if (ageRange.min && castAge < parseInt(ageRange.min)) return false;
          if (ageRange.max && castAge > parseInt(ageRange.max)) return false;
      }
      
      // Cup Size filtering
      const isDefaultCup = cupRange.min === "A" && cupRange.max === "H";
      if (!isDefaultCup) {
          const cupOrder = ['A','B','C','D','E','F','G','H','I'];
          const cupMinIndex = cupOrder.indexOf(cupRange.min);
          const cupMaxIndex = cupOrder.indexOf(cupRange.max);
          
          const castCup = pref.cup_min;
          if (!castCup) return false; // 除外：カップ数未設定
          
          const castCupIdx = cupOrder.indexOf(castCup);
          if (castCupIdx === -1 || castCupIdx < cupMinIndex || castCupIdx > cupMaxIndex) return false;
      }
      
      // Working Date filtering
      if (selectedDate) {
          if (selectedDate === 'today') {
              if (!cast.isWorkingToday) return false;
          } else {
              // Custom calendar date
              if (!workingCastIdsForDate.includes(cast.id)) return false;
          }
      }
      
      if (selectedOpOptions.length > 0) {
          if (!pref.op_options || pref.op_options.length === 0) return false;
          const hasAllOp = selectedOpOptions.every(op => pref.op_options.includes(op));
          if (!hasAllOp) return false;
      }
      
      // DBに紐づけた詳細条件の判定
      if (selectedBodyTypes.length > 0) {
          if (!pref.body_types || pref.body_types.length === 0) return false;
          const hasMatch = selectedBodyTypes.some(b => pref.body_types.includes(b));
          if (!hasMatch) return false;
      }
      
      if (selectedSM.length > 0) {
          if (!pref.sm_types || pref.sm_types.length === 0) return false;
          const hasMatch = selectedSM.some(sm => pref.sm_types.includes(sm));
          if (!hasMatch) return false;
      }
      
      if (selectedPlays.length > 0) {
          if (!pref.plays || pref.plays.length === 0) return false;
          const hasAllPlays = selectedPlays.every(p => pref.plays.includes(p));
          if (!hasAllPlays) return false;
      }
      
      if (selectedFeatures.length > 0) {
          if (!pref.features || pref.features.length === 0) return false;
          const hasAllFeatures = selectedFeatures.every(f => pref.features.includes(f));
          if (!hasAllFeatures) return false;
      }
      
      if (selectedPersonalities.length > 0) {
          if (!pref.personalities || pref.personalities.length === 0) return false;
          const hasAllPers = selectedPersonalities.every(p => pref.personalities.includes(p));
          if (!hasAllPers) return false;
      }
      
      return true;
  });

  return (
    <div className="min-h-screen bg-white pb-24 font-light relative">
      {/* Header & Search Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E5E5] pt-4">
        <h1 className="text-sm font-bold tracking-widest text-center mb-4 uppercase">探す</h1>
        
        <div className="px-6 mb-4 flex gap-3 pb-2">
            <div className="flex-1 flex items-center border-b border-black pb-2">
                <SearchIcon size={18} className="text-[#777777] mr-3 stroke-[1.5]" />
                <input 
                    type="text" 
                    placeholder="キャスト名や特徴で検索"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full outline-none bg-transparent placeholder:text-[#E5E5E5] text-sm tracking-widest text-black"
                />
            </div>
            <button 
                onClick={() => {
                    handleReset();
                    setIsFilterOpen(true);
                }}
                className="p-2 border border-[#E5E5E5] text-[#777777] hover:border-black hover:text-black transition-colors"
            >
                <SlidersHorizontal size={18} className="stroke-[1.5]" />
            </button>
        </div>

        {/* Filter Tags Scroll */}
        <div className="px-6 pb-4 overflow-x-auto no-scrollbar flex gap-2">
            {filters.map(f => (
                <button 
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`whitespace-nowrap px-4 py-2 text-[10px] tracking-widest border transition-all ${activeFilter === f.id ? 'bg-black text-white border-black' : 'bg-white text-[#777777] border-[#E5E5E5] hover:border-black'}`}
                >
                    {f.label}
                </button>
            ))}
        </div>
      </div>

      {/* Grid */}
      <main className="p-1">
        <div className="grid grid-cols-2 gap-1">
            {isLoading ? (
                <div className="col-span-2 py-20 flex justify-center">
                   <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : casts.length > 0 ? (
                (() => {
                    if (displayedCasts.length === 0) {
                        return (
                           <div className="col-span-2 py-20 text-center text-[#777777]">
                              <p className="text-xs tracking-widest">条件に一致するキャストが見つかりません</p>
                           </div>
                        );
                    }
                    
                    return displayedCasts.map(cast => (
                    <Link key={cast.id} href={`/cast/${cast.id}`} className="block relative aspect-[3/4] bg-[#F9F9F9] group overflow-hidden border border-[#E5E5E5]">
                        <img 
                           src={cast.sns_avatar_url || cast.profile_image_url || cast.avatar_url || "/images/no-photo.jpg"} 
                           alt={cast.name} 
                           loading="lazy" 
                           className="w-full h-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-105 mobile-color-pulse" 
                           style={{ "--pulse-delay": `-${Math.random() * 15}s`, "--pulse-dur": `${10 + Math.random() * 6}s` } as React.CSSProperties}
                        />
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                        
                        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1.5 pointer-events-none max-w-[calc(100%-24px)]">
                            {cast.statusText === 'お休み' ? (
                                <div className="bg-black/80 backdrop-blur text-white text-[9px] px-2 py-1 font-bold tracking-widest border border-white/20">
                                    お休み
                                </div>
                            ) : cast.statusText === '受付終了' ? (
                                <div className="bg-black/70 backdrop-blur text-[#E5E5E5] text-[9px] px-2 py-1 font-bold tracking-widest border border-white/20">
                                    受付終了
                                </div>
                            ) : cast.statusText === '本日出勤中' ? (
                                <div className="bg-white/90 backdrop-blur text-black text-[9px] px-2 py-1 font-bold tracking-widest flex items-center gap-1 shadow-sm border border-white whitespace-nowrap">
                                    <span className={`w-1.5 h-1.5 shrink-0 rounded-none ${cast.nextAvailableTime === '待機中' ? 'bg-[#E02424] animate-[pulse_2s_ease-in-out_infinite]' : 'bg-black'}`}></span>
                                    <span className="truncate">{cast.nextAvailableTime === '待機中' ? '待機中' : `次回 ${cast.nextAvailableTime}〜`}</span>
                                </div>
                            ) : cast.nextAvailableTime && cast.nextAvailableTime.includes('次回出勤: ') && !cast.nextAvailableTime.includes('未定') ? (
                                <div className="bg-black/70 backdrop-blur text-[#E5E5E5] text-[9px] px-2 py-1 font-bold tracking-widest border border-white/20">
                                    <span className="truncate">{cast.nextAvailableTime.replace('次回出勤: ', '次回出勤 ')}</span>
                                </div>
                            ) : null}

                            {cast.isNew && (
                                <div className="bg-[#22C55E] text-white text-[9px] font-bold px-2.5 py-1 tracking-[0.2em] shadow-lg flex items-center justify-center gap-1.5 whitespace-nowrap">
                                    <span style={{ textShadow: "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff" }} className="text-[11px]">🔰</span>
                                    NEW FACE
                                </div>
                            )}
                        </div>

                        <div className="absolute bottom-4 left-4">
                            <h2 className="text-white text-lg font-normal tracking-[0.2em] uppercase drop-shadow-md">
                                {cast.name}
                            </h2>
                        </div>
                    </Link>
                    ));
                })()
            ) : (
                <div className="col-span-2 py-20 text-center text-[#777777]">
                   <p className="text-xs tracking-widest">キャストが見つかりません</p>
                </div>
            )}
        </div>
      </main>

      {/* Details Filter Modal Sheet */}
      {isFilterOpen && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end">
              {/* Backdrop */}
              <div 
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" 
                  onClick={() => {
                      handleReset();
                      setIsFilterOpen(false);
                  }}
              />
              
              {/* Modal Content */}
              <div className="relative bg-white w-full max-h-[85vh] rounded-t-none overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300 max-w-md mx-auto">
                  <div className="flex items-center justify-between p-6 border-b border-[#E5E5E5] bg-white sticky top-0 z-10 shadow-sm">
                      <h2 className="font-bold text-sm tracking-widest flex items-center gap-2">
                          詳細絞り込み
                          <span className="bg-black text-white px-2 py-0.5 text-[10px] rounded-none">{displayedCasts.length}名</span>
                      </h2>
                      <button onClick={() => {
                          handleReset();
                          setIsFilterOpen(false);
                      }} className="text-[#777777] hover:text-black transition-colors">
                          <X size={24} className="stroke-[1.5]" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-10 pb-32">
                      {/* Age */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">年齢</h3>
                          <div className="flex items-center gap-3">
                              <input type="number" placeholder="18" className="w-20 border border-[#E5E5E5] p-3 text-center text-sm outline-none focus:border-black appearance-none" value={ageRange.min} onChange={e => setAgeRange({...ageRange, min: e.target.value})} />
                              <span className="text-[#777777] text-xs">歳 〜</span>
                              <input type="number" placeholder="30" className="w-20 border border-[#E5E5E5] p-3 text-center text-sm outline-none focus:border-black appearance-none" value={ageRange.max} onChange={e => setAgeRange({...ageRange, max: e.target.value})} />
                              <span className="text-[#777777] text-xs">歳</span>
                          </div>
                      </section>

                      {/* Cup Size */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">カップ数</h3>
                          <div className="flex items-center gap-3">
                              <select className="w-20 border border-[#E5E5E5] p-3 text-center text-sm outline-none focus:border-black bg-white" value={cupRange.min} onChange={e => setCupRange({...cupRange, min: e.target.value})}>
                                 {['A','B','C','D','E','F','G','H','I'].map(c => <option key={`min-${c}`} value={c}>{c}</option>)}
                              </select>
                              <span className="text-[#777777] text-xs">〜</span>
                              <select className="w-20 border border-[#E5E5E5] p-3 text-center text-sm outline-none focus:border-black bg-white" value={cupRange.max} onChange={e => setCupRange({...cupRange, max: e.target.value})}>
                                 {['A','B','C','D','E','F','G','H','I'].map(c => <option key={`max-${c}`} value={c}>{c}</option>)}
                              </select>
                          </div>
                      </section>

                      {/* Working Days */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">出勤日</h3>
                          <div className="flex items-center gap-3">
                              <button 
                                  onClick={() => setSelectedDate(prev => prev === "today" ? "" : "today")} 
                                  className={`px-6 py-2 h-[42px] text-[11px] tracking-widest border transition-all ${selectedDate === "today" ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}
                              >
                                  本日
                              </button>
                              <span className="text-[#777777] text-xs">または</span>
                              <div className="relative flex-1">
                                  <input 
                                      type="date"
                                      value={selectedDate !== "today" ? selectedDate : ""}
                                      onChange={(e) => setSelectedDate(e.target.value)}
                                      className={`w-full px-4 py-2 h-[42px] text-[11px] tracking-widest border transition-all outline-none bg-white font-medium ${selectedDate !== "today" && selectedDate !== "" ? 'border-black text-black' : 'border-[#E5E5E5] text-[#777777]'}`}
                                  />
                              </div>
                          </div>
                      </section>

                      {/* Body Type */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">体型 <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {bodyTypeOptions.map(opt => (
                                  <button key={opt} onClick={() => toggleItem(setSelectedBodyTypes, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedBodyTypes.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>

                      {/* SM Type */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">S・M傾向 <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {smOptions.map(opt => (
                                  <button key={opt} onClick={() => toggleItem(setSelectedSM, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedSM.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>

                      {/* Skills / Play */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">可能プレイ <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {playOptions.map(opt => (
                                  <button key={opt} onClick={() => toggleItem(setSelectedPlays, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedPlays.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>

                      {/* OP Options */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">OP枠 <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {opOptions.map(opt => (
                                  <button key={opt} onClick={() => toggleItem(setSelectedOpOptions, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedOpOptions.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>

                      {/* Features (Image 1) */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">個性（特徴） <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {featureOptions.map(opt => (
                                  <button key={opt} onClick={() => toggleItem(setSelectedFeatures, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedFeatures.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>

                      {/* Personality (Image 2) */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">性格 <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {personalityOptions.map(opt => (
                                  <button key={opt} onClick={() => toggleItem(setSelectedPersonalities, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedPersonalities.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>
                  </div>

                  {/* Fixed Bottom Action */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-[#E5E5E5]">
                      <div className="flex gap-4">
                          <button 
                              onClick={handleReset}
                              className="px-6 py-3 border border-[#E5E5E5] text-black text-xs tracking-widest hover:border-black transition-colors whitespace-nowrap bg-[#F9F9F9]"
                          >
                              クリア
                          </button>
                          <button 
                              onClick={() => setIsFilterOpen(false)}
                              className="premium-btn flex-1 py-3 text-sm tracking-widest flex items-center justify-center gap-2"
                          >
                              <Check size={16} className="stroke-[1.5]" />
                              この条件で探す
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
