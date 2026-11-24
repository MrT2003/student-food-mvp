import { Suspense } from "react";
import type { Metadata } from "next";
import JoinStoreConfirmView from "@/components/features/account/JoinStoreConfirmView";

export const metadata: Metadata = {
  title: "Xác nhận gia nhập | StudentFood",
  description: "Kiểm tra thông tin cửa hàng trước khi gửi yêu cầu.",
};

export default function JoinStoreConfirmPage() {
  return (
    <Suspense fallback={null}>
      <JoinStoreConfirmView />
    </Suspense>
  );
}
