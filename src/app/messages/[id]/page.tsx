"use client";
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Send, MoreHorizontal, Ban, BellOff, Flag, User as UserIcon, Pencil, Trash2, Heart, Lock, Calendar, X, HelpCircle } from 'lucide-react';
import { useUser } from '@/providers/UserProvider';
import { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export default function MessageRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useUser();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [customName, setCustomName] = useState("");
  const [partnerProfile, setPartnerProfile] = useState<{name: string, avatar_url: string | null, bio?: string, age_group?: string, role?: string} | null>(null);
  const [nextShift, setNextShift] = useState<string | null>(null);
  const [unsendCandidate, setUnsendCandidate] = useState<string | null>(null);

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const reportOptions = [
    "暴言・誹謗中傷",
    "ドタキャン・無断キャンセル",
    "迷惑行為",
    "その他"
  ];

  // Request / Question Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [showPartnerProfile, setShowPartnerProfile] = useState(false);
  const [requestDate, setRequestDate] = useState(() => {
     const tomorrow = new Date();
     tomorrow.setDate(tomorrow.getDate() + 1);
     return tomorrow.toISOString().split('T')[0];
  });
  const [requestTime, setRequestTime] = useState("20:00");
  const [requestCourse, setRequestCourse] = useState("60分コース");
  const [requestRemarks, setRequestRemarks] = useState("");

  // Determine initial name and handle localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(`nickname_${id}`);
        if (saved) setCustomName(saved);
    }
  }, [id]);

  const handleSaveName = () => {
    setIsEditingName(false);
    if (typeof window !== 'undefined' && customName.trim()) {
        localStorage.setItem(`nickname_${id}`, customName.trim());
    } else if (!customName.trim()) {
        const fallback = partnerProfile?.name || "名称未設定";
        setCustomName(fallback);
        if (typeof window !== 'undefined') localStorage.setItem(`nickname_${id}`, fallback);
    }
  };

  // ----- Supabase Integration -----
  useEffect(() => {
    if (!user || !user.id || !id) return;
    
    // URLのidが正しいUUIDフォーマットかチェック（デモ画面から来た場合は取得しないため）
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) return;

    const fetchPartnerProfile = async () => {
       const { data } = await supabase.from('sns_profiles').select('name, avatar_url, bio, age_group, phone, role').eq('id', id).single();
       if (data) {
          setPartnerProfile({ name: data.name, avatar_url: data.avatar_url, bio: data.bio, age_group: data.age_group, role: data.role });
          if (!customName) {
             const saved = localStorage.getItem(`nickname_${id}`);
             setCustomName(saved || data.name || "名称未設定");
          }
          
          if (user?.role !== 'cast') {
             const { data: castData } = await supabase.from('casts').select('id, store_id').eq('login_id', data.phone).maybeSingle();
             if (castData) {
                 const todayStr = new Date().toLocaleDateString('sv-SE').split('T')[0];
                 const { data: availData } = await supabase.rpc('get_public_availability', {
                     p_store_id: castData.store_id,
                     p_date: todayStr
                 }).eq('cast_id', castData.id);
                 
                 let finalStatus = "出勤未定";
                 
                 if (availData && availData.length > 0) {
                     const myAvails = availData;
                     const shift_start = myAvails[0].shift_start;
                     const shift_end = myAvails[0].shift_end;
                     const isAbsent = myAvails[0].attendance_status === 'absent';
                     const bookings = myAvails.filter((a: any) => a.booked_start).map((a: any) => ({
                         start: a.booked_start, end: a.booked_end
                     }));
                     
                     let statusText = "本日出勤中";
                     const now = new Date();
                     const currentHour = now.getHours();
                     const currentMin = now.getMinutes();
                     const currentMinTotal = currentHour * 60 + currentMin;

                     if (isAbsent) {
                         statusText = "お休み";
                     } else if (shift_end) {
                         const eParts = shift_end.split(':');
                         let eH = parseInt(eParts[0]);
                         if (eH < 6) eH += 24;
                         const eMin = eH * 60 + parseInt(eParts[1] || '0');
                         const adjCurrentMin = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                         if (adjCurrentMin >= eMin) {
                             statusText = "受付終了";
                             const next_shift_date = myAvails[0].next_shift_date;
                             if (next_shift_date) {
                                 const d = new Date(next_shift_date);
                                 finalStatus = `次回出勤: ${d.getMonth() + 1}/${d.getDate()}`;
                             } else {
                                 finalStatus = "次回出勤: 未定";
                             }
                         }
                     }
                     
                     if (statusText === "本日出勤中") {
                         let isBookedNow = false;
                         let nextEnd = null;
                         
                         for (const b of bookings) {
                             const bsP = b.start.split(':');
                             const beP = b.end.split(':');
                             let bsH = parseInt(bsP[0]); if(bsH < 6) bsH += 24;
                             let beH = parseInt(beP[0]); if(beH < 6) beH += 24;
                             const bsM = bsH * 60 + parseInt(bsP[1] || '0');
                             const beM = beH * 60 + parseInt(beP[1] || '0');
                             const am = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                             
                             if (am >= bsM && am < beM) {
                                 isBookedNow = true;
                                 nextEnd = b.end;
                             }
                         }
                         if (!isBookedNow) {
                             finalStatus = "本日出勤中 (待機中)";
                         } else {
                             const timeStr = nextEnd || shift_start;
                             finalStatus = `本日出勤中 (次回${timeStr}〜)`;
                         }
                     } else if (statusText === "お休み") {
                         const next_shift_date = myAvails[0].next_shift_date;
                         if (next_shift_date) {
                             const d = new Date(next_shift_date);
                             finalStatus = `次回出勤: ${d.getMonth() + 1}/${d.getDate()}`;
                         } else {
                             finalStatus = "出勤未定";
                         }
                     }
                 } else {
                     const { data: futureShifts } = await supabase.from('shifts')
                          .select('date')
                          .eq('cast_id', castData.id)
                          .gt('date', todayStr)
                          .or('attendance_status.is.null,attendance_status.not.eq.absent')
                          .order('date', { ascending: true })
                          .limit(1);
                     if (futureShifts && futureShifts.length > 0) {
                         const d = new Date(futureShifts[0].date);
                         finalStatus = `次回出勤: ${d.getMonth() + 1}/${d.getDate()}`;
                     }
                 }
                 setNextShift(finalStatus);
             }
          }
       }
    }
    fetchPartnerProfile();

    // 1. Initial Fetch
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('sns_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
        
      if (!error && data) {
         setMessages(data);
         
         // 自分が受信者で未読のものがあれば、すべて既読にアップデートする
         const unreadIds = data.filter(m => m.receiver_id === user.id && !m.is_read).map(m => m.id);
         if (unreadIds.length > 0) {
            await supabase.from('sns_messages').update({ is_read: true }).in('id', unreadIds);
         }
      }
    };
    fetchMessages();

    // 2. Realtime Subscription
    const channel = supabase.channel(`room_${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sns_messages'
      }, payload => {
          const newMsg = payload.new as any;
          if (!newMsg || typeof newMsg !== 'object') return;
          
          // このルームに関係するメッセージのみ処理（送信者か受信者が該当するか）
          if ((newMsg.sender_id === user.id && newMsg.receiver_id === id) || 
              (newMsg.sender_id === id && newMsg.receiver_id === user.id)) {
             
             if (payload.eventType === 'INSERT') {
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });
                // 新規メッセージが相手からの場合、即座に既読状態にする
                if (newMsg.receiver_id === user.id && !newMsg.is_read) {
                   supabase.from('sns_messages').update({ is_read: true }).eq('id', newMsg.id).then();
                }
             } else if (payload.eventType === 'UPDATE') {
                // UPDATE（既読や送信取消）を受け取ったら配列を上書き
                setMessages(prev => prev.map(m => m.id === newMsg.id ? newMsg : m));
             }
          }
      }).subscribe();
      
    return () => {
       supabase.removeChannel(channel);
    };
  }, [user, id]);

  // Scroll to bottom on load or new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || !id) return;
    
    // UUIDチェック
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
        alert("無効なユーザーIDです。デモ版のためメッセージは送信されません。");
        setInputText("");
        return;
    }
    
    const textToSend = inputText;
    setInputText("");
    
    // Insert into DB
    const { data: insertedMsg, error } = await supabase.from('sns_messages').insert({
       sender_id: user.id,
       receiver_id: id,
       content: textToSend,
    }).select().single();
    
    if (error) {
       alert("メッセージの送信に失敗しました");
    } else if (insertedMsg) {
       setMessages(prev => {
           if (prev.some(m => m.id === insertedMsg.id)) return prev;
           return [...prev, insertedMsg];
       });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white font-light relative">
      {/* Unsend Confirmation Modal */}
      {unsendCandidate !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col items-center">
            <h3 className="text-sm font-bold tracking-widest mb-4">送信取消</h3>
            <p className="text-xs text-[#333333] leading-relaxed mb-6 font-light">
              このメッセージの送信を取り消しますか？
            </p>
            
            <div className="w-full flex gap-3">
              <button 
                onClick={() => setUnsendCandidate(null)}
                className="flex-1 py-3 border border-[#E5E5E5] text-xs tracking-widest text-[#777777] hover:bg-[#F9F9F9] transition-colors bg-white"
              >
                キャンセル
              </button>
              <button 
                onClick={async () => {
                  // DBのメッセージを論理削除
                  await supabase.from('sns_messages').update({ is_deleted: true }).eq('id', unsendCandidate);
                  setUnsendCandidate(null);
                }}
                className="flex-1 py-3 bg-black text-white text-xs tracking-widest hover:bg-[#333333] transition-colors"
              >
                取り消す
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E5E5] flex items-center justify-between px-4 py-4">
        <button onClick={() => router.back()} className="text-black hover:text-[#777777] p-2 -ml-2 transition-colors">
          <ChevronLeft size={24} className="stroke-[1.5]" />
        </button>
        <div className="flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
                {isEditingName ? (
                     <input 
                       className="font-medium text-sm tracking-widest bg-transparent border-b border-black outline-none text-center w-28 py-0.5"
                       value={customName}
                       onChange={(e) => setCustomName(e.target.value)}
                       onBlur={handleSaveName}
                       onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                       autoFocus
                     />
                ) : (
                     <span className="font-medium text-sm tracking-widest uppercase">{customName}</span>
                )}
                {user?.role === 'cast' && !isEditingName && (
                   <button onClick={() => setIsEditingName(true)} className="absolute -right-6 text-[#777777] hover:text-black transition-colors p-1">
                      <Pencil size={12} className="stroke-[2]" />
                   </button>
                )}
            </div>
            {user?.role === 'cast' ? (
                <span className="text-[10px] text-[#777777] tracking-widest mt-0.5">お客様</span>
            ) : (
                <span className="text-[10px] text-[#777777] tracking-widest mt-1 inline-block border border-[#E5E5E5] px-2 py-0.5 bg-[#F9F9F9]">
                    {nextShift ? nextShift : "出勤未定"}
                </span>
            )}
        </div>
        <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)} 
              className="text-black hover:text-[#777777] p-2 -mr-2 transition-colors"
            >
              <MoreHorizontal size={18} className="stroke-[1.5]"/>
            </button>

            {showMenu && (
              <>
                {/* Invisible overlay to close menu */}
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-[#E5E5E5] z-50 shadow-[0_4px_20px_rgba(0,0,0,0.05)] animate-in fade-in duration-200">
                   <div className="flex flex-col text-[11px] tracking-widest text-[#333333]">
                      <button onClick={() => setShowMenu(false)} className="flex items-center gap-3 w-full text-left p-4 hover:bg-[#F9F9F9] transition-colors border-b border-[#E5E5E5]">
                         <Ban size={16} className="stroke-[1.5] text-black" />
                         ブロックする
                      </button>
                      <button onClick={() => setShowMenu(false)} className="flex items-center gap-3 w-full text-left p-4 hover:bg-[#F9F9F9] transition-colors border-b border-[#E5E5E5]">
                         <BellOff size={16} className="stroke-[1.5] text-black" />
                         通知をオフにする
                      </button>
                      
                      {user?.role === 'cast' ? (
                        <>
                           <button onClick={() => { setShowMenu(false); setShowPartnerProfile(true); }} className="flex items-center gap-3 w-full text-left p-4 hover:bg-[#F9F9F9] transition-colors border-b border-[#E5E5E5]">
                              <UserIcon size={16} className="stroke-[1.5] text-black" />
                              プロフィールを見る
                           </button>
                           <button onClick={() => { setShowMenu(false); setShowReportModal(true); }} className="flex items-center gap-3 w-full text-left p-4 hover:bg-[#F9F9F9] transition-colors text-red-600">
                              <Flag size={16} className="stroke-[1.5] text-red-600" />
                              通報する / 報告する
                           </button>
                        </>
                      ) : (
                        <>
                           <button 
                             onClick={() => { setShowMenu(false); setShowRequestModal(true); }} 
                             className="flex items-center gap-3 w-full text-left p-4 hover:bg-[#F9F9F9] transition-colors border-b border-[#E5E5E5]"
                           >
                              <Calendar size={16} className="stroke-[1.5] text-black" />
                              出勤リクエストを送る
                           </button>
                           <button 
                             onClick={() => { setShowMenu(false); setShowQuestionModal(true); }} 
                             className="flex items-center gap-3 w-full text-left p-4 hover:bg-[#F9F9F9] transition-colors border-b border-[#E5E5E5]"
                           >
                              <HelpCircle size={16} className="stroke-[1.5] text-black" />
                              質問をする
                           </button>
                           <Link href={`/cast/${id}`} onClick={() => setShowMenu(false)} className="flex items-center gap-3 w-full text-left p-4 hover:bg-[#F9F9F9] transition-colors">
                              <UserIcon size={16} className="stroke-[1.5] text-black" />
                              プロフィールを見る
                           </Link>
                        </>
                      )}
                   </div>
                </div>
              </>
            )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-40 bg-[#F9F9F9] flex flex-col gap-6" ref={scrollRef}>
        <div className="text-center text-[10px] text-[#777777] my-2 tracking-widest">
            今日
        </div>
        
        {messages.filter(msg => !msg.is_deleted && !msg.content?.startsWith('[SYSTEM_LIKE]') && !msg.content?.startsWith('[SYSTEM_ACCEPT]')).map((msg) => {
          const isMe = msg.sender_id === user?.id;
          const timeString = new Date(msg.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          
          return (
            <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className="w-8 h-8 bg-white border border-[#E5E5E5] shrink-0 mr-3 flex items-center justify-center overflow-hidden">
                    <img 
                      src={partnerProfile?.avatar_url || "/images/no-photo.jpg"} 
                      alt="Profile" 
                      className="w-full h-full object-cover" 
                    />
                </div>
              )}
              
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                <div className="flex items-end gap-2">
                    {/* For ME: Read Receipt & Time */}
                    {isMe && (
                       <div className="flex flex-col items-end justify-end mb-1 gap-1.5">
                          {user?.role === 'cast' && (
                             <button 
                                onClick={() => setUnsendCandidate(msg.id)} 
                                className="text-[#CCCCCC] hover:text-[#E02424] transition-colors"
                                title="送信取消"
                             >
                                <Trash2 size={12} className="stroke-[2]" />
                             </button>
                          )}
                          {/* 【重要要件】既読表示はキャスト（role === 'cast'）にのみ表示し、客には表示させない */}
                          {user?.role === 'cast' && msg.is_read && (
                             <span className="text-[9px] text-[#777777] tracking-widest leading-none">既読</span>
                          )}
                          <span className="text-[10px] text-[#777777] tracking-widest leading-none">{timeString}</span>
                       </div>
                    )}
                    
                    {/* Message Bubble (Monochrome & No border radius) */}
                    <div className={`p-3.5 text-xs whitespace-pre-wrap leading-relaxed border ${
                      isMe 
                        ? 'bg-black text-white border-black' 
                        : msg.content?.startsWith('[SYSTEM_LIKE]')
                            ? 'bg-[#FFF0F5] text-[#E02424] border-[#FFC0CB] flex items-center justify-center font-bold tracking-widest'
                            : 'bg-white text-black border-[#E5E5E5]'
                    }`}>
                      {msg.content?.startsWith('[SYSTEM_LIKE]') 
                         ? <><Heart size={14} className="fill-[#E02424] text-[#E02424] mr-2" /> {msg.content.replace('[SYSTEM_LIKE]', '')}</>
                         : msg.content
                      }
                    </div>

                    {/* For PARTNER: Time */}
                    {!isMe && (
                       <span className="text-[10px] text-[#777777] mb-1 tracking-widest leading-none">{timeString}</span>
                    )}
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {/* Input Footer Fixed */}
      <div className="fixed bottom-[83px] left-0 right-0 max-w-md mx-auto bg-white border-t border-[#E5E5E5] p-4 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
         {(() => {
            const hasSystemAccept = messages.some(m => m.content?.startsWith('[SYSTEM_ACCEPT]'));
            const isBronzeAndVip = user?.role === 'customer' && (user.points ?? 0) >= 100 && user.is_vip;
            const isMatch = hasSystemAccept || isBronzeAndVip || partnerProfile?.role === 'store' || partnerProfile?.role === 'system' || user?.role === 'store' || user?.role === 'system';
            
            if (!isMatch) {
               if (user?.role === 'cast') {
                  return (
                      <div className="h-16 flex flex-col items-center justify-center bg-[#F9F9F9] border border-[#E5E5E5] px-4">
                          <button 
                             onClick={async () => {
                                 if (!user || !id) return;
                                 const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
                                 if (!isUuid) return;
                                 
                                 const textToSend = `[SYSTEM_ACCEPT]`;
                                 const { error } = await supabase.from('sns_messages').insert({
                                     sender_id: user.id,
                                     receiver_id: id,
                                     content: textToSend,
                                     is_read: false
                                 });
                                 if (error) console.error("Like error:", error);
                             }}
                             className="w-full flex items-center justify-center gap-2 bg-black text-white text-[11px] font-bold tracking-widest py-3 hover:bg-black/80 transition-colors"
                          >
                             <Heart size={14} className="stroke-[2]" />
                             承認してメッセージ機能を開放する
                          </button>
                      </div>
                  );
               }

               return (
                  <div className="h-12 flex flex-col items-center justify-center bg-[#F9F9F9] border border-[#E5E5E5]">
                     <div className="flex items-center gap-1.5 text-[#777777]">
                        <Lock size={12} className="stroke-[1.5]" />
                        <span className="text-[10px] tracking-widest font-bold">
                           キャストからの承認を待っています...
                        </span>
                     </div>
                  </div>
               );
            }

            return (
               <form onSubmit={handleSend} className="flex gap-2 items-center">
                  <input 
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="メッセージを入力..."
                    className="flex-1 h-12 bg-[#F9F9F9] border border-[#E5E5E5] px-4 text-sm font-light outline-none rounded-none focus:border-black transition-colors"
                  />
                  <button 
                    type="submit" 
                    disabled={!inputText.trim()}
                    className="h-12 w-12 flex items-center justify-center bg-black text-white disabled:bg-[#E5E5E5] disabled:text-[#777777] transition-colors rounded-none"
                  >
                    <Send size={18} className="stroke-[1.5] -ml-1" />
                  </button>
               </form>
            );
         })()}
      </div>

      {/* Shift Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col relative shadow-sm">
             <button 
               onClick={() => setShowRequestModal(false)}
               className="absolute top-4 right-4 text-black hover:text-[#777777] transition-colors"
             >
               <X size={20} className="stroke-[1.5]" />
             </button>
             
             <div className="flex items-center justify-center mb-6">
                <div className="w-10 h-10 border border-black flex items-center justify-center text-black">
                   <Calendar size={18} className="stroke-[1.5]" />
                </div>
             </div>
             
             <h3 className="text-sm font-bold tracking-widest mb-6 uppercase text-center text-black border-b border-[#E5E5E5] pb-4">
               出勤リクエスト
             </h3>
             
             <div className="space-y-5 mb-8">
                <div className="space-y-2">
                   <label className="text-[10px] uppercase tracking-widest text-[#777777]">Date (希望日)</label>
                   <input 
                     type="date" 
                     value={requestDate}
                     onChange={e => setRequestDate(e.target.value)}
                     className="w-full border-b border-[#E5E5E5] pb-2 text-sm outline-none focus:border-black transition-colors bg-transparent rounded-none"
                     min={new Date().toISOString().split('T')[0]}
                   />
                </div>
                
                <div className="space-y-2">
                   <label className="text-[10px] uppercase tracking-widest text-[#777777]">Time (開始時間)</label>
                   <select 
                     value={requestTime}
                     onChange={e => setRequestTime(e.target.value)}
                     className="w-full border-b border-[#E5E5E5] pb-2 text-sm outline-none focus:border-black transition-colors bg-transparent rounded-none cursor-pointer"
                   >
                     {Array.from({length: 24}, (_, i) => {
                        const hour = Math.floor(i / 2) + 18;
                        const minute = i % 2 === 0 ? '00' : '30';
                        const h = hour >= 24 ? hour - 24 : hour;
                        const display = `${h.toString().padStart(2, '0')}:${minute}`;
                        return <option key={display} value={display}>{display}</option>;
                     })}
                   </select>
                </div>
                
                <div className="space-y-2">
                   <label className="text-[10px] uppercase tracking-widest text-[#777777]">Course (コース)</label>
                   <select 
                     value={requestCourse}
                     onChange={e => setRequestCourse(e.target.value)}
                     className="w-full border-b border-[#E5E5E5] pb-2 text-sm outline-none focus:border-black transition-colors bg-transparent rounded-none cursor-pointer"
                   >
                     <option value="60分コース">60分コース</option>
                     <option value="90分コース">90分コース</option>
                     <option value="120分コース">120分コース</option>
                     <option value="フリータイム">フリータイム</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] uppercase tracking-widest text-[#777777]">Remarks (備考)</label>
                   <textarea 
                     value={requestRemarks}
                     onChange={e => setRequestRemarks(e.target.value)}
                     placeholder="ご要望や質問があればご記入ください..."
                     className="w-full border-b border-[#E5E5E5] pb-2 pt-2 min-h-[80px] text-sm outline-none focus:border-black transition-colors bg-transparent rounded-none resize-none leading-relaxed"
                   />
                </div>
             </div>
             
             <button 
               onClick={async () => {
                  if (!user || !id) return;
                  const formattedDate = new Date(requestDate).toLocaleDateString('ja-JP');
                  let textToSend = `【出勤リクエスト】\n希望日: ${formattedDate}\n開始時間: ${requestTime}〜\n希望コース: ${requestCourse}`;
                  if (requestRemarks.trim()) {
                      textToSend += `\n備考: ${requestRemarks.trim()}`;
                  }
                  
                  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
                  if (!isUuid) {
                      alert("無効なユーザーIDです。デモ版のためメッセージは送信されません。");
                      setShowRequestModal(false);
                      return;
                  }

                  const { error } = await supabase.from('sns_messages').insert({
                      sender_id: user.id,
                      receiver_id: id,
                      content: textToSend,
                      is_read: false
                  });

                  if (!error) {
                      setShowRequestModal(false);
                  } else {
                      console.error("Shift request error:", error);
                      alert("リクエストの送信に失敗しました。");
                  }
               }}
               disabled={!requestDate}
               className="premium-btn w-full py-4 text-xs tracking-widest flex items-center justify-center bg-black text-white hover:bg-black/80 transition-colors disabled:opacity-50"
             >
               リクエストを送信する
             </button>
           </div>
        </div>
      )}

      {/* Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col relative shadow-sm">
             <button 
               onClick={() => setShowQuestionModal(false)}
               className="absolute top-4 right-4 text-black hover:text-[#777777] transition-colors"
             >
               <X size={20} className="stroke-[1.5]" />
             </button>
             
             <div className="flex items-center justify-center mb-6">
                <div className="w-10 h-10 border border-black flex items-center justify-center text-black">
                   <HelpCircle size={18} className="stroke-[1.5]" />
                </div>
             </div>
             
             <h3 className="text-sm font-bold tracking-widest mb-4 uppercase text-center text-black border-b border-[#E5E5E5] pb-4">
               質問をする
             </h3>
             <p className="text-[10px] text-[#777777] tracking-widest leading-relaxed mb-6 text-center">
               承認前でもキャストに質問を送ることができます。<br />
               <span className="text-[#E02424]">内容は運営確認後女性に送信されます。内容によって未承認となる場合が御座います。その際の通知等は御座いませんのでご了承下さいませ。</span>
             </p>
             
             <div className="space-y-5 mb-8">
                <div className="space-y-2">
                   <textarea 
                     value={questionText}
                     onChange={e => setQuestionText(e.target.value)}
                     placeholder="質問を入力してください..."
                     className="w-full border-b border-[#E5E5E5] pb-2 pt-2 min-h-[100px] text-sm outline-none focus:border-black transition-colors bg-transparent rounded-none resize-none leading-relaxed"
                   />
                </div>
             </div>
             
             <button 
               onClick={async () => {
                  if (!user || !id || !questionText.trim()) return;
                  const textToSend = `【質問】\n${questionText.trim()}`;
                  
                  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
                  if (!isUuid) {
                      alert("無効なユーザーIDです。デモ版のためメッセージは送信されません。");
                      setShowQuestionModal(false);
                      return;
                  }

                  const { error } = await supabase.from('sns_messages').insert({
                      sender_id: user.id,
                      receiver_id: id,
                      content: textToSend,
                      is_read: false
                  });

                  if (!error) {
                      setShowQuestionModal(false);
                      setQuestionText("");
                  } else {
                      alert("質問の送信に失敗しました。");
                  }
               }}
               disabled={!questionText.trim()}
               className="premium-btn w-full py-4 text-xs tracking-widest flex items-center justify-center bg-black text-white hover:bg-black/80 transition-colors disabled:opacity-50"
             >
               質問を送信する
             </button>
           </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col relative shadow-sm">
             <button 
               onClick={() => setShowReportModal(false)}
               className="absolute top-4 right-4 text-black hover:text-[#777777] transition-colors"
             >
               <X size={20} className="stroke-[1.5]" />
             </button>
             
             <div className="flex items-center justify-center mb-6">
                <div className="w-10 h-10 border border-[#E02424] flex items-center justify-center text-[#E02424]">
                   <Flag size={18} className="stroke-[1.5]" />
                </div>
             </div>
             
             <h3 className="text-sm font-bold tracking-widest mb-4 uppercase text-center text-black border-b border-[#E5E5E5] pb-4">
               通報・報告する
             </h3>
             <p className="text-[10px] text-[#777777] tracking-widest leading-relaxed mb-6 text-center">
               運営に通報を送信します。<br />
               対象ユーザーの通報回数が加算され、運営が悪質と判断した場合はアカウント停止措置等を行います。
             </p>
             
             <div className="space-y-5 mb-8">
                <div className="space-y-3">
                   <label className="text-[10px] uppercase tracking-widest text-[#777777] block mb-2">Category (理由)</label>
                   {reportOptions.map(opt => (
                     <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                       <div className="relative flex items-center justify-center">
                         <input 
                           type="radio" 
                           name="report_category"
                           value={opt}
                           checked={reportCategory === opt}
                           onChange={(e) => setReportCategory(e.target.value)}
                           className="peer appearance-none w-4 h-4 border border-black checked:bg-black transition-colors cursor-pointer rounded-full"
                         />
                         <div className="absolute w-1.5 h-1.5 bg-white rounded-full opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"></div>
                       </div>
                       <span className="text-xs tracking-widest text-[#333333] group-hover:text-black transition-colors">{opt}</span>
                     </label>
                   ))}
                </div>
                
                <div className="space-y-2 pt-4 border-t border-[#E5E5E5]">
                   <label className="text-[10px] uppercase tracking-widest text-[#777777] block">Details (詳細)</label>
                   <textarea 
                     value={reportDetails}
                     onChange={e => setReportDetails(e.target.value)}
                     placeholder="詳細な理由をご記入ください..."
                     className="w-full border-b border-[#E5E5E5] pb-2 pt-2 min-h-[80px] text-sm outline-none focus:border-black transition-colors bg-transparent rounded-none resize-none leading-relaxed"
                   />
                </div>
             </div>
             
             <button 
               onClick={async () => {
                  if (!user || !id || !reportCategory) return;
                  const finalReason = `${reportCategory}
詳細: ${reportDetails.trim() || 'なし'}`;
                  
                  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
                  if (!isUuid) {
                      alert("無効なユーザーIDです。");
                      setShowReportModal(false);
                      return;
                  }

                  // RPC呼び出し
                  const { error } = await supabase.rpc('report_user', {
                      p_target_id: id,
                      p_reporter_id: user.id,
                      p_reason: finalReason
                  });

                  if (!error) {
                      alert("通報を受け付けました。運営にて確認いたします。");
                      setShowReportModal(false);
                      setReportCategory("");
                      setReportDetails("");
                  } else {
                      alert("通報の送信に失敗しました。");
                      console.error("Report error:", error);
                  }
               }}
               disabled={!reportCategory}
               className="premium-btn w-full py-4 text-xs tracking-widest flex items-center justify-center bg-[#E02424] text-white hover:bg-[#C81E1E] transition-colors disabled:opacity-50 disabled:bg-[#E5E5E5] disabled:text-[#777777]"
             >
               通報を送信する
             </button>
           </div>
        </div>
      )}

      {/* Partner Profile Modal */}
      {showPartnerProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowPartnerProfile(false)}>
           <div className="bg-white w-full max-w-sm p-8 border border-[#E5E5E5] flex flex-col relative shadow-sm" onClick={e => e.stopPropagation()}>
             <button 
               onClick={() => setShowPartnerProfile(false)}
               className="absolute top-4 right-4 text-[#777777] hover:text-black transition-colors"
             >
               <X size={20} className="stroke-[1.5]" />
             </button>

             <div className="flex flex-col items-center">
                 <div className="w-20 h-20 border border-black p-0.5 overflow-hidden mb-4">
                   {partnerProfile?.avatar_url ? (
                      <img src={partnerProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                   ) : (
                      <div className="w-full h-full bg-[#F9F9F9] flex items-center justify-center text-[#777777]">
                        <UserIcon size={24} className="stroke-[1.5]" />
                      </div>
                   )}
                 </div>
                 
                 <h3 className="text-base tracking-widest font-bold text-black uppercase mb-1">
                   {partnerProfile?.name || "名称未設定"}
                 </h3>
                 <span className="text-[10px] tracking-widest bg-black text-white px-2 py-0.5 mb-6">
                   {partnerProfile?.age_group || "年代未設定"}
                 </span>

                 <div className="w-full space-y-2 mt-2 border-t border-[#E5E5E5] pt-6 text-left">
                    <label className="text-[10px] uppercase tracking-widest text-[#777777] font-bold">Bio (自己紹介)</label>
                    <p className="text-xs text-[#333333] tracking-widest leading-relaxed whitespace-pre-wrap min-h-[60px]">
                      {partnerProfile?.bio || "自己紹介文はまだ登録されていません。"}
                    </p>
                 </div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
