import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/layout/BottomNav";
import { UserProvider } from "@/providers/UserProvider";
import AuthGuard from "@/components/auth/AuthGuard";
import AppLockGuard from "@/components/auth/AppLockGuard";
import AgeGuard from "@/components/auth/AgeGuard";
import SecurityGuard from "@/components/security/SecurityGuard";

const inter = Inter({ subsets: ["latin"], display: 'swap' });
const notoSansJP = Noto_Sans_JP({ subsets: ["latin"], weight: ["300", "400", "500", "700"], display: 'swap' });

export const metadata: Metadata = {
  title: "HimeMatch",
  description: "Official SNS Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${notoSansJP.className} ${inter.className} bg-white text-black min-h-screen overscroll-none antialiased font-light tracking-wide`}
      >
        <UserProvider>
          <AgeGuard>
            <AuthGuard>
              <AppLockGuard>
                <SecurityGuard>
                  <div className="max-w-md mx-auto relative min-h-screen border-x border-[#E5E5E5] bg-white flex flex-col">
                    <main className="flex-1 pb-[80px]">
                      {children}
                    </main>
                    <BottomNav />
                  </div>
                </SecurityGuard>
              </AppLockGuard>
            </AuthGuard>
          </AgeGuard>
        </UserProvider>
      </body>
    </html>
  );
}
