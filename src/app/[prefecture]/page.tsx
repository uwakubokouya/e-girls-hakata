"use client";
import PostCard from "@/components/feed/PostCard";
import AdminHomeContent from "@/components/admin/AdminHomeContent";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from "@/providers/UserProvider";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MessageSquare, Bell, Lock, ArrowLeft, Heart, X } from "lucide-react";
import { fetchBusinessEndTime, getLogicalBusinessDate, getAdjustedMinutes, getAdjustedNowMins } from "@/utils/businessTime";

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
  const params = useParams();
  const prefecture = params.prefecture ? decodeURIComponent(params.prefecture as string) : "";
  const router = useRouter();

  // 「全国」エリアを廃止し、アクセスされた場合はトップ（エリア選択）へリダイレクト
  useEffect(() => {
    if (prefecture === '全国') {
      router.replace('/');
    }
  }, [prefecture, router]);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(`home_tab_${prefecture}`);
      if (saved && ['official', 'following', 'recommended', 'working', 'summary', 'admin_posts'].includes(saved)) {
        return saved;
      }
    }
    return 'official';
  });

  // Remove the useEffect that was overriding it on mount since we now do it synchronously
  useEffect(() => {
    if (activeTab) {
      sessionStorage.setItem(`home_tab_${prefecture}`, activeTab);
    }
  }, [activeTab, prefecture]);

  const { user, logout, isLoading: isUserLoading, hasUnreadMessages, hasUnreadNotifications, hasUnreadLikes, markLikesAsRead, markNotificationsAsRead, isTestMode } = useUser();

  // テストモード中の強制リダイレクト
  useEffect(() => {
    if (isTestMode && prefecture !== '福岡') {
      router.replace('/福岡');
    }
  }, [isTestMode, prefecture, router]);
  useEffect(() => { if ((user?.role === 'system' || user?.role === 'admin') && ['official', 'following', 'recommended', 'working'].includes(activeTab)) { setActiveTab('summary'); } }, [user, activeTab]);

  useEffect(() => {
    const trackPV = async () => {
      const TRACK_KEY = 'last_pv_home';
      const lastTracked = sessionStorage.getItem(TRACK_KEY);
      const now = Date.now();
      
      if (user?.role === 'cast' || user?.role === 'store' || user?.role === 'system' || user?.role === 'admin') return;
      
      // Track once per hour per session (3600000ms)
      if (!lastTracked || now - parseInt(lastTracked) > 3600000) {
          sessionStorage.setItem(TRACK_KEY, now.toString());
          try {
              let sessionObj = localStorage.getItem('anon_session_id');
              if (!sessionObj) {
                  sessionObj = 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                  localStorage.setItem('anon_session_id', sessionObj);
              }
              await supabase.from('page_views').insert({
                  page_type: 'home',
                  viewer_id: user?.id || null,
                  session_id: sessionObj
              });
          } catch(e) { console.error('PV tracking error', e); }
      }
    };
    if (!isUserLoading) trackPV();
  }, [user, isUserLoading]);

  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likeMessages, setLikeMessages] = useState<any[]>([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);

  // Pagination states
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const POSTS_PER_PAGE = 30;

  const fetchPosts = async (pageNum = 0, isLoadMore = false) => {
    if (isLoadMore) {
        setIsFetchingMore(true);
    } else {
        setIsLoading(true);
    }

    let storeProfilesQuery = supabase
      .from('profiles')
      .select('id, store_id, username, full_name')
      .eq('sns_enabled', true)
      .eq('role', 'admin');

    if (prefecture && prefecture !== '全国') {
      storeProfilesQuery = storeProfilesQuery.ilike('prefecture', `${prefecture}%`);
    }

    const { data: storeProfiles } = await storeProfilesQuery;

    if (!storeProfiles || storeProfiles.length === 0) {
      setPosts([]);
      setIsLoading(false);
      return;
    }
    const storeIds = storeProfiles.map(p => p.store_id).filter(Boolean);
    const storeUsernames = storeProfiles.map(p => p.username).filter(Boolean);

    const { data: snsStoreProfiles } = await supabase
      .from('sns_profiles')
      .select('id, name, phone')
      .in('phone', storeUsernames);
      
    const { data: platformAdmins } = await supabase
      .from('sns_profiles')
      .select('id')
      .in('role', ['admin', 'system']);
    const platformAdminIds = platformAdmins ? platformAdmins.map(a => a.id) : [];

    const storeProfileMap = new Map();
    storeProfiles.forEach(p => {
        storeProfileMap.set(p.store_id, p);
    });

    const snsStoreMap = new Map();
    if (snsStoreProfiles) {
        snsStoreProfiles.forEach(p => {
            if (p.phone) snsStoreMap.set(p.phone, { id: p.id, name: p.name });
        });
    }
    
    const storeAccountIds = snsStoreProfiles ? snsStoreProfiles.map(p => p.id) : [];
    
    const { data: fetchedCasts } = await supabase
      .from('casts')
      .select('id, login_id, store_id')
      .in('store_id', storeIds)
      .eq('status', 'active');
      
    let activeCasts = fetchedCasts || [];
    let loginIds = activeCasts.map(c => c.login_id).filter(Boolean);

    let myStoreLoginIds: string[] = [];
    if (user?.role === 'store' && user.phone) {
        let myProfile = storeProfiles.find(p => p.username === user.phone);
        let myStoreId = myProfile?.store_id;

        if (!myStoreId) {
            const { data: dbProfile } = await supabase
                .from('profiles')
                .select('store_id')
                .eq('username', user.phone)
                .eq('role', 'admin')
                .maybeSingle();
            if (dbProfile?.store_id) {
                myStoreId = dbProfile.store_id;
            }
        }

        if (myStoreId) {
            const { data: myCasts } = await supabase
                .from('casts')
                .select('id, login_id, store_id')
                .eq('store_id', myStoreId)
                .eq('status', 'active');
            
            if (myCasts) {
                myStoreLoginIds = myCasts.map(c => c.login_id).filter(Boolean);
                myCasts.forEach(c => {
                    if (c.login_id && !loginIds.includes(c.login_id)) {
                        loginIds.push(c.login_id);
                    }
                    if (!activeCasts.find(ac => ac.id === c.id)) {
                        activeCasts.push(c);
                    }
                });
            }
        }
    }

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

    const now = new Date();
    const businessEndTime = await fetchBusinessEndTime(supabase);
    const todayStr = getLogicalBusinessDate(now, businessEndTime.hour, businessEndTime.min);

    let workingCastLoginIds: string[] = [];
    if (activeTab === 'working') {
        const shiftPromises = storeIds.map(sid => 
            supabase.rpc('get_public_availability', { p_store_id: sid, p_date: todayStr })
        );
        const shiftResults = await Promise.all(shiftPromises);
        let workingCastIds = new Set();
        shiftResults.forEach(({ data }) => {
            if (data) {
                data.forEach((s: any) => {
                    if (s.attendance_status && s.attendance_status !== 'absent') workingCastIds.add(s.cast_id);
                });
            }
        });
        workingCastLoginIds = activeCasts
            ? activeCasts.filter(c => workingCastIds.has(c.id)).map(c => c.login_id).filter(Boolean)
            : [];
    }

    let query = supabase.from('sns_profiles').select('id, phone');
    let orFilters = [];
    if (loginIds.length > 0) {
        orFilters.push(`phone.in.(${loginIds.join(',')})`);
    }
    
    if (storeAccountIds.length > 0) {
        orFilters.push(`id.in.(${storeAccountIds.join(',')})`);
    }

    if (followingIds.size > 0) {
        orFilters.push(`id.in.(${Array.from(followingIds).join(',')})`);
    }

    if (platformAdminIds.length > 0) {
        orFilters.push(`id.in.(${platformAdminIds.join(',')})`);
    }

    let profilesData: any[] = [];
    if (orFilters.length > 0) {
        query = query.or(orFilters.join(','));
        const result = await query;
        profilesData = result.data || [];
    }

    let targetSnsIds: string[] = [];

    if (user?.role === 'store') {
        if (activeTab === 'official') {
            targetSnsIds = profilesData
                .filter(p => platformAdminIds.includes(p.id) || p.id === user.id)
                .map(p => p.id);
        } else if (activeTab === 'following') {
            targetSnsIds = profilesData
                .filter(p => p.phone && myStoreLoginIds.includes(p.phone))
                .map(p => p.id);
        } else if (activeTab === 'working') {
            targetSnsIds = profilesData
                .filter(p => p.phone && myStoreLoginIds.includes(p.phone) && workingCastLoginIds.includes(p.phone))
                .map(p => p.id);
        }
    } else {
        if (activeTab === 'official') {
            targetSnsIds = profilesData.filter(p => storeAccountIds.includes(p.id) || platformAdminIds.includes(p.id)).map(p => p.id);
        } else if (activeTab === 'following') {
            targetSnsIds = profilesData.filter(p => followingIds.has(p.id)).map(p => p.id);
        } else if (activeTab === 'working') {
            targetSnsIds = profilesData.filter(p => !storeAccountIds.includes(p.id) && !platformAdminIds.includes(p.id) && p.phone && workingCastLoginIds.includes(p.phone)).map(p => p.id);
        } else {
            targetSnsIds = profilesData.filter(p => !storeAccountIds.includes(p.id) && !platformAdminIds.includes(p.id)).map(p => p.id);
        }
    }

    if (targetSnsIds.length === 0) {
      if (!isLoadMore) setPosts([]);
      setIsLoading(false);
      setIsFetchingMore(false);
      setHasMore(false);
      return;
    }

    const from = pageNum * POSTS_PER_PAGE;
    const to = from + POSTS_PER_PAGE - 1;

    const { data: postsData } = await supabase
      .from('sns_posts')
      .select(`
        id,
        content,
        images,
        created_at,
        cast_id,
        post_type,
        sns_profiles!cast_id!inner (
          name,
          avatar_url,
          phone,
          role
        )
      `)
      .in('cast_id', targetSnsIds)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (postsData) {
       const uniqueCastLogins = [...new Set(postsData.map((p: any) => p.sns_profiles?.phone).filter(Boolean))];
       const castsForPosts = activeCasts?.filter((c: any) => uniqueCastLogins.includes(c.login_id)) || [];
       const castIdsForPosts = castsForPosts.map((c: any) => c.id);

       let availabilityData: any[] = [];
       
       if (castIdsForPosts.length > 0) {
           const uniqueStoreIds = [...new Set(castsForPosts.map((c: any) => c.store_id).filter(Boolean))];
           const shiftPromises = uniqueStoreIds.map(sid => 
               supabase.rpc('get_public_availability', { p_store_id: sid as string, p_date: todayStr })
           );
           const shiftResults = await Promise.all(shiftPromises);
           shiftResults.forEach(({ data }) => {
               if (data) {
                   availabilityData = [...availabilityData, ...data];
               }
           });
       }

       const availabilityMap = new Map();
       castsForPosts.forEach((c: any) => {
           const myAvails = availabilityData.filter((a: any) => a.cast_id === c.id);
           if (myAvails.length > 0) {
               const bookings = myAvails.filter((a: any) => a.booked_start).map((a: any) => ({ start: a.booked_start, end: a.booked_end }));
               availabilityMap.set(c.id, {
                   shift_start: myAvails[0].shift_start,
                   shift_end: myAvails[0].shift_end,
                   attendance_status: myAvails[0].attendance_status,
                   next_shift_date: myAvails[0].next_shift_date,
                   bookings
               });
           }
       });

       const { data: adminProfile } = await supabase.from('sns_profiles').select('id, name').in('role', ['system', 'admin']).limit(1).maybeSingle();

       const mappedPosts = postsData.map((post: any) => {
           const isFollowing = user?.id === post.cast_id || followingIds.has(post.cast_id);
           const isMyStoreCast = user?.role === 'store' && myStoreLoginIds.includes(post.sns_profiles?.phone);
           
           const matchedStoreCast = activeCasts?.find((c: any) => c.login_id === post.sns_profiles?.phone);
           let isWorkingToday = matchedStoreCast ? availabilityMap.has(matchedStoreCast.id) : false;
           
           let slotsLeft = null;
           let nextAvailableTime = null;
           let statusText = null;
           
           if (isWorkingToday && matchedStoreCast) {
               const avail = availabilityMap.get(matchedStoreCast.id);
               
               statusText = "本日出勤中";
               let isAbsent = avail.attendance_status === 'absent';
               
               if (isAbsent) {
                   statusText = "お休み";
                   isWorkingToday = false;
               } else if (avail.shift_end) {
                   const eMin = getAdjustedMinutes(avail.shift_end, businessEndTime.hour);
                   const adjCurrentMin = getAdjustedNowMins(now, businessEndTime.hour);
                   if (adjCurrentMin >= eMin) {
                        statusText = "受付終了";
                        if (avail.next_shift_date) {
                            const dt = new Date(avail.next_shift_date);
                            nextAvailableTime = `次回出勤: ${dt.getMonth() + 1}/${dt.getDate()}`;
                        } else {
                            nextAvailableTime = "次回出勤: 未定";
                        }
                    }
               }
               
               if (statusText === "本日出勤中") {
                   const ssM = getAdjustedMinutes(avail.shift_start, businessEndTime.hour);
                   const seM = getAdjustedMinutes(avail.shift_end, businessEndTime.hour);
                   const am = getAdjustedNowMins(now, businessEndTime.hour);
                   
                   let cursorM = Math.max(am, ssM);
                   
                   const parsedBookings = avail.bookings.map((b: any) => {
                       return {
                           startM: getAdjustedMinutes(b.start, businessEndTime.hour),
                           endM: getAdjustedMinutes(b.end, businessEndTime.hour) + 10
                       };
                   }).sort((a: any, b: any) => a.startM - b.startM);

                   const MIN_GAP = 50;
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
                   }

                   if (cursorM + MIN_GAP > seM) {
                       if (am >= seM) { statusText = "受付終了"; } else { statusText = "ご予約完売"; }
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
            const isStore = storeAccountIds.includes(post.cast_id) || platformAdminIds.includes(post.cast_id);
            
            let currentStoreName = adminProfile?.name || "公式";
            let currentStoreProfileId = adminProfile?.id;

            if (isStore) {
                currentStoreName = post.sns_profiles?.name || "公式";
                currentStoreProfileId = post.cast_id;
            } else if (matchedStoreCast) {
                const sId = matchedStoreCast.store_id;
                const storeProfile = storeProfileMap.get(sId);
                
                if (storeProfile) {
                    currentStoreName = storeProfile.full_name || storeProfile.username || "公式";
                    if (snsStoreMap.has(storeProfile.username)) {
                        currentStoreProfileId = snsStoreMap.get(storeProfile.username).id;
                    } else {
                        currentStoreProfileId = storeProfile.id; 
                    }
                }
            }

            let result = { 
                 ...post, 
                 isWorkingToday, 
                 slotsLeft, 
                 nextAvailableTime,
                 statusText,
                 isFollowing, 
                 isLocked: false, 
                 lockReason: "",
                 isStore,
                 isMyStoreCast,
                 isPlatformAdmin: platformAdminIds.includes(post.cast_id),
                 storeName: currentStoreName,
                 storeProfileId: currentStoreProfileId
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

       if (postsData.length < POSTS_PER_PAGE) {
           setHasMore(false);
       } else {
           setHasMore(true);
       }

       if (isLoadMore) {
           setPosts(prev => {
               const existingIds = new Set(prev.map(p => p.id));
               const newPosts = mappedPosts.filter(p => !existingIds.has(p.id));
               return [...prev, ...newPosts];
           });
       } else {
           setPosts(mappedPosts);
       }
    } else {
       setHasMore(false);
       if (!isLoadMore) setPosts([]);
    }
    
    setIsLoading(false);
    setIsFetchingMore(false);
  };

  useEffect(() => {
    if (isUserLoading) return;
    setPage(0);
    setHasMore(true);
    fetchPosts(0, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserLoading, user?.id, activeTab]);

  // 無限スクロールの検知用Ref
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const observer = new IntersectionObserver(
          entries => {
              if (entries[0].isIntersecting && hasMore && !isFetchingMore && !isLoading) {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  fetchPosts(nextPage, true);
              }
          },
          { threshold: 0.1 }
      );

      if (observerTarget.current) {
          observer.observe(observerTarget.current);
      }

      return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isFetchingMore, isLoading, page]);

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

    // フィルタリングはサーバー側（fetchPosts）で完了しているためそのまま返す
  const activePosts = posts || [];

  useEffect(() => {
      if (!isLoading && !isFetchingMore && hasMore && activePosts.length < 5) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchPosts(nextPage, true);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePosts.length, isLoading, isFetchingMore, hasMore, page]);

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E5E5]">
        <div className="flex px-4 py-4 items-center justify-between">
          <div className="flex flex-col items-center gap-1">
            <button 
              onClick={() => {
                localStorage.removeItem('age_verified');
                window.location.reload();
              }}
              className="block"
            >
              <img src="/images/logo2.png" alt="HimeMatch" className="h-16 object-contain" />
            </button>
            <div className="flex items-center gap-2">
              {(!user || user?.role === 'customer') && (
                <>
                  <span className="text-[10px] tracking-widest text-black font-bold bg-[#F9F9F9] border border-[#E5E5E5] px-2 py-0.5">
                    {prefecture || "総合"}エリア
                  </span>
                  {!isTestMode && (
                  <Link 
                    href="/"
                    className="text-[10px] tracking-widest text-[#777777] hover:text-black border border-[#E5E5E5] hover:border-black px-2 py-0.5 transition-colors"
                  >
                    エリア変更
                  </Link>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
             {(!user || user?.role === 'customer') && (
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
        
        {/* Test Mode Badge */}
        {isTestMode && user?.role === 'system' && (
          <div className="w-full bg-[#E02424] text-white text-center text-[10px] py-1 font-bold tracking-widest">
            ※現在福岡限定のテスト運用中です
          </div>
        )}

        {/* Tabs */}
        <div className="flex w-full border-t border-[#E5E5E5]">
          {(user?.role === 'system' || user?.role === 'admin') ? (
            <>
              {[
                { id: 'summary', label: 'サマリー' },
                { id: 'users', label: '顧客管理' },
                { id: 'moderation', label: '監視' },
                { id: 'settings', label: '設定' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex justify-center py-3 text-xs tracking-widest transition-colors border-r border-[#E5E5E5] relative ${activeTab === tab.id ? 'font-bold text-black bg-[#F9F9F9]' : 'text-[#777777] hover:bg-[#F9F9F9]'}`}
                >
                  {tab.label}
                  {activeTab === tab.id && <div className="absolute top-0 w-full h-[1px] bg-black"></div>}
                </button>
              ))}
            </>
          ) : (
            <>
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
            {user?.role === 'store' ? 'マイ店舗' : 'フォロー中'}
            {activeTab === 'following' && <div className="absolute top-0 w-full h-[1px] bg-black"></div>}
          </button>
          {user?.role !== 'store' && (
            <button 
              onClick={() => setActiveTab('recommended')} 
              className={`flex-1 flex justify-center py-3 text-xs tracking-widest transition-colors border-r border-[#E5E5E5] relative ${activeTab === 'recommended' ? 'font-bold text-black bg-[#F9F9F9]' : 'text-[#777777] hover:bg-[#F9F9F9]'}`}
            >
              おすすめ
              {activeTab === 'recommended' && <div className="absolute top-0 w-full h-[1px] bg-black"></div>}
            </button>
          )}
          <button 
            onClick={() => setActiveTab('working')} 
            className={`flex-1 flex justify-center py-3 text-xs tracking-widest transition-colors relative ${activeTab === 'working' ? 'font-bold text-black bg-[#F9F9F9]' : 'text-[#777777] hover:bg-[#F9F9F9]'}`}
          >
            本日出勤
            {activeTab === 'working' && <div className="absolute top-0 w-full h-[1px] bg-black"></div>}
          </button>
            </>
          )}
        </div>
      </header>

        {/* Feed List */}
        {(user?.role === 'system' || user?.role === 'admin') ? (
          <AdminHomeContent activeTab={activeTab} />
        ) : (
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
                storeName={post.storeName}
                storeProfileId={post.storeProfileId}
                postType={post.post_type}
              />
            ))
          ) : (
            <div className="py-20 text-center text-[#777777]">
              <p className="text-sm font-light tracking-widest">投稿がありません</p>
            </div>
          )}
        </div>
        )}
      
      {/* Loader Mock & Infinite Scroll Trigger */}
      <div ref={observerTarget} className="py-8 flex justify-center h-20">
         {isFetchingMore && (
            <div className="w-5 h-5 border border-[#E5E5E5] border-t-black rounded-full animate-spin"></div>
         )}
      </div>

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
