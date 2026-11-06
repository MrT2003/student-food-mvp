"use client";
import { useRef, useState } from "react";
import { useStudentMockStore } from "@/store/useStudentMockStore";

export function useReorder() {
  const action = useStudentMockStore((s) => s.reorderDatabaseOrder);
  const submitted = useRef(new Set<string>());
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState("");
  async function reorder(id: string): Promise<boolean> {
    if (submitted.current.has(id)) return true;
    submitted.current.add(id);
    const result = await action(id);
    if (!result.ok) {
      submitted.current.delete(id);
      setNotice(result.message);
      return false;
    }
    setAddedIds(new Set(submitted.current));
    setNotice("Đã thêm món vào giỏ theo giá hiện tại. Vui lòng kiểm tra số lượng, địa chỉ, ghi chú và thanh toán trước khi đặt hàng.");
    return true;
  }
  return { reorder, addedIds, notice, setNotice };
}
