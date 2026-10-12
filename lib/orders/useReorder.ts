"use client";
import { useRef, useState } from "react";
import { useStudentMockStore } from "@/store/useStudentMockStore";

export function useReorder() {
  const action = useStudentMockStore((s) => s.reorderOrder);
  const submitted = useRef(new Set<string>());
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState("");
  function reorder(id: string) {
    if (submitted.current.has(id)) return;
    submitted.current.add(id);
    const result = action(id);
    if (!result.ok) {
      submitted.current.delete(id);
      setNotice(result.message);
      return;
    }
    setAddedIds(new Set(submitted.current));
    setNotice("Đã thêm món vào giỏ theo giá hiện tại. Vui lòng kiểm tra số lượng, địa chỉ, ghi chú và thanh toán trước khi đặt hàng.");
  }
  return { reorder, addedIds, notice, setNotice };
}
