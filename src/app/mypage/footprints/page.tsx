"use client";
import { useEffect, useState } from 'react';
import { useUser } from '@/providers/UserProvider';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function FootprintsPage() {
  const { user, checkUnreadFootprints } = useUser();
  const router = useRouter();
  const [footprints, setFootprints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [likedFootprintIds, setLikedFootprintIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || user.role !== 'cast') {
      router.replace('/mypage');
      return;
    }

    const fetchFootprints = async () => {
      setIsLoading(true);
      const snsProfileId = user.id;

      const { data, error } = await supabase
        .from('sns_footprints')
        .select(`
          id,
          created_at,
          viewer_id,
          sns_profiles!sns_footprints_viewer_id_fkey (
            name,
            avatar_url
          )
        `)
        .eq('cast_id', snsProfileId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setFootprints(data);
      }

      // Fetch existing likes sent by this cast (ignoring SYSTEM_ACCEPT)
      const { data: likesData } = await supabase
        .from('sns_messages')
        .select('receiver_id, content')
        .eq('sender_id', snsProfileId)
        .like('content', '[SYSTEM_LIKE]%');

      if (likesData) {
         const likedIds = new Set<string>();
         likesData.forEach(d => {
             likedIds.add(d.receiver_id);
         });
         setLikedFootprintIds(likedIds);
      }

      setIsLoading(false);
    };

    fetchFootprints();
  }, [user, router]);

  const handleSendLike = async (viewerId: string, viewerName: string) => {
      if (likedFootprintIds.has(viewerId)) return;
      
      // Update local state immediately
      setLikedFootprintIds(prev => new Set(prev).add(viewerId));
      
      if (!user) return;
      
      // Insert LIKE into messages to bypass sns_notifications RLS
      const { error: notifError } = await supabase
        .from('sns_messages')
        .insert({
           sender_id: user.id,
           receiver_id: viewerId,
           content: `[SYSTEM_LIKE]${user?.name || 'キャスト'}さんからいいねが届いています！早速チェックしてみて！`,
           is_read: false
        });
      if (notifError) {
          console.error("Notification insert error:", notifError);
      } else if (checkUnreadFootprints) {
          await checkUnreadFootprints();
      }
  };

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

  return (
    <div className="min-h-screen bg-[#F9F9F9] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E5E5E5] px-4 py-4 flex items-center">
        <button onClick={() => router.back()} className="mr-4">
          <ArrowLeft size={20} className="stroke-[1.5]" />
        </button>
        <h1 className="text-sm font-bold tracking-widest uppercase">足跡履歴</h1>
      </header>

      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : footprints.length > 0 ? (
          <div className="space-y-[1px] bg-[#E5E5E5]">
            {footprints.map((item) => (
              <div key={item.id} className="bg-white p-4 flex items-center gap-4">
                <Link href={`/messages/${item.viewer_id}`} className="shrink-0">
                  <div className="w-12 h-12 bg-[#F9F9F9] border border-[#E5E5E5] overflow-hidden">
                    <img 
                      src={item.sns_profiles?.avatar_url || "/images/no-photo.jpg"} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </Link>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <Link href={`/messages/${item.viewer_id}`} className="font-bold text-sm tracking-widest truncate text-black hover:opacity-70 transition-opacity">
                      {item.sns_profiles?.name || "名称未設定"}
                    </Link>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[#777777] tracking-widest">
                    <Clock size={10} />
                    <span>{getTimeAgo(item.created_at)}</span>
                  </div>
                </div>
                
                {item.viewer_id !== user?.id && (
                  likedFootprintIds.has(item.viewer_id) ? (
                    <button disabled className="shrink-0 text-[10px] tracking-widest font-bold px-4 py-2 border border-[#E5E5E5] bg-[#F9F9F9] text-[#777777]">
                      いいね済
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleSendLike(item.viewer_id, item.sns_profiles?.name)}
                      className="shrink-0 text-[10px] tracking-widest font-bold border border-black px-4 py-2 bg-black text-white hover:bg-white hover:text-black transition-colors"
                    >
                      いいねを送る
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-[#777777]">
            <p className="text-xs tracking-widest">まだ足跡はありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
