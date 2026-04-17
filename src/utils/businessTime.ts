import { SupabaseClient } from '@supabase/supabase-js';

export async function fetchBusinessEndTime(supabase: SupabaseClient): Promise<{ hour: number, min: number }> {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'business_end_time')
            .single();
            
        if (!error && data?.value) {
            let parts = data.value.toString().split(':');
            let h = parseInt(parts[0] || '0', 10);
            const m = parseInt(parts[1] || '0', 10);
            if (h >= 24) h -= 24; 
            return { hour: Math.max(0, h), min: m };
        }
    } catch (err) {
        console.error('Error fetching business_end_time:', err);
    }
    // デフォルト: 06:00
    return { hour: 6, min: 0 };
}

export function getLogicalBusinessDate(now: Date, endHour: number, endMin: number): string {
    // もし現在が営業終了時刻よりも前なら、論理的には「前日の営業日」として扱う。
    // 例: endHour=6, 現在が朝5時なら、昨日の日付を返す。
    const isPastMidnight = now.getHours() < endHour || (now.getHours() === endHour && now.getMinutes() < endMin);
    
    const logicalDate = new Date(now);
    if (isPastMidnight) {
        logicalDate.setDate(logicalDate.getDate() - 1);
    }
    
    const yyyy = logicalDate.getFullYear();
    const mm = String(logicalDate.getMonth() + 1).padStart(2, '0');
    const dd = String(logicalDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function getAdjustedMinutes(timeStr: string, endHour: number): number {
    if (!timeStr) return 0;
    const parts = timeStr.toString().split(':');
    let h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    
    // システム上の「夜中の時刻」は 24時間を足して計算する。
    // 従来 `h < 6` 固定だったものを、営業終了時間基準にする。
    // ただし、入力された時間が最初から 24 を超えている場合は何もしない
    if (h < endHour) {
        h += 24;
    }
    return h * 60 + m;
}

export function getAdjustedNowMins(now: Date, endHour: number): number {
    let currentHour = now.getHours();
    let currentMin = now.getMinutes();
    
    if (currentHour < endHour) {
        currentHour += 24;
    }
    return currentHour * 60 + currentMin;
}
