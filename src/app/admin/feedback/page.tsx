"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MessageSquare, Check, Mail, Phone, Clock, X, CheckCircle2, Copy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/providers/UserProvider";

interface Feedback {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  content: string;
  status: 'unread' | 'read' | 'resolved';
  created_at: string;
  user_id: string | null;
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const { user } = useUser();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Restored states
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [resultModal, setResultModal] = useState<{ isOpen: boolean; type: 'success' | 'error'; message: string }>({ isOpen: false, type: 'success', message: "" });

  useEffect(() => {
    if (!user?.is_admin) {
      router.push('/mypage');
      return;
    }
    fetchFeedbacks();
  }, [user, filter]);

  const fetchFeedbacks = async () => {
    setIsLoading(true);
    let query = supabase
      .from('sns_feedbacks')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (filter === 'unread') {
      query = query.eq('status', 'unread');
    }

    const { data, error } = await query;
    if (!error && data) {
      setFeedbacks(data as Feedback[]);
    }
    setIsLoading(false);
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'unread' ? 'read' : 'unread';
    const { error } = await supabase
      .from('sns_feedbacks')
      .update({ status: newStatus })
      .eq('id', id);
      
    if (!error) {
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f));
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // Restored functions
  const handleNameClick = async (userId: string | null) => {
    if (!userId) return;
    setIsModalOpen(true);
    setIsLoadingUser(true);
    const { data, error } = await supabase
      .from('sns_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (!error && data) {
      setSelectedUser(data);
    } else {
      setSelectedUser(null);
    }
    setIsLoadingUser(false);
  };

  const handleResetPasswordClick = () => {
    if (!selectedUser?.id) return;
    setIsConfirmResetOpen(true);
  };

  const executeResetPassword = async () => {
    if (!selectedUser?.id) return;
    
    setIsConfirmResetOpen(false);
    setIsResetting(true);
    
    const { error } = await supabase.rpc('_admin_reset_password_to_zero', { 
      target_user_id: selectedUser.id 
    });

    if (error) {
      console.error(error);
      setResultModal({ isOpen: true, type: 'error', message: 'パスワードの初期化に失敗しました。\nSupabaseのSQLが正しく実行されているかご確認ください。' });
    } else {
      setResultModal({ isOpen: true, type: 'success', message: `「${selectedUser.name || '名無し'}」のパスワードを「000000」に初期化しました。\nお客様に「000000」でログインして変更するようにお伝えください。` });
    }
    
    setIsResetting(false);
  };

  if (!user?.is_admin) return null;

  return (
    <div className="min-h-screen bg-white text-black flex flex-col font-light selection:bg-black selection:text-white">
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E5E5] flex items-center px-4 py-4">
        <button onClick={() => router.back()} className="text-black hover:text-[#777] p-2 -ml-2 transition-colors">
          <ChevronLeft size={24} className="stroke-[1.5]" />
        </button>
        <h1 className="text-sm font-bold tracking-widest absolute left-1/2 -translate-x-1/2 uppercase">Feedback</h1>
      </header>

      <main className="p-6 pb-40">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-normal tracking-[0.2em] uppercase mb-1">ご意見一覧</h2>
            <p className="text-[10px] text-[#777] tracking-widest">お客様からのフィードバック</p>
          </div>
          
          <div className="flex border border-[#E5E5E5]">
            <button 
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-[10px] tracking-widest transition-colors ${filter === 'all' ? 'bg-black text-white font-bold' : 'bg-transparent text-[#777] hover:text-black'}`}
            >
              すべて
            </button>
            <button 
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 text-[10px] tracking-widest transition-colors border-l border-[#E5E5E5] ${filter === 'unread' ? 'bg-black text-white font-bold' : 'bg-transparent text-[#777] hover:text-black'}`}
            >
              未読のみ
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="border border-[#E5E5E5] p-12 text-center">
            <MessageSquare size={32} className="stroke-[1] mx-auto text-[#555] mb-4" />
            <p className="text-xs tracking-widest text-[#777]">ご意見はありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((fb) => (
              <div key={fb.id} className={`border p-6 transition-colors ${fb.status === 'unread' ? 'border-black bg-white shadow-sm' : 'border-[#E5E5E5] bg-[#F9F9F9]'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-bold tracking-widest flex items-center gap-2">
                       <button 
                         onClick={() => handleNameClick(fb.user_id)}
                         className={`hover:text-[#777] transition-colors ${fb.user_id ? 'cursor-pointer underline decoration-[#CCC] underline-offset-4' : 'cursor-default'}`}
                         disabled={!fb.user_id}
                       >
                         {fb.name || "名無し"}
                       </button>
                      {fb.status === 'unread' && <span className="bg-black text-white text-[9px] px-1.5 py-0.5 rounded-none">NEW</span>}
                    </h3>
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-[#777] tracking-widest flex items-center gap-2">
                        <Mail size={12} className="stroke-[1.5]" />
                        {fb.email}
                      </p>
                      {fb.phone && (
                        <p className="text-[10px] text-[#777] tracking-widest flex items-center gap-2">
                          <Phone size={12} className="stroke-[1.5]" />
                          {fb.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[#777] flex items-center gap-1 justify-end">
                      <Clock size={12} className="stroke-[1.5]" />
                      {formatDate(fb.created_at)}
                    </p>
                    <button 
                      onClick={() => toggleStatus(fb.id, fb.status)}
                      className={`mt-4 px-3 py-1.5 text-[10px] tracking-widest border transition-colors flex items-center gap-1 ml-auto ${fb.status === 'unread' ? 'border-black text-black hover:bg-black hover:text-white' : 'border-[#E5E5E5] text-[#777] hover:border-[#AAA] hover:text-black'}`}
                    >
                      <Check size={12} className="stroke-[1.5]" />
                      {fb.status === 'unread' ? '既読にする' : '未読に戻す'}
                    </button>
                  </div>
                </div>
                <div className="border-t border-[#E5E5E5] pt-4 mt-2">
                  <p className="text-sm leading-relaxed tracking-wider whitespace-pre-wrap font-light">
                    {fb.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* User Detail Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-none shadow-2xl relative border border-black">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 bg-[#F9F9F9] text-[#777] hover:text-black transition-colors z-10"
            >
              <X size={18} />
            </button>
            <div className="p-6">
              <h2 className="text-sm font-bold tracking-widest text-center border-b border-[#E5E5E5] pb-4 mb-6 uppercase">User Info</h2>
              {isLoadingUser ? (
                 <div className="flex justify-center py-10">
                   <div className="w-5 h-5 border border-black border-t-transparent rounded-full animate-spin"></div>
                 </div>
              ) : selectedUser ? (
                 <div className="space-y-5">
                   <div className="flex flex-col items-center gap-3">
                     <img src={selectedUser.avatar_url || '/images/default-avatar.png'} alt="avatar" className="w-16 h-16 rounded-full object-cover border border-[#E5E5E5]" />
                     <div className="text-center">
                       <p className="text-sm font-bold tracking-widest">{selectedUser.name}</p>
                       <span className="text-[10px] text-[#777] border border-[#E5E5E5] px-2 py-0.5 inline-block mt-1 bg-[#F9F9F9] uppercase">
                         {selectedUser.role}
                       </span>
                     </div>
                   </div>
                   <div className="bg-[#F9F9F9] p-4 text-xs space-y-3 tracking-widest leading-relaxed border border-[#E5E5E5]">
                      <div><span className="text-[10px] text-[#777] block mb-0.5">電話番号</span>{selectedUser.phone || '未登録'}</div>
                      <div><span className="text-[10px] text-[#777] block mb-0.5">自己紹介</span>
                         <p className="whitespace-pre-wrap">{selectedUser.bio || '未設定'}</p>
                      </div>
                      <div><span className="text-[10px] text-[#777] block mb-0.5">登録日時</span>{new Date(selectedUser.created_at).toLocaleString('ja-JP')}</div>
                   </div>

                   {/* Password Reset Button */}
                   <div className="pt-2">
                     <button
                       onClick={handleResetPasswordClick}
                       disabled={isResetting}
                       className="w-full py-3 bg-white border border-[#E02424] text-[#E02424] text-[10px] font-bold tracking-widest hover:bg-[#E02424] hover:text-white transition-colors flex items-center justify-center gap-2"
                     >
                       {isResetting ? (
                         <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                       ) : (
                         '※ パスワードを「000000」に初期化する'
                       )}
                     </button>
                   </div>
                 </div>
              ) : (
                 <p className="text-center text-xs text-[#777] py-10 tracking-widest">ユーザー情報が見つかりませんでした。</p>
              )}
            </div>
            <div className="bg-[#F9F9F9] p-4 border-t border-[#E5E5E5]">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-full bg-white border border-black text-black py-3 text-[11px] font-bold tracking-widest hover:bg-black hover:text-white transition-colors uppercase"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reset Modal */}
      {isConfirmResetOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm border border-black shadow-2xl relative overflow-hidden">
            <div className="p-6 text-center">
              <h2 className="text-sm font-bold tracking-widest text-[#E02424] mb-3 flex items-center justify-center gap-2">
                <CheckCircle2 size={18} className="stroke-[2]" />
                初期化の確認
              </h2>
              <p className="text-xs text-[#333] leading-relaxed tracking-widest mb-2">
                「<strong>{selectedUser?.name || '名無し'}</strong>」のパスワードを<br/>「<strong>000000</strong>」に初期化しますか？
              </p>
              <p className="text-[10px] text-[#777] mb-6">※この操作は元に戻せません</p>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsConfirmResetOpen(false)}
                  className="flex-1 py-3 bg-[#F9F9F9] border border-[#E5E5E5] text-[#777] text-[11px] font-bold tracking-widest hover:bg-[#EEEEEE] transition-colors"
                >
                  キャンセル
                </button>
                <button 
                  onClick={executeResetPassword}
                  className="flex-1 py-3 bg-[#E02424] text-white text-[11px] font-bold tracking-widest shadow-md hover:bg-[#C81E1E] transition-colors"
                >
                  初期化する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {resultModal.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm border border-black shadow-2xl relative overflow-hidden">
            <div className="p-6 text-center">
              <h2 className={`text-sm font-bold tracking-widest mb-4 flex items-center justify-center gap-2 ${resultModal.type === 'success' ? 'text-black' : 'text-[#E02424]'}`}>
                {resultModal.type === 'success' ? (
                   <><CheckCircle2 size={18} className="stroke-[2]" /> 完了</>
                ) : (
                   <><X size={18} className="stroke-[2]" /> エラー</>
                )}
              </h2>
              <p className="text-xs text-[#333] leading-relaxed tracking-widest mb-6 whitespace-pre-wrap">
                {resultModal.message}
              </p>
              
              {resultModal.type === 'success' && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`お問い合わせいただき、誠にありがとうございます。\n\nパスワードがご不明とのこと、承知いたしました。ご不便をおかけしております。\n運営事務局にて「仮パスワード」を発行いたしましたので、下記の情報でログインをお試しいただけますでしょうか。\n\n【仮パスワード】：000000\n\nご登録の電話番号と上記の仮パスワードでログイン後、メニュー内の「アカウント設定」より、お客様ご自身で本パスワードへの変更をお願いいたします。\n\nその他、ご不明な点やご要望などがございましたら、いつでもお気軽にお申し付けください。\nよろしくお願い申し上げます。`);
                    setResultModal({ isOpen: true, type: 'success', message: 'リセット案内の定型文をコピーしました！\nメールなどに貼り付けてご返信ください。' });
                  }}
                  className="w-full mb-3 py-3 bg-[#F9F9F9] border border-[#E5E5E5] text-[#333] text-[10px] font-bold tracking-widest hover:bg-[#EEEEEE] transition-colors flex items-center justify-center gap-2"
                >
                  <Copy size={16} className="stroke-[1.5]" />
                  リセット案内の定型文をコピー
                </button>
              )}

              <button 
                onClick={() => setResultModal(prev => ({ ...prev, isOpen: false }))}
                className="w-full py-3 bg-black text-white text-[11px] font-bold tracking-widest shadow-md hover:bg-[#333] transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
