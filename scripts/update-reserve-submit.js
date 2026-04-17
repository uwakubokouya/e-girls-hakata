const fs = require('fs');
let c = fs.readFileSync('src/app/reserve/[castId]/page.tsx', 'utf-8');

// 1. Add states
const tState = `    const [errorMsg, setErrorMsg] = useState<string | null>(null);`;
const rState = `    const [errorMsg, setErrorMsg] = useState<string | null>(null);\n    const [isSubmitting, setIsSubmitting] = useState(false);\n    const [isSuccess, setIsSuccess] = useState(false);`;
c = c.split(tState).join(rState);

// 2. Add handleSubmit above the return
const tSubmit = `    if (isLoading) {`;
const rSubmit = `    const handleSubmit = async () => {
        if (!user) {
            setErrorMsg("予約にはログインが必要です。");
            return;
        }

        setIsSubmitting(true);
        try {
            const cPrice = selectedCourseItem?.price || 0;
            const nPrice = selectedNomination?.price || 0;
            const oPrice = selectedOptions.reduce((sum, o) => sum + (o.price || 0), 0);
            const dPrice = selectedDiscount?.price ? Math.abs(selectedDiscount.price) * -1 : 0;
            const total = cPrice + nPrice + oPrice + dPrice;

            const reservationData = {
                customer_id: user.id,
                cast_id: cast?.id,
                store_id: cast?.store_id,
                reserve_date: selectedDate,
                reserve_time: selectedSlot,
                course_id: selectedCourseItem?.id,
                course_name: selectedCourseItem?.name || selectedCourseItem?.label,
                course_price: cPrice,
                nomination_id: selectedNomination?.id,
                nomination_name: selectedNomination?.name || selectedNomination?.label,
                nomination_price: nPrice,
                options: selectedOptions.length > 0 ? selectedOptions.map(o => ({id: o.id, name: o.name || o.label, price: o.price})) : null,
                discount_id: selectedDiscount?.id,
                discount_name: selectedDiscount?.name || selectedDiscount?.label,
                discount_price: dPrice,
                total_price: Math.max(0, total),
                customer_notes: customerNotes,
                status: 'pending'
            };

            const { error } = await supabase.from('sns_reservations').insert(reservationData);

            if (error) {
                console.error("Reserve Error:", error);
                setErrorMsg("ご予約の送信に失敗しました。" + error.message);
            } else {
                setIsSuccess(true);
            }
        } catch (e: any) {
            setErrorMsg("エラーが発生しました。" + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {`;
c = c.split(tSubmit).join(rSubmit);

// 3. Add Success View
const tSuccess = `    return (
        <div className="min-h-screen bg-white pb-40 font-light">`;
const rSuccess = `    if (isSuccess) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center font-light">
                <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center mb-6">
                    <Check size={32} className="stroke-[1.5]" />
                </div>
                <h2 className="text-xl font-normal tracking-widest mb-4">予約リクエスト完了</h2>
                <div className="text-sm tracking-widest leading-loose text-[#333333] mb-10">
                    ご予約いただきありがとうございます。<br/>
                    店舗からの折り返しのご連絡をもちまして<br/>
                    【確定】とさせていただきます。<br/><br/>
                    確認ができ次第、速やかにご連絡差し上げますので<br/>
                    今しばらくお待ちくださいませ。
                </div>
                <button 
                    onClick={() => router.push('/')}
                    className="premium-btn w-full max-w-sm py-4 bg-black text-white text-sm tracking-widest"
                >
                    ホームへ戻る
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white pb-40 font-light">`;
c = c.split(tSuccess).join(rSuccess);

// 4. Update the bottom button
const tBtn = `                    <Link href="/" className="premium-btn py-4 flex items-center justify-center gap-3 w-full text-sm tracking-widest bg-black text-white hover:bg-white hover:text-black hover:border-black border transition-all">
                        <Check size={18} className="stroke-[1.5]" />
                        予約を確定する
                    </Link>`;
const rBtn = `                    <button 
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="premium-btn py-4 flex items-center justify-center gap-3 w-full text-sm tracking-widest bg-black text-white hover:bg-white hover:text-black hover:border-black border transition-all disabled:opacity-50">
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <><Check size={18} className="stroke-[1.5]" />予約を確定する</>
                        )}
                    </button>`;
c = c.split(tBtn).join(rBtn);

fs.writeFileSync('src/app/reserve/[castId]/page.tsx', c);
console.log('updated page.tsx');
