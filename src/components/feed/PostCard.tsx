"use client";
import Link from 'next/link';
import { Heart, MessageCircle, Clock, CalendarCheck, Lock, ArrowLeft, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/providers/UserProvider';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MediaWatermark from '@/components/security/MediaWatermark';

interface PostProps {
  id: string;
  castId: string;
  castName: string;
  castImage: string;
  timeAgo: string;
  content: string;
  images: string[];
  isWorkingToday: boolean;
  slotsLeft?: number;
  nextAvailableTime?: string;
  statusText?: string;
  onDelete?: (id: string) => void;
  isLocked?: boolean;
  lockReason?: string;
  showFollowButton?: boolean;
  isFollowing?: boolean;
  onFollowToggle?: () => void;
  storeName?: string;
  storeProfileId?: string;
}

export default function PostCard({
  castId,
  castName,
  castImage,
  timeAgo,
  content,
  images,
  isWorkingToday,
  slotsLeft,
  nextAvailableTime,
  statusText,
  id,
  onDelete,
  isLocked = false,
  lockReason = "限定投稿",
  showFollowButton = false,
  isFollowing = false,
  onFollowToggle,
  storeName,
  storeProfileId,
}: PostProps) {
  const router = useRouter();
  const { user } = useUser();
  const [isImagesRevealed, setIsImagesRevealed] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLockedPromptModal, setShowLockedPromptModal] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState<string | null>(null);
  const [localIsLocked, setLocalIsLocked] = useState(isLocked);
  
  useEffect(() => {
      setLocalIsLocked(isLocked);
  }, [isLocked]);
  
  const handleDirectFollow = async () => {
      if (!user) return;
      try {
          const { error } = await supabase
              .from('sns_follows')
              .insert({
                  follower_id: user.id,
                  following_id: castId
              });
              
          if (!error || error.code === '23505') { // 23505 is unique violation (already following)
              setLocalIsLocked(false);
              setShowLockedPromptModal(false);
              if (onFollowToggle) onFollowToggle();
          } else {
              console.error('Follow error:', error);
          }
      } catch (err) {
          console.error(err);
      }
  };

  const shouldBlur = localIsLocked || (user?.settings?.image_blur_enabled && !isImagesRevealed);

  const handleAuthAction = () => {
    if (!user) {
      if (typeof window !== 'undefined') {
          sessionStorage.setItem('authRedirect', `/cast/${castId}`);
      }
      setShowAuthModal(true);
      return;
    }
    // TODO: Handle like/message action
  };

  return (
    <article className="border-b border-[#E5E5E5] p-5 bg-white hover:bg-[#FCFCFC] transition-colors">
      <div className="flex gap-4">
        {/* Avatar & Follow */}
        <div className="shrink-0 flex-col flex items-center">
          <Link href={`/cast/${castId}`} className="block relative w-12 h-12 rounded-none overflow-hidden border border-black bg-[#F9F9F9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={castImage} alt={castName} className="object-cover w-full h-full transition-all duration-500" loading="lazy" />
          </Link>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col">
              <Link href={`/cast/${castId}`} className="flex items-baseline gap-2 truncate hover:opacity-70 transition-opacity">
                <span className="font-bold text-sm tracking-widest uppercase truncate text-black">{castName}</span>
                <span className="text-[10px] text-[#777777] shrink-0 font-medium">{timeAgo}</span>
              </Link>
              {storeName && storeProfileId && (
                <Link href={`/cast/${storeProfileId}`} className="inline-block mt-1">
                  <span className="text-[10px] text-[#777777] bg-[#F9F9F9] border border-[#E5E5E5] px-2 py-0.5 tracking-widest hover:bg-[#E5E5E5] transition-colors">
                    {storeName}
                  </span>
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              {showFollowButton && user?.id !== castId && (
                  <button 
                     onClick={(e) => {
                         e.preventDefault();
                         if (onFollowToggle) onFollowToggle();
                     }}
                     className={`text-[10px] tracking-widest px-3 py-1 font-medium transition-colors ${
                       isFollowing 
                         ? 'border border-[#E5E5E5] text-[#777777] bg-[#F9F9F9] hover:bg-[#E5E5E5]' 
                         : 'bg-black text-white border border-black hover:bg-black/80'
                     }`}
                  >
                     {isFollowing ? 'フォロー中' : 'フォロー'}
                  </button>
              )}
              {user?.is_admin && onDelete && (
                <button onClick={() => onDelete(id)} className="text-[#bbb] hover:text-red-500 transition-colors ml-2">
                  <span className="text-[10px] border border-current px-2 py-0.5">削除</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="relative mb-4">
              <p className={`text-[13px] text-[#333333] leading-relaxed whitespace-pre-wrap break-words font-light ${localIsLocked ? 'blur-[4px] select-none pointer-events-none' : ''}`}>
                {content}
              </p>
              {localIsLocked && images.length === 0 && (
                  <div 
                      className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
                      onClick={() => {
                          if (!user) {
                              if (typeof window !== 'undefined') {
                                  sessionStorage.setItem('authRedirect', `/cast/${castId}`);
                              }
                              setShowAuthModal(true);
                          } else {
                              setShowLockedPromptModal(true);
                          }
                      }}
                  >
                      <div className="flex items-center gap-2 bg-black/80 px-4 py-2 text-white text-[10px] tracking-widest font-bold">
                          <Lock size={14} />
                          {lockReason}
                      </div>
                  </div>
              )}
          </div>

          {/* Images Grid */}
          {images.length > 0 && (
            <div 
              className={`grid gap-[1px] mb-4 bg-[#E5E5E5] border border-[#E5E5E5] ${shouldBlur ? 'cursor-pointer' : ''} ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}
            >
                {images.map((img, idx) => {
                    const isVideo = img.match(/\.(mp4|mov|webm)$/i);
                    return (
                    <div 
                       key={idx} 
                       onClick={() => {
                         if (localIsLocked) {
                             if (!user) {
                                 if (typeof window !== 'undefined') {
                                     sessionStorage.setItem('authRedirect', `/cast/${castId}`);
                                 }
                                 setShowAuthModal(true);
                             }
                             else setShowLockedPromptModal(true);
                             return;
                         }
                         if (user?.settings?.image_blur_enabled && !isImagesRevealed) {
                             setIsImagesRevealed(true);
                             return;
                         }
                         setFullscreenMedia(img);
                       }}
                       className={`relative aspect-square cursor-pointer bg-[#F9F9F9] overflow-hidden ${images.length === 3 && idx === 0 ? 'col-span-2 aspect-[2/1]' : ''}`}
                    >
                         {isVideo ? (
                             <>
                               <video 
                                  src={img} 
                                  className={`object-cover w-full h-full transition-all duration-700 pointer-events-none ${shouldBlur ? 'blur-xl scale-110' : ''}`} 
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                               />
                               {!shouldBlur && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                     <div className="bg-black/40 rounded-full p-3 backdrop-blur-sm shadow-md">
                                        <Play size={24} className="text-white fill-white ml-1" />
                                     </div>
                                  </div>
                               )}
                             </>
                          ) : (
                             // eslint-disable-next-line @next/next/no-img-element
                             <img 
                                src={img} 
                                alt="Post media" 
                                className={`object-cover w-full h-full transition-all duration-700 ${shouldBlur ? 'blur-xl scale-110' : ''}`} 
                                loading="lazy" 
                             />
                         )}
                         
                         {!shouldBlur && <MediaWatermark />}
                        {shouldBlur && idx === 0 && (
                           <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                               {localIsLocked ? (
                                   <div className="flex items-center gap-2 bg-black/80 px-4 py-2 text-white text-[10px] tracking-widest font-bold shadow-lg">
                                       <Lock size={14} />
                                       {lockReason}
                                   </div>
                               ) : (
                                   <div className="bg-black/60 text-white text-[10px] tracking-widest px-4 py-2 font-medium">
                                       タップしてメディアを表示
                                   </div>
                               )}
                           </div>
                        )}
                    </div>
                )})}
            </div>
          )}

          {/* Business Info Banner - Minimalist High Fashion */}
          {isWorkingToday && (
              <div className="border border-black p-4 mb-4 space-y-4 bg-white relative">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-none ${statusText === '受付終了' ? 'bg-[#777777]' : 'bg-[#E02424] animate-pulse'}`}></span>
                          <span className={`font-bold text-[11px] tracking-widest ${statusText === '受付終了' ? 'text-[#777777]' : 'text-[#E02424] animate-pulse'}`}>
                              {statusText || "本日出勤中"}
                          </span>
                      </div>
                  </div>
                  {nextAvailableTime && (
                      <div className="flex items-center text-[11px] text-[#777777] gap-2 font-light tracking-widest">
                          <Clock size={12} className={nextAvailableTime === '待機中' ? 'text-[#E02424]' : 'text-black'} />
                          {nextAvailableTime.startsWith('次回出勤') ? (
                              <span><strong className="text-black font-medium">{nextAvailableTime}</strong></span>
                          ) : (
                              <span>次回の空き時間: <strong className={nextAvailableTime === '待機中' ? 'text-[#E02424] font-bold' : 'text-black font-medium'}>{nextAvailableTime}{nextAvailableTime !== '待機中' ? '〜' : ''}</strong></span>
                          )}
                      </div>
                  )}
                  {statusText !== '受付終了' && (
                      <Link href={`/reserve/${castId}`} className="premium-btn w-full flex items-center justify-center gap-2 py-3 text-sm tracking-widest w-full">
                          <CalendarCheck size={16} className="stroke-[1.5]" />
                          今すぐ予約する
                      </Link>
                  )}
              </div>
          )}


        </div>
      </div>
      
      {/* Auth Modal for Guests */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="absolute top-6 left-6 border border-white/50 bg-white/50 rounded-full z-10">
             <button 
               onClick={() => setShowAuthModal(false)} 
               className="flex items-center justify-center w-10 h-10 text-black hover:bg-black hover:text-white transition-colors rounded-full shadow-sm"
             >
               <ArrowLeft size={16} className="stroke-[2]" />
             </button>
           </div>
           
           <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col items-center">
             <div className="w-12 h-12 border border-black flex items-center justify-center mb-6 text-black">
               <Lock size={20} className="stroke-[1.5]" />
             </div>
             <h3 className="text-sm font-bold tracking-widest mb-2 uppercase">Members Only</h3>
             <p className="text-[10px] text-[#777777] mb-6 tracking-widest">これより先は会員登録が必要です</p>
             
             <div className="w-full bg-[#F9F9F9] border border-[#E5E5E5] p-5 mb-8 text-left space-y-4">
                 <p className="text-[11px] font-bold tracking-widest border-b border-[#E5E5E5] pb-2 mb-4 uppercase">無料会員登録のメリット</p>
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
               <button onClick={() => { setShowAuthModal(false); router.push('/register'); }} className="premium-btn w-full py-4 text-xs tracking-widest">
                 無料会員登録に進む
               </button>
               <button onClick={() => setShowAuthModal(false)} className="w-full py-4 text-xs tracking-widest text-[#777777] border border-[#E5E5E5] bg-white hover:bg-[#F9F9F9] transition-colors">
                 閉じる
               </button>
             </div>
           </div>
        </div>
      )}

      {/* Fullscreen Media Viewer */}
      {fullscreenMedia && (
        <div 
          className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-200"
          onClick={() => setFullscreenMedia(null)}
        >
           <button 
             onClick={() => setFullscreenMedia(null)}
             className="absolute top-4 right-4 p-2 text-white bg-black/50 border border-white/20 rounded-full hover:bg-white/20 transition-colors z-10"
           >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
           </button>
           
           <div 
             className="relative inline-block max-w-[95vw] max-h-[75vh] bg-black overflow-hidden rounded-lg shadow-2xl"
             onClick={(e) => e.stopPropagation()}
           >
              {fullscreenMedia.match(/\.(mp4|mov|webm)$/i) ? (
                 <video 
                   src={fullscreenMedia} 
                   className="max-w-[95vw] max-h-[75vh] w-auto h-auto block" 
                   controls 
                   controlsList="nodownload nofullscreen"
                   disablePictureInPicture
                   autoPlay 
                   playsInline 
                 />
              ) : (
                 // eslint-disable-next-line @next/next/no-img-element
                 <img 
                   src={fullscreenMedia} 
                   alt="Fullscreen media" 
                   className="max-w-[95vw] max-h-[75vh] w-auto h-auto block" 
                 />
              )}
              <MediaWatermark />
           </div>
           
           <div className="mt-8 text-center animate-in slide-in-from-bottom-2 duration-500 max-w-[90vw]">
             <p className="text-white/90 text-xs tracking-widest font-bold mb-1.5 flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#E02424]"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
                スクショ等による保存・無断転載はご遠慮下さい
             </p>
             <p className="text-white/50 text-[10px] tracking-widest leading-relaxed">
               万が一流出が確認された場合、透かしIDより<br/>特定を行い、法的措置の対象となる場合がございます
             </p>
           </div>
        </div>
      )}
      {/* Locked Post Prompt Modal */}
      {showLockedPromptModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm p-6 border border-[#E5E5E5] flex flex-col items-center">
             <div className="w-12 h-12 border border-black flex items-center justify-center mb-6 text-black">
               <Lock size={20} className="stroke-[1.5]" />
             </div>
             <h3 className="text-sm font-bold tracking-widest mb-2 uppercase text-black">Followers Only</h3>
             
             <div className="text-xs text-[#333333] tracking-widest leading-relaxed mb-8 flex flex-col gap-4 text-center mt-3">
               <p>
                 「<span className="font-bold text-black">フォロー</span>」していただきますと、<br />
                 フォロワー様だけの限定コンテンツをご覧いただけます。
               </p>
               <p className="font-bold text-[#E02424]">ぜひ、下記ボタンよりチェックしてみてください。</p>
             </div>
             
             <div className="w-full flex">
               <button 
                 onClick={() => setShowLockedPromptModal(false)}
                 className="flex-1 py-4 text-xs tracking-widest text-[#777777] border border-[#E5E5E5] bg-white hover:bg-[#F9F9F9] transition-colors"
               >
                 キャンセル
               </button>
               <button 
                 onClick={handleDirectFollow}
                 className="flex-1 py-4 text-xs tracking-widest bg-black text-white hover:bg-black/90 transition-colors font-bold"
               >
                 フォローする
               </button>
             </div>
           </div>
        </div>
      )}
    </article>
  );
}
