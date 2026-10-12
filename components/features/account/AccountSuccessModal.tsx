"use client";

import { useEffect, useId, useRef } from "react";
import { Check, X } from "lucide-react";
import styles from "@/styles/account-success-modal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AccountSuccessModal({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }

    if (!dialog.open) dialog.showModal();

    // Không cho trang phía sau cuộn khi popup đang mở.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles.content}>
        <button
          type="button"
          className={styles.closeButton}
          aria-label="Đóng thông báo"
          onClick={onClose}
        >
          <X size={26} strokeWidth={1.8} aria-hidden="true" />
        </button>

        <div className={styles.illustration} aria-hidden="true">
          <span className={styles.leftRays} />

          <span className={styles.checkCircle}>
            <Check size={54} strokeWidth={3.2} />
          </span>

          <span className={styles.rightRays} />
        </div>

        <h2 id={titleId} className={styles.title}>
          Cập nhật thành công
        </h2>

        <p id={descriptionId} className={styles.description}>
          Đã thay đổi tên thành công.
        </p>

        <button
          type="button"
          className={styles.confirmButton}
          onClick={onClose}
          autoFocus
        >
          Đã hiểu
        </button>
      </div>
    </dialog>
  );
}