"use client";
import React, { useState, useEffect } from 'react';
import { useUser } from '@/providers/UserProvider';
import { Lock, ArrowRight } from 'lucide-react';

export default function AppLockGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Determine if we need to show the lock screen
    if (!isLoading) {
      if (!user || user.settings?.app_lock_enabled !== true) {
        setIsUnlocked(true); // Don't lock if not logged in or disabled
      } else {
        const unlocked = sessionStorage.getItem('app_unlocked') === 'true';
        setIsUnlocked(unlocked);
      }
      setIsChecking(false);
    }
  }, [user, isLoading]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (phoneInput === user.phone) {
      sessionStorage.setItem('app_unlocked', 'true');
      setIsUnlocked(true);
      setErrorMsg("");
    } else {
      setErrorMsg("電話番号が一致しません");
    }
  };

  if (isLoading || isChecking) {
    // 完全に真っ黒になるのを防ぐため、ローディング中は一時的に透明または白にする
    return <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  if (!isUnlocked) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center p-6 text-white font-light text-center">
        <div className="w-16 h-16 border border-white/20 flex items-center justify-center mb-8">
            <Lock size={24} className="stroke-[1]" />
        </div>
        
        <h1 className="text-xl tracking-[0.2em] uppercase mb-4 font-normal">App Locked</h1>
        <p className="text-xs text-white/50 tracking-widest mb-12 leading-relaxed">
          プライバシー保護機能が有効です。<br/>ご登録の電話番号を入力してロックを解除してください。
        </p>
        
        {errorMsg && (
          <p className="text-[#E02424] text-xs tracking-widest mb-6">{errorMsg}</p>
        )}

        <form onSubmit={handleUnlock} className="w-full max-w-xs space-y-8">
          <input 
            type="tel"
            autoFocus
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="電話番号を入力"
            className="w-full bg-transparent border-b border-white/30 pb-3 text-center text-lg outline-none focus:border-white transition-colors tracking-widest placeholder:text-white/20"
          />
          <button type="submit" className="w-full bg-white text-black py-4 text-xs tracking-widest uppercase flex items-center justify-center gap-2 group hover:bg-white/90 transition-colors">
             解除する
             <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
