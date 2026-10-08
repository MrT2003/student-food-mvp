"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BarChart3, Check, CheckCircle2, ChevronRight, ClipboardList, Clock3, Copy, Headphones, Lightbulb, Share2, Store, Utensils, Wallet, X, Zap } from "lucide-react";
import StudentHeader from "@/components/layout/StudentHeader";
import SellerSidebar from "./SellerSidebar";
import { useSellerPreview } from "@/store/useSellerPreviewStore";
import styles from "@/styles/seller-overview.module.css";

export default function SellerOverviewView() {
  const draft = useSellerPreview();
  const [bannerVisible, setBannerVisible] = useState(true);
  const [notice, setNotice] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const name = draft?.name || "Cửa hàng của bạn";
  const unavailable = (feature: string) => setNotice(`${feature} chưa được triển khai. Hiện đây là bản xem trước giao diện, chưa kết nối API.`);
  const setup = [
    { icon: Utensils, title: "Thêm món đầu tiên", badge: "Chưa có món nào", text: "Tạo món ăn, đặt giá và hình ảnh hấp dẫn để thu hút sinh viên.", action: "Thêm món" },
    { icon: Wallet, title: "Thiết lập thanh toán", badge: draft?.cash === false ? "Tiền mặt: Chưa bật" : "Tiền mặt: Đã chọn", text: "Cấu hình các phương thức thanh toán cho cửa hàng.", action: "Thiết lập" },
    { icon: Store, title: "Hoàn thiện thông tin cửa hàng", badge: "Ảnh đại diện: Chưa tải lên", text: "Cập nhật thông tin cửa hàng để khách hàng dễ tìm thấy bạn.", action: "Chỉnh sửa" },
  ];
  return (
    <div className={styles.page}>
      <StudentHeader />
      <div className={styles.workspace}>
        <SellerSidebar active="overview" name={name} />
        <main className={styles.main}>
          <header className={styles.heading}>
            <h1>Seller Dashboard</h1>
            <h2>Xin chào, <span>{name}</span> 👋</h2>
            <p>Cùng hoàn thiện cửa hàng để bắt đầu phục vụ các bạn sinh viên nhé!</p>
          </header>
          <div className={styles.columns}>
            <div className={styles.content}>
              {bannerVisible && <section className={styles.success}>
                <CheckCircle2 size={36} />
                <div><strong>{draft ? "Hoàn tất đăng ký cửa hàng (bản xem trước)!" : "Chào mừng đến trang tổng quan!"}</strong><p>{draft ? "Thông tin được giữ trong phiên trình duyệt. Chưa tạo cửa hàng hoặc cấp quyền seller trên hệ thống." : "Đăng ký cửa hàng để xem thông tin của bạn tại đây."}</p></div>
                <button onClick={() => setBannerVisible(false)} aria-label="Đóng thông báo"><X size={18} /></button>
              </section>}
              <section className={styles.card}>
                <h3>Trạng thái cửa hàng</h3>
                <div className={styles.status}>
                  <span className={styles.storeIcon}><Store size={40} /></span>
                  <div><span className={styles.closed}>● Tạm đóng</span><p>Cửa hàng của bạn đang tạm đóng và chưa nhận hàng.<br />Bạn cần thêm ít nhất 1 món đang bán trước khi mở cửa hàng.</p></div>
                  <div className={styles.openAction}><button disabled>Mở nhận đơn</button><small>Chưa có món đang bán. Chức năng mở cửa hàng chưa nối API.</small></div>
                </div>
              </section>
              <section>
                <div className={styles.sectionTitle}><Zap /><h3>Thiết lập nhanh</h3><small>Hoàn thiện các thông tin quan trọng để bắt đầu kinh doanh.</small></div>
                <div className={styles.setupGrid}>
                  {setup.map(({ icon: Icon, title, badge, text, action }, index) => <article className={styles.setupCard} key={title}>
                    <div className={styles.setupHeading}><span className={styles.icon}><Icon /></span><div><h4>{title}</h4><span className={index === 1 && draft?.cash !== false ? styles.greenBadge : styles.redBadge}>{badge}</span></div></div>
                    {index === 1 && <small>{draft?.bank === false ? "Chuyển khoản: Chưa chọn" : "Chuyển khoản: Chưa cấu hình"}</small>}
                    {index === 2 && <small><Clock3 size={13} /> {draft?.hours || "Giờ hoạt động: Chưa thiết lập"}</small>}
                    <p>{text}</p><button className={styles.primary} onClick={() => unavailable(title)}>{action}<ArrowRight size={16} /></button>
                  </article>)}
                  <article className={styles.setupCard}>
                    <div className={styles.setupHeading}><span className={styles.icon}><Share2 /></span><h4>Chia sẻ cửa hàng</h4></div>
                    <div className={styles.sharePlaceholder}><Copy size={16} /> Chưa có liên kết công khai</div>
                    <p>Liên kết sẽ có sau khi cửa hàng được tạo trên hệ thống.</p><button className={styles.outline} disabled>Sao chép link</button>
                  </article>
                </div>
              </section>
              {notice && <div className={styles.notice} role="status">{notice}<button onClick={() => setNotice("")} aria-label="Đóng"><X size={16} /></button></div>}
              <section>
                <div className={styles.sectionTitle}><BarChart3 /><h3>Tổng quan hôm nay</h3><small>Số liệu mẫu cho cửa hàng mới, chưa kết nối API.</small></div>
                <div className={styles.stats}>
                  {[{ icon: ClipboardList, label: "Đơn mới", value: "0" }, { icon: CheckCircle2, label: "Đã chấp nhận", value: "0" }, { icon: Check, label: "Hoàn thành", value: "0" }, { icon: Wallet, label: "Doanh thu", value: "0đ" }].map(({ icon: Icon, label, value }, index) => <article key={label} className={styles.stat} data-tone={index}><span className={styles.icon}><Icon /></span><div><h4>{label}</h4><strong>{value}</strong><small>{index === 3 ? "hôm nay" : "đơn hàng"}</small></div></article>)}
                </div>
              </section>
              <section>
                <div className={styles.sectionTitle}><ClipboardList /><h3>Đơn hàng mới</h3><small>Các đơn hàng mới nhất sẽ hiển thị tại đây.</small><Link href="/seller/orders">Xem tất cả <ArrowRight size={16} /></Link></div>
                <div className={styles.empty}><ClipboardList size={40} /><div><strong>Chưa có đơn hàng nào</strong><p>Khi cửa hàng bắt đầu nhận đơn, các đơn hàng mới sẽ hiển thị tại đây.</p></div></div>
              </section>
            </div>
            <aside className={styles.rail}>
              <section className={styles.card}>
                <div className={styles.checklistHeading}><span className={styles.icon}><ClipboardList /></span><h3>Việc nên làm tiếp theo</h3><small>0/4 đã hoàn thành</small></div>
                <progress value={0} max={4} aria-label="Tiến độ thiết lập cửa hàng" />
                {[['Thêm món đầu tiên', 'Tạo và đăng món ăn đầu tiên'], ['Tải ảnh đại diện', 'Giúp cửa hàng của bạn nổi bật hơn'], ['Cấu hình chuyển khoản', 'Nhận thanh toán qua ngân hàng'], ['Mở nhận đơn', 'Sau khi hoàn tất thiết lập cửa hàng']].map(([title, text]) => <button className={styles.task} key={title} onClick={() => unavailable(title)}><span className={styles.checkbox} /><span><strong>{title}</strong><small>{text}</small></span><ChevronRight size={17} /></button>)}
              </section>
              <section className={styles.card}>
                <div className={styles.sectionTitle}><Lightbulb /><h3>Cần hỗ trợ?</h3></div>
                <p>Nếu bạn có thắc mắc trong quá trình thiết lập hoặc kinh doanh, hãy xem hướng dẫn bên dưới.</p>
                <button className={styles.outline} onClick={() => setGuideOpen(!guideOpen)} aria-expanded={guideOpen}>Xem hướng dẫn <ArrowRight size={17} /></button>
                {guideOpen && <ol className={styles.guide}><li>Thêm món và đặt giá bán.</li><li>Hoàn thiện thông tin, hình ảnh cửa hàng.</li><li>Cấu hình thanh toán rồi mở nhận đơn khi đủ điều kiện.</li></ol>}
                <button className={styles.support} onClick={() => unavailable("Liên hệ hỗ trợ")}><Headphones size={18} />Liên hệ hỗ trợ</button>
              </section>
              {!draft && <Link className={styles.outline} href="/seller/register">Đăng ký cửa hàng <ArrowRight size={16} /></Link>}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
