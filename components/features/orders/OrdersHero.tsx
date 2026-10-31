import styles from "@/styles/orders.module.css";

export default function OrdersHero() {
  return (
    <header className={styles.heading}>
      <h1 id="orders-page-title">Đơn hàng của tôi</h1>
      <p>
        Theo dõi các đơn hàng hiện tại và xem lại lịch sử đặt món của bạn.
      </p>
    </header>
  );
}
