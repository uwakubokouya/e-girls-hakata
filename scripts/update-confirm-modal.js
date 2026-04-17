const fs = require('fs');

let c = fs.readFileSync('src/app/reserve/[castId]/page.tsx', 'utf-8');

const tModal = `            {showConfirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white p-6 shadow-xl max-w-sm w-full text-center space-y-6 border border-[#E5E5E5]">
                        <div className="text-black text-sm font-bold tracking-widest pb-3 border-b border-[#E5E5E5]">
                            最終確認
                        </div>
                        <p className="text-sm tracking-widest leading-loose py-2">
                            この内容で予約リクエストを送信します。<br/>
                            よろしいですか？
                        </p>
                        <div className="flex gap-3">`;

const rModal = `            {showConfirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
                    <div className="bg-white p-6 shadow-xl max-w-sm w-full text-center space-y-5 border border-[#E5E5E5] max-h-[90vh] overflow-y-auto mt-auto mb-auto">
                        <div className="text-black text-sm font-bold tracking-widest pb-3 border-b border-[#E5E5E5]">
                            予約内容の最終確認
                        </div>
                        
                        <div className="text-left text-xs tracking-widest space-y-3 bg-[#F9F9F9] p-4 border border-[#E5E5E5]">
                            <div className="flex justify-between border-b border-[#E5E5E5] pb-2">
                                <span className="text-[#777777]">来店日時</span>
                                <span>{selectedDate ? formatDateStr(selectedDate) : ''} {selectedSlot}</span>
                            </div>
                            <div className="flex justify-between border-b border-[#E5E5E5] pb-2">
                                <span className="text-[#777777]">キャスト</span>
                                <span>{cast?.name}</span>
                            </div>
                            {selectedCourseItem && (
                                <div className="flex justify-between border-b border-[#E5E5E5] pb-2">
                                    <span className="text-[#777777]">コース</span>
                                    <span>{selectedCourseItem.label || selectedCourseItem.name}</span>
                                </div>
                            )}
                            <div className="flex justify-between pt-1">
                                <span className="text-[#777777] font-bold">合計予定額</span>
                                <span className="font-bold tracking-widest">
                                    {(()=>{
                                        const cPrice = selectedCourseItem?.price || 0;
                                        const nPrice = selectedNomination?.price || 0;
                                        const oPrice = selectedOptions.reduce((sum, o) => sum + (o.price || 0), 0);
                                        const dPrice = selectedDiscount?.price ? Math.abs(selectedDiscount.price) * -1 : 0;
                                        const total = cPrice + nPrice + oPrice + dPrice;
                                        return \`¥\${Math.max(0, total).toLocaleString()}\`;
                                    })()}
                                </span>
                            </div>
                        </div>

                        <p className="text-[10px] tracking-widest leading-loose py-1">
                            上記の内容で送信します。<br/>よろしいですか？
                        </p>
                        <div className="flex gap-3">`;

let newC = c.split(tModal).join(rModal);
if (newC === c) {
    newC = c.split(tModal.replace(/\n/g, '\r\n')).join(rModal.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('src/app/reserve/[castId]/page.tsx', newC);
console.log('updated confirm modal');
