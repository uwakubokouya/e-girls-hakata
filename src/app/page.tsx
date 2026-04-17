"use client";
import PostCard from "@/components/feed/PostCard";
import { useState, useEffect } from 'react';
import { useUser } from "@/providers/UserProvider";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MessageSquare, Bell, Lock, ArrowLeft, Heart, X } from "lucide-react";

const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return `たった今`;
    if (diffMins < 60) return `${diffMins}分前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}時間前`;
    return `${Math.floor(diffHours / 24)}日前`;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'official' | 'following' | 'recommended' | 'working'>('official');
  const { user, logout, isLoading: isUserLoading, hasUnreadMessages, hasUnreadNotifications, hasUnreadLikes, markLikesAsRead, markNotificationsAsRead } = useUser();

  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likeMessages, setLikeMessages] = useState<any[]>([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);

  const fetchPosts = async () => {
    setIsLoading(true);
    const { data: postsData } = await supabase
      .from('sns_posts')
      .select(`
        id,
        content,
        images,
        created_at,
        cast_id,
        post_type,
        sns_profiles!cast_id (
          name,
          avatar_url,
          phone,
          is_admin
        )
      `)
      .order('created_at', { ascending: false });

    if (postsData) {
       let followingIds = new Set<string>();
       if (user?.id) {
           const { data: follows } = await supabase
               .from('sns_follows')
               .select('following_id')
               .eq('follower_id', user.id);
           if (follows) {
               follows.forEach(f => followingIds.add(f.following_id));
           }
       }

       // --- 出勤情報（shifts）と空き状況（sales）の連動 ---
       const todayStr = new Date().toLocaleDateString('sv-SE').split('T')[0];
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
               if (row.booked_start && row.booked_end) {
                   availabilityMap.get(row.cast_id).bookings.push({
                       start: row.booked_start,
                       end: row.booked_end
                   });
               }
           });
       }
       
       const { data: castsData } = await supabase.from('casts').select('id, login_id');

       const mappedPosts = postsData.map((post: any) => {
           const isFollowing = user?.id === post.cast_id || followingIds.has(post.cast_id);
           
           const matchedStoreCast = castsData?.find(c => c.login_id === post.sns_profiles?.phone);
           let isWorkingToday = matchedStoreCast ? availabilityMap.has(matchedStoreCast.id) : false;
           
           let slotsLeft = null;
           let nextAvailableTime = null;
           let statusText = null;
           
           if (isWorkingToday && matchedStoreCast) {
               const avail = availabilityMap.get(matchedStoreCast.id);
               
               statusText = "本日出勤中";
               let isAbsent = avail.attendance_status === 'absent';
               
               const now = new Date();
               // Note: Timezone is Japanese local for users, but logic here assumes server/client roughly same
               const currentHour = now.getHours();
               const currentMin = now.getMinutes();
               const currentMinTotal = currentHour * 60 + currentMin;

               if (isAbsent) {
                   statusText = "お休み";
                   isWorkingToday = false; // Hide from standard "Working Today" logic
               } else if (avail.shift_end) {
                   const eParts = avail.shift_end.split(':');
                   let eH = parseInt(eParts[0]);
                   if (eH < 6) eH += 24; // If shift ends at 01:00 am, treat as 25:00
                   const eMin = eH * 60 + parseInt(eParts[1] || '0');
                   const adjCurrentMin = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                   if (adjCurrentMin >= eMin) {
                       statusText = "受付終了";
                       if (avail.next_shift_date) {
                           const d = new Date(avail.next_shift_date);
                           nextAvailableTime = `次回出勤: ${d.getMonth() + 1}/${d.getDate()}`;
                       } else {
                           nextAvailableTime = "次回出勤: 未定";
                       }
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
                       if (avail.next_shift_date) {
                           const dt = new Date(avail.next_shift_date);
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
                   
                   // Slots left logic
                   if (avail.shift_start && avail.shift_end) {
                       const sH = parseInt(avail.shift_start.split(':')[0]);
                       const eH = parseInt(avail.shift_end.split(':')[0]) || 24;
                       const totalSlots = (eH <= sH ? eH + 24 - sH : eH - sH);
                       const bookedCount = avail.bookings.length;
                       slotsLeft = Math.max(0, totalSlots - bookedCount);
                   }
               }
           }
           
           const type = post.post_type || "全員";
           let result = { 
               ...post, 
               isWorkingToday, 
               slotsLeft, 
               nextAvailableTime,
               statusText,
               isFollowing, 
               isLocked: false, 
               lockReason: "" 
           };
           
           if (type === "会員" && !user) {
               result.isLocked = true;
               result.lockReason = "会員限定の投稿です";
           }
           if (type === "フォロワー" && (!user || !followingIds.has(post.cast_id))) {
               result.isLocked = true;
               result.lockReason = "フォロワー限定の投稿です";
           }
           
           return result; 
       });

       setPosts(mappedPosts);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isUserLoading) return;
    fetchPosts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserLoading, user?.id]);

  const handleDeletePost = (id: string) => {
    setPostToDelete(id);
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    const { error } = await supabase.from('sns_posts').delete().eq('id', postToDelete);
    if (error) {
      alert("削除に失敗しました: " + error.message);
    } else {
      setPosts(prev => prev.filter(p => p.id !== postToDelete));
    }
    setPostToDelete(null);
  };

  // フィルタリング
  const getFilteredPosts = () => {
    if (!posts) return [];
    
    if (activeTab === 'official') {
        return posts.filter(p => p.sns_profiles?.is_admin === true);
    }

    if (activeTab === 'following') {
        if (!user) return [];
        return posts.filter(p => p.isFollowing && !p.sns_profiles?.is_admin);
    }
    
    if (activeTab === 'working') {
        return posts.filter(p => p.isWorkingToday);
    }

    return posts;
  };

  const activePosts = getFilteredPosts();

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E5E5E5]">
        <div className="flex px-4 py-4 items-center justify-between">
          <button 
            onClick={() => {
              localStorage.removeItem('age_verified');
              window.location.reload();
            }}
            className="text-xl font-normal tracking-[0.2em] uppercase"
          >
            E-girls博多
          </button>
          <div className="flex items-center gap-4">
             {user?.role !== 'cast' && (
                <>
                  <button 
                     onClick={() => {
                        if (!user) {
                           setShowAuthModal(true);
                           return;
                        }
                        // Open Likes Modal
                        setShowLikesModal(true);
                        setIsLoadingLikes(true);
                        supabase.from('sns_messages')
                           .select('*, sender:sns_profiles!sender_id(*)')
                           .eq('receiver_id', user.id)
                           .like('content', '[SYSTEM_LIKE]%')
                           .order('created_at', { ascending: false })
                           .then(({ data, error }) => {
                               console.log("Likes Modal Fetch:", { data, error, uid: user.id });
                               if (data) setLikeMessages(data);
                               setIsLoadingLikes(false);
                               markLikesAsRead();
                               markNotificationsAsRead();
                           });
                     }}
                     className="relative text-black hover:text-[#777777] transition-colors p-1"
                  >
                     <Bell size={22} className="stroke-[1.5]" />
                     {hasUnreadLikes && (
                       <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#E02424] border-2 border-white rounded-full"></div>
                     )}
                  </button>
                  <Link href="/messages" className="relative text-black hover:text-[#777777] transition-colors p-1">
                     <MessageSquare size={22} className="stroke-[1.5]" />
                     {hasUnreadMessages && (
                       <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#E02424] border-2 border-white rounded-full"></div>
                     )}
                  </Link>
                </>
             )}
            {user ? (
              <button 
                onClick={async () => {
                  await logout();
                  localStorage.removeItem('age_verified');
                  window.location.reload();
                }}
                className="text-[10px] tracking-widest font-medium uppercase border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
              >
                Logout
              </button>
            ) : (
              <Link 
                href="/login" 
                className="text-[10px] tracking-widest font-medium uppercase border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex w-full border-t border-[#E5E5E5]">
          <button 
            onClick={() => setActiveTab('official')} 
            className={`flex-1 flex justify-center py-3 text-xs tracking-widest transition-colors border-r border-[#E5E5E5] relative ${activeTab === 'official' ? 'font-bold text-black bg-[#F9F9F9]' : 'text-[#777777] hover:bg-[#F9F9F9]'}`}
          >
            公式
            {activeTab === 'official' && <div className="absolute top-0 w-full h-[1px] bg-black"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('following')} 
            className={`flex-1 flex justify-center py-3 text-xs tracking-widest transition-colors border-r border-[#E5E5E5] relative ${activeTab === 'following' ? 'font-bold text-black bg-[#F9F9F9]' : 'text-[#777777] hover:bg-[#F9F9F9]'}`}
          >
            フォロー中
            {activeTab === 'following' && <div className="absolute top-0 w-full h-[1px] bg-black"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('recommended')} 
            className={`flex-1 flex justify-center py-3 text-xs tracking-widest transition-colors border-r border-[#E5E5E5] relative ${activeTab === 'recommended' ? 'font-bold text-black bg-[#F9F9F9]' : 'text-[#777777] hover:bg-[#F9F9F9]'}`}
          >
            おすすめ
            {activeTab === 'recommended' && <div className="absolute top-0 w-full h-[1px] bg-black"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('working')} 
            className={`flex-1 flex justify-center py-3 text-xs tracking-widest transition-colors relative ${activeTab === 'working' ? 'font-bold text-black bg-[#F9F9F9]' : 'text-[#777777] hover:bg-[#F9F9F9]'}`}
          >
            本日出勤
            {activeTab === 'working' && <div className="absolute top-0 w-full h-[1px] bg-black"></div>}
          </button>
        </div>
      </header>

        {/* Feed List */}
        <div className="pb-20">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : activePosts.length > 0 ? (
            activePosts.map(post => (
              <PostCard 
                key={post.id} 
                id={post.id}
                castId={post.cast_id}
                castName={post.sns_profiles?.name || "Unknown"}
                castImage={post.sns_profiles?.avatar_url || "/images/no-photo.jpg"}
                timeAgo={getTimeAgo(post.created_at)}
                content={post.content}
                images={post.images || []}
                isWorkingToday={post.isWorkingToday}
                slotsLeft={post.slotsLeft}
                nextAvailableTime={post.nextAvailableTime}
                statusText={post.statusText}
                onDelete={handleDeletePost}
                isLocked={post.isLocked}
                lockReason={post.lockReason}
              />
            ))
          ) : (
            <div className="py-20 text-center text-[#777777]">
              <p className="text-sm font-light tracking-widest">投稿がありません</p>
            </div>
          )}
        </div>
      
      {/* Loader Mock */}
      {activePosts.length > 0 && (
         <div className="py-8 flex justify-center">
            <div className="w-5 h-5 border border-[#E5E5E5] border-t-black rounded-full animate-spin"></div>
         </div>
      )}

      {/* Delete Confirmation Modal */}
      {postToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col items-center">
            <h3 className="text-sm font-bold tracking-widest mb-4 uppercase">Confirm</h3>
            <p className="text-xs text-[#333333] mb-8 text-center bg-[#F9F9F9] p-4 w-full">
              この投稿を完全に削除しますか？<br/>この操作は取り消せません。
            </p>
            <div className="w-full flex gap-3">
              <button 
                onClick={() => setPostToDelete(null)}
                className="flex-1 py-3 bg-[#F9F9F9] border border-[#E5E5E5] text-xs tracking-widest text-[#777777] hover:bg-[#E5E5E5] transition-colors shadow-sm"
              >
                キャンセル
              </button>
              <button 
                onClick={confirmDeletePost}
                className="flex-1 py-3 bg-red-600 text-white text-xs tracking-widest font-medium hover:bg-red-700 transition-colors shadow-sm"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          {/* ... existing modal untouched internally if we just override the wrapper */}
           <div className="absolute top-6 left-6 border border-white/50 bg-white/50 rounded-full z-10">
             <button 
               onClick={() => setShowAuthModal(false)} 
               className="flex items-center justify-center w-10 h-10 text-black hover:bg-black hover:text-white transition-colors rounded-full shadow-sm"
             >
               <ArrowLeft size={16} className="stroke-[2]" />
             </button>
           </div>
           
           <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col items-center shadow-sm">
             <div className="w-12 h-12 border border-black flex items-center justify-center mb-6 text-black">
               <Lock size={20} className="stroke-[1.5]" />
             </div>
             <h3 className="text-sm font-bold tracking-widest mb-2 uppercase text-black">Members Only</h3>
             <p className="text-[10px] text-[#777777] mb-6 tracking-widest">これより先は会員登録が必要です</p>
             
             <div className="w-full bg-[#F9F9F9] border border-[#E5E5E5] p-5 mb-8 text-left space-y-4">
                 <p className="text-[11px] font-bold tracking-widest border-b border-[#E5E5E5] text-black pb-2 mb-4 uppercase">無料会員登録のメリット</p>
                 <div className="flex items-center gap-3 text-xs tracking-widest text-[#333333]">
                    <span className="w-4 h-4 bg-black text-white flex items-center justify-center text-[8px] font-bold shrink-0">1</span>
                    会員・フォロワー限定の<br/>写真・動画が見放題
                 </div>
                 <div className="flex items-center gap-3 text-xs tracking-widest text-[#333333]">
                    <span className="w-4 h-4 bg-black text-white flex items-center justify-center text-[8px] font-bold shrink-0">2</span>
                    お気に入りのキャストと<br/>メッセージでやり取り可能
                 </div>
                 <div className="flex items-center gap-3 text-xs tracking-widest text-[#333333]">
                    <span className="w-4 h-4 bg-black text-white flex items-center justify-center text-[8px] font-bold shrink-0">3</span>
                    予約管理や店舗からの<br/>特別なお知らせを受け取れる
                 </div>
             </div>

             <div className="w-full space-y-3">
               <Link href="/register" className="premium-btn w-full py-4 text-xs tracking-widest flex items-center justify-center bg-black text-white">
                 無料会員登録に進む
               </Link>
               <Link href="/login" className="w-full py-4 flex items-center justify-center text-xs tracking-widest text-[#777777] border border-[#E5E5E5] bg-white hover:bg-[#F9F9F9] transition-colors">
                 ログイン
               </Link>
             </div>
           </div>
        </div>
      )}

      {/* Likes Modal */}
      {showLikesModal && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex flex-col justify-end animate-in fade-in duration-200">
           <div className="bg-white w-full h-[80vh] rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] sticky top-0 bg-white rounded-t-3xl z-10">
                 <div className="w-8"></div>
                 <h2 className="font-bold text-sm tracking-widest flex items-center gap-2"><Heart size={16} className="fill-[#E02424] text-[#E02424]" /> いいね一覧</h2>
                 <button onClick={() => setShowLikesModal(false)} className="p-2 -mr-2 text-black hover:bg-[#F9F9F9] rounded-full transition-colors">
                    <X size={20} className="stroke-[1.5]" />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-[#F9F9F9]">
                 {isLoadingLikes ? (
                    <div className="flex justify-center py-20">
                      <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    </div>
                 ) : likeMessages.length > 0 ? (
                    <div className="space-y-3">
                       {likeMessages.map((msg) => (
                           <Link href={`/cast/${msg.sender_id}`} key={msg.id} className="bg-white p-4 flex gap-4 shadow-sm hover:shadow-md transition-shadow border border-[#E5E5E5]">
                              <div className="w-12 h-12 bg-[#F9F9F9] shrink-0 border border-[#E5E5E5] overflow-hidden">
                                  <img 
                                      src={msg.sender?.avatar_url || "/images/no-photo.jpg"} 
                                      alt="Avatar" 
                                      className="w-full h-full object-cover"
                                  />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-sm text-black tracking-widest truncate">{msg.sender?.name || 'キャスト'}</h4>
                                    <span className="text-[10px] text-[#777777] shrink-0 ml-2">{getTimeAgo(msg.created_at)}</span>
                                 </div>
                                 <p className="text-xs text-[#E02424] tracking-widest leading-relaxed line-clamp-2">
                                     {msg.content.replace('[SYSTEM_LIKE]', '')}
                                 </p>
                              </div>
                           </Link>
                       ))}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-[#777777]">
                        <Heart size={32} className="mb-4 opacity-20" />
                        <p className="text-xs tracking-widest">いいねはまだありません</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
