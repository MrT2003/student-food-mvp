import { normalizeSearchText } from "@/lib/format";
import type { OrderDetail, OrderDetailStatus } from "@/lib/orders/order-detail";
import type { OrderArtworkKind } from "./OrderFoodMedia";

export type OrderStatus = OrderDetailStatus;

export type OrderStatusFilter =
  | "all"
  | "pending"
  | "accepted"
  | "completed"
  | "cancelled";

export type OrderDateFilter = "today" | "7days" | "30days" | "all";

export type OrderFiltersState = {
  status: OrderStatusFilter;
  query: string;
  dateFilter: OrderDateFilter;
};

export type OrderSummaryCounts = {
  pending: number;
  accepted: number;
  completed: number;
  cancelled: number;
};

export type OrderCardViewModel = {
  id: string;
  orderCode: string;
  restaurantId: string;
  restaurantName: string;
  location: string;
  kind: "food" | "drink";
  artwork: OrderArtworkKind;
  itemArtwork: OrderArtworkKind;
  imageUrl?: string | null;
  itemImageUrl?: string | null;
  status: OrderStatus;
  itemCount: number;
  lineCount: number;
  otherItemCount: number;
  firstItem: string;
  payment: string;
  paymentShort: string;
  total: number;
  date: string;
  dateShort: string;
  createdAt: string;
  isToday?: boolean;
};

export const initialOrderFilters: OrderFiltersState = {
  status: "all",
  query: "",
  dateFilter: "today",
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Đang chờ xác nhận",
  accepted: "Đã chấp nhận",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  rejected: "Bị từ chối",
};

export const orderStatusTabs: readonly {
  value: OrderStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ xác nhận" },
  { value: "accepted", label: "Đã chấp nhận" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
] as const;

export const orderDateOptions: readonly {
  value: OrderDateFilter;
  label: string;
}[] = [
  { value: "today", label: "Hôm nay" },
  { value: "7days", label: "7 ngày qua" },
  { value: "30days", label: "30 ngày qua" },
  { value: "all", label: "Tất cả ngày" },
] as const;

export const orderSummaryCards: readonly {
  key: keyof OrderSummaryCounts;
  label: string;
}[] = [
  { key: "pending", label: "Chờ xác nhận" },
  { key: "accepted", label: "Đã chấp nhận" },
  { key: "completed", label: "Hoàn thành" },
  { key: "cancelled", label: "Đã hủy" },
] as const;

export const defaultOrderSummaryCounts: OrderSummaryCounts = {
  pending: 3,
  accepted: 5,
  completed: 18,
  cancelled: 2,
};

export const previewOrders: OrderCardViewModel[] = [
  {
    id: "SF0123",
    orderCode: "SF0123",
    restaurantId: "10000000-0000-4000-8000-000000000001",
    restaurantName: "Cơm Cô Ba",
    location: "KTX A",
    kind: "food",
    artwork: "com-co-ba",
    itemArtwork: "com-ga-chien",
    status: "pending",
    itemCount: 2,
    lineCount: 2,
    otherItemCount: 1,
    firstItem: "Cơm gà chiên",
    payment: "Chuyển khoản",
    paymentShort: "Chuyển khoản",
    total: 100000,
    date: "06/09/2026",
    dateShort: "06/09/2026",
    createdAt: "2026-09-06T09:30:00.000Z",
    isToday: true,
  },
  {
    id: "SF0124",
    orderCode: "SF0124",
    restaurantId: "10000000-0000-4000-8000-000000000002",
    restaurantName: "Trà Sữa Nhà Làm",
    location: "KTX B",
    kind: "drink",
    artwork: "tra-sua-nha-lam",
    itemArtwork: "tra-sua-truyen-thong",
    status: "accepted",
    itemCount: 2,
    lineCount: 2,
    otherItemCount: 1,
    firstItem: "Trà sữa truyền thống",
    payment: "Thanh toán khi nhận",
    paymentShort: "Thanh toán khi nhận",
    total: 45000,
    date: "06/09/2026",
    dateShort: "06/09/2026",
    createdAt: "2026-09-06T09:15:00.000Z",
    isToday: true,
  },
  {
    id: "SF0101",
    orderCode: "SF0101",
    restaurantId: "10000000-0000-4000-8000-000000000003",
    restaurantName: "Bún Chả Hà Nội",
    location: "KTX A",
    kind: "food",
    artwork: "bun-cha-ha-noi",
    itemArtwork: "bun-cha-ha-noi",
    status: "completed",
    itemCount: 1,
    lineCount: 1,
    otherItemCount: 0,
    firstItem: "Bún chả đặc biệt",
    payment: "Tiền mặt",
    paymentShort: "Tiền mặt",
    total: 52000,
    date: "06/09/2026",
    dateShort: "06/09/2026",
    createdAt: "2026-09-06T08:00:00.000Z",
    isToday: true,
  },
  {
    id: "SF0098",
    orderCode: "SF0098",
    restaurantId: "10000000-0000-4000-8000-000000000004",
    restaurantName: "Mì Cay Seoul",
    location: "KTX B",
    kind: "food",
    artwork: "mi-cay-seoul",
    itemArtwork: "mi-cay-seoul",
    status: "cancelled",
    itemCount: 2,
    lineCount: 2,
    otherItemCount: 1,
    firstItem: "Mì cay hải sản",
    payment: "Tiền mặt",
    paymentShort: "Tiền mặt",
    total: 65000,
    date: "04/09/2026",
    dateShort: "04/09/2026",
    createdAt: "2026-09-04T18:20:00.000Z",
    isToday: true,
  },
  {
    id: "SF0095",
    orderCode: "SF0095",
    restaurantId: "10000000-0000-4000-8000-000000000005",
    restaurantName: "Ăn Vặt 5K",
    location: "KTX A",
    kind: "food",
    artwork: "an-vat-5k",
    itemArtwork: "an-vat-5k",
    status: "completed",
    itemCount: 3,
    lineCount: 3,
    otherItemCount: 2,
    firstItem: "Xiên que thập cẩm",
    payment: "Tiền mặt",
    paymentShort: "Tiền mặt",
    total: 40000,
    date: "02/09/2026",
    dateShort: "02/09/2026",
    createdAt: "2026-09-02T15:10:00.000Z",
    isToday: true,
  },
];

function inferArtwork(
  restaurantName: string,
  firstItemName: string,
  kind: "food" | "drink",
): { artwork: OrderArtworkKind; itemArtwork: OrderArtworkKind } {
  const normRestaurant = normalizeSearchText(restaurantName);
  const normItem = normalizeSearchText(firstItemName);

  if (normRestaurant.includes("com co ba")) {
    return { artwork: "com-co-ba", itemArtwork: "com-ga-chien" };
  }
  if (normRestaurant.includes("tra sua") || kind === "drink") {
    return {
      artwork: "tra-sua-nha-lam",
      itemArtwork: "tra-sua-truyen-thong",
    };
  }
  if (normRestaurant.includes("bun cha") || normItem.includes("bun cha")) {
    return { artwork: "bun-cha-ha-noi", itemArtwork: "bun-cha-ha-noi" };
  }
  if (normRestaurant.includes("mi cay") || normItem.includes("mi cay")) {
    return { artwork: "mi-cay-seoul", itemArtwork: "mi-cay-seoul" };
  }
  if (normRestaurant.includes("an vat")) {
    return { artwork: "an-vat-5k", itemArtwork: "an-vat-5k" };
  }
  return { artwork: kind, itemArtwork: kind };
}

export function formatShortPayment(
  payment: string,
  isHistory: boolean,
): string {
  const norm = normalizeSearchText(payment);
  if (norm.includes("chuyen khoan") || norm.includes("bank")) {
    return "Chuyển khoản";
  }
  if (norm.includes("nhan") || norm.includes("tien mat") || norm.includes("cash")) {
    return isHistory ? "Tiền mặt" : "Thanh toán khi nhận";
  }
  return payment;
}

export function extractShortDate(placedAt: string): string {
  return placedAt.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] ?? placedAt;
}

export function toOrderCardViewModel(order: OrderDetail): OrderCardViewModel {
  const firstItemName = order.items[0]?.name ?? "Món ăn";
  const isHistory =
    order.status === "completed" ||
    order.status === "cancelled" ||
    order.status === "rejected";
  const { artwork, itemArtwork } = inferArtwork(
    order.restaurantName,
    firstItemName,
    order.kind,
  );
  const otherItemCount = Math.max(
    0,
    order.items.length > 1 ? order.items.length - 1 : order.quantity - 1,
  );

  return {
    id: order.id,
    orderCode: order.orderCode,
    restaurantId: order.restaurantId,
    restaurantName: order.restaurantName,
    location: order.restaurantLocation,
    kind: order.kind,
    artwork,
    itemArtwork,
    imageUrl: order.items[0]?.imageUrl ?? null,
    itemImageUrl: order.items[0]?.imageUrl ?? null,
    status: order.status,
    itemCount: order.quantity,
    lineCount: order.items.length,
    otherItemCount,
    firstItem: firstItemName,
    payment: order.payment,
    paymentShort: formatShortPayment(order.payment, isHistory),
    total: order.total,
    date: order.placedAt,
    dateShort: extractShortDate(order.placedAt),
    createdAt: order.createdAt,
    isToday: true,
  };
}

export function isCurrentOrderStatus(status: OrderStatus): boolean {
  return status === "pending" || status === "accepted";
}

export function isHistoryOrderStatus(status: OrderStatus): boolean {
  return (
    status === "completed" || status === "cancelled" || status === "rejected"
  );
}

export function isAllOrdersFilter(
  filters: Partial<OrderFiltersState>,
): boolean {
  const status = filters.status ?? initialOrderFilters.status;
  const query = filters.query ?? initialOrderFilters.query;
  const dateFilter = filters.dateFilter ?? initialOrderFilters.dateFilter;
  return (
    status === "all" &&
    !query.trim() &&
    (dateFilter === "today" || dateFilter === "all")
  );
}

export function matchesOrderStatusFilter(
  order: Pick<OrderCardViewModel, "status">,
  statusFilter: OrderStatusFilter,
): boolean {
  if (statusFilter === "all") return true;
  if (statusFilter === "cancelled") {
    return order.status === "cancelled" || order.status === "rejected";
  }
  return order.status === statusFilter;
}

export function matchesOrderDateFilter(
  order: Pick<OrderCardViewModel, "createdAt" | "isToday">,
  dateFilter: OrderDateFilter,
  referenceIso = "2026-09-06T12:00:00.000Z",
): boolean {
  if (dateFilter === "all") return true;
  if (order.isToday) return true;

  const orderTime = Date.parse(order.createdAt);
  const refTime = Date.parse(referenceIso);
  if (Number.isNaN(orderTime) || Number.isNaN(refTime)) return true;

  const diffDays = (refTime - orderTime) / (1000 * 60 * 60 * 24);
  if (dateFilter === "today") {
    return diffDays >= 0 && diffDays < 1;
  }
  if (dateFilter === "7days") {
    return diffDays >= 0 && diffDays <= 7;
  }
  if (dateFilter === "30days") {
    return diffDays >= 0 && diffDays <= 30;
  }
  return true;
}

export function filterOrderCards(
  orders: OrderCardViewModel[],
  filters: Partial<OrderFiltersState> = initialOrderFilters,
  referenceIso?: string,
): {
  all: OrderCardViewModel[];
  current: OrderCardViewModel[];
  history: OrderCardViewModel[];
} {
  const status = filters.status ?? initialOrderFilters.status;
  const query = filters.query ?? initialOrderFilters.query;
  const dateFilter = filters.dateFilter ?? initialOrderFilters.dateFilter;
  const normalizedQuery = normalizeSearchText(query).replace(/^#/, "");

  const matched = orders.filter((order) => {
    if (!matchesOrderStatusFilter(order, status)) return false;
    if (!matchesOrderDateFilter(order, dateFilter, referenceIso)) return false;

    if (!normalizedQuery) return true;

    const searchable = normalizeSearchText(
      [
        order.orderCode,
        order.id,
        order.restaurantName,
        order.firstItem,
        order.location,
        order.paymentShort,
      ].join(" "),
    );
    return searchable.includes(normalizedQuery);
  });

  return {
    all: matched,
    current: matched.filter((order) => isCurrentOrderStatus(order.status)),
    history: matched.filter((order) => isHistoryOrderStatus(order.status)),
  };
}

export function computeSummaryCounts(
  orders: OrderCardViewModel[],
  baseCounts: OrderSummaryCounts = defaultOrderSummaryCounts,
  useLiveCounts = false,
): OrderSummaryCounts {
  if (!useLiveCounts) {
    return baseCounts;
  }
  return {
    pending: orders.filter((o) => o.status === "pending").length,
    accepted: orders.filter((o) => o.status === "accepted").length,
    completed: orders.filter((o) => o.status === "completed").length,
    cancelled: orders.filter(
      (o) => o.status === "cancelled" || o.status === "rejected",
    ).length,
  };
}

export function cancelPendingOrder(
  orders: OrderCardViewModel[],
  counts: OrderSummaryCounts,
  orderId: string,
): {
  orders: OrderCardViewModel[];
  counts: OrderSummaryCounts;
  cancelledOrder: OrderCardViewModel | null;
} {
  const target = orders.find((o) => o.id === orderId);
  if (!target || target.status !== "pending") {
    return { orders, counts, cancelledOrder: null };
  }

  const updatedOrder: OrderCardViewModel = {
    ...target,
    status: "cancelled",
    paymentShort: formatShortPayment(target.payment, true),
  };

  const nextOrders = orders.map((o) => (o.id === orderId ? updatedOrder : o));
  const nextCounts: OrderSummaryCounts = {
    ...counts,
    pending: Math.max(0, counts.pending - 1),
    cancelled: counts.cancelled + 1,
  };

  return {
    orders: nextOrders,
    counts: nextCounts,
    cancelledOrder: updatedOrder,
  };
}
