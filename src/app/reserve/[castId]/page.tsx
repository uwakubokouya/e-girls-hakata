"use client";
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check, CalendarDays, KeyRound, Clock } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useUser } from "@/providers/UserProvider";
import { supabase } from "@/lib/supabase";
import { fetchBusinessEndTime, getLogicalBusinessDate, getAdjustedMinutes, getAdjustedNowMins } from "@/utils/businessTime";

// Helper to parse time string "HH:MM" to minutes since start of day (06:00 is base 360, 01:00 is 25:00=1500)
const parseMins = (t: any) => {
    if (!t) return 0;
    const str = String(t);
    let parts = str.split(':').map(Number);
    let h = parts[0] || 0;
    let m = parts[1] || 0;
    if (h < 6) h += 24; // Midnight to 5 AM treated as next day
    return h * 60 + m;
};

// Helper: formater
const formatTimeLabel = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export default function ReservationPage({ params }: { params: Promise<{ prefecture: string, castId: string }> }) {
    const resolvedParams = use(params);
    const castId = resolvedParams.castId;
    const prefecture = decodeURIComponent(resolvedParams.prefecture || "");
    const router = useRouter();
    const { user } = useUser();
    
    // UI steps
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    
    // DB Data
    const [cast, setCast] = useState<any>(null);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    
    // User Selections
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedCourseItem, setSelectedCourseItem] = useState<any | null>(null);
    const [selectedNomination, setSelectedNomination] = useState<any | null>(null);
    const [selectedOptions, setSelectedOptions] = useState<any[]>([]);
    const [selectedDiscount, setSelectedDiscount] = useState<any | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [customerNotes, setCustomerNotes] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    
    // Dynamic Slots calculation
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [businessEndTime, setBusinessEndTime] = useState<{hour: number, min: number}>({hour: 6, min: 0});

    // 0. Tracking
    useEffect(() => {
        if (!castId) return;
        if (user?.role === 'cast' || user?.is_admin) return;
        
        const trackPV = async () => {
            const TRACK_KEY = `last_reserve_click_${castId}`;
            const lastTracked = sessionStorage.getItem(TRACK_KEY);
            const now = Date.now();
            
            if (!lastTracked || now - parseInt(lastTracked) > 600000) {
              sessionStorage.setItem(TRACK_KEY, now.toString());
              try {
                  const sessionObj = localStorage.getItem('anon_session_id');
                  supabase.from('page_views').insert({
                      page_type: 'reserve_click',
                      target_id: castId,
                      viewer_id: user?.id || null,
                      session_id: sessionObj
                  }).then(() => {});
              } catch(e) {}
            }
        };
        trackPV();
    }, [castId, user]);

    // 1. Initial Data Fetch
    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            
            // Get Cast & Store info (Try cast ID first)
            let castData = null;
            const { data: directCast } = await supabase
                .from('casts')
                .select('id, name, store_id, phone, back_settings')
                .eq('id', castId)
                .maybeSingle();
                
            castData = directCast;

            // If not found, try to look up via sns_profiles
            if (!castData) {
                const { data: profile } = await supabase
                    .from('sns_profiles')
                    .select('id, phone, name')
                    .eq('id', castId)
                    .maybeSingle();
                    
                if (profile && profile.phone) {
                    const { data: mappedCast } = await supabase
                        .from('casts')
                        .select('id, name, store_id, phone, back_settings, login_id')
                        .eq('login_id', profile.phone)
                        .maybeSingle();
                    
                    if (mappedCast) {
                        castData = mappedCast;
                    } else {
                        // Fallback using profile name
                        castData = { id: castId, name: profile.name || "キャスト", store_id: null };
                    }
                }
            }
                
            let activeStoreId = castData?.store_id || 'ef92279f-3f19-47e7-b542-69de5906ab9b';
            
            // Set dummy cast name if not found
            setCast(castData || { id: castId, name: "キャスト", store_id: activeStoreId });
            
            // Fetch masters (courses, options, discounts, nominations) using resolved store_id (strict match)
            const { data: mastersData } = await supabase
                .from('masters')
                .select('*')
                .eq('store_id', activeStoreId)
                .eq('is_active', true)
                .eq('is_visible', true)
                .order('sort_order', { ascending: true });
                    
                if (mastersData) {
                    setCourses(mastersData.filter(m => m.type && ['COURSE', 'OPTION', 'DISCOUNT', 'NOMINATION'].includes(m.type.toUpperCase())));
                }

                // Fetch business time once on init
                const bTime = await fetchBusinessEndTime(supabase);
                setBusinessEndTime(bTime);

                // Fetch shifts for the next 14 days via RPC (bypasses RLS safely)
                const next14DaysPromises = Array.from({length: 14}, async (_, i) => {
                    const now = new Date();
                    const logicalTodayStr = getLogicalBusinessDate(now, bTime.hour, bTime.min);
                    const d = new Date(logicalTodayStr);
                    d.setDate(d.getDate() + i);
                    const dateStr = d.toLocaleDateString('sv-SE').split('T')[0];
                    
                    const { data } = await supabase.rpc('get_public_availability', {
                        p_store_id: activeStoreId,
                        p_date: dateStr
                    });
                    
                    const targetId = castData?.id || castId;
                    const shift = data?.find((s: any) => s.cast_id === targetId);
                    if (shift && shift.attendance_status !== 'absent' && shift.shift_start && shift.shift_end) {
                        return dateStr;
                    }
                    return null;
                });
                
                const next14DaysResults = await Promise.all(next14DaysPromises);
                const uniqueDates = next14DaysResults.filter(Boolean) as string[];
                setAvailableDates(uniqueDates);
            
            setIsLoading(false);
        };
        fetchInitialData();
    }, [castId]);

    // 2. Fetch specific availability when Date AND Course are selected (on Step 3 mount or when data changes)
    useEffect(() => {
        const calculateSlots = async () => {
            if (!cast || !selectedDate || !selectedCourseItem) return;
            setIsLoadingSlots(true);
            
            try {
                // Fetch availability RPC (which includes shift info and bookings for that date)
                const { data: availData } = await supabase.rpc('get_public_availability', {
                    p_store_id: cast.store_id,
                    p_date: selectedDate
                });
                
                if (availData && availData.length > 0) {
                    // Get all rows for this cast to extract multiple bookings
                    const castRows = availData.filter((a: any) => a.cast_id === cast.id);
                    
                    if (castRows.length > 0 && castRows[0].shift_start && castRows[0].shift_end) {
                        const baseShift = castRows[0];
                        let sStart = getAdjustedMinutes(baseShift.shift_start, businessEndTime.hour);
                        const sEnd = getAdjustedMinutes(baseShift.shift_end, businessEndTime.hour);
                        
                        // Extract all bookings for this day
                        const activeBookings = castRows
                            .filter((r: any) => r.booked_start && r.booked_end)
                            .map((r: any) => ({
                                start: r.booked_start,
                                end: r.booked_end
                            }));
                        
                        // If selectedDate is today, ensure we don't show past times
                        const now = new Date();
                        const todayStr = getLogicalBusinessDate(now, businessEndTime.hour, businessEndTime.min);
                        if (selectedDate === todayStr) {
                            const adjCurrentMins = getAdjustedNowMins(now, businessEndTime.hour);
                            // 現在時刻より少し余裕を持たせて10分単位で丸める
                            const roundedNow = Math.ceil(adjCurrentMins / 10) * 10;
                            if (roundedNow > sStart) {
                                sStart = roundedNow;
                            }
                        }
                        
                        const baseDur = Number(selectedCourseItem?.duration) || 60;
                        const optDur = selectedOptions.reduce((sum, o) => sum + (Number(o.duration) || 0), 0);
                        const nomDur = Number(selectedNomination?.duration) || 0;
                        const requiredMins = baseDur + optDur + nomDur + 10; // Total time + 10 mins buffer
                        
                        const candidateSet = new Set<number>();
                        
                        // 1. Base 30-min intervals
                        let current30 = sStart;
                        if (current30 % 30 !== 0) {
                            current30 = current30 + (30 - (current30 % 30));
                        }
                        let safety = 0;
                        while (current30 + requiredMins <= sEnd && safety < 100) {
                            safety++;
                            candidateSet.add(current30);
                            current30 += 30;
                        }
                        
                        // 2. Exact fit slots (Smart Slots)
                        for (const b of activeBookings) {
                            const bStart = getAdjustedMinutes(b.start, businessEndTime.hour);
                            const bEnd = getAdjustedMinutes(b.end, businessEndTime.hour);
                            const bEndWithBuffer = bEnd + 10; // 前の予約の片付け時間（10分）を考慮
                            
                            // Immediately after previous booking ends
                            if (bEndWithBuffer >= sStart && bEndWithBuffer + requiredMins <= sEnd) {
                                candidateSet.add(bEndWithBuffer);
                            }
                            
                            // Exactly before next booking starts
                            const perfectStart = bStart - requiredMins;
                            if (perfectStart >= sStart && perfectStart + requiredMins <= sEnd) {
                                candidateSet.add(perfectStart);
                            }
                        }
                        
                        // 3. Filter overlapping and sort
                        const validSlots = Array.from(candidateSet).filter(cStart => {
                            const cEnd = cStart + requiredMins;
                            for (const b of activeBookings) {
                                const bStart = getAdjustedMinutes(b.start, businessEndTime.hour);
                                const bEnd = getAdjustedMinutes(b.end, businessEndTime.hour);
                                const bEndWithBuffer = bEnd + 10;
                                // Check overlap
                                if (cStart < bEndWithBuffer && cEnd > bStart) {
                                    return false;
                                }
                            }
                            return true;
                        }).sort((a, b) => a - b).map(mins => formatTimeLabel(mins));
                        
                        setAvailableSlots(validSlots);
                    } else {
                        setAvailableSlots([]);
                    }
                } else {
                    setAvailableSlots([]);
                }
            } catch (err) {
                console.error("Error calculating slots:", err);
                setAvailableSlots([]);
            } finally {
                setIsLoadingSlots(false);
            }
        };
        
        if (step === 3) {
            calculateSlots();
        }
    }, [step, selectedDate, selectedCourseItem, selectedOptions, selectedNomination, cast, castId]);

    const handleNext = () => {
        if (step === 2) {
            const hasCourse = courses.some(c => c.type?.toUpperCase() === 'COURSE');
            const hasNomination = courses.some(c => c.type?.toUpperCase() === 'NOMINATION');
            
            if (hasCourse && !selectedCourseItem) {
                setErrorMsg('コースが選択されていません');
                return;
            }
            if (hasNomination && !selectedNomination) {
                setErrorMsg('指名が選択されていません');
                return;
            }
        }
        if (step < 4) setStep(step + 1);
    }

    const formatDateStr = (dStr: string) => {
        const d = new Date(dStr);
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
    };

    const handleSubmit = async () => {
        if (!user) {
            setErrorMsg("予約にはログインが必要です。");
            return;
        }

        setIsSubmitting(true);
        try {
            const cPrice = selectedCourseItem?.price || 0;
            const nPrice = selectedNomination?.price || 0;
            const oPrice = selectedOptions.reduce((sum, o) => sum + (o.price || 0), 0);
            const dPrice = selectedDiscount?.price ? Math.abs(selectedDiscount.price) * -1 : 0;
            const total = cPrice + nPrice + oPrice + dPrice;

            const reservationData = {
                customer_id: user.id,
                customer_name: user.name,
                customer_phone: user.phone || null,
                cast_id: cast?.id,
                store_id: cast?.store_id,
                reserve_date: selectedDate,
                reserve_time: selectedSlot,
                course_id: selectedCourseItem?.id,
                course_name: selectedCourseItem?.name || selectedCourseItem?.label,
                course_price: cPrice,
                nomination_id: selectedNomination?.id,
                nomination_name: selectedNomination?.name || selectedNomination?.label,
                nomination_price: nPrice,
                options: selectedOptions.length > 0 ? selectedOptions.map(o => ({id: o.id, name: o.name || o.label, price: o.price})) : null,
                discount_id: selectedDiscount?.id,
                discount_name: selectedDiscount?.name || selectedDiscount?.label,
                discount_price: dPrice,
                total_price: Math.max(0, total),
                customer_notes: customerNotes,
                status: 'pending'
            };

            const { error } = await supabase.from('sns_reservations').insert(reservationData);

            if (error) {
                console.error("Reserve Error:", error);
                setErrorMsg("ご予約の送信に失敗しました。" + error.message);
            } else {
                setIsSuccess(true);
            }
        } catch (e: any) {
            setErrorMsg("エラーが発生しました。" + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center font-light">
                <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center mb-6">
                    <Check size={32} className="stroke-[1.5]" />
                </div>
                <h2 className="text-xl font-normal tracking-widest mb-4">予約リクエスト完了</h2>
                <div className="text-sm tracking-widest leading-loose text-[#333333] mb-10">
                    ご予約いただきありがとうございます。<br/>
                    店舗からの折り返しのご連絡をもちまして<br/>
                    【確定】とさせていただきます。<br/><br/>
                    確認ができ次第、速やかにご連絡差し上げますので<br/>
                    今しばらくお待ちくださいませ。
                </div>
                <button 
                    onClick={() => {
                        const savedPref = localStorage.getItem('last_prefecture');
                        router.push(savedPref ? `/${savedPref}` : '/');
                    }}
                    className="premium-btn w-full max-w-sm py-4 bg-black text-white text-sm tracking-widest"
                >
                    ホームへ戻る
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white pb-40 font-light">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white border-b border-[#E5E5E5] flex items-center px-4 py-4">
                <button onClick={() => {
                    if (step > 1) {
                        setStep(step - 1);
                    } else {
                        router.back();
                    }
                }} className="text-black hover:text-[#777777] p-2">
                    <ChevronLeft size={24} className="stroke-[1.5]" />
                </button>
                <div className="flex-1 text-center font-normal text-sm pr-10 tracking-widest font-bold">
                    予約する{cast?.name ? `（${cast.name}）` : ''}
                </div>
            </header>

            {/* Progress Bar */}
            <div className="px-6 py-6 pb-2">
                <div className="flex justify-between relative max-w-[300px] mx-auto">
                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[#E5E5E5] -z-10 -translate-y-1/2"></div>
                    <div className="absolute top-1/2 left-0 h-[1px] bg-black -z-10 -translate-y-1/2 transition-all duration-500" style={{ width: `${(step - 1) * 33.3}%`}}></div>
                    
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center font-medium text-[10px] transition-colors bg-white border ${step >= i ? 'border-black text-black' : 'border-[#E5E5E5] text-[#E5E5E5]'}`}>
                            {step > i ? <Check size={12} className="stroke-[2]" /> : i}
                        </div>
                    ))}
                </div>
            </div>

            <main className="px-6 py-4">
                {/* STEP 1: DATE */}
                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-sm font-normal tracking-widest border-b border-black pb-2 flex items-center gap-3">
                            <CalendarDays size={18} className="stroke-[1.5]" />
                            ご来店日の選択
                        </h2>
                        
                        {availableDates.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {availableDates.map(date => (
                                    <button 
                                        key={date}
                                        onClick={() => setSelectedDate(date)}
                                        className={`py-4 text-sm font-medium tracking-widest transition-all border ${selectedDate === date ? 'bg-black text-white border-black shadow-md' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}
                                    >
                                        {formatDateStr(date)}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="py-10 text-center text-[#777777] text-xs tracking-widest">
                                現在、予約可能な日程がありません。
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2: COURSE */}
                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <h2 className="text-sm font-normal tracking-widest border-b border-black pb-2 flex items-center gap-3">
                            <KeyRound size={18} className="stroke-[1.5]" />
                            コース・指名の選択
                        </h2>
                        
                        {courses.length > 0 ? (
                            <div className="space-y-8">
                                {['COURSE', 'NOMINATION', 'OPTION', 'DISCOUNT'].map(type => {
                                    let items = courses.filter(c => c.type?.toUpperCase() === type);
                                    
                                    // キャストのback_settingsで対応可能（金額設定あり）なオプションのみに絞り込む
                                    if (type === 'OPTION' && cast?.back_settings) {
                                        items = items.filter(course => Object.keys(cast.back_settings).includes(course.label || course.name));
                                    }
                                    
                                    if (items.length === 0) return null;
                                    
                                    const title = type === 'COURSE' ? 'コース' : type === 'NOMINATION' ? '指名' : type === 'OPTION' ? 'オプション' : '割引';
                                    
                                    return (
                                        <div key={type} className="space-y-3">
                                            <h3 className="text-xs font-bold tracking-widest text-[#333333] border-l-2 border-black pl-2">{title}</h3>
                                            <div className="space-y-3">
                                                {items.map(course => {
                                                    let isSelected = false;
                                                    if (type === 'COURSE') isSelected = selectedCourseItem?.id === course.id;
                                                    else if (type === 'NOMINATION') isSelected = selectedNomination?.id === course.id;
                                                    else if (type === 'DISCOUNT') isSelected = selectedDiscount?.id === course.id;
                                                    else if (type === 'OPTION') isSelected = selectedOptions.some(o => o.id === course.id);

                                                    const toggleSelection = () => {
                                                        if (type === 'COURSE') setSelectedCourseItem(isSelected ? null : course);
                                                        else if (type === 'NOMINATION') setSelectedNomination(isSelected ? null : course);
                                                        else if (type === 'DISCOUNT') setSelectedDiscount(isSelected ? null : course);
                                                        else if (type === 'OPTION') {
                                                            if (isSelected) setSelectedOptions(prev => prev.filter(o => o.id !== course.id));
                                                            else setSelectedOptions(prev => [...prev, course]);
                                                        }
                                                    };

                                                    return (
                                                        <button 
                                                            key={course.id}
                                                            onClick={toggleSelection}
                                                            className={`w-full p-5 border text-left flex items-center justify-between transition-all ${isSelected ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black hover:bg-[#F9F9F9]'}`}
                                                        >
                                                            <div>
                                                                <h3 className="font-medium text-sm tracking-widest mb-1">{course.label || course.name}</h3>
                                                                {course.duration ? <span className={`text-[10px] tracking-widest ${isSelected ? 'text-white/70' : 'text-[#777777]'}`}>{course.duration}分</span> : null}
                                                            </div>
                                                            <div className="font-normal text-lg tracking-wider">
                                                                {course.price > 0 ? (type === 'DISCOUNT' ? `-¥${course.price.toLocaleString()}` : `¥${course.price.toLocaleString()}`) : course.price < 0 ? `-¥${Math.abs(course.price).toLocaleString()}` : '無料'}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-10 text-center text-[#777777] text-xs tracking-widest">
                                コース情報が登録されていません。
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: TIME */}
                {step === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <h2 className="text-sm font-normal tracking-widest border-b border-black pb-2 flex items-center gap-3">
                            <Clock size={18} className="stroke-[1.5]" />
                            ご来店時間の選択
                        </h2>
                        
                        <div className="bg-[#F9F9F9] border border-[#E5E5E5] p-6 text-center">
                            <p className="text-[10px] text-[#777777] tracking-widest mb-6 leading-loose">
                                {selectedDate && formatDateStr(selectedDate)}<br/>
                                {selectedCourseItem?.label || selectedCourseItem?.name} <br/>
                                が予約可能な時間枠です。
                            </p>
                            
                            {isLoadingSlots ? (
                                <div className="py-10 flex justify-center">
                                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : availableSlots.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2">
                                    {availableSlots.map(slot => (
                                        <button 
                                            key={slot}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`py-3 text-sm font-medium tracking-widest transition-all border ${selectedSlot === slot ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-[#E02424] text-xs tracking-widest border border-[#E02424] bg-red-50">
                                    この日のこのコースの十分な空き枠がありません。<br/>別の日程または短いコースをお試しください。
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 4: CONFIRM */}
                {step === 4 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <h2 className="text-sm font-normal tracking-widest border-b border-black pb-2 flex items-center gap-3">
                            <Check size={18} className="stroke-[1.5]" />
                            予約内容の確認
                        </h2>
                        
                        <div className="border border-[#E5E5E5] p-6 space-y-6 bg-[#F9F9F9]">
                            <div className="flex flex-col border-b border-[#E5E5E5] pb-4">
                                <span className="text-[#777777] text-[10px] tracking-widest mb-1">指名キャスト</span>
                                <span className="font-normal text-base uppercase tracking-widest">{cast?.name}</span>
                            </div>
                            <div className="flex flex-col border-b border-[#E5E5E5] pb-4">
                                <span className="text-[#777777] text-[10px] tracking-widest mb-1">来店日時</span>
                                <span className="font-normal text-base uppercase tracking-widest">
                                    {selectedDate ? formatDateStr(selectedDate) : ''} {selectedSlot}
                                </span>
                            </div>
                            {selectedCourseItem && (
                                <div className="flex flex-col pb-4 border-b border-[#E5E5E5]">
                                    <span className="text-[#777777] text-[10px] tracking-widest mb-1">コース</span>
                                    <span className="font-normal text-base tracking-widest">{selectedCourseItem.label || selectedCourseItem.name}</span>
                                    <span className="mt-1 text-sm tracking-wide">{selectedCourseItem.price > 0 ? `¥${selectedCourseItem.price.toLocaleString()}` : '無料'}</span>
                                </div>
                            )}
                            {selectedNomination && (
                                <div className="flex flex-col pb-4 border-b border-[#E5E5E5] pt-4">
                                    <span className="text-[#777777] text-[10px] tracking-widest mb-1">指名</span>
                                    <span className="font-normal text-base tracking-widest">{selectedNomination.label || selectedNomination.name}</span>
                                    <span className="mt-1 text-sm tracking-wide">{selectedNomination.price > 0 ? `¥${selectedNomination.price.toLocaleString()}` : '無料'}</span>
                                </div>
                            )}
                            {selectedOptions.length > 0 && (
                                <div className="flex flex-col pb-4 border-b border-[#E5E5E5] pt-4">
                                    <span className="text-[#777777] text-[10px] tracking-widest mb-1">オプション</span>
                                    {selectedOptions.map(o => (
                                        <div key={o.id} className="flex justify-between items-center mb-1 text-base tracking-widest">
                                            <span>{o.label || o.name}</span>
                                            <span>{o.price > 0 ? `¥${o.price.toLocaleString()}` : '無料'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {selectedDiscount && (
                                <div className="flex flex-col pb-4 border-b border-[#E5E5E5] pt-4">
                                    <span className="text-[#e23c3c] text-[10px] tracking-widest mb-1">割引</span>
                                    <span className="font-normal text-base tracking-widest text-[#e23c3c]">{selectedDiscount.label || selectedDiscount.name}</span>
                                    <span className="mt-1 text-sm tracking-wide text-[#e23c3c]">{selectedDiscount.price !== 0 ? `-¥${Math.abs(selectedDiscount.price).toLocaleString()}` : '無料'}</span>
                                </div>
                            )}
                            <div className="flex flex-col pb-2 pt-4">
                                <span className="text-[#777777] text-[10px] tracking-widest mb-1">合計予定額</span>
                                <span className="mt-1 text-2xl font-normal tracking-wide">
                                    {(()=>{
                                        const cPrice = selectedCourseItem?.price || 0;
                                        const nPrice = selectedNomination?.price || 0;
                                        const oPrice = selectedOptions.reduce((sum, o) => sum + (o.price || 0), 0);
                                        const dPrice = selectedDiscount?.price ? Math.abs(selectedDiscount.price) * -1 : 0;
                                        const total = cPrice + nPrice + oPrice + dPrice;
                                        return `¥${Math.max(0, total).toLocaleString()}`;
                                    })()}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4">
                            <label className="text-sm font-normal tracking-widest flex items-center gap-2">
                                希望連絡時間やその他備考
                            </label>
                            <textarea 
                                className="w-full border border-[#E5E5E5] bg-[#F9F9F9] p-4 text-xs tracking-widest leading-relaxed focus:outline-none focus:border-black transition-colors resize-none"
                                rows={4}
                                placeholder="ご希望の連絡時間帯や、お店へのご要望などをご自由にお書きください。"
                                value={customerNotes}
                                onChange={(e) => setCustomerNotes(e.target.value)}
                            ></textarea>
                        </div>

                        <div className="bg-black p-5 text-[10px] text-white tracking-widest leading-relaxed font-light text-left space-y-3">
                            <p>ご予約いただきありがとうございます。<br/>ご予約につきましては、店舗からの折り返しのご連絡をもちまして「確定」とさせていただきます。</p>
                            <p>誠に恐縮ながら、ご予約は先着順にて承っております。<br/>ご連絡がつく前に他のお客様の予約が確定した場合は、そちらが優先となる場合がございます。<br/>何卒、ご了承いただけますようお願い申し上げます。</p>
                            <p>確認ができ次第、速やかにご連絡差し上げますので今しばらくお待ちくださいませ。</p>
                        </div>
                    </div>
                )}
            </main>

            {errorMsg && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white p-6 shadow-xl max-w-sm w-full text-center space-y-4 border border-[#E5E5E5]">
                        <div className="text-[#E02424] text-xs font-bold tracking-widest pb-3 border-b border-[#E5E5E5]">
                            エラー
                        </div>
                        <p className="text-sm font-normal tracking-widest py-2">{errorMsg}</p>
                        <button 
                            onClick={() => setErrorMsg(null)}
                            className="premium-btn w-full py-3 bg-black text-white text-xs tracking-widest"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            )}

            {showConfirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
                    <div className="bg-white p-6 shadow-xl max-w-sm w-full text-center space-y-5 border border-[#E5E5E5] max-h-[90vh] overflow-y-auto mt-auto mb-auto">
                        <div className="text-black text-sm font-bold tracking-widest pb-3 border-b border-[#E5E5E5]">
                            予約内容の最終確認
                        </div>
                        
                        <div className="text-left text-xs tracking-widest space-y-3 bg-[#F9F9F9] p-4 border border-[#E5E5E5]">
                            <div className="flex justify-between border-b border-[#E5E5E5] pb-2">
                                <span className="text-[#777777]">来店日時</span>
                                <span>{selectedDate ? formatDateStr(selectedDate) : ''} {selectedSlot}</span>
                            </div>
                            <div className="flex justify-between border-b border-[#E5E5E5] pb-2">
                                <span className="text-[#777777]">キャスト</span>
                                <span>{cast?.name}</span>
                            </div>
                            {selectedCourseItem && (
                                <div className="flex justify-between border-b border-[#E5E5E5] pb-2 text-[11px]">
                                    <span className="text-[#777777]">コース</span>
                                    <span>{selectedCourseItem.label || selectedCourseItem.name}</span>
                                </div>
                            )}
                            {selectedNomination && (
                                <div className="flex justify-between border-b border-[#E5E5E5] pb-2 text-[11px]">
                                    <span className="text-[#777777]">指名</span>
                                    <span>{selectedNomination.label || selectedNomination.name}</span>
                                </div>
                            )}
                            {selectedOptions.length > 0 && (
                                <div className="flex flex-col border-b border-[#E5E5E5] pb-2 space-y-1 text-[11px]">
                                    <span className="text-[#777777]">オプション</span>
                                    {selectedOptions.map(o => (
                                        <div key={o.id} className="flex justify-end">
                                            <span>{o.label || o.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {selectedDiscount && (
                                <div className="flex justify-between border-b border-[#E5E5E5] pb-2 text-[#e23c3c] text-[11px]">
                                    <span>割引</span>
                                    <span>{selectedDiscount.label || selectedDiscount.name}</span>
                                </div>
                            )}
                            {customerNotes && (
                                <div className="flex flex-col border-b border-[#E5E5E5] pb-2 space-y-1 text-[11px]">
                                    <span className="text-[#777777]">ご要望・備考</span>
                                    <span className="whitespace-pre-wrap text-left break-words leading-relaxed">{customerNotes}</span>
                                </div>
                            )}
                            <div className="flex justify-between pt-1">
                                <span className="text-[#777777] font-bold">合計予定額</span>
                                <span className="font-bold tracking-widest">
                                    {(()=>{
                                        const cPrice = selectedCourseItem?.price || 0;
                                        const nPrice = selectedNomination?.price || 0;
                                        const oPrice = selectedOptions.reduce((sum, o) => sum + (o.price || 0), 0);
                                        const dPrice = selectedDiscount?.price ? Math.abs(selectedDiscount.price) * -1 : 0;
                                        const total = cPrice + nPrice + oPrice + dPrice;
                                        return `¥${Math.max(0, total).toLocaleString()}`;
                                    })()}
                                </span>
                            </div>
                        </div>

                        <p className="text-[10px] tracking-widest leading-loose py-1">
                            上記の内容で送信します。<br/>よろしいですか？
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isSubmitting}
                                className="premium-btn flex-1 py-3 bg-white text-black border border-[#E5E5E5] text-xs tracking-widest disabled:opacity-50"
                            >
                                キャンセル
                            </button>
                            <button 
                                onClick={() => {
                                    setShowConfirmModal(false);
                                    handleSubmit();
                                }}
                                disabled={isSubmitting}
                                className="premium-btn flex-1 py-3 bg-black text-white border border-black text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    '送信する'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Actions Fixed */}
            <div className="fixed bottom-[80px] left-0 right-0 max-w-md mx-auto p-5 z-40 bg-white/95 backdrop-blur border-t border-[#E5E5E5] shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                {step < 4 ? (
                    <button 
                        onClick={handleNext}
                        disabled={
                            (step === 1 && !selectedDate) || 
                            (step === 3 && !selectedSlot)
                        }
                        className="premium-btn w-full py-4 text-sm tracking-widest disabled:opacity-30 disabled:border-[#E5E5E5]"
                    >
                        次へ進む
                    </button>
                ) : (
                    <button 
                        onClick={() => setShowConfirmModal(true)}
                        className="premium-btn py-4 flex items-center justify-center gap-3 w-full text-sm tracking-widest bg-black text-white hover:bg-white hover:text-black hover:border-black border transition-all">
                        <Check size={18} className="stroke-[1.5]" />
                        予約を確定する
                    </button>
                )}
            </div>
        </div>
    );
}
