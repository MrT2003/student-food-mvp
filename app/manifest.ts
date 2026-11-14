import type { MetadataRoute } from "next";

// Đường dẫn cùng origin: không gắn domain dev vào bản cài production.
// Manifest chỉ mô tả ứng dụng, không xin quyền hay tự đăng ký push.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "StudentFood",
    short_name: "StudentFood",
    description: "Đặt món và nhận cập nhật đơn hàng cùng StudentFood.",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ff4d0a",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
