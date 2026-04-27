"use client";
import React, { useState, useEffect } from 'react';

export default function AgeGuard({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState(true); // Default true to avoid flash before effect
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const verified = localStorage.getItem('age_verified');
    if (verified !== 'true') {
      setIsVerified(false);
    }
    setIsChecking(false);
  }, []);

  const handleEnter = () => {
    localStorage.setItem('age_verified', 'true');
    setIsVerified(true);
  };

  const handleExit = () => {
    window.location.href = 'https://google.com';
  };

  if (isChecking) {
    return <div className="min-h-screen bg-white" />; // Sleek transition
  }

  if (!isVerified) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white text-black flex flex-col items-center justify-center p-6 font-light">
        <div className="max-w-sm w-full text-center space-y-10">
            <img src="/images/logo.png" alt="HimeMatch" className="w-64 md:w-80 h-auto object-contain mx-auto mb-6" />
            
            <div className="space-y-4">
                <p className="text-[#E02424] font-medium tracking-widest text-sm border border-[#E02424] inline-block px-4 py-2">
                    18歳未満アクセス禁止
                </p>
                <p className="text-xs leading-loose tracking-widest text-[#555555]">
                    当サイトは18歳未満（高校生含む）の方、<br/>
                    および閲覧を禁止されている地域からの<br/>
                    アクセスは固くお断りいたします。<br/>
                    あなたは18歳以上ですか？
                </p>
            </div>

            <div className="flex flex-col gap-4 mt-12 w-full px-4">
                <button 
                  onClick={handleEnter}
                  className="w-full bg-black text-white py-4 text-xs tracking-widest font-bold tracking-[0.2em]"
                >
                  YES (18歳以上・入店する)
                </button>
                <button 
                  onClick={handleExit}
                  className="w-full bg-transparent border border-[#777777] text-[#777777] py-4 text-xs tracking-widest hover:bg-[#F9F9F9] transition-colors"
                >
                  NO (18歳未満・退出する)
                </button>
            </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
