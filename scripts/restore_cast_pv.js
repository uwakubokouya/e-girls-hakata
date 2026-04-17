const fs = require('fs');

let c = fs.readFileSync('src/app/cast/[id]/page.tsx', 'utf-8');

const tFootprint = `  // 足あと記録ロジック
  useEffect(() => {
    // ログインしていない、またはキャストの場合は足あとを残さない`;

const rFootprint = `  // PVトラッキング
  useEffect(() => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedCastId);
      if (!isUuid) return;
      if (user?.role === 'cast' || user?.is_admin) return;

      const trackPV = async () => {
          const TRACK_KEY = \`last_pv_cast_\${resolvedCastId}\`;
          const lastTracked = sessionStorage.getItem(TRACK_KEY);
          const now = Date.now();
          if (!lastTracked || now - parseInt(lastTracked) > 3600000) {
              sessionStorage.setItem(TRACK_KEY, now.toString());
              try {
                  let sessionObj = localStorage.getItem('anon_session_id');
                  if (!sessionObj) {
                      sessionObj = 'sess_' + Math.random().toString(36).substring(2, 15);
                      localStorage.setItem('anon_session_id', sessionObj);
                  }
                  await supabase.from('page_views').insert({
                      page_type: 'cast_profile',
                      target_id: resolvedCastId,
                      viewer_id: user?.id || null,
                      session_id: sessionObj
                  });
              } catch (e) {}
          }
      };
      trackPV();
  }, [resolvedCastId, user]);

  // 足あと記録ロジック
  useEffect(() => {
    // ログインしていない、またはキャストの場合は足あとを残さない`;

let newC = c.split(tFootprint).join(rFootprint);
if (newC === c) {
    newC = c.split(tFootprint.replace(/\n/g, '\r\n')).join(rFootprint.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('src/app/cast/[id]/page.tsx', newC);
console.log('restored PV tracking for cast profile');
