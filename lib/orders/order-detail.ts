export { formatMoney as formatOrderMoney } from "@/lib/format";
export type OrderDetailStatus =
  | "pending"
  | "accepted"
  | "completed"
  | "cancelled"
  | "rejected";

export type OrderDetailItem = {
  id: string;
  name: string;
  kind: "food" | "drink";
  quantity: number;
  unitPrice: number;
  options: string[];
  note: string;
};

export type OrderDetail = {
  id: string;
  restaurantName: string;
  restaurantLocation: string;
  kind: "food" | "drink";
  status: OrderDetailStatus;
  placedAt: string;
  payment: string;
  note: string;
  deliveryLocation: string;
  deliveryAddress: string;
  deliveryFee: number;
  items: OrderDetailItem[];
};

export const orderStatusLabels: Record<OrderDetailStatus, string> = {
  pending: "Đang chờ xác nhận",
  accepted: "Đã chấp nhận",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  rejected: "Bị từ chối",
};

// Chỉ phục vụ UI. Sau này thay bằng dữ liệu từ API.
export const mockOrderDetails: OrderDetail[] = [
  {
    id: "SF0124",
    restaurantName: "Trà Sữa Nhà Làm",
    restaurantLocation: "KTX B",
    kind: "drink",
    status: "accepted",
    placedAt: "09:45 - 10/09/2026",
    payment: "Thanh toán khi nhận món",
    note: "Gọi khi tới nơi.",
    deliveryLocation: "KTX B",
    deliveryAddress: "Tòa B1, Phòng 101",
    deliveryFee: 0,
    items: [
      {
        id: "milk-tea",
        name: "Trà sữa truyền thống",
        kind: "drink",
        quantity: 1,
        unitPrice: 25000,
        options: ["Trân châu đen"],
        note: "Ít đá",
      },
      {
        id: "peach-tea",
        name: "Trà đào cam sả",
        kind: "drink",
        quantity: 1,
        unitPrice: 20000,
        options: [],
        note: "Ít đá, ít ngọt",
      },
    ],
  },
  {
    id: "SF0123",
    restaurantName: "Cơm Cô Ba",
    restaurantLocation: "KTX A",
    kind: "food",
    status: "pending",
    placedAt: "09:42 - 10/09/2026",
    payment: "Chuyển khoản ngân hàng",
    note: "Ít cay, nhiều rau.",
    deliveryLocation: "KTX A",
    deliveryAddress: "Cổng B, Phòng 302",
    deliveryFee: 0,
    items: [
      {
        id: "chicken",
        name: "Cơm gà chiên",
        kind: "food",
        quantity: 2,
        unitPrice: 35000,
        options: [],
        note: "Ít cơm",
      },
      {
        id: "ribs",
        name: "Cơm sườn nướng",
        kind: "food",
        quantity: 1,
        unitPrice: 30000,
        options: [],
        note: "",
      },
    ],
  },
  {
    id: "SF0108",
    restaurantName: "Cơm Gà 3 Chị Em",
    restaurantLocation: "KTX A",
    kind: "food",
    status: "completed",
    placedAt: "08/09/2026",
    payment: "Thanh toán khi nhận món",
    note: "",
    deliveryLocation: "KTX A",
    deliveryAddress: "Cổng B, Phòng 302",
    deliveryFee: 0,
    items: [
      {
        id: "chicken-rice",
        name: "Cơm gà",
        kind: "food",
        quantity: 1,
        unitPrice: 39000,
        options: [],
        note: "",
      },
      {
        id: "roasted-chicken-rice",
        name: "Cơm gà quay",
        kind: "food",
        quantity: 1,
        unitPrice: 39000,
        options: [],
        note: "",
      },
    ],
  },
  {
    id: "SF0101",
    restaurantName: "Bún Chả Hà Nội",
    restaurantLocation: "KTX A",
    kind: "food",
    status: "cancelled",
    placedAt: "06/09/2026",
    payment: "Thanh toán khi nhận món",
    note: "",
    deliveryLocation: "KTX A",
    deliveryAddress: "Cổng B, Phòng 302",
    deliveryFee: 0,
    items: [
      {
        id: "bun-cha",
        name: "Bún chả",
        kind: "food",
        quantity: 1,
        unitPrice: 52000,
        options: [],
        note: "",
      },
    ],
  },
  {
    id: "SF0098",
    restaurantName: "Mì Cay Seoul",
    restaurantLocation: "KTX B",
    kind: "food",
    status: "rejected",
    placedAt: "04/09/2026",
    payment: "Chuyển khoản ngân hàng",
    note: "",
    deliveryLocation: "KTX B",
    deliveryAddress: "Tòa B1, Phòng 101",
    deliveryFee: 0,
    items: [
      {
        id: "spicy-noodles",
        name: "Mì cay",
        kind: "food",
        quantity: 1,
        unitPrice: 35000,
        options: [],
        note: "",
      },
      {
        id: "beef-noodles",
        name: "Mì cay bò",
        kind: "food",
        quantity: 1,
        unitPrice: 30000,
        options: [],
        note: "",
      },
    ],
  },
];

type HistoryStatus = "completed" | "cancelled" | "rejected";

type HistorySeed = {
  id: string;
  name: string;
  location: string;
  date: string;
  status: HistoryStatus;
  kind: "food" | "drink";
  dishes: { name: string; price: number }[];
};

function createHistoryOrder(seed: HistorySeed): OrderDetail {
  return {
    id: seed.id,
    restaurantName: seed.name,
    restaurantLocation: seed.location,
    kind: seed.kind,
    status: seed.status,
    placedAt: seed.date,
    payment: "Thanh toán khi nhận món",
    note: "",
    deliveryLocation: seed.location,
    deliveryAddress:
      seed.location === "KTX A" ? "Cổng B, Phòng 302" : "Tòa B1, Phòng 101",
    deliveryFee: 0,
    items: seed.dishes.map((dish, index) => ({
      id: `${seed.id}-item-${index + 1}`,
      name: dish.name,
      kind: seed.kind,
      quantity: 1,
      unitPrice: dish.price,
      options: [],
      note: "",
    })),
  };
}

const additionalHistoryOrders: OrderDetail[] = [
  createHistoryOrder({
    id: "SF0113",
    name: "Cơm Cô Ba",
    location: "KTX A",
    date: "10/09/2026",
    status: "completed",
    kind: "food",
    dishes: [
      { name: "Cơm gà chiên", price: 55000 },
      { name: "Cơm sườn nướng", price: 45000 },
    ],
  }),
  createHistoryOrder({
    id: "SF0114",
    name: "Trà Sữa Nhà Làm",
    location: "KTX B",
    date: "09/09/2026",
    status: "completed",
    kind: "drink",
    dishes: [
      { name: "Trà sữa truyền thống", price: 25000 },
      { name: "Trà đào cam sả", price: 20000 },
    ],
  }),
  createHistoryOrder({
    id: "SF0095",
    name: "Bánh Mì Út",
    location: "KTX A",
    date: "01/09/2026",
    status: "completed",
    kind: "food",
    dishes: [{ name: "Bánh mì thịt nướng", price: 28000 }],
  }),
  createHistoryOrder({
    id: "SF0090",
    name: "Cơm Tấm Sài Gòn",
    location: "KTX B",
    date: "28/08/2026",
    status: "rejected",
    kind: "food",
    dishes: [{ name: "Cơm tấm sườn nướng", price: 55000 }],
  }),
  createHistoryOrder({
    id: "SF0087",
    name: "Bún Bò Huế",
    location: "KTX A",
    date: "25/08/2026",
    status: "completed",
    kind: "food",
    dishes: [
      { name: "Bún bò tái nạm", price: 45000 },
      { name: "Chả thêm", price: 17000 },
    ],
  }),
  createHistoryOrder({
    id: "SF0083",
    name: "Chè Cô Lan",
    location: "KTX B",
    date: "20/08/2026",
    status: "cancelled",
    kind: "drink",
    dishes: [{ name: "Chè thập cẩm", price: 30000 }],
  }),
];

export const mockHistoryOrders: OrderDetail[] = [
  ...mockOrderDetails.filter(
    (order) =>
      order.status === "completed" ||
      order.status === "cancelled" ||
      order.status === "rejected",
  ),
  ...additionalHistoryOrders,
];

// Dùng chung cho màn hình chi tiết và theo dõi.
export function findMockOrderDetail(orderId: string) {
  return (
    mockOrderDetails.find((order) => order.id === orderId) ??
    additionalHistoryOrders.find((order) => order.id === orderId)
  );
}
