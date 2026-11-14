"use client";

import { Bell } from "lucide-react";
import { usePushNotifications } from "@/lib/firebase/usePushNotifications";
import styles from "@/styles/account.module.css";

export default function AccountNotifications() {
  const push = usePushNotifications();
  const blocked = push.permission === "denied";
  return (
    <section className={styles.card} aria-labelledby="push-title" aria-busy={push.pending}>
      <div className={styles.sectionHeading}>
        <span className={styles.sectionIcon}><Bell size={27} aria-hidden="true" /></span>
        <div>
          <h2 id="push-title">Thông báo trên thiết bị này</h2>
          <p>Nhận cập nhật đơn hàng khi bạn không mở trang.</p>
        </div>
      </div>
      {push.installRequired && (
        <div className="my-4 rounded-xl border border-orange-200 p-4 text-sm">
          <p className="font-semibold">Cài StudentFood trên iPhone/iPad</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Mở website bằng Safari, chọn Chia sẻ → Thêm vào Màn hình chính.</li>
            <li>Mở StudentFood từ icon vừa thêm và đăng nhập nếu được yêu cầu.</li>
            <li>Quay lại đây, bấm Bật thông báo và chọn Cho phép.</li>
          </ol>
          <p className="mt-2">Cần iOS/iPadOS 16.4 trở lên. Cài app không tự cấp quyền thông báo.</p>
        </div>
      )}
      <p role="status">
        {push.status === "checking" ? "Đang kiểm tra hỗ trợ thông báo…"
          : push.status === "unsupported" ? "Trình duyệt hiện chưa hỗ trợ. Trên iPhone/iPad, hãy thêm ứng dụng vào màn hình chính rồi mở từ icon."
          : blocked ? "Thông báo đang bị chặn. Mở cài đặt quyền của website trong trình duyệt, cho phép Thông báo rồi quay lại trang này."
          : push.status === "enabling" ? "Đang đăng ký thông báo…"
          : push.status === "disabling" ? "Đang tắt thông báo…"
          : push.status === "enabled" ? "Đã bật thông báo cho tài khoản này trên thiết bị."
          : push.status === "disabled" ? "Đã tắt thông báo trên thiết bị này."
          : push.permission === "granted" ? "Trình duyệt đã cấp quyền. Nhấn bật để xác nhận đăng ký cho tài khoản hiện tại."
          : "Bạn có thể bật thông báo để nhận cập nhật đơn hàng."}
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className={styles.primaryButton} onClick={() => void push.enable()}
          disabled={push.pending || blocked || push.installRequired || push.status === "unsupported" || push.status === "enabled"}>
          Bật thông báo
        </button>
        {push.hasRegistration && (
          <button type="button" className={styles.outlineButton} onClick={() => void push.disable()}
            disabled={push.pending || push.status === "unsupported"}>Tắt trên thiết bị này</button>
        )}
      </div>
      {push.error && <p className={styles.error} role="alert">{push.error}</p>}
    </section>
  );
}
