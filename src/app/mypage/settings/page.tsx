"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ArrowRight, Eye, EyeOff, SlidersHorizontal, X, Check, Camera, User as UserIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/providers/UserProvider";
import ImageCropperModal from "@/components/ui/ImageCropperModal";

export default function AccountSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshProfile } = useUser();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bio, setBio] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [pendingCrop, setPendingCrop] = useState<string | null>(null);

  // --- Preference Modal States ---
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false);
  const [ageRange, setAgeRange] = useState({ min: "", max: "" });
  const [cupRange, setCupRange] = useState({ min: "A", max: "H" });
  const [selectedPlays, setSelectedPlays] = useState<string[]>([]);
  const [selectedOpOptions, setSelectedOpOptions] = useState<string[]>([]);
  const [selectedSM, setSelectedSM] = useState<string[]>([]);
  const [selectedBodyTypes, setSelectedBodyTypes] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>([]);

  // Preference Options
  const playOptions = ["コスプレ", "ディープキス", "全身リップ", "手コキ", "足コキ", "フェラチオ", "イラマチオ", "玉舐め", "乳首舐め", "クンニ", "シックスナイン", "顔面騎乗", "聖水", "洗体", "マットプレイ", "目隠し（お客様）", "イメージプレイ", "焦らしプレイ", "赤ちゃんプレイ", "男の潮吹き・亀頭責め", "アナル舐め・前立腺マッサージ", "口内射精", "射精管理"];
  const opOptions = ["即尺", "ローター", "電マ", "写真・動画撮影", "オナニー鑑賞", "ノースキン"];
  const smOptions = ["ドＳ", "S", "Sより", "両方", "Mより", "M", "ドＭ"];
  const bodyTypeOptions = ["スレンダー", "ぷよっこ", "小柄", "長身", "普通", "グラマー", "ぽっちゃり"];
  const featureOptions = ["素人", "巨乳", "美乳", "美脚", "美尻", "パイパン", "ギャル系", "モデル系", "現役学生", "セクシー女優", "ハーフ", "アニメ声", "黒髪", "レズビアン", "乳首ピンク", "乳輪大きい", "喫煙しない"];
  const personalityOptions = ["明るい", "癒し系", "甘えん坊", "天然", "ツンデレ", "おっとり", "恥ずかしがり屋", "人懐っこい", "エロい", "空気を読む", "オタク", "しっかり者"];

  const toggleItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
      setter(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  useEffect(() => {
    if (searchParams.get('open') === 'pref') {
      setIsPrefModalOpen(true);
    }
  }, [searchParams]);

  const handleClosePrefModal = () => {
    if (searchParams.get('open') === 'pref') {
      router.push('/mypage');
    } else {
      setIsPrefModalOpen(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setIsFetching(false);
      return;
    }

    const fetchCurrentData = async () => {
      try {
        // Fetch Profile
        const { data: profile } = await supabase
          .from('sns_profiles')
          .select('name, phone, avatar_url, bio, age_group')
          .eq('id', user.id)
          .single();

        if (profile) {
          setName(profile.name || "");
          setPhone(profile.phone || "");
          setAvatarUrl(profile.avatar_url || "");
          setBio(profile.bio || "");
          setAgeGroup(profile.age_group || "");
        }
        
        // Fetch Preferences
        const { data: prefs, error: prefsError } = await supabase
          .from('sns_user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (prefs) {
            setAgeRange({ min: prefs.age_min || "", max: prefs.age_max || "" });
            setCupRange({ min: prefs.cup_min || "A", max: prefs.cup_max || "H" });
            setSelectedPlays(prefs.plays || []);
            setSelectedOpOptions(prefs.op_options || []);
            setSelectedSM(prefs.sm_types || []);
            setSelectedBodyTypes(prefs.body_types || []);
            setSelectedFeatures(prefs.features || []);
            setSelectedPersonalities(prefs.personalities || []);
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      } finally {
        setIsFetching(false);
      }
    };

    fetchCurrentData();
  }, [user, router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name || !phone) return;
    
    setIsLoading(true);
    setMessage(null);

    try {
      // 1. Update Password if provided
      if (password) {
        if (!currentPassword) {
            throw new Error("パスワードを変更するには、現在のパスワードを入力してください。");
        }
        if (password.length < 6) {
          throw new Error("新しいパスワードは6文字以上で入力してください。");
        }
        
        // Verify current password first by signing in
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser || !authUser.email) throw new Error("認証情報が取得できません。");
        
        const { error: verifyError } = await supabase.auth.signInWithPassword({
            email: authUser.email,
            password: currentPassword
        });
        
        if (verifyError) {
            throw new Error("現在のパスワードが間違っています。");
        }

        const { error: pwdError } = await supabase.auth.updateUser({ password });
        if (pwdError) throw new Error("パスワードの更新に失敗しました。再ログインが必要な場合があります。");
      }

      // 2. Update Auth Email if phone changed
      if (phone !== user.phone) {
        const dummyEmail = `${phone}@sns.local`;
        const { error: authError } = await supabase.auth.updateUser({ email: dummyEmail });
        if (authError) {
            throw new Error("電話番号（ログインID）の更新に失敗しました。既に使われている可能性があります。");
        }
      }

      // 3. Upload Image if provided
      let finalAvatarUrl = avatarUrl;
      if (avatarFile) {
          const fileExt = avatarFile.name.split('.').pop();
          const fileName = `${user.id}-${Math.random()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatarFile, { upsert: true });

          if (uploadError) throw new Error("画像のアップロードに失敗しました。");

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
            
          finalAvatarUrl = publicUrl;
      }

      // 4. Update Profile Data
      const { error: profileError } = await supabase
        .from('sns_profiles')
        .update({ name, phone, avatar_url: finalAvatarUrl, bio, age_group: ageGroup })
        .eq('id', user.id);

      if (profileError) {
        throw new Error("プロフィールの更新に失敗しました。");
      }

      await refreshProfile();
      setMessage({ type: 'success', text: 'アカウント情報を更新しました。' });
      setPassword(""); // Clear password field after success
      setCurrentPassword("");

      // Wait a bit, then go back
      setTimeout(() => {
        router.back();
      }, 1500);

    } catch (err: any) {
      if (err?.message?.includes('stole it') || err?.name === 'AbortError') {
        setMessage({ type: 'success', text: 'アカウント情報を更新しました。' });
        setTimeout(() => router.back(), 1500);
      } else {
        setMessage({ type: 'error', text: err.message || "予期せぬエラーが発生しました。" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!user) return;
    setIsLoading(true);
    
    const { error } = await supabase.from('sns_user_preferences').upsert({
        user_id: user.id,
        age_min: ageRange.min,
        age_max: ageRange.max,
        cup_min: cupRange.min,
        cup_max: cupRange.max,
        sm_types: selectedSM,
        body_types: selectedBodyTypes,
        features: selectedFeatures,
        personalities: selectedPersonalities,
        plays: selectedPlays,
        op_options: selectedOpOptions,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    
    setIsLoading(false);
    if (error) {
        alert('好みの保存に失敗しました。');
        console.error(error);
    } else {
        if (searchParams.get('open') === 'pref') {
            router.push('/mypage');
        } else {
            setIsPrefModalOpen(false);
        }
        setMessage({ type: 'success', text: '好みの条件を新しく保存しました。' });
    }
  };

  const handleResetPreferences = () => {
      setAgeRange({ min: "", max: "" });
      setCupRange({ min: "A", max: "H" });
      setSelectedPlays([]);
      setSelectedOpOptions([]);
      setSelectedSM([]);
      setSelectedBodyTypes([]);
      setSelectedFeatures([]);
      setSelectedPersonalities([]);
  };

  if (isFetching) {
    return <div className="min-h-screen bg-[#F9F9F9]" />;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-light">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E5E5] flex items-center px-4 py-4">
        <button onClick={() => router.back()} className="text-black hover:text-[#777777] p-2 -ml-2 transition-colors">
          <ChevronLeft size={24} className="stroke-[1.5]" />
        </button>
        <h1 className="text-sm font-bold tracking-widest absolute left-1/2 -translate-x-1/2">アカウント設定</h1>
      </header>

      <main className="p-8">
        {message && (
          <div className={`mb-6 p-4 border text-xs tracking-widest leading-relaxed ${
            message.type === 'success' 
              ? 'border-green-500 bg-green-50 text-green-700' 
              : 'border-red-500 bg-red-50 text-red-600'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-8 mt-6">
          <div className="flex flex-col items-center justify-center space-y-4 mb-4">
            <div className="relative w-24 h-24 border border-black overflow-hidden p-0.5 group">
               {avatarFile ? (
                 <img src={URL.createObjectURL(avatarFile)} alt="Avatar" className="w-full h-full object-cover" />
               ) : avatarUrl ? (
                 <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full bg-[#F9F9F9] flex items-center justify-center text-[#CCC]">
                    <UserIcon size={32} className="stroke-[1]" />
                 </div>
               )}
               <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center cursor-pointer transition-colors backdrop-blur-sm opacity-0 hover:opacity-100">
                 <Camera size={20} className="text-white mb-1" />
                 <span className="text-white text-[8px] tracking-widest font-bold">変更</span>
                 <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                     if (e.target.files && e.target.files[0]) {
                         setPendingCrop(URL.createObjectURL(e.target.files[0]));
                         e.target.value = '';
                     }
                 }} />
               </label>
            </div>
          </div>

          <div className="space-y-2 block">
            <label className="text-[10px] uppercase tracking-widest text-[#777777]">Name</label>
            <input 
              type="text"
              required
              autoComplete="off"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border-b border-[#E5E5E5] pb-2 text-base outline-none focus:border-black transition-colors bg-transparent rounded-none"
              placeholder="お名前"
            />
          </div>

          <div className="space-y-2 block">
            <label className="text-[10px] uppercase tracking-widest text-[#777777]">Phone Number</label>
            <input 
              type="tel"
              required
              autoComplete="off"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full border-b border-[#E5E5E5] pb-2 text-base outline-none focus:border-black transition-colors bg-transparent rounded-none"
              placeholder="ご自身の携帯電話番号"
            />
            <p className="text-[9px] text-[#777777] tracking-widest pt-1">
              ※こちらを変更すると次回のログインID（電話番号）も変更されます。
            </p>
          </div>

          <div className="space-y-2 block">
            <label className="text-[10px] uppercase tracking-widest text-[#777777]">Age Group / 年代</label>
            <select 
              value={ageGroup}
              onChange={e => setAgeGroup(e.target.value)}
              className="w-full border-b border-[#E5E5E5] pb-2 text-base outline-none focus:border-black transition-colors bg-white rounded-none cursor-pointer"
            >
              <option value="">未設定</option>
              {['20代前半', '20代後半', '30代前半', '30代後半', '40代前半', '40代後半', '50代以上'].map(age => (
                  <option key={age} value={age}>{age}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 block">
            <label className="text-[10px] uppercase tracking-widest text-[#777777]">Bio / 自己紹介</label>
            <textarea 
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="w-full border-b border-[#E5E5E5] pb-2 pt-2 text-base outline-none focus:border-black transition-colors bg-transparent rounded-none min-h-[100px] resize-none leading-relaxed"
              placeholder="例：仕事終わりに遊びに行くことが多いです。甘えさせてくれる優しい子がタイプです！マッサージメインでゆっくり癒やされたい派なので、よろしくお願いします。"
            />
          </div>

          <div className="pt-4 border-t border-[#E5E5E5] space-y-8">
            <div className="space-y-2 block">
              <label className="text-[10px] uppercase tracking-widest text-[#777777]">New Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border-b border-[#E5E5E5] pb-2 text-base outline-none focus:border-black transition-colors bg-transparent rounded-none pr-10"
                  placeholder="新しいパスワード（変更する場合のみ入力）"
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

            {password.length > 0 && (
              <div className="space-y-2 block animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] uppercase tracking-widest text-[#E02424]">Current Password *</label>
                <div className="relative">
                  <input 
                    type={showCurrentPassword ? "text" : "password"}
                    required={password.length > 0}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full border-b border-[#E5E5E5] pb-2 text-base outline-none focus:border-black transition-colors bg-transparent rounded-none pr-10"
                    placeholder="現在のパスワード"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-0 top-1/2 -translate-y-[80%] text-[#777777] p-2 hover:text-black transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                  </button>
                </div>
                <p className="text-[9px] text-[#777777] tracking-widest pt-1">
                  ※セキュリティのため、現在のパスワードを入力してください。
                </p>
              </div>
            )}
          </div>

          <div className="pt-8 space-y-4">
              <button disabled={isLoading} type="submit" className="w-full premium-btn py-4 flex items-center justify-center gap-2 group disabled:opacity-50">
                <span className="tracking-widest">{isLoading ? "更新中..." : "設定を保存する"}</span>
                {!isLoading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /> }
              </button>
              
              <button 
                  type="button"
                  onClick={() => setIsPrefModalOpen(true)}
                  className="w-full bg-[#f9f9f9] border border-[#E5E5E5] text-black hover:border-black py-4 flex items-center justify-center gap-2 tracking-widest text-xs transition-colors"
              >
                  <SlidersHorizontal size={14} className="stroke-[1.5]" />
                  キャストの好みを設定・編集
              </button>
          </div>
        </form>
      </main>

      {/* Preferences Modal (Copied from Search Filter) */}
      {isPrefModalOpen && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end">
              <div 
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" 
                  onClick={handleClosePrefModal}
              />
              
              <div className="relative bg-white w-full h-[90vh] rounded-t-none overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300 max-w-md mx-auto shadow-2xl">
                  <div className="flex items-center justify-between p-6 border-b border-[#E5E5E5] bg-white sticky top-0 z-10 shadow-sm">
                      <h2 className="font-bold text-sm tracking-widest">
                          {user?.role === 'cast' ? "自身の推しポイント設定" : "お好みの絞り込み"}
                      </h2>
                      <button onClick={handleClosePrefModal} className="text-[#777777] hover:text-black transition-colors">
                          <X size={24} className="stroke-[1.5]" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-10 pb-32">
                      <p className="text-xs text-[#777777] leading-relaxed tracking-widest bg-[#F9F9F9] p-4 border border-[#E5E5E5]">
                          {user?.role === 'cast' 
                              ? "ここに入力した推しポイントに合わせて、お客様がキャストを検索した時のマッチング率が変わります。"
                              : "ここに入力した好みの条件に合わせて、よりご希望に近いキャストやイベント情報が表示されやすくなります。"
                          }
                      </p>

                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">年齢</h3>
                          {user?.role === 'cast' ? (
                              <div className="flex items-center gap-3">
                                  <input type="number" placeholder="24" className="w-20 border border-[#E5E5E5] p-3 text-center text-sm outline-none focus:border-black appearance-none" value={ageRange.min} onChange={e => setAgeRange({...ageRange, min: e.target.value, max: e.target.value})} />
                                  <span className="text-[#777777] text-xs">歳</span>
                              </div>
                          ) : (
                              <div className="flex items-center gap-3">
                                  <input type="number" placeholder="18" className="w-20 border border-[#E5E5E5] p-3 text-center text-sm outline-none focus:border-black appearance-none" value={ageRange.min} onChange={e => setAgeRange({...ageRange, min: e.target.value})} />
                                  <span className="text-[#777777] text-xs">歳 〜</span>
                                  <input type="number" placeholder="30" className="w-20 border border-[#E5E5E5] p-3 text-center text-sm outline-none focus:border-black appearance-none" value={ageRange.max} onChange={e => setAgeRange({...ageRange, max: e.target.value})} />
                                  <span className="text-[#777777] text-xs">歳</span>
                              </div>
                          )}
                      </section>

                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">カップ数</h3>
                          {user?.role === 'cast' ? (
                              <div className="flex items-center gap-3">
                                  <select className="w-20 border border-[#E5E5E5] p-3 text-center text-sm outline-none focus:border-black bg-white" value={cupRange.min} onChange={e => setCupRange({...cupRange, min: e.target.value, max: e.target.value})}>
                                     {['A','B','C','D','E','F','G','H','I'].map(c => <option key={`min-${c}`} value={c}>{c}</option>)}
                                  </select>
                                  <span className="text-[#777777] text-xs">カップ</span>
                              </div>
                          ) : (
                              <div className="flex items-center gap-3">
                                  <select className="w-20 border border-[#E5E5E5] p-3 text-center text-sm outline-none focus:border-black bg-white" value={cupRange.min} onChange={e => setCupRange({...cupRange, min: e.target.value})}>
                                     {['A','B','C','D','E','F','G','H','I'].map(c => <option key={`min-${c}`} value={c}>{c}</option>)}
                                  </select>
                                  <span className="text-[#777777] text-xs">〜</span>
                                  <select className="w-20 border border-[#E5E5E5] p-3 text-center text-sm outline-none focus:border-black bg-white" value={cupRange.max} onChange={e => setCupRange({...cupRange, max: e.target.value})}>
                                     {['A','B','C','D','E','F','G','H','I'].map(c => <option key={`max-${c}`} value={c}>{c}</option>)}
                                  </select>
                              </div>
                          )}
                      </section>

                      {/* Body Type */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">体型 <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {bodyTypeOptions.map(opt => (
                                  <button type="button" key={opt} onClick={() => toggleItem(setSelectedBodyTypes, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedBodyTypes.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>

                      {/* SM Type */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">S・M傾向 <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {smOptions.map(opt => (
                                  <button type="button" key={opt} onClick={() => toggleItem(setSelectedSM, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedSM.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>

                      {/* Skills / Play */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">可能プレイ <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {playOptions.map(opt => (
                                  <button type="button" key={opt} onClick={() => toggleItem(setSelectedPlays, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedPlays.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>

                      {/* OP Options */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">OP枠 <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {opOptions.map(opt => (
                                  <button type="button" key={opt} onClick={() => toggleItem(setSelectedOpOptions, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedOpOptions.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>

                      {/* Features */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">個性（特徴） <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {featureOptions.map(opt => (
                                  <button type="button" key={opt} onClick={() => toggleItem(setSelectedFeatures, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedFeatures.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>

                      {/* Personality */}
                      <section>
                          <h3 className="text-xs text-[#777777] tracking-widest mb-4 font-normal">性格 <span className="text-[10px] ml-2">(複数可)</span></h3>
                          <div className="flex flex-wrap gap-2">
                              {personalityOptions.map(opt => (
                                  <button type="button" key={opt} onClick={() => toggleItem(setSelectedPersonalities, opt)} className={`px-4 py-2 text-[11px] tracking-widest border transition-all ${selectedPersonalities.includes(opt) ? 'bg-black text-white border-black' : 'bg-white text-black border-[#E5E5E5] hover:border-black'}`}>
                                      {opt}
                                  </button>
                              ))}
                          </div>
                      </section>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-[#E5E5E5]">
                      <div className="flex gap-4">
                          <button 
                              type="button"
                              onClick={handleResetPreferences}
                              className="px-6 py-3 border border-[#E5E5E5] text-black text-xs tracking-widest hover:border-black transition-colors whitespace-nowrap bg-[#F9F9F9]"
                          >
                              クリア
                          </button>
                          <button 
                              type="button"
                              disabled={isLoading}
                              onClick={handleSavePreferences}
                              className="premium-btn flex-1 py-3 text-sm tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                              {isLoading ? (
                                  "保存中..."
                              ) : (
                                  <>
                                     <Check size={16} className="stroke-[1.5]" />
                                     好みを保存する
                                  </>
                              )}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Image Cropper Modal */}
      {pendingCrop && (
        <ImageCropperModal
          imageSrc={pendingCrop}
          aspectRatio={1}
          onCropComplete={(croppedFile) => {
            setAvatarFile(croppedFile);
            setPendingCrop(null);
          }}
          onCancel={() => setPendingCrop(null)}
        />
      )}
    </div>
  );
}

