"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRedirect = () => {
    sessionStorage.removeItem('authRedirect'); // Clean up just in case
    
    // Always redirect to home page, avoiding authRedirect restoration
    window.location.href = "/";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) return;

    setIsLoading(true);
    setErrorMsg("");

    const dummyEmail = `${phone}@sns.local`;
    
    // 事前チェック: SNS機能が無効な店舗・キャストの場合は認証前にブロック
    const { data: storeCheck } = await supabase.from('profiles').select('sns_enabled').eq('username', phone).eq('role', 'admin').maybeSingle();
    if (storeCheck && storeCheck.sns_enabled === false) {
        setErrorMsg("この店舗はSNS機能が無効化されています。");
        setIsLoading(false);
        return;
    }
    
    const { data: castCheck } = await supabase.from('casts').select('store_id').eq('login_id', phone).maybeSingle();
    if (castCheck && castCheck.store_id) {
        const { data: p } = await supabase.from('profiles').select('sns_enabled').eq('store_id', castCheck.store_id).maybeSingle();
        if (p && p.sns_enabled === false) {
            setErrorMsg("所属店舗のSNS機能が無効化されています。");
            setIsLoading(false);
            return;
        }
    }

    // 1. Try standard Supabase Auth Login first
    let { data: authData, error } = await supabase.auth.signInWithPassword({
      email: dummyEmail,
      password: password,
    });

    if (!error && authData?.user) {
      handleRedirect();
      return;
    }

    // 2. If standard login fails or user doesn't exist, check the `casts` table directly!
    // The user inputs 'phone' field, which acts as `login_id`
    const { data: castMatch } = await supabase
      .from('casts')
      .select('*')
      .eq('login_id', phone)
      .eq('password', password)
      .maybeSingle();

    if (castMatch) {
      if (castMatch.store_id) {
          const { data: p } = await supabase.from('profiles').select('sns_enabled').eq('store_id', castMatch.store_id).maybeSingle();
          if (p && p.sns_enabled === false) {
              setErrorMsg("所属店舗のSNS機能が無効化されています。");
              setIsLoading(false);
              return;
          }
      }

      // 3. Cast verified by `casts` table! Automatically create their SNS internal auth session.
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: dummyEmail,
        password: password,
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setErrorMsg("このIDは既にSNSに登録されていますが、パスワードが一致しません。");
        } else {
          setErrorMsg("初期セットアップに失敗しました: " + signUpError.message);
        }
        setIsLoading(false);
        return;
      }

      // Check if session was actually created (e.g. Email Confirmation is required)
      if (!signUpData?.session) {
        setErrorMsg("セッションが作成されませんでした。Supabase管理画面の「Authentication > Providers > Email」で「Confirm email」がOFFになっているかご確認ください！");
        setIsLoading(false);
        return;
      }

      // Sync their profile.
      if (signUpData?.user) {
        const { error: upsertErr } = await supabase.from('sns_profiles').upsert({
          id: signUpData.user.id,
          name: castMatch.name || "キャスト",
          role: "cast",
          phone: phone, // Actually their login_id
          avatar_url: castMatch.profile_image_url || castMatch.avatar_url || null,
        });

        if (upsertErr) {
           console.error("Profile upsert failed during cast login:", upsertErr);
        }
      }

      handleRedirect();
      return;
    }

    // 3. New: Check the `profiles` table directly for admin/store accounts!
    // The user inputs 'phone' field, which acts as `username`
    const { data: adminMatch } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', phone)
      .eq('password_memo', password)
      .eq('role', 'admin')
      .maybeSingle();

    if (adminMatch) {
      if (adminMatch.sns_enabled === false) {
          setErrorMsg("この店舗はSNS機能が無効化されています。");
          setIsLoading(false);
          return;
      }

      // Create their SNS internal auth session
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: dummyEmail,
        password: password,
      });

      if (signUpError && signUpError.message.includes('already registered')) {
         // They already have an SNS auth account, log them in
         const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: dummyEmail,
            password: password,
         });
         if (signInErr) {
             setErrorMsg("店舗アカウントのログインに失敗しました（再認証エラー）。");
             setIsLoading(false);
             return;
         }
      } else if (signUpError) {
        setErrorMsg("店舗アカウントの初期セットアップに失敗しました: " + signUpError.message);
        setIsLoading(false);
        return;
      }

      // Sync their profile as 'store'.
      // Note: we fetch the current session to get the Auth ID since it might be different from adminMatch.id
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error: upsertErr } = await supabase.from('sns_profiles').upsert({
          id: session.user.id,
          name: adminMatch.full_name || adminMatch.username || "店舗公式",
          role: "store",
          phone: phone, // Actually their username, used to link with profiles later
          is_admin: true,
          avatar_url: adminMatch.avatar_url || null,
        }, { onConflict: 'id' });

        if (upsertErr) {
           console.error("Profile upsert failed during admin login:", upsertErr);
        }
      }

      handleRedirect();
      return;
    }

    // 4. Fails normal, cast, and admin tables
    setErrorMsg("ログインに失敗しました。ID（電話番号）とパスワードをご確認ください。");
    setIsLoading(false);
  };

  const handleGuestLogin = () => {
    // Just navigate to public feed, they are unauthenticated.
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-8 pt-24 font-light">
      <div className="mb-8">
        <h1 className="text-3xl font-normal tracking-widest uppercase mb-2">Login</h1>
        <p className="text-sm text-[#777777]">HimeMatchへようこそ。</p>
      </div>

      {errorMsg && (
        <div className="mb-6 flex flex-col gap-2">
          <div className="p-4 border border-red-500 bg-red-50 text-red-600 text-xs tracking-widest leading-relaxed">
            {errorMsg}
          </div>
          <div className="text-right">
            <Link href="/mypage/feedback" className="text-[10px] text-[#777777] underline underline-offset-2 hover:text-black transition-colors tracking-widest">
              パスワードをお忘れの場合はコチラ
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-8">
        <div className="space-y-1 block">
          <label className="text-[10px] uppercase tracking-widest text-[#777777]">Phone Number</label>
          <input 
            type="tel"
            required
            autoComplete="off"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full border-b border-[#E5E5E5] pb-2 text-lg outline-none focus:border-black transition-colors bg-transparent rounded-none"
            placeholder="携帯電話番号"
          />
        </div>

        <div className="space-y-1 block mb-12">
          <label className="text-[10px] uppercase tracking-widest text-[#777777]">Password</label>
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border-b border-[#E5E5E5] pb-2 text-lg outline-none focus:border-black transition-colors bg-transparent rounded-none pr-10"
              placeholder="パスワード"
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-[80%] text-[#777777] p-2 hover:text-black transition-colors"
            >
              {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        <button disabled={isLoading} type="submit" className="w-full premium-btn py-4 flex items-center justify-center gap-2 group disabled:opacity-50">
          <span className="tracking-widest">{isLoading ? "ログイン中..." : "ログイン"}</span>
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </form>

      <div className="mt-8 mb-6">
        <button 
          onClick={handleGuestLogin}
          type="button" 
          className="w-full bg-transparent border border-black text-black py-4 flex items-center justify-center tracking-widest hover:bg-black hover:text-white transition-colors"
        >
          ゲストとして続行
        </button>
      </div>

      <div className="mt-6 text-center text-sm">
        <span className="text-[#777777]">アカウントをお持ちでないですか？</span>
        <Link href="/register" className="block mt-2 underline tracking-widest font-normal hover:text-[#777777] transition-colors">
          新規会員登録
        </Link>
      </div>
      
    </div>
  );
}
