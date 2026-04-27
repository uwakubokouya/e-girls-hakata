import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Next.jsのfetch重複排除・キャッシュバグを強制的に回避する
const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  return fetch(url, {
    ...options,
    cache: 'no-store' // 強制的にキャッシュとDeduplicationをバイパス
  });
};
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch
  }
});
