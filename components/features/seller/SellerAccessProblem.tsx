"use client";
import Link from "next/link";
export default function SellerAccessProblem() {
    return <main className="p-6"><h1>Chưa thể mở cửa hàng</h1><p>Thông tin tài khoản hoặc cửa hàng chưa sẵn sàng. Hãy tải lại; nếu vẫn gặp lỗi, vui lòng liên hệ hỗ trợ.</p><button type="button" onClick={() => window.location.reload()}>Tải lại</button> <Link href="/account">Về tài khoản</Link></main>;
}
