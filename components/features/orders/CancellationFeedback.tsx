"use client";

import { reconcileCancellation, useCancellationFeedback } from "@/store/useCancellationFeedback";
import { useAuthStore } from "@/store/useAuthStore";

export default function CancellationFeedback() {
  const result = useCancellationFeedback(state => state.result);
  const userId = useAuthStore(state => state.user?.id);
  if (!result || result.userId !== userId) return null;
  const accepted = ["accepted", "completed"].includes(result.state);
  const waiting = ["checking", "unknown"].includes(result.state);
  // Chỉ cho phép số điện thoại; không đưa URL hoặc ký tự điều khiển tùy ý vào href.
  const phone = result.phone?.replace(/[\s().-]/g, "") ?? "";
  const canCall = /^\+?\d{9,15}$/.test(phone);
  return <section aria-label="Kết quả hủy đơn" className="fixed bottom-24 left-4 right-4 z-[110] mx-auto max-w-md rounded-2xl border border-orange-200 bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-white">
    <button type="button" aria-label="Đóng kết quả hủy đơn" onClick={() => useCancellationFeedback.setState({ result: null })} className="absolute right-3 top-2 p-2">✕</button>
    <div role="status" aria-live="polite" className="pr-6">
      <p className="text-sm text-slate-500">{result.context || "Đơn hàng bạn vừa yêu cầu hủy"}</p>
      <p className="mt-2 font-bold">{waiting ? "Vui lòng đợi trong giây lát để hệ thống kiểm tra trạng thái đơn hàng" : result.state === "cancelled" ? "Đã hủy đơn hàng thành công." : "Không thể hủy."}</p>
      {accepted && <><p className="mt-2">Lí do: Quán đã chấp nhận đơn hàng.</p>
        <p className="mt-2 text-sm">Bạn có thể liên hệ quán để hủy đơn hàng.</p></>}
      {result.state === "rejected" && <p className="mt-2">Lí do: Quán đã từ chối đơn hàng. Bạn không cần hủy thêm.</p>}
    </div>
    {accepted && (canCall ? <div className="mt-3"><p>{result.phone}</p>
      <a href={`tel:${phone}`} className="mt-2 inline-block rounded-xl bg-orange-600 px-4 py-2 font-semibold text-white">Gọi quán</a>
    </div> : <p className="mt-3 text-sm">Chưa có số điện thoại liên hệ của quán.</p>)}
    {result.state === "unknown" && <><p className="mt-2 text-sm">Chưa kết nối được để xác nhận kết quả. Bạn có thể kiểm tra lại.</p>
      <button type="button" className="mt-3 rounded-xl border px-4 py-2" onClick={() => void reconcileCancellation(result)}>Kiểm tra lại</button></>}
  </section>;
}
