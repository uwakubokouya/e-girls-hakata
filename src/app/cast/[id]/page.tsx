"use client";
import { use } from 'react';
import Link from 'next/link';
import PostCard from "@/components/feed/PostCard";
import { ChevronLeft, MessageCircle, Calendar, Lock, ArrowRight, UserPlus, ArrowLeft, AlertTriangle, CheckSquare, Square, Camera, X, ChevronRight, Heart, Check, Sparkles } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useUser } from '@/providers/UserProvider';
import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabase';
import MediaWatermark from '@/components/security/MediaWatermark';
import ImageCropperModal from '@/components/ui/ImageCropperModal';

export default function CastProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useUser();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showDMWarning, setShowDMWarning] = useState(false);
  const [showFollowPromptModal, setShowFollowPromptModal] = useState(false);
  const [showDMDisabledModal, setShowDMDisabledModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0); 
  const [posts, setPosts] = useState<any[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [acceptsDms, setAcceptsDms] = useState(true);
  const [resolvedCastId, setResolvedCastId] = useState<string>(id);
  const [activeTab, setActiveTab] = useState<'timeline' | 'gallery' | 'shifts'>('timeline');
  const [weekOffset, setWeekOffset] = useState(0);
  const [weeklyShifts, setWeeklyShifts] = useState<{dateStr: string, displayDate: string, text: string}[]>([]);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(false);
  const [likedFollowerIds, setLikedFollowerIds] = useState<Set<string>>(new Set());

  interface ProfileData {
    name: string;
    image: string;
    cover: string;
    bio: string;
    workingToday: boolean;
    slotsLeft?: number | null;
    nextAvailableTime?: string | null;
    statusText?: string;
    _avatarFile?: File;
    _coverFile?: File;
  }

  const [profileData, setProfileData] = useState<ProfileData>({
    name: "",
    image: "",
    cover: "",
    bio: "",
    workingToday: false,
  });
  const [editForm, setEditForm] = useState<ProfileData>(profileData);
  const [pendingCrop, setPendingCrop] = useState<{ src: string, type: 'avatar' | 'cover' } | null>(null);

  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [castPreferences, setCastPreferences] = useState<any>(null);

  useEffect(() => {
    if (isEditingProfile) {
      setEditForm(profileData);
    }
  }, [isEditingProfile, profileData]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      setPendingCrop({ src: previewUrl, type });
      e.target.value = ''; // Reset the input
    }
  };

  const handleSaveProfile = async () => {
    // Optimistic UI update
    setProfileData(editForm);
    setIsEditingProfile(false);
    
    if (!user?.id) return;

    let finalAvatarUrl = editForm.image;
    let finalCoverUrl = editForm.cover;

    try {
        if (editForm._avatarFile) {
            const fileExt = editForm._avatarFile.name?.split('.').pop() || 'jpg';
            const fileName = `${user.id}-avatar-${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, editForm._avatarFile, { upsert: true });
            
            if (!uploadError) {
                const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                finalAvatarUrl = data.publicUrl;
            }
        }
        
        if (editForm._coverFile) {
            const fileExt = editForm._coverFile.name?.split('.').pop() || 'jpg';
            const fileName = `${user.id}-cover-${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, editForm._coverFile, { upsert: true });
                
            if (!uploadError) {
                const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                finalCoverUrl = data.publicUrl;
            }
        }

        // Update database (bio, avatar_url, cover_url)
        // If your schema does not have cover_url yet, it will just be ignored by Postgrest if no error thrown, or you can add it to sns_profiles later.
        await supabase.from('sns_profiles').update({ 
            name: editForm.name,
            bio: editForm.bio,
            avatar_url: finalAvatarUrl,
        }).eq('id', user.id);
        
    } catch (err) {
        console.error("Profile save error:", err);
    }
  };

  useEffect(() => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) return;

    const fetchFollowData = async () => {
      // 1. Fetch Profile Data & Handle Dual-ID Mapping
      // The URL 'id' could be an sns_profiles ID or a casts ID.
      let { data: profile } = await supabase
        .from('sns_profiles')
        .select('id, name, avatar_url, accepts_dms, phone')
        .eq('id', id)
        .maybeSingle();

      let storeCast = null;

      // If no profile found by URL ID, it is likely a casts ID (from Search page)
      if (!profile) {
        const { data: castData } = await supabase.from('casts').select('*').eq('id', id).maybeSingle();
        if (castData) {
           storeCast = castData;
           // Find linked SNS profile by matching phone to login_id
           const { data: linkedProfile } = await supabase
             .from('sns_profiles')
             .select('id, name, avatar_url, accepts_dms, phone')
             .eq('phone', castData.login_id || 'dummy')
             .maybeSingle();
             
           if (linkedProfile) profile = linkedProfile;
        }
      } else {
        // We found SNS profile. Optionally load storeCast if needed for fallbacks.
        const { data: castData } = await supabase.from('casts').select('*').eq('login_id', profile.phone || 'dummy').maybeSingle();
        storeCast = castData;
      }

      let castName = profile?.name || "";
      let castBio = /* profile?.bio || */ ""; // bio doesn't exist in schema

      if (!storeCast && !profile) {
          const { data: castFromDb } = await supabase.from('casts').select('*').eq('id', id).maybeSingle();
          storeCast = castFromDb;
      }
      
      // 画像は「四角いSNSアイコン」側を最優先し、無ければ店舗の公式写真（casts）、それでも無ければデフォルト
      let castImg = profile?.avatar_url || storeCast?.profile_image_url || storeCast?.avatar_url || "/images/no-photo.jpg";

      // 名前のフォールバック
      if (!castName && storeCast) {
          castName = storeCast.name || "";
      }

      setProfileData(prev => ({
        ...prev,
        name: castName,
        image: castImg,
        bio: castBio
      }));

      if (profile && profile.accepts_dms === false) {
          setAcceptsDms(false);
      } else {
          setAcceptsDms(true);
      }

      const actualCastId = profile ? profile.id : id;
      setResolvedCastId(actualCastId); // Keep for handleFollow

      // Fetch sns_user_preferences
      const { data: prefData } = await supabase
          .from('sns_user_preferences')
          .select('*')
          .eq('user_id', actualCastId)
          .maybeSingle();
      if (prefData) {
          setCastPreferences(prefData);
      }

      // Fetch upcoming week's shifts
      const weekDays = ["日", "月", "火", "水", "木", "金", "土"];
      const storeId = storeCast?.store_id || 'ef92279f-3f19-47e7-b542-69de5906ab9b';

      const next14DaysPromises = Array.from({length: 14}, async (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const dateStr = d.toLocaleDateString('sv-SE').split('T')[0]; 
          
          const { data } = await supabase.rpc('get_public_availability', {
              p_store_id: storeId,
              p_date: dateStr
          });
          
          const shift = data?.find((s: any) => s.cast_id === storeCast?.id);
          let text = "お休み";
          
          if (shift && shift.attendance_status !== 'absent' && shift.shift_start && shift.shift_end) {
              text = `${shift.shift_start} 〜 ${shift.shift_end}`;
          }

          return {
              dateStr: dateStr,
              displayDate: `${d.getMonth() + 1}/${d.getDate()}(${weekDays[d.getDay()]})`,
              text: text
          }
      });
      
      const next14Days = await Promise.all(next14DaysPromises);
      setWeeklyShifts(next14Days);

      // 2. Get total followers using actualCastId
      const { count } = await supabase
        .from('sns_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', actualCastId);
        
      if (count !== null && count !== undefined) setFollowerCount(count);

      // 3. Check if current user is following using actualCastId
      let followsCurrentCast = false;
      if (user && user.id) {
         const { data: followData } = await supabase
           .from('sns_follows')
           .select('follower_id')
           .eq('follower_id', user.id)
           .eq('following_id', actualCastId)
           .maybeSingle();
           
         if (followData) {
             setIsFollowing(true);
             followsCurrentCast = true;
         }
      }

      // 4. Fetch Posts Data using actualCastId
      const { data: feedPosts } = await supabase
        .from('sns_posts')
        .select('*')
        .eq('cast_id', actualCastId)
        .order('created_at', { ascending: false });

      if (feedPosts) {
         // Map to isLocked instead of filtering
         const mappedPosts = feedPosts.map(p => {
             let isLocked = false;
             let lockReason = "";

             if (user?.id !== p.cast_id) {
                 const type = p.post_type || "全員";
                 if (type === "会員" && !user) {
                     isLocked = true;
                     lockReason = "会員限定の投稿です";
                 } else if (type === "フォロワー" && (!user || !followsCurrentCast)) {
                     isLocked = true;
                     lockReason = "フォロワー限定の投稿です";
                 }
             }
             return { ...p, isLocked, lockReason };
         });

         setPosts(mappedPosts.map(p => {
             const publishDate = new Date(p.created_at);
             const now = new Date();
             const diffMinutes = Math.floor((now.getTime() - publishDate.getTime()) / 60000);
             const timeAgo = diffMinutes < 60 ? `${diffMinutes}分前` : diffMinutes < 1440 ? `${Math.floor(diffMinutes / 60)}時間前` : `${Math.floor(diffMinutes / 1440)}日前`;
             
             return {
                 id: p.id,
                 castId: id,
                 castName: castName,
                 castImage: castImg,
                 timeAgo,
                 content: p.content,
                 images: p.images || [],
                 isWorkingToday: false, // TODO: Link to real shifts per post if needed
                 isLocked: p.isLocked,
                 lockReason: p.lockReason,
                 post_type: p.post_type
             };
         }));
      }

      // 5. Fetch Today's Shift Status
      if (storeCast?.id) {
          const todayStr = new Date().toLocaleDateString('sv-SE').split('T')[0];
          const { data: availabilityData } = await supabase
            .rpc('get_public_availability', {
                p_store_id: 'ef92279f-3f19-47e7-b542-69de5906ab9b',
                p_date: todayStr
            });

          if (availabilityData && availabilityData.length > 0) {
              const myAvails = availabilityData.filter((a: any) => a.cast_id === storeCast.id);
              if (myAvails.length > 0) {
                  const shift_start = myAvails[0].shift_start;
                  const shift_end = myAvails[0].shift_end;
                  const isAbsent = myAvails[0].attendance_status === 'absent';
                  const bookings = myAvails.filter((a: any) => a.booked_start).map((a: any) => ({
                      start: a.booked_start, end: a.booked_end
                  }));
                  
                  let statusText = "本日出勤中";
                  let isWorkingToday = true;
                  let slotsLeft = null;
                  let nextAvailableTime = null;
                  
                  const now = new Date();
                  const currentHour = now.getHours();
                  const currentMin = now.getMinutes();
                  const currentMinTotal = currentHour * 60 + currentMin;

                  if (isAbsent) {
                      statusText = "お休み";
                      isWorkingToday = false;
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
                              nextAvailableTime = `次回出勤: ${d.getMonth() + 1}/${d.getDate()}`;
                          } else {
                              nextAvailableTime = "次回出勤: 未定";
                          }
                      }
                  }
                  
                  if (statusText === "本日出勤中") {
                      let ssP = shift_start.split(':');
                       let seP = shift_end.split(':');
                       let ssH = parseInt(ssP[0]); if(ssH < 6) ssH += 24;
                       let seH = parseInt(seP[0]); if(seH < 6) seH += 24;
                       const ssM = ssH * 60 + parseInt(ssP[1] || '0');
                       const seM = seH * 60 + parseInt(seP[1] || '0');
                       const am = currentHour < 6 ? currentHour * 60 + 24 * 60 + currentMin : currentMinTotal;
                       
                       let cursorM = Math.max(am, ssM);
                       
                       const parsedBookings = bookings.map((b) => {
                           let bsH = parseInt(b.start.split(':')[0]); if(bsH < 6) bsH += 24;
                           let beH = parseInt(b.end.split(':')[0]); if(beH < 6) beH += 24;
                           return {
                               startM: bsH * 60 + parseInt(b.start.split(':')[1] || '0'),
                               endM: beH * 60 + parseInt(b.end.split(':')[1] || '0') + 10
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
                           if (myAvails[0] && myAvails[0].next_shift_date) {
                               const dt = new Date(myAvails[0].next_shift_date);
                               nextAvailableTime = `����o��: ${dt.getMonth() + 1}/${dt.getDate()}`;
                           } else {
                               nextAvailableTime = "����o��: ����";
                           }
                       } else {
                           if (cursorM <= am) {
                               nextAvailableTime = "�ҋ@��";
                           } else {
                               let h = Math.floor(cursorM / 60);
                               let m = cursorM % 60;
                               if (h >= 24) h -= 24;
                               nextAvailableTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                           }
                       }

                      if (shift_start && shift_end) {
                          const sH = parseInt(shift_start.split(':')[0]);
                          const eH = parseInt(shift_end.split(':')[0]) || 24;
                          const totalSlots = (eH <= sH ? eH + 24 - sH : eH - sH);
                          slotsLeft = Math.max(0, totalSlots - bookings.length);
                      }
                  }

                  setProfileData(prev => ({ 
                      ...prev, 
                      workingToday: isWorkingToday, 
                      slotsLeft: slotsLeft,
                      nextAvailableTime: nextAvailableTime,
                      statusText: statusText
                  }));
              }
          }
      }
    };
    
    fetchFollowData();
  }, [id, user]);

  // 足あと記録ロジック
  useEffect(() => {
    // ログインしていない、またはキャストの場合は足あとを残さない
    if (!user || user.role !== 'customer') return;
    
    // 足あと設定がOFFの場合は残さない
    if (user.settings?.leave_footprints === false) return;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) return;

    const leaveFootprint = async () => {
      // 重複の場合はエラーとなるが想定内なのでコンソール出力を抑制
      await supabase.from('sns_footprints').insert({
        viewer_id: user.id,
        cast_id: id
      }).then(({ error }) => {
         // 重複 (23505) や存在しないキャスト (23503: profile未作成) は想定内なのでスキップ
         if (error && error.code !== '23505' && error.code !== '23503') {
            console.error(error);
         }
      });
    };

    leaveFootprint();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  const handleFollow = async () => {
    if (!user) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('authRedirect', `/cast/${id}`);
      }
      setShowAuthPrompt(true);
      return;
    }
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
       alert("無効なユーザーIDです。デモ版のためフォロー処理は行われません。");
       return;
    }

    const updatePostsLockStatus = (newIsFollowing: boolean) => {
       setPosts(prevPosts => prevPosts.map(p => {
           if (user?.id !== id) {
               const type = p.post_type || "全員";
               if (type === "フォロワー") {
                   const isLocked = !user || !newIsFollowing;
                   const lockReason = "フォロワー限定の投稿です";
                   return { ...p, isLocked, lockReason };
               }
           }
           return p;
       }));

       if (selectedPost) {
           setSelectedPost((prev: any) => {
               if (!prev) return null;
               if (user?.id !== id) {
                   const type = prev.post_type || "全員";
                   if (type === "フォロワー") {
                       const isLocked = !user || !newIsFollowing;
                       const lockReason = "フォロワー限定の投稿です";
                       return { ...prev, isLocked, lockReason };
                   }
               }
               return prev;
           });
       }
    };
    
    // Optimistic Update
    updatePostsLockStatus(!isFollowing);

    if (isFollowing) {
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
        await supabase
          .from('sns_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', resolvedCastId);
    } else {
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
        await supabase
          .from('sns_follows')
          .insert({
             follower_id: user.id,
             following_id: resolvedCastId
          });
    }
  };

  const handleMessage = () => {
    // 自身のプレビュー時は何も起きない
    if (user?.id === id) return;

    if (!acceptsDms) {
      setShowDMDisabledModal(true);
      return;
    }

    // ゲスト（未ログイン）の場合はメンバーズオンリーを表示
    if (!user) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('authRedirect', `/cast/${id}`);
      }
      setShowAuthPrompt(true);
      return;
    }
    
    // 客アカウントの場合はDM（注意事項）へ進む
    if (user.role === 'customer') {
      if (!isFollowing) {
          setShowFollowPromptModal(true);
          return;
      }
      
      if (typeof window !== 'undefined') {
        const hidden = localStorage.getItem('dm_warning_hidden');
        if (hidden === 'true') {
          router.push(`/messages/${id}`);
          return;
        }
      }
      setShowDMWarning(true);
    }
  };

  const handleProceedToMessage = () => {
    if (!agreedToTerms) return;
    if (doNotShowAgain && typeof window !== 'undefined') {
      localStorage.setItem('dm_warning_hidden', 'true');
    }
    setShowDMWarning(false);
    router.push(`/messages/${id}`);
  };

  const handleShowFollowers = async () => {
     setShowFollowersModal(true);
     setIsLoadingFollowers(true);
     
     const { data, error } = await supabase
        .from('sns_follows')
        .select(`
           follower_id,
           created_at,
           sns_profiles!sns_follows_follower_id_fkey (
               name,
               avatar_url
           )
        `)
        .eq('following_id', resolvedCastId)
        .order('created_at', { ascending: false });

     if (!error && data) {
         setFollowersList(data);
     }
     setIsLoadingFollowers(false);
  };

  const handleSendLike = async (followerId: string) => {
      if (likedFollowerIds.has(followerId)) return;
      
      // Update local state immediately
      setLikedFollowerIds(prev => new Set(prev).add(followerId));
      
      // Insert LIKE into messages to bypass sns_notifications RLS
      const { error: notifError } = await supabase
        .from('sns_messages')
        .insert({
           sender_id: user?.id,
           receiver_id: followerId,
           content: `[SYSTEM_LIKE]${profileData.name || 'キャスト'}さんからいいねが届いています！早速チェックしてみて！`,
           is_read: false
        });
      if (notifError) console.error("Notification insert error:", notifError);
  };

  const cast = {
    id: id,
    name: profileData.name,
    image: profileData.image,
    cover: profileData.cover,
    followers: followerCount,
    status: profileData.statusText || (profileData.workingToday ? "本日出勤" : ""),
    bio: profileData.bio,
    workingToday: profileData.workingToday,
    nextAvailable: ""
  };

  const galleryItems = posts.flatMap(post => 
      (post.images || []).map((imgUrl: string) => ({ imgUrl, post }))
  );

  return (
    <>
      <div className={`min-h-screen bg-white pb-24 relative font-light ${showAuthPrompt ? 'pointer-events-none select-none filter blur-[3px] opacity-70 transition-all duration-500' : ''}`}>
      
      {/* DM Disabled Modal Overlay */}
      {showDMDisabledModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col items-center">
            <div className="w-12 h-12 border border-black flex items-center justify-center mb-4 text-black">
              <AlertTriangle size={20} className="stroke-[1.5]" />
            </div>
            <h3 className="text-sm font-bold tracking-widest mb-4">ご利用いただけません</h3>
            <p className="text-xs text-[#333333] leading-relaxed mb-8 bg-[#F9F9F9] p-4 text-center">
              このキャストは現在DM機能が有効ではありません。
            </p>
            <div className="w-full flex">
              <button 
                onClick={() => setShowDMDisabledModal(false)}
                className="w-full py-3 bg-black text-white text-xs tracking-widest transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal Sheet */}
      {showPreferencesModal && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end">
              <div 
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" 
                  onClick={() => setShowPreferencesModal(false)}
              />
              <div className="relative bg-white w-full max-h-[85vh] rounded-t-none overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300 max-w-md mx-auto">
                  <div className="flex items-center justify-between p-6 border-b border-[#E5E5E5] bg-white sticky top-0 z-10 shadow-sm">
                      <h2 className="font-bold text-sm tracking-widest flex items-center gap-2 uppercase">
                          CAST DATA
                      </h2>
                      <button onClick={() => setShowPreferencesModal(false)} className="text-[#777777] hover:text-black transition-colors">
                          <X size={24} className="stroke-[1.5]" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-8 pb-10">
                      {castPreferences ? (
                          <>
                              {(castPreferences.age_min || castPreferences.tall_min || castPreferences.cup_min) && (
                                  <section>
                                      <h3 className="text-xs text-[#777777] tracking-widest mb-3 font-normal">年齢・スタイル</h3>
                                      <div className="flex flex-wrap gap-2">
                                          {castPreferences.age_min && <span className="px-3 py-1.5 text-[11px] tracking-widest border border-black bg-black text-white">{castPreferences.age_min}歳</span>}
                                          {castPreferences.tall_min && <span className="px-3 py-1.5 text-[11px] tracking-widest border border-black text-black">{castPreferences.tall_min}cm</span>}
                                          {castPreferences.cup_min && <span className="px-3 py-1.5 text-[11px] tracking-widest border border-black text-black">{castPreferences.cup_min}カップ</span>}
                                      </div>
                                  </section>
                              )}

                              {castPreferences.body_types && castPreferences.body_types.length > 0 && (
                                  <section>
                                      <h3 className="text-xs text-[#777777] tracking-widest mb-3 font-normal">体型</h3>
                                      <div className="flex flex-wrap gap-2">
                                          {castPreferences.body_types.map((item: string) => (
                                              <span key={item} className="px-3 py-1.5 text-[11px] tracking-widest border border-[#E5E5E5] text-black bg-[#F9F9F9]">{item}</span>
                                          ))}
                                      </div>
                                  </section>
                              )}

                              {castPreferences.features && castPreferences.features.length > 0 && (
                                  <section>
                                      <h3 className="text-xs text-[#777777] tracking-widest mb-3 font-normal">個性・特徴</h3>
                                      <div className="flex flex-wrap gap-2">
                                          {castPreferences.features.map((item: string) => (
                                              <span key={item} className="px-3 py-1.5 text-[11px] tracking-widest border border-[#E5E5E5] text-black bg-[#F9F9F9]">{item}</span>
                                          ))}
                                      </div>
                                  </section>
                              )}

                              {castPreferences.personalities && castPreferences.personalities.length > 0 && (
                                  <section>
                                      <h3 className="text-xs text-[#777777] tracking-widest mb-3 font-normal">性格</h3>
                                      <div className="flex flex-wrap gap-2">
                                          {castPreferences.personalities.map((item: string) => (
                                              <span key={item} className="px-3 py-1.5 text-[11px] tracking-widest border border-[#E5E5E5] text-black bg-[#F9F9F9]">{item}</span>
                                          ))}
                                      </div>
                                  </section>
                              )}

                              {castPreferences.sm_types && castPreferences.sm_types.length > 0 && (
                                  <section>
                                      <h3 className="text-xs text-[#777777] tracking-widest mb-3 font-normal">S/M傾向</h3>
                                      <div className="flex flex-wrap gap-2">
                                          {castPreferences.sm_types.map((item: string) => (
                                              <span key={item} className="px-3 py-1.5 text-[11px] tracking-widest border border-[#E5E5E5] text-black bg-[#F9F9F9]">{item}</span>
                                          ))}
                                      </div>
                                  </section>
                              )}

                              {castPreferences.plays && castPreferences.plays.length > 0 && (
                                  <section>
                                      <h3 className="text-xs text-[#777777] tracking-widest mb-3 font-normal">可能プレイ</h3>
                                      <div className="flex flex-wrap gap-2">
                                          {castPreferences.plays.map((item: string) => (
                                              <span key={item} className="px-3 py-1.5 text-[11px] tracking-widest border border-[#E5E5E5] text-black bg-[#F9F9F9]">{item}</span>
                                          ))}
                                      </div>
                                  </section>
                              )}

                              {castPreferences.op_options && castPreferences.op_options.length > 0 && (
                                  <section>
                                      <h3 className="text-xs text-[#777777] tracking-widest mb-3 font-normal">OP枠</h3>
                                      <div className="flex flex-wrap gap-2">
                                          {castPreferences.op_options.map((item: string) => (
                                              <span key={item} className="px-3 py-1.5 text-[11px] tracking-widest border border-[#E5E5E5] text-black bg-[#F9F9F9]">{item}</span>
                                          ))}
                                      </div>
                                  </section>
                              )}
                          </>
                      ) : (
                          <div className="py-10 text-center text-[#777777] text-xs tracking-widest uppercase">
                              NO DATA
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Follow Prompt Modal Before DM */}
      {showFollowPromptModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col shadow-sm">
             <div className="flex items-center gap-3 border-b border-black pb-4 mb-6">
                <MessageCircle size={20} className="stroke-[1.5]" />
                <h3 className="text-sm font-bold tracking-widest uppercase text-black">DM送信前の確認</h3>
             </div>
             
             <div className="text-xs text-[#333333] tracking-widest leading-relaxed mb-8 flex flex-col gap-4">
                <p>
                  メッセージを送るには、まずこのキャストを <strong>フォロー</strong> する必要があります。
                </p>
                <p>
                  フォローすることで、キャストがあなたのプロフィールを確認し、「承認」しやすくなります。<br/>
                  さっそくフォローしてメッセージ設定に進みますか？
                </p>
             </div>
             
             <div className="flex gap-4">
                 <button 
                   onClick={() => setShowFollowPromptModal(false)}
                   className="flex-1 py-3 text-[11px] tracking-widest border border-[#E5E5E5] text-[#777777] font-medium hover:bg-[#F9F9F9] transition-colors"
                 >
                   キャンセル
                 </button>
                 <button 
                   onClick={async () => {
                       setShowFollowPromptModal(false);
                       await handleFollow(); // Call follow logic
                       
                       // Proceed to DM warning logic
                       if (typeof window !== 'undefined') {
                          const hidden = localStorage.getItem('dm_warning_hidden');
                          if (hidden === 'true') {
                             router.push(`/messages/${id}`);
                             return;
                          }
                       }
                       setShowDMWarning(true);
                   }}
                   className="flex-1 py-3 text-[11px] tracking-widest font-medium bg-black text-white hover:bg-black/80 transition-colors flex items-center justify-center gap-2"
                 >
                   フォローして進む
                 </button>
             </div>
           </div>
        </div>
      )}

      {/* DM Warning Modal Overlay */}
      {showDMWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col items-center">
            <div className="w-12 h-12 border border-black flex items-center justify-center mb-4 text-black">
              <AlertTriangle size={20} className="stroke-[1.5]" />
            </div>
            <h3 className="text-sm font-bold tracking-widest mb-4">注意事項</h3>
            <p className="text-xs text-[#333333] leading-relaxed mb-6 bg-[#F9F9F9] p-4 text-justify">
              店舗外で会おうと誘う行為や連絡先を聞く行為等は禁止させて頂いております。違反が発覚した際は当社顧問弁護士の指導のもと、厳格な対処を取らせて頂きます。
            </p>
            
            <div className="w-full space-y-4 mb-8 text-left">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5">
                  {agreedToTerms ? <CheckSquare size={16} className="text-black" /> : <Square size={16} className="text-[#777777]" />}
                </div>
                <span className={`text-xs tracking-widest transition-colors block ${agreedToTerms ? 'text-black font-bold' : 'text-[#777777]'}`}>
                  上記の内容に同意する
                </span>
                <input type="checkbox" className="hidden" checked={agreedToTerms} onChange={() => setAgreedToTerms(!agreedToTerms)} />
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div>
                  {doNotShowAgain ? <CheckSquare size={16} className="text-black" /> : <Square size={16} className="text-[#777777]" />}
                </div>
                <span className={`text-[10px] tracking-widest transition-colors ${doNotShowAgain ? 'text-black' : 'text-[#777777]'}`}>
                  今後は表示しない
                </span>
                <input type="checkbox" className="hidden" checked={doNotShowAgain} onChange={() => setDoNotShowAgain(!doNotShowAgain)} />
              </label>
            </div>

            <div className="w-full flex gap-3">
              <button 
                onClick={() => setShowDMWarning(false)}
                className="flex-1 py-3 border border-[#E5E5E5] text-xs tracking-widest text-[#777777] hover:bg-[#F9F9F9] transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={handleProceedToMessage}
                disabled={!agreedToTerms}
                className="flex-1 py-3 bg-black text-white text-xs tracking-widest disabled:bg-[#E5E5E5] disabled:text-[#777777] transition-colors"
              >
                進む
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header / Cover */}
      <div 
        className={`relative h-56 bg-[#F9F9F9] border-b border-[#E5E5E5] flex items-center justify-center overflow-hidden ${cast.cover ? 'cursor-pointer' : ''}`}
        onClick={() => {
            if (cast.cover) setFullscreenImage(cast.cover);
        }}
      >
        {cast.cover ? (
           /* eslint-disable-next-line @next/next/no-img-element */
           <img src={cast.cover} alt="Cover" className="w-full h-full object-cover opacity-50 mix-blend-overlay" />
        ) : (
           <div className="w-full h-full bg-[#E5E5E5] opacity-20"></div>
        )}
        
        {/* Typography over cover */}
        <div className="absolute inset-0 flex items-center justify-center text-center">
             <h1 className="text-4xl font-light tracking-[0.3em] uppercase text-black/20 mix-blend-overlay">E-GIRLS</h1>
        </div>

        {/* Top bar controls */}
        <div className="absolute top-0 w-full p-4 flex justify-between items-center z-10">
            <button onClick={() => router.back()} className="bg-white p-2 rounded-none text-black border border-black hover:bg-black hover:text-white transition-colors">
                <ChevronLeft size={20} className="stroke-[1.5]" />
            </button>
            <div className="flex gap-2">
                <button 
                  onClick={handleMessage} 
                  className={`p-2 rounded-none border transition-colors flex items-center justify-center ${
                    acceptsDms 
                      ? 'bg-white text-black border-black hover:bg-black hover:text-white' 
                      : 'bg-[#F9F9F9] text-[#CCC] border-[#E5E5E5]'
                  }`}
                >
                    <MessageCircle size={18} className="stroke-[1.5]" />
                </button>
            </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-6 relative mb-8">
        <div className="flex justify-between items-end -mt-10 mb-4">
            <div 
                className="relative w-20 h-20 bg-white border border-black overflow-hidden z-20 p-1 cursor-pointer"
                onClick={(e) => {
                   e.stopPropagation();
                   if (cast.image) setFullscreenImage(cast.image);
                }}
            >
                {cast.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={cast.image} alt={cast.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-[#E5E5E5] flex items-center justify-center text-[#777777]">
                        <UserPlus size={24} className="stroke-[1.5]" />
                    </div>
                )}
            </div>
            {user?.id === id ? (
                <div className="flex gap-2">
                    <button onClick={() => setShowPreferencesModal(true)} className="px-4 py-1.5 mb-2 border border-[#E5E5E5] text-black bg-white hover:bg-[#F9F9F9] transition-colors flex flex-col items-center justify-center tracking-widest gap-0.5">
                        <span className="text-[10px] font-medium leading-none tracking-[0.1em]">CAST</span>
                        <span className="text-[8px] font-bold leading-none tracking-[0.1em]">DATA</span>
                    </button>
                    <button onClick={() => setIsEditingProfile(true)} className="px-6 py-2 text-[11px] mb-2 font-medium tracking-widest transition-colors premium-btn-outline">
                        設定・編集
                    </button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <button onClick={() => setShowPreferencesModal(true)} className="px-4 py-1.5 mb-2 border border-[#E5E5E5] text-black bg-white hover:bg-[#F9F9F9] transition-colors flex flex-col items-center justify-center tracking-widest gap-0.5">
                        <span className="text-[10px] font-medium leading-none tracking-[0.1em]">CAST</span>
                        <span className="text-[8px] font-bold leading-none tracking-[0.1em]">DATA</span>
                    </button>
                    <button 
                      onClick={handleFollow} 
                      className={`px-6 py-2 text-[11px] mb-2 font-medium tracking-widest transition-colors ${
                          isFollowing 
                            ? 'border border-[#E5E5E5] text-black bg-[#F9F9F9] hover:bg-[#E5E5E5]' 
                            : 'bg-black text-white border border-black hover:bg-black/80'
                      }`}
                    >
                        {isFollowing ? 'フォロー中' : 'フォローする'}
                    </button>
                </div>
            )}
        </div>

        <div className="mb-6">
            <h1 className="text-2xl font-normal text-black flex items-center gap-2 uppercase tracking-widest mb-4">
                {cast.name || "名称未設定"}
            </h1>
            <p className="text-sm text-[#333333] whitespace-pre-wrap leading-relaxed font-light">
                {cast.bio || ""}
            </p>
        </div>

        <div className="flex items-center justify-between text-xs mb-8 tracking-widest text-[#777777] border-y border-[#E5E5E5] py-4">
            <button 
                onClick={() => {
                   if (user?.id === id || user?.id === resolvedCastId) {
                       handleShowFollowers();
                   }
                }}
                disabled={cast.followers === 0 || (user?.id !== id && user?.id !== resolvedCastId)}
                className="flex gap-1.5 items-baseline disabled:opacity-100 disabled:cursor-default hover:opacity-70 transition-opacity whitespace-nowrap"
            >
                <strong className="text-black font-medium">{cast.followers}</strong> フォロワー
            </button>
            <div className="flex gap-1 items-center">
                ステータス: 
                <span className="text-black font-medium inline-flex items-center whitespace-nowrap">
                    {cast.status}
                    {profileData.nextAvailableTime && (
                        <span className="text-[10px] ml-1 font-normal text-[#777777]">
                            ({
                                profileData.nextAvailableTime === '待機中' ? '待機中' :
                                profileData.nextAvailableTime.startsWith('次回出勤') ? profileData.nextAvailableTime :
                                `次回${profileData.nextAvailableTime}〜`
                            })
                        </span>
                    )}
                </span>
            </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-full border-y border-[#E5E5E5] sticky top-0 bg-white/90 backdrop-blur z-30">
          <button 
             onClick={() => setActiveTab('timeline')}
             className={`flex-1 py-4 text-[11px] tracking-widest border-r border-[#E5E5E5] relative transition-colors ${activeTab === 'timeline' ? 'font-bold text-black bg-[#F9F9F9]' : 'font-normal text-[#777777] hover:bg-[#F9F9F9]'}`}
          >
            タイムライン
            {activeTab === 'timeline' && <div className="absolute top-0 w-full h-[1px] bg-black"></div>}
          </button>
          <button 
             onClick={() => setActiveTab('gallery')}
             className={`flex-1 py-4 text-[11px] tracking-widest border-r border-[#E5E5E5] relative transition-colors ${activeTab === 'gallery' ? 'font-bold text-black bg-[#F9F9F9]' : 'font-normal text-[#777777] hover:bg-[#F9F9F9]'}`}
          >
            ギャラリー
            {activeTab === 'gallery' && <div className="absolute top-0 w-full h-[1px] bg-black"></div>}
          </button>
          <button 
             onClick={() => setActiveTab('shifts')}
             className={`flex-1 py-4 text-[11px] tracking-widest relative transition-colors ${activeTab === 'shifts' ? 'font-bold text-black bg-[#F9F9F9]' : 'font-normal text-[#777777] hover:bg-[#F9F9F9]'}`}
          >
            出勤情報
            {activeTab === 'shifts' && <div className="absolute top-0 w-full h-[1px] bg-black"></div>}
          </button>
      </div>

      {/* Tab Content */}
      <div className="pb-12 bg-[#F9F9F9] min-h-[300px]">
        {activeTab === 'timeline' ? (
            posts.length > 0 ? (
                posts.map(post => (
                  <PostCard key={post.id} {...post} />
                ))
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-[#777777]">
                    <p className="text-xs tracking-widest">まだ投稿はありません</p>
                </div>
            )
        ) : activeTab === 'gallery' ? (
            galleryItems.length > 0 ? (
                <div className="grid grid-cols-3 gap-[1px] bg-white">
                    {galleryItems.map((item, idx) => {
                        const isVideo = item.imgUrl.match(/\.(mp4|mov|webm)$/i);
                        return (
                            <div key={idx} onClick={() => setSelectedPost(item.post)} className="relative aspect-square cursor-pointer overflow-hidden bg-[#E5E5E5]">
                                {isVideo ? (
                                    <video src={item.imgUrl} className={`object-cover w-full h-full ${item.post.isLocked ? 'blur-[8px] scale-110' : ''}`} muted playsInline />
                                ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={item.imgUrl} alt="Gallery" className={`object-cover w-full h-full ${item.post.isLocked ? 'blur-[8px] scale-110' : ''}`} loading="lazy" />
                                )}
                                {item.post.isLocked && (
                                    <div className="absolute inset-0 flex items-center justify-center text-white bg-black/20 pointer-events-none">
                                        <Lock size={16} />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-[#777777]">
                    <p className="text-xs tracking-widest">まだ画像/動画はありません</p>
                </div>
            )
        ) : (
            <div className="bg-white p-6 min-h-[300px]">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[11px] font-bold tracking-widest uppercase text-black flex items-center gap-2 m-0">
                        <Calendar size={14} className="stroke-[2]" />
                        出勤予定
                    </h3>
                    <div className="flex items-center gap-4 text-[10px] tracking-widest font-bold">
                       <button 
                          onClick={() => setWeekOffset(0)} 
                          disabled={weekOffset === 0}
                          className={`flex items-center gap-1 ${weekOffset === 0 ? 'text-[#E5E5E5]' : 'text-black hover:text-[#777777]'} transition-colors`}
                       >
                         <ChevronLeft size={16} className="stroke-[1.5]" /> 前の週
                       </button>
                       <button 
                          onClick={() => setWeekOffset(1)} 
                          disabled={weekOffset === 1}
                          className={`flex items-center gap-1 ${weekOffset === 1 ? 'text-[#E5E5E5]' : 'text-black hover:text-[#777777]'} transition-colors`}
                       >
                         次の週 <ChevronRight size={16} className="stroke-[1.5]" />
                       </button>
                    </div>
                </div>
                <div className="border border-black flex flex-col w-full text-xs">
                    {weeklyShifts.slice(weekOffset * 7, weekOffset * 7 + 7).map((shift, idx) => {
                        const isOff = shift.text === "お休み";
                        const isToday = weekOffset === 0 && idx === 0;
                        return (
                            <div key={idx} className={`flex items-center w-full min-h-[44px] border-b border-[#E5E5E5] last:border-0 ${isOff ? 'bg-[#F9F9F9]' : 'bg-white'}`}>
                                <div className="w-1/3 shrink-0 h-full flex items-center justify-center border-r border-[#E5E5E5] font-medium tracking-widest py-3">
                                    <span className={isToday ? 'text-[#E02424]' : 'text-black'}>{shift.displayDate}</span>
                                </div>
                                <div className="w-2/3 flex items-center justify-center font-bold tracking-widest py-3">
                                    <span className={isOff ? 'text-[#777777] font-normal' : 'text-black'}>{shift.text}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-8 text-[10px] text-[#777777] tracking-widest leading-relaxed">
                    ※シフトは予告なく変更となる場合がございます。<br />
                    ※枠の最新の空き状況は「予約する」ボタンよりご確認ください。
                </div>
            </div>
        )}
      </div>

      {/* Fixed Sticky CTA Bottom for Cast Profile */}
      <div className="fixed bottom-[72px] left-0 right-0 max-w-md mx-auto p-4 z-40 bg-white border-t border-[#E5E5E5]">
          {user?.id === id ? (
            <button onClick={() => setIsEditingProfile(true)} className="premium-btn w-full flex items-center justify-center gap-3 py-4 text-sm tracking-widest">
               <UserPlus size={18} className="stroke-[1.5]" />
               プロフィールを設定・編集する
            </button>
          ) : (
            <Link href={`/reserve/${id}`} className="premium-btn w-full flex items-center justify-center gap-3 py-4 text-sm tracking-widest">
               <Calendar size={18} className="stroke-[1.5]" />
               このキャストを予約する
            </Link>
          )}
      </div>
      
    </div>
    
      {/* Auth Prompt Overlay (Glassmorphism) */})
      {showAuthPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="absolute top-6 left-6 border border-white/50 bg-white/50 rounded-full z-10">
             <button 
               onClick={() => setShowAuthPrompt(false)} 
               className="flex items-center justify-center w-10 h-10 text-black hover:bg-black hover:text-white transition-colors rounded-full shadow-sm"
             >
               <ArrowLeft size={16} className="stroke-[2]" />
             </button>
           </div>
           
           <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col items-center">
             <div className="w-12 h-12 border border-black flex items-center justify-center mb-6 text-black">
               <Lock size={20} className="stroke-[1.5]" />
             </div>
             <h3 className="text-sm font-bold tracking-widest mb-2 uppercase text-black">Members Only</h3>
             <p className="text-[10px] text-[#777777] mb-6 tracking-widest">これより先は会員登録が必要です</p>
             
             <div className="w-full bg-[#F9F9F9] border border-[#E5E5E5] p-5 mb-8 text-left space-y-4">
                 <p className="text-[11px] font-bold tracking-widest border-b border-[#E5E5E5] pb-2 mb-4 text-black uppercase">無料会員登録のメリット</p>
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
               <button onClick={() => { setShowAuthPrompt(false); router.push('/register'); }} className="premium-btn w-full py-4 text-xs tracking-widest bg-black text-white">
                 無料会員登録に進む
               </button>
               <button onClick={() => setShowAuthPrompt(false)} className="w-full py-4 text-xs tracking-widest text-[#777777] border border-[#E5E5E5] bg-white hover:bg-[#F9F9F9] transition-colors">
                 閉じる
               </button>
             </div>
           </div>
        </div>
      )}

      {/* Twitter-style Profile Edit Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-[110] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] bg-white/90 backdrop-blur sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsEditingProfile(false)} className="p-2 -ml-2 text-black hover:bg-[#F9F9F9] rounded-full transition-colors">
                <ArrowLeft size={20} className="stroke-[1.5]" />
              </button>
              <h2 className="font-bold text-sm tracking-widest">プロフィールを編集</h2>
            </div>
            <button 
              onClick={handleSaveProfile}
              className="bg-black text-white px-5 py-2 text-[11px] font-bold tracking-widest hover:bg-black/80 transition-colors"
            >
              保存
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
             {/* Cover Editor */}
             <div className="relative h-48 bg-[#F9F9F9] border-b border-[#E5E5E5]">
                 {editForm.cover ? (
                     /* eslint-disable-next-line @next/next/no-img-element */
                     <img src={editForm.cover} alt="Cover" className="w-full h-full object-cover opacity-50" />
                 ) : (
                     <div className="w-full h-full bg-[#E5E5E5] opacity-50 text-transparent">No Cover</div>
                 )}
                 <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                     <label className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 backdrop-blur-sm transition-colors cursor-pointer">
                        <Camera size={20} />
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'cover')} />
                     </label>
                 </div>
             </div>
             
             {/* Avatar Editor */}
             <div className="px-6 relative mb-8">
                 <div className="relative w-24 h-24 -mt-12 bg-white border border-black overflow-hidden shadow-sm z-20">
                     {editForm.image ? (
                         /* eslint-disable-next-line @next/next/no-img-element */
                         <img src={editForm.image} alt="Avatar" className="w-full h-full object-cover opacity-90" />
                     ) : (
                         <div className="w-full h-full bg-[#E5E5E5] opacity-70"></div>
                     )}
                     <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                         <label className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 backdrop-blur-sm transition-colors cursor-pointer">
                            <Camera size={18} />
                            <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'avatar')} />
                         </label>
                     </div>
                 </div>
             </div>

             {/* Form Fields */}
             <div className="px-6 space-y-8 pb-32">
                <div className="space-y-1 block relative group">
                    <label className="text-[10px] uppercase tracking-widest text-[#777777] font-bold">Name</label>
                    <input 
                       type="text"
                       value={editForm.name}
                       onChange={e => setEditForm({...editForm, name: e.target.value})}
                       className="w-full border-b border-[#E5E5E5] pb-2 text-sm outline-none focus:border-black transition-colors bg-transparent rounded-none"
                    />
                </div>
                
                <div className="space-y-1 block">
                    <label className="text-[10px] uppercase tracking-widest text-[#777777] font-bold">Bio</label>
                    <textarea 
                       value={editForm.bio}
                       onChange={e => setEditForm({...editForm, bio: e.target.value})}
                       rows={6}
                       className="w-full border-b border-[#E5E5E5] pb-2 text-sm leading-relaxed outline-none focus:border-black transition-colors bg-transparent rounded-none resize-none"
                    />
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Selected Post Modal (Gallery) */}
      {selectedPost && (
          <div className="fixed inset-0 z-[120] bg-white flex flex-col animate-in fade-in duration-200">
             <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] bg-white sticky top-0 z-10">
               <button onClick={() => setSelectedPost(null)} className="p-2 -ml-2 text-black hover:bg-[#F9F9F9] rounded-none transition-colors">
                  <ArrowLeft size={20} className="stroke-[1.5]" />
               </button>
               <span className="text-[11px] font-bold tracking-widest uppercase">投稿詳細</span>
               <div className="w-8"></div>
             </div>
             <div className="flex-1 overflow-y-auto pb-20 bg-[#F9F9F9]">
                <PostCard 
                   {...selectedPost} 
                   showFollowButton={true}
                   isFollowing={isFollowing}
                   onFollowToggle={handleFollow}
                />
             </div>
          </div>
      )}

      {/* Followers Modal */}
      {showFollowersModal && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex flex-col justify-end animate-in fade-in duration-200">
           <div className="bg-white w-full h-[80vh] rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] sticky top-0 bg-white rounded-t-3xl z-10">
                 <div className="w-8"></div>
                 <h2 className="font-bold text-sm tracking-widest">フォロワー</h2>
                 <button onClick={() => setShowFollowersModal(false)} className="p-2 -mr-2 text-black hover:bg-[#F9F9F9] rounded-full transition-colors">
                    <X size={20} className="stroke-[1.5]" />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                 {isLoadingFollowers ? (
                    <div className="flex justify-center py-20">
                      <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    </div>
                 ) : followersList.length > 0 ? (
                    <div className="space-y-[1px] bg-[#E5E5E5] -mx-4 border-y border-[#E5E5E5]">
                       {followersList.map((follower) => {
                           const isLiked = likedFollowerIds.has(follower.follower_id);
                           return (
                               <div 
                                  key={follower.follower_id}
                                  className="bg-white p-4 flex items-center gap-4 hover:bg-[#FCFCFC] transition-colors"
                               >
                                  <div className="shrink-0 w-12 h-12 bg-[#F9F9F9] overflow-hidden border border-[#E5E5E5]">
                                      <img 
                                          src={follower.sns_profiles?.avatar_url || "/images/no-photo.jpg"} 
                                          alt="Avatar" 
                                          className="w-full h-full object-cover"
                                      />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="font-bold text-sm tracking-widest text-black truncate mb-1">
                                          {follower.sns_profiles?.name || "名称未設定"}
                                      </div>
                                  </div>
                               </div>
                           );
                       })}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-[#777777]">
                        <p className="text-xs tracking-widest">フォロワーがいません</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Fullscreen Image Viewer (Inherits security settings from PostCard) */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-200"
          onClick={() => setFullscreenImage(null)}
        >
           <button 
             onClick={() => setFullscreenImage(null)}
             className="absolute top-4 right-4 p-2 text-white bg-black/50 border border-white/20 rounded-full hover:bg-white/20 transition-colors z-10"
           >
              <X size={24} />
           </button>
           
           <div 
             className="relative inline-block max-w-[95vw] max-h-[75vh] bg-black overflow-hidden rounded-lg shadow-2xl"
             onClick={(e) => e.stopPropagation()}
           >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={fullscreenImage} 
                alt="Fullscreen Cast Image" 
                className="max-w-[95vw] max-h-[75vh] w-auto h-auto block" 
              />
              <MediaWatermark />
           </div>
           
           <div className="mt-8 text-center animate-in slide-in-from-bottom-2 duration-500 max-w-[90vw]">
             <p className="text-white/90 text-xs tracking-widest font-bold mb-1.5 flex items-center justify-center gap-1.5">
                <AlertTriangle size={14} className="text-[#E02424]" />
                スクショ等による保存・無断転載はご遠慮下さい
             </p>
             <p className="text-white/50 text-[10px] tracking-widest leading-relaxed">
               万が一流出が確認された場合、透かしIDより<br/>特定を行い、法的措置の対象となる場合がございます
             </p>
           </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {pendingCrop && (
        <ImageCropperModal
          imageSrc={pendingCrop.src}
          aspectRatio={pendingCrop.type === 'avatar' ? 1 : 16/9}
          onCropComplete={(croppedFile) => {
              const previewUrl = URL.createObjectURL(croppedFile);
              if (pendingCrop.type === 'avatar') {
                setEditForm(prev => ({ ...prev, image: previewUrl, _avatarFile: croppedFile }));
              } else {
                setEditForm(prev => ({ ...prev, cover: previewUrl, _coverFile: croppedFile }));
              }
              setPendingCrop(null);
          }}
          onCancel={() => setPendingCrop(null)}
        />
      )}
    </>
  );
}
