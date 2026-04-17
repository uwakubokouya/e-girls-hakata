const fs = require('fs');

let c = fs.readFileSync('src/app/page.tsx', 'utf-8');

const target = `  const [activeTab, setActiveTab] = useState<'official' | 'following' | 'recommended' | 'working'>('official');
  const { user, logout, isLoading: isUserLoading, hasUnreadMessages, hasUnreadNotifications, hasUnreadLikes, markLikesAsRead, markNotificationsAsRead } = useUser();`;

const replacement = `  const [activeTab, setActiveTab] = useState<'official' | 'following' | 'recommended' | 'working'>('official');
  const { user, logout, isLoading: isUserLoading, hasUnreadMessages, hasUnreadNotifications, hasUnreadLikes, markLikesAsRead, markNotificationsAsRead } = useUser();

  useEffect(() => {
    const trackPV = async () => {
      const TRACK_KEY = 'last_pv_home';
      const lastTracked = sessionStorage.getItem(TRACK_KEY);
      const now = Date.now();
      
      // Track once per hour per session (3600000ms)
      if (!lastTracked || now - parseInt(lastTracked) > 3600000) {
          sessionStorage.setItem(TRACK_KEY, now.toString());
          try {
              let sessionObj = localStorage.getItem('anon_session_id');
              if (!sessionObj) {
                  sessionObj = 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                  localStorage.setItem('anon_session_id', sessionObj);
              }
              await supabase.from('page_views').insert({
                  page_type: 'home',
                  viewer_id: user?.id || null,
                  session_id: sessionObj
              });
          } catch(e) { console.error('PV tracking error', e); }
      }
    };
    if (!isUserLoading) trackPV();
  }, [user, isUserLoading]);`;

let newC = c.split(target).join(replacement);
if (newC === c) {
    newC = c.split(target.replace(/\n/g, '\r\n')).join(replacement.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('src/app/page.tsx', newC);
console.log('page.tsx tracking added');
