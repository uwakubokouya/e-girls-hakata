"use client";
import { useUser } from "@/providers/UserProvider";
import { LogOut, ChevronRight, User as UserIcon, Settings, Bell, CircleHelp, MessageSquare, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function MyPage() {
  const { user, logout, hasUnreadNotifications } = useUser();

  return (
    <div className="min-h-screen bg-[#F9F9F9] pb-24 font-light">
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E5E5] px-6 py-4">
        <h1 className="text-sm font-normal tracking-widest font-bold">マイページ</h1>
      </header>

      <main className="p-6 space-y-6">
        {/* User Card */}
        <div className="bg-white border border-[#E5E5E5] p-6 flex items-center gap-4">
          <div className="w-16 h-16 border border-black p-0.5 overflow-hidden">
            {user?.avatar_url ? (
               <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
               <div className="w-full h-full bg-[#E5E5E5] flex items-center justify-center text-[#777777]">
                 <UserIcon size={24} className="stroke-[1.5]" />
               </div>
            )}
          </div>
          <div>
            <h2 className="text-lg font-normal tracking-widest uppercase mb-1">{user?.name || "ゲスト"}</h2>
            <p className="text-[10px] text-[#777777] tracking-widest bg-[#F9F9F9] inline-block px-2 py-0.5 border border-[#E5E5E5]">
              {user?.role === "cast" ? "キャスト" : "お客様"}
            </p>
          </div>
        </div>

        {/* Post Creation Action (Cast & Admin Only) */}
        {(user?.role === 'cast' || user?.is_admin) && (
          <Link href="/post" className="premium-btn w-full py-4 text-sm tracking-widest flex items-center justify-center gap-2">
            <MessageSquare size={18} className="stroke-[1.5]" />
            新しい投稿を作成
          </Link>
        )}

        {/* Menu Links */}
        <div className="bg-white border border-[#E5E5E5]">
          {user?.role === 'cast' ? (
            <Link href={`/cast/${user.id}`} className="w-full px-6 py-4 flex items-center justify-between border-b border-[#E5E5E5] hover:bg-[#F9F9F9] transition-colors">
              <div className="flex items-center gap-3">
                <UserIcon size={18} className="stroke-[1.5]" />
                <span className="text-xs tracking-widest">プロフィール確認</span>
              </div>
              <ChevronRight size={16} className="text-[#777777]" />
            </Link>
          ) : (
            <Link href="/mypage/settings" className="w-full px-6 py-4 flex items-center justify-between border-b border-[#E5E5E5] hover:bg-[#F9F9F9] transition-colors">
              <div className="flex items-center gap-3">
                <UserIcon size={18} className="stroke-[1.5]" />
                <span className="text-xs tracking-widest">アカウント設定</span>
              </div>
              <ChevronRight size={16} className="text-[#777777]" />
            </Link>
          )}
          {user?.role !== 'cast' && (
            <Link href="/mypage/notifications" className="w-full px-6 py-4 flex items-center justify-between border-b border-[#E5E5E5] hover:bg-[#F9F9F9] transition-colors">
              <div className="flex items-center gap-3 relative">
                <div className="relative">
                  {hasUnreadNotifications ? (
                    <Bell size={18} className="stroke-[1.5] text-[#E02424] fill-[#E02424] animate-ring origin-top" />
                  ) : (
                    <Bell size={18} className="stroke-[1.5]" />
                  )}
                </div>
                <span className="text-xs tracking-widest">お知らせ</span>
              </div>
              <ChevronRight size={16} className="text-[#777777]" />
            </Link>
          )}
          {user?.role === 'cast' ? (
            <Link href="/mypage/settings?open=pref" className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F9F9F9] transition-colors">
              <div className="flex items-center gap-3">
                <Settings size={18} className="stroke-[1.5]" />
                <span className="text-xs tracking-widest">推しポイント設定</span>
              </div>
              <ChevronRight size={16} className="text-[#777777]" />
            </Link>
          ) : (
            <Link href="/mypage/system-settings" className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F9F9F9] transition-colors">
              <div className="flex items-center gap-3">
                <Settings size={18} className="stroke-[1.5]" />
                <span className="text-xs tracking-widest">各種設定</span>
              </div>
              <ChevronRight size={16} className="text-[#777777]" />
            </Link>
          )}

          {user?.role === 'cast' && (
            <Link href="/mypage/dm-settings" className="w-full px-6 py-4 flex items-center justify-between border-t border-[#E5E5E5] hover:bg-[#F9F9F9] transition-colors">
              <div className="flex items-center gap-3">
                <MessageSquare size={18} className="stroke-[1.5]" />
                <span className="text-xs tracking-widest">DM受信設定</span>
              </div>
              <ChevronRight size={16} className="text-[#777777]" />
            </Link>
          )}

          {user?.role === 'cast' && (
            <Link href="/mypage/footprints" className="w-full px-6 py-4 flex items-center justify-between border-t border-[#E5E5E5] hover:bg-[#F9F9F9] transition-colors">
              <div className="flex items-center gap-3">
                <ShieldAlert size={18} className="stroke-[1.5] text-[#777777]" />
                <span className="text-xs tracking-widest">足跡履歴</span>
              </div>
              <ChevronRight size={16} className="text-[#777777]" />
            </Link>
          )}
        </div>

        {/* Admin Links */}
        {user?.is_admin && (
          <div className="bg-white border border-black shadow-sm flex flex-col">
            <Link href="/admin/announcement" className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F9F9F9] transition-colors border-b border-[#E5E5E5]">
              <div className="flex items-center gap-3">
                <ShieldAlert size={18} className="stroke-[1.5] text-black" />
                <span className="text-xs tracking-widest font-bold">【管理】お知らせ配信</span>
              </div>
              <ChevronRight size={16} className="text-[#777777]" />
            </Link>
            <Link href="/admin/analytics" className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F9F9F9] transition-colors">
              <div className="flex items-center gap-3">
                <ShieldAlert size={18} className="stroke-[1.5] text-black" />
                <span className="text-xs tracking-widest font-bold">【管理】アクセス解析</span>
              </div>
              <ChevronRight size={16} className="text-[#777777]" />
            </Link>
          </div>
        )}

        {/* Support Links */}
        {user?.role !== 'cast' && (
          <div className="bg-white border border-[#E5E5E5]">
            <Link href="/mypage/help" className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F9F9F9] transition-colors">
              <div className="flex items-center gap-3">
                <CircleHelp size={18} className="stroke-[1.5]" />
                <span className="text-xs tracking-widest">ヘルプとサポート</span>
              </div>
              <ChevronRight size={16} className="text-[#777777]" />
            </Link>
            <Link href="/mypage/feedback" className="w-full px-6 py-4 flex items-center justify-between border-t border-[#E5E5E5] hover:bg-[#F9F9F9] transition-colors">
              <div className="flex items-center gap-3">
                <MessageSquare size={18} className="stroke-[1.5]" />
                <span className="text-xs tracking-widest">ご意見・ご要望</span>
              </div>
              <ChevronRight size={16} className="text-[#777777]" />
            </Link>
          </div>
        )}

        {/* Logout / Login Button */}
        <div className="pt-4">
          {user ? (
            <button 
              onClick={() => logout()}
              className="w-full py-4 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2 group"
            >
              <LogOut size={16} className="stroke-[1.5]" />
              <span className="text-[10px] font-medium tracking-widest uppercase">ログアウト</span>
            </button>
          ) : (
            <Link 
              href="/login"
              className="w-full py-4 border border-black bg-black text-white hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2 group"
            >
              <span className="text-[10px] font-medium tracking-widest uppercase">ログイン / 新規会員登録</span>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
