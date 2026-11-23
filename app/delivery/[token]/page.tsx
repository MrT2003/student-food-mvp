import type { Metadata, Viewport } from "next";
import Link from "next/link";
import DeliveryDashboard from "@/components/features/delivery/DeliveryDashboard";
import { DeliveryService, DeliveryServiceError } from "@/services/delivery.service";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Đơn cần giao | StudentFood",
  description: "Giao diện quản lý đơn cần giao dành cho người giao hàng.",
};

export default async function DeliveryTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  try {
    const data = await DeliveryService.getByToken(token);
    return (
      <DeliveryDashboard
        deliveryToken={token}
        shopName={data.restaurant.name}
        bankInfo={data.bank ?? undefined}
        initialOrders={data.orders}
        initialCompletedBaseCount={0}
      />
    );
  } catch (error) {
    const isInvalidToken =
      error instanceof DeliveryServiceError &&
      error.code === "DELIVERY_TOKEN_INVALID";

    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#fbf7f2",
          color: "#091a48",
          fontFamily: "var(--font-body, system-ui, sans-serif)",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "28px 24px",
            borderRadius: 20,
            background: "#ffffff",
            border: "1px solid #f0ebe5",
            boxShadow: "0 14px 36px rgba(15, 23, 42, 0.08)",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>
            {isInvalidToken
              ? "Liên kết giao hàng không hợp lệ"
              : "Không thể tải danh sách đơn giao"}
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "#556c94", lineHeight: 1.5 }}>
            {isInvalidToken
              ? "Liên kết giao hàng không hợp lệ hoặc đã được cửa hàng thay đổi. Vui lòng liên hệ chủ quán để lấy liên kết mới."
              : "Hệ thống đang bận khi kết nối dữ liệu đơn hàng. Vui lòng tải lại trang."}
          </p>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 42,
              padding: "0 20px",
              borderRadius: 10,
              background: "linear-gradient(110deg, #ff8523, #ff391b)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Về trang chủ
          </Link>
        </section>
      </main>
    );
  }
}
