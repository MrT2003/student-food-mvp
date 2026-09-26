// Frontend fixtures only; no database writes or authentication actions.
export const headerNotifications = [
  { id: "SF0123", restaurant: "Cơm Cô Ba", message: "đã được cửa hàng chấp nhận.", time: "2 phút trước", kind: "rice", unread: true },
  { id: "SF0124", restaurant: "Trà Sữa Nhà Làm", message: "đang chờ cửa hàng xác nhận.", time: "8 phút trước", kind: "tea", unread: true },
  { id: "SF0118", restaurant: "Bún Chả Hà Nội", message: "đã hoàn thành.", time: "Hôm qua", kind: "noodles", unread: false },
  { id: "SF0116", restaurant: "Mì Cay Seoul", message: "đã bị từ chối.", time: "Hôm qua", kind: "spicy", unread: false },
] as const;

export type HeaderNotification = Omit<(typeof headerNotifications)[number], "unread"> & { unread: boolean };
