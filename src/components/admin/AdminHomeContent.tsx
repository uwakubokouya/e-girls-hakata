import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { BarChart3, Bell, ShieldAlert, Settings, X, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface AdminHomeContentProps {
  activeTab: string;
}

export default function AdminHomeContent({ activeTab }: AdminHomeContentProps) {
  const [summaryData, setSummaryData] = useState({ todayPv: 0, todayUsers: 0, unreadFeedbacks: 0 });
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'summary') fetchSummary();
    if (activeTab === 'users') fetchCustomers();
  }, [activeTab]);

  const fetchSummary = async () => {
    setIsLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const { count: pvCount } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayIso);

    const { count: userCount } = await supabase
      .from('sns_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayIso)
      .eq('role', 'customer');

    const { count: feedbackCount } = await supabase
      .from('sns_feedbacks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unread');

    setSummaryData({
      todayPv: pvCount || 0,
      todayUsers: userCount || 0,
      unreadFeedbacks: feedbackCount || 0
    });
    setIsLoading(false);
  };

  const fetchCustomers = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('sns_profiles')
      .select('*')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setCustomers(data);
    setIsLoading(false);
  };

  const handleUserClick = (u: any) => {
    setSelectedUser(u);
    setIsModalOpen(true);
    setStatusMessage("");
  };

  const executeResetPassword = async () => {
    if (!selectedUser?.id) return;
    setIsResetting(true);
    const { error } = await supabase.rpc('_admin_reset_password_to_zero', { 
      target_user_id: selectedUser.id 
    });
    if (error) {
      setStatusMessage("エラー: " + error.message);
    } else {
      setStatusMessage("パスワードを「000000」に初期化しました。");
    }
    setIsResetting(false);
  };

  const toggleBan = async () => {
    if (!selectedUser?.id) return;
    const newStatus = selectedUser.status === 'banned' ? 'active' : 'banned';
    const { error } = await supabase
      .from('sns_profiles')
      .update({ status: newStatus })
      .eq('id', selectedUser.id);
    if (!error) {
      setSelectedUser({ ...selectedUser, status: newStatus });
      setCustomers(customers.map(c => c.id === selectedUser.id ? { ...c, status: newStatus } : c));
      setStatusMessage(newStatus === 'banned' ? "アカウントを停止しました。" : "アカウントを復旧しました。");
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* --- SUMMARY TAB --- */}
      {activeTab === 'summary' && (
        <div className="space-y-4 animate-in fade-in duration-300 px-4 py-6">
          <h2 className="text-sm tracking-widest font-bold mb-4 uppercase">KPI Summary</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#E5E5E5] p-5 flex flex-col items-center justify-center">
              <p className="text-[10px] text-[#777] tracking-widest mb-2">本日のアクセス</p>
              <p className="text-2xl font-normal tracking-widest">{summaryData.todayPv}</p>
            </div>
            <div className="bg-white border border-[#E5E5E5] p-5 flex flex-col items-center justify-center">
              <p className="text-[10px] text-[#777] tracking-widest mb-2">本日の新規登録</p>
              <p className="text-2xl font-normal tracking-widest">{summaryData.todayUsers}</p>
            </div>
          </div>
          
          <Link href="/admin/feedback" className="block bg-white border border-black p-5 relative group hover:bg-black transition-colors">
            <div className="flex items-center justify-between group-hover:text-white transition-colors">
              <div>
                <p className="text-[10px] text-[#777] group-hover:text-[#CCC] tracking-widest mb-1">未読のご意見</p>
                <p className="text-xl font-normal tracking-widest">{summaryData.unreadFeedbacks} 件</p>
              </div>
              <div className="w-10 h-10 border border-[#E5E5E5] group-hover:border-[#555] rounded-full flex items-center justify-center">
                <span className="text-lg">→</span>
              </div>
            </div>
          </Link>

          <div className="grid grid-cols-2 gap-3 mt-6">
             <Link href="/admin/analytics" className="bg-white border border-[#E5E5E5] p-4 flex items-center gap-3 hover:border-black transition-colors">
               <BarChart3 size={20} className="stroke-[1.5]" />
               <span className="text-[10px] font-bold tracking-widest">詳細な解析</span>
             </Link>
             <Link href="/admin/announcement" className="bg-white border border-[#E5E5E5] p-4 flex items-center gap-3 hover:border-black transition-colors">
               <Bell size={20} className="stroke-[1.5]" />
               <span className="text-[10px] font-bold tracking-widest">お知らせ配信</span>
             </Link>
          </div>
        </div>
      )}

      {/* --- USERS TAB --- */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-in fade-in duration-300 px-4 py-6">
          <h2 className="text-sm tracking-widest font-bold mb-4 uppercase">Customer Management</h2>
          <div className="space-y-2">
            {customers.map(c => (
              <div key={c.id} onClick={() => handleUserClick(c)} className="bg-white border border-[#E5E5E5] p-4 flex items-center justify-between cursor-pointer hover:border-black transition-colors">
                <div className="flex items-center gap-3">
                  <img 
                    src={c.avatar_url || '/images/no-photo.jpg'} 
                    alt="avatar" 
                    className="w-10 h-10 rounded-full border border-[#E5E5E5] object-cover" 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('no-photo.jpg')) {
                        target.src = '/images/no-photo.jpg';
                      }
                    }}
                  />
                  <div>
                    <p className="text-xs font-bold tracking-widest flex items-center gap-2">
                      {c.name || '名無し'}
                      {c.status === 'banned' && <span className="bg-[#E02424] text-white text-[8px] px-1 py-0.5 rounded-sm">BAN</span>}
                    </p>
                    <p className="text-[10px] text-[#777] mt-1">{c.phone || '電話番号未登録'}</p>
                  </div>
                </div>
              </div>
            ))}
            {customers.length === 0 && <p className="text-xs text-[#777] text-center py-10">顧客データがありません</p>}
          </div>
        </div>
      )}

      {/* --- MODERATION TAB --- */}
      {activeTab === 'moderation' && (
        <div className="space-y-4 animate-in fade-in duration-300 text-center py-20 px-4">
          <ShieldAlert size={32} className="stroke-[1] mx-auto text-[#CCC] mb-4" />
          <p className="text-xs tracking-widest text-[#777]">コンテンツ監視機能は準備中です</p>
        </div>
      )}

      {/* --- SETTINGS TAB --- */}
      {activeTab === 'settings' && (
        <div className="space-y-4 animate-in fade-in duration-300 text-center py-20 px-4">
          <Settings size={32} className="stroke-[1] mx-auto text-[#CCC] mb-4" />
          <p className="text-xs tracking-widest text-[#777]">システムマスター設定は準備中です</p>
        </div>
      )}

      {/* User Detail Modal */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm border border-black shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 bg-[#F9F9F9] text-[#777] hover:text-black transition-colors z-10">
              <X size={18} />
            </button>
            <div className="p-6">
              <h2 className="text-sm font-bold tracking-widest text-center border-b border-[#E5E5E5] pb-4 mb-6 uppercase">Customer Info</h2>
              
              <div className="flex flex-col items-center gap-3 mb-6">
                <img 
                  src={selectedUser.avatar_url || '/images/no-photo.jpg'} 
                  alt="avatar" 
                  className="w-16 h-16 rounded-full object-cover border border-[#E5E5E5]" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('no-photo.jpg')) {
                      target.src = '/images/no-photo.jpg';
                    }
                  }}
                />
                <div className="text-center">
                  <p className="text-sm font-bold tracking-widest">{selectedUser.name}</p>
                  <p className="text-[10px] text-[#777] mt-1">{selectedUser.phone}</p>
                </div>
              </div>

              {statusMessage && (
                <div className="mb-4 p-3 bg-[#F9F9F9] border border-black text-[10px] text-center font-bold tracking-widest">
                  {statusMessage}
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={executeResetPassword}
                  disabled={isResetting}
                  className="w-full py-3 bg-white border border-[#333] text-[#333] text-[10px] font-bold tracking-widest hover:bg-[#333] hover:text-white transition-colors"
                >
                  {isResetting ? '処理中...' : 'パスワードを「000000」に初期化'}
                </button>

                <button
                  onClick={toggleBan}
                  className="w-full py-3 bg-white border border-[#E02424] text-[#E02424] text-[10px] font-bold tracking-widest hover:bg-[#E02424] hover:text-white transition-colors"
                >
                  {selectedUser.status === 'banned' ? '利用停止(BAN)を解除する' : 'このアカウントを利用停止(BAN)にする'}
                </button>
              </div>
            </div>
            <div className="bg-[#F9F9F9] p-4 border-t border-[#E5E5E5]">
              <button onClick={() => setIsModalOpen(false)} className="w-full bg-black text-white py-3 text-[11px] font-bold tracking-widest hover:bg-[#333] transition-colors uppercase">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
