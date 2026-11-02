import type { Metadata } from "next";
import JoinStoreQrScanView from "@/components/features/account/JoinStoreQrScanView";

export const metadata: Metadata = {
  title: "Quét QR xin việc | StudentFood",
  description: "Quét mã QR từ chủ quán để gửi yêu cầu xin làm nhân viên.",
};

export default function JoinStoreQrScanPage() {
  return <JoinStoreQrScanView />;
}
