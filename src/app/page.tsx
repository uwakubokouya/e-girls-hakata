"use client";
import React from 'react';
import Link from 'next/link';
import { useUser } from '@/providers/UserProvider';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AreaSelectionPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  // --- Start Added Logic for Auto-Resume ---
  const [lastArea, setLastArea] = React.useState<string | null>(null);
  React.useEffect(() => {
    // 1. Check user role and redirect to their prefecture if applicable
    const checkUserArea = async () => {
      if (!user) return;

      if (user.role === 'cast') {
        router.replace(`/cast/${user.id}`);
        return; // Exit after redirect
      } else if (user.role === 'store' && user.phone) {
        const { data: storeProfile } = await supabase
          .from('profiles')
          .select('prefecture')
          .eq('username', user.phone)
          .eq('role', 'admin')
          .maybeSingle();

        if (storeProfile?.prefecture) {
          router.replace(`/${encodeURIComponent(storeProfile.prefecture)}`);
          return; // Exit after redirect
        }
      }
    };

    if (!isLoading && user) {
      checkUserArea();
    }

    // 2. Load last selected area for normal users
    const saved = localStorage.getItem('last_prefecture');
    if (saved === '全国') {
      localStorage.removeItem('last_prefecture');
    } else if (saved) {
      setLastArea(saved);
    }
  }, [user, isLoading, router]);
  // --- End Added Logic ---
  const regions = [
    { name: "北海道・東北", prefectures: ["北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島"] },
    { name: "関東", prefectures: ["東京", "神奈川", "埼玉", "千葉", "茨城", "栃木", "群馬"] },
    { name: "中部", prefectures: ["愛知", "静岡", "岐阜", "三重", "新潟", "富山", "石川", "福井", "山梨", "長野"] },
    { name: "近畿", prefectures: ["大阪", "京都", "兵庫", "奈良", "滋賀", "和歌山"] },
    { name: "中国・四国", prefectures: ["広島", "岡山", "山口", "鳥取", "島根", "徳島", "香川", "愛媛", "高知"] },
    { name: "九州・沖縄", prefectures: ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"] }
  ];

  return (
    <div className="min-h-screen bg-white text-black font-light pb-20">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md">
        <div className="px-4 text-center flex flex-col items-center">
          <img src="/images/logo.png" alt="HimeMatch" className="w-64 md:w-80 h-auto object-contain" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-12 text-center">
          <h2 className="text-sm tracking-widest font-bold mb-4 uppercase">Area Selection</h2>
          <p className="text-xs tracking-widest text-[#777777] leading-loose">
            ご覧になりたいエリアを選択してください。<br/>
            厳選されたキャスト情報をお届けします。
          </p>
        </div>

        {lastArea && (
          <div className="mb-12 animate-in fade-in zoom-in duration-500">
            <Link href={`/${lastArea}`} className="block w-full border border-black bg-black text-white p-6 text-center group hover:bg-white hover:text-black transition-colors">
              <p className="text-[10px] tracking-widest mb-2 opacity-80 uppercase">Last Selected Area</p>
              <p className="text-lg tracking-[0.2em] font-bold group-hover:scale-105 transition-transform inline-block">
                前回選択したエリア ({decodeURIComponent(lastArea)}) に戻る
              </p>
            </Link>
          </div>
        )}

        <div className="space-y-12">
          {regions.map((region) => (
            <section key={region.name} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h3 className="text-xs font-bold tracking-[0.2em] mb-6 border-b border-black pb-3 uppercase">{region.name}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {region.prefectures.map((pref) => (
                  <Link 
                    key={pref} 
                    href={`/${pref}`}
                    className="group border border-[#E5E5E5] p-5 text-center transition-all hover:bg-black hover:text-white hover:border-black"
                  >
                    <span className="text-sm tracking-[0.2em] transition-transform group-hover:scale-105 inline-block">
                      {pref}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      
      <footer className="border-t border-[#E5E5E5] mt-20 py-10 text-center">
          <p className="text-[10px] tracking-[0.3em] text-[#777777] uppercase">&copy; HimeMatch All Rights Reserved.</p>
      </footer>
    </div>
  );
}
