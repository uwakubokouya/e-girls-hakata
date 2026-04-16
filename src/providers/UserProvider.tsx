"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export type UserRole = 'customer' | 'cast';

export interface UserSettings {
  notifications_enabled: boolean;
  image_blur_enabled: boolean;
  favorite_cast_alerts: boolean;
  leave_footprints: boolean;
  reservation_reminders: boolean;
  app_lock_enabled: boolean;
  accepts_dms?: boolean;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  phone?: string;
  is_admin: boolean;
  avatar_url?: string;
  settings: UserSettings;
}

interface UserContextType {
  user: User | null;
  logout: () => Promise<void>;
  isMounted: boolean;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  hasUnreadNotifications: boolean;
  hasUnreadLikes: boolean;
  hasUnreadMessages: boolean;
  hasUnreadFeedbacks: boolean;
  markNotificationsAsRead: () => void;
  markLikesAsRead: () => Promise<void>;
  refreshUnreadFeedbacks: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [hasUnreadLikes, setHasUnreadLikes] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadFeedbacks, setHasUnreadFeedbacks] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);

    const loadUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
          await fetchProfile(session.user.id);
        } else {
          setIsLoading(false);
        }
      } catch (err: any) {
        if (err?.message?.includes('stole it') || err?.name === 'AbortError') {
           // Safe to ignore: React 18 Strict Mode double-render race condition
        } else {
           console.error("Auth session fetch error:", err);
        }
        setIsLoading(false);
      }
    };

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await fetchProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    // Initial check for unread notifications
    const checkUnreadNotifications = async () => {
      const { data } = await supabase
        .from('sns_notifications')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const lastRead = localStorage.getItem('last_read_notification_time');
        if (!lastRead || new Date(data.created_at) > new Date(lastRead)) {
          setHasUnreadNotifications(true);
        }
      }
    };
    checkUnreadNotifications();

    // Listen for new notifications in real-time
    const notificationChannel = supabase.channel('public:sns_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sns_notifications' }, () => {
         setHasUnreadNotifications(true);
      })
      .subscribe();

    // Listen for unread messages (basic global subscription or periodic fetch)
    const checkUnreadMessages = async (userId: string) => {
       const { data } = await supabase
          .from('sns_messages')
          .select('id, content')
          .eq('receiver_id', userId)
          .eq('is_read', false);
          
       if (data) {
           const normalMsgs = data.filter(m => !m.content.startsWith('[SYSTEM_LIKE]'));
           const likeMsgs = data.filter(m => m.content.startsWith('[SYSTEM_LIKE]'));
           setHasUnreadMessages(normalMsgs.length > 0);
           setHasUnreadLikes(likeMsgs.length > 0);
       } else {
           setHasUnreadMessages(false);
           setHasUnreadLikes(false);
       }
    };

    const messageChannel = supabase.channel('public:sns_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sns_messages' }, () => {
         // Re-check unread state basically arbitrarily if logged in
         supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user.id) checkUnreadMessages(session.user.id);
         });
      })
      .subscribe();

    // Load unread initially
    supabase.auth.getSession().then(({ data: { session } }) => {
       if (session?.user.id) checkUnreadMessages(session.user.id);
    });

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(notificationChannel);
      supabase.removeChannel(messageChannel);
    };
  }, []);

  // Admin feedbacks unread observer
  useEffect(() => {
    if (!user?.is_admin) {
      setHasUnreadFeedbacks(false);
      return;
    }

    const checkFeedbacks = async () => {
       const { count } = await supabase
         .from('sns_feedbacks')
         .select('*', { count: 'exact', head: true })
         .eq('status', 'unread');
       
       setHasUnreadFeedbacks(!!count && count > 0);
    };

    checkFeedbacks();

    const fbChannel = supabase.channel('admin_feedbacks')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'sns_feedbacks' }, () => {
          checkFeedbacks();
       })
       .subscribe();

    return () => {
       supabase.removeChannel(fbChannel);
    };
  }, [user?.is_admin]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('sns_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !error) {
        let finalAvatarUrl = data.avatar_url;

        // キャストでアイコン未設定の場合はマスターデータからフォールバック
        if (!finalAvatarUrl && data.role === 'cast') {
          const { data: storeCast } = await supabase.from('casts').select('profile_image_url, avatar_url').eq('id', userId).maybeSingle();
          if (storeCast) {
            finalAvatarUrl = storeCast.profile_image_url || storeCast.avatar_url;
          }
          if (!finalAvatarUrl) {
            finalAvatarUrl = "/images/no-photo.jpg";
          }
        }

        setUser({
          id: data.id,
          name: data.name,
          role: data.role as UserRole,
          phone: data.phone,
          is_admin: data.is_admin ?? false,
          avatar_url: finalAvatarUrl,
          settings: {
            notifications_enabled: data.notifications_enabled ?? true,
            image_blur_enabled: data.image_blur_enabled ?? false,
            favorite_cast_alerts: data.favorite_cast_alerts ?? true,
            leave_footprints: data.leave_footprints ?? true,
            reservation_reminders: data.reservation_reminders ?? true,
            app_lock_enabled: data.app_lock_enabled ?? false,
            accepts_dms: data.accepts_dms ?? true,
          }
        });
      } else {
        if (error?.code !== 'PGRST116') {
          console.error("Profile fetch error:", error);
        }
        setUser(null);
      }
    } catch (err) {
      console.error("Fetch profile exception:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetchProfile(session.user.id);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Sign out error:", error);
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  const markNotificationsAsRead = () => {
    localStorage.setItem('last_read_notification_time', new Date().toISOString());
    setHasUnreadNotifications(false);
  };

  const markLikesAsRead = async () => {
     if (!user?.id) return;
     try {
         await supabase.from('sns_messages')
            .update({ is_read: true })
            .eq('receiver_id', user.id)
            .like('content', '[SYSTEM_LIKE]%')
            .eq('is_read', false);
         setHasUnreadLikes(false);
     } catch (e) {
         console.error(e);
     }
  };

  const refreshUnreadFeedbacks = async () => {
     if (!user?.is_admin) return;
     const { count } = await supabase
        .from('sns_feedbacks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread');
     setHasUnreadFeedbacks(!!count && count > 0);
  };

  return (
    <UserContext.Provider value={{ 
      user, logout, isMounted, isLoading, refreshProfile, hasUnreadNotifications, hasUnreadLikes, hasUnreadMessages, hasUnreadFeedbacks, markNotificationsAsRead, markLikesAsRead, refreshUnreadFeedbacks 
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
}
