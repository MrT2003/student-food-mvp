"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import styles from "@/styles/transfer-content.module.css";

export default function TransferContent({ value, variant = "card" }: { value: string; variant?: "card" | "field" }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Đã sao chép");
    } catch {
      setMessage("Không thể sao chép. Bạn có thể chọn nội dung bên dưới để sao chép thủ công.");
    }
  }
  return <div className={`${styles.box} ${variant === "field" ? styles.field : ""}`}>
    <span className={styles.label}>Nội dung chuyển khoản</span>
    <div className={styles.row}><code>{value}</code><button type="button" onClick={copy} aria-label={`Sao chép ${value}`}><Copy size={16} aria-hidden="true" /></button></div>
    {message && <small role="status">{message}</small>}
  </div>;
}
