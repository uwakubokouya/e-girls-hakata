const fs = require('fs');

let c = fs.readFileSync('src/app/cast/[id]/page.tsx', 'utf-8');

const target = `    const leaveFootprint = async () => {
      // 重複の場合はエラーとなるが想定内なのでコンソール出力を抑制
      await supabase.from('sns_footprints').insert({
        viewer_id: user.id,
        cast_id: id
      }).catch(() => {});
    };

    leaveFootprint();
  }, [id, user]);`;

const replacement = `    const leaveFootprint = async () => {
      // 重複の場合はエラーとなるが想定内なのでコンソール出力を抑制
      await supabase.from('sns_footprints').insert({
        viewer_id: user.id,
        cast_id: id
      }).catch(() => {});
    };

    leaveFootprint();
  }, [id, user]);

  // 新規追加: PVトラッキング（page_views） - ログイン・未ログイン問わず記録
  useEffect(() => {
    const trackPV = async () => {
      if (!id) return;
      const TRACK_KEY = \`last_pv_cast_\${id}\`;
      const lastTracked = sessionStorage.getItem(TRACK_KEY);
      const now = Date.now();
      
      // 1時間に1回のみ記録 (3600000ms)
      if (!lastTracked || now - parseInt(lastTracked) > 3600000) {
          sessionStorage.setItem(TRACK_KEY, now.toString());
          try {
              let sessionObj = localStorage.getItem('anon_session_id');
              if (!sessionObj) {
                  sessionObj = 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                  localStorage.setItem('anon_session_id', sessionObj);
              }
              await supabase.from('page_views').insert({
                  page_type: 'cast_profile',
                  target_id: id,
                  viewer_id: user?.id || null,
                  session_id: sessionObj
              });
          } catch(e) { console.error('PV tracking error', e); }
      }
    };
    if (!isUserLoading) trackPV();
  }, [id, user, isUserLoading]);`;

let newC = c.split(target).join(replacement);
if (newC === c) {
    newC = c.split(target.replace(/\n/g, '\r\n')).join(replacement.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('src/app/cast/[id]/page.tsx', newC);
console.log('cast page tracking added');
