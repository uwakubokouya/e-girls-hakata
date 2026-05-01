"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Star } from 'lucide-react';
import { useUser } from '@/providers/UserProvider';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCastId: string;
  castName: string;
  onReviewSubmitted: () => void;
}

export default function ReviewModal({ isOpen, onClose, targetCastId, castName, onReviewSubmitted }: ReviewModalProps) {
  const { user } = useUser();
  const [rating, setRating] = useState<number>(5);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg("口コミを投稿するにはログインが必要です。");
      return;
    }
    if (!content.trim()) {
      setErrorMsg("口コミ本文を入力してください。");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    const { error } = await supabase
      .from('sns_reviews')
      .insert({
        target_cast_id: targetCastId,
        reviewer_id: user.id,
        rating,
        content: content.trim()
      });

    setIsSubmitting(false);

    if (error) {
      console.error("口コミ投稿エラー:", error);
      setErrorMsg("エラーが発生しました。もう一度お試しください。");
    } else {
      onReviewSubmitted();
      setContent("");
      setRating(5);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md border border-[#E5E5E5] flex flex-col relative animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5]">
          <h2 className="text-sm font-bold tracking-widest uppercase">口コミを投稿する</h2>
          <button onClick={onClose} className="text-[#777777] hover:text-black transition-colors">
            <X size={20} className="stroke-[1.5]" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          <div className="text-xs text-[#333333] text-center mb-2">
            <p className="font-bold">{castName} さんへの口コミ</p>
          </div>

          {errorMsg && (
            <div className="text-[10px] text-red-500 bg-red-50 p-2 text-center">
              {errorMsg}
            </div>
          )}

          {/* Rating */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] tracking-widest text-[#777777] uppercase">総合評価</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star 
                    size={32} 
                    className={`stroke-[1] ${rating >= star ? 'fill-black text-black' : 'fill-transparent text-[#E5E5E5]'}`}
                  />
                </button>
              ))}
            </div>
            <p className="text-xs font-bold mt-1">{rating}.0</p>
          </div>

          {/* Text Content */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] tracking-widest text-[#777777] uppercase">口コミ内容</p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="接客や施術の感想をご記入ください..."
              className="w-full h-32 p-3 border border-[#E5E5E5] text-xs leading-relaxed focus:border-black focus:outline-none resize-none transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 text-xs tracking-widest transition-colors font-bold ${
                isSubmitting ? 'bg-[#E5E5E5] text-[#777777]' : 'bg-black text-white hover:bg-[#333333]'
              }`}
            >
              {isSubmitting ? '送信中...' : '投稿する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
