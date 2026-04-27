"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MessageCircle, Phone, ChevronRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/providers/UserProvider";

export default function HelpAndSupportPage() {
  const router = useRouter();
  const { user } = useUser();
  const isCastOrStore = user?.role === 'cast' || user?.role === 'store';
  
  // Accordion state
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
      if (openFaqId === id) setOpenFaqId(null);
      else setOpenFaqId(id);
  };

  const faqs = [
      {
          id: "faq-1",
          q: "通知が届きません",
          a: "スマートフォンの本体設定（設定アプリ > 通知）で当アプリの通知が許可されているかご確認ください。また、マイページの「各種設定」からプッシュ通知がONになっているか併せてご確認ください。"
      },
      {
          id: "faq-2",
          q: "タイムラインの画像のぼかしを解除したい",
          a: "マイページの「各種設定」より、「画像を隠す（タップで表示）」をOFFに切り替えていただくことで、常にぼかし無しで画像が表示されるようになります。"
      },
      {
          id: "faq-3",
          q: "退会方法を教えてください",
          a: "恐れ入りますが、防犯およびなりすまし防止の観点からアプリ上での即時退会は受け付けておりません。退会・アカウントの削除をご希望のお客様は、コンシェルジュデスク（LINEまたはお電話）までご連絡くださいませ。"
      }
  ];

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col font-light">
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E5E5] flex items-center px-4 py-4">
        <button onClick={() => router.back()} className="text-black hover:text-[#777777] p-2 -ml-2 transition-colors">
          <ChevronLeft size={24} className="stroke-[1.5]" />
        </button>
        <h1 className="text-sm font-bold tracking-widest absolute left-1/2 -translate-x-1/2">ヘルプ・サポート</h1>
      </header>

      <main className="p-6 space-y-10 pb-32">
        
        {/* Concierge Section */}
        <section>
            <div className="mb-4">
                <h2 className="text-sm font-bold tracking-widest uppercase mb-1">コンシェルジュ・デスク</h2>
                <p className="text-[10px] text-[#777777] leading-relaxed tracking-widest">お急ぎのトラブルやご相談はこちらの窓口にて、担当スタッフが迅速に対応いたします。</p>
            </div>
            
            <div className="space-y-3">
                <a 
                    href="https://lin.ee/zL6IbU1" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-[#06C755] text-white p-4 flex items-center justify-center gap-3 hover:bg-[#05b34c] transition-colors"
                >
                    <MessageCircle size={20} className="stroke-[1.5]" />
                    <span className="text-sm tracking-widest font-medium">LINEでお問い合わせ（推奨）</span>
                </a>
                
                <a 
                    href="tel:092-409-9171" 
                    className="w-full bg-white border border-black text-black p-4 flex items-center justify-center gap-3 hover:bg-[#F9F9F9] transition-colors"
                >
                    <Phone size={20} className="stroke-[1.5]" />
                    <span className="text-sm tracking-widest">お電話でのお問い合わせ</span>
                </a>
            </div>
        </section>

        {/* Guides Section */}
        <section>
            <div className="mb-4">
                <h2 className="text-sm font-bold tracking-widest">ご利用ガイド</h2>
            </div>
            <div className="bg-white border border-[#E5E5E5]">
                <Link href="/mypage/help/about" className={`flex items-center justify-between p-4 hover:bg-[#F9F9F9] ${!isCastOrStore ? 'border-b border-[#E5E5E5]' : ''}`}>
                    <span className="text-xs tracking-widest">HimeMatchのご利用ガイド</span>
                    <ChevronRight size={16} className="text-[#777777]" />
                </Link>
                {!isCastOrStore && (
                  <Link href="/mypage/help/flow" className="flex items-center justify-between p-4 hover:bg-[#F9F9F9]">
                      <span className="text-xs tracking-widest">ご予約・キャンセルの流れ</span>
                      <ChevronRight size={16} className="text-[#777777]" />
                  </Link>
                )}
            </div>
        </section>

        {/* FAQ Section */}
        {!isCastOrStore && (
          <section>
              <div className="mb-4">
                  <h2 className="text-sm font-bold tracking-widest">よくあるご質問</h2>
              </div>
              <div className="bg-white border border-[#E5E5E5]">
                  {faqs.map((faq, idx) => (
                      <div key={faq.id} className={`${idx !== faqs.length - 1 ? 'border-b border-[#E5E5E5]' : ''}`}>
                          <button 
                              onClick={() => toggleFaq(faq.id)}
                              className="w-full flex items-center justify-between p-4 hover:bg-[#F9F9F9] transition-colors text-left"
                          >
                              <span className="text-xs tracking-widest leading-relaxed pr-4 font-medium"><span className="text-black font-bold mr-2">Q.</span>{faq.q}</span>
                              <ChevronDown size={16} className={`text-[#777777] transition-transform duration-300 ${openFaqId === faq.id ? 'rotate-180' : ''}`} />
                          </button>
                          <div 
                              className={`overflow-hidden transition-all duration-300 ${openFaqId === faq.id ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                          >
                              <div className="p-4 pt-0 text-[11px] text-[#555] leading-loose tracking-widest bg-[#F9F9F9] border-t border-[#E5E5E5]">
                                  <span className="text-black font-bold mr-2">A.</span>{faq.a}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </section>
        )}

        {/* Legal Section */}
        {!isCastOrStore && (
          <section>
              <div className="mb-4">
                  <h2 className="text-sm font-bold tracking-widest">法令・ポリシー</h2>
              </div>
              <div className="bg-white border border-[#E5E5E5]">
                  <Link href="/mypage/help/terms" className="flex items-center justify-between p-4 border-b border-[#E5E5E5] hover:bg-[#F9F9F9]">
                      <span className="text-xs tracking-widest">利用規約</span>
                      <ChevronRight size={16} className="text-[#777777]" />
                  </Link>
                  <Link href="/mypage/help/privacy" className="flex items-center justify-between p-4 border-b border-[#E5E5E5] hover:bg-[#F9F9F9]">
                      <span className="text-xs tracking-widest">プライバシーポリシー</span>
                      <ChevronRight size={16} className="text-[#777777]" />
                  </Link>
                  <Link href="/mypage/help/tokushoho" className="flex items-center justify-between p-4 hover:bg-[#F9F9F9]">
                      <span className="text-xs tracking-widest">店舗情報</span>
                      <ChevronRight size={16} className="text-[#777777]" />
                  </Link>
              </div>
          </section>
        )}

      </main>
    </div>
  );
}
