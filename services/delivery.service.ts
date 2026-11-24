import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  DeliveryOrder,
  DeliveryOrderItemDetail,
} from "@/components/features/delivery/DeliveryDashboard";
import type { VietQrBankSource } from "@/lib/payment/vietqr";

export class DeliveryServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

async function getDbClient(): Promise<SupabaseClient> {
  try {
    return createAdminClient();
  } catch {
    return await createClient();
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatTimeHm(value: string | null | undefined): string {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return timeFormatter.format(date);
}

type OrderRow = {
  id: string;
  order_code: string;
  order_status: string;
  payment_method: string | null;
  total: number;
  delivery_address: string | null;
  customer_notes: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  student_id: string;
  order_items: {
    id: string;
    item_name_snapshot: string;
    quantity: number;
    total_price: number | null;
    unit_price_snapshot: number | null;
    image_url: string | null;
  }[];
};

type UserRow = {
  id: string;
  name: string | null;
  phone: string | null;
};

type BankRow = {
  bank_name: string;
  account_no: string;
  account_name: string;
  is_default: boolean;
};

export type DeliveryTokenPayload = {
  restaurant: {
    id: string;
    name: string;
    avatar_url: string | null;
    location: string | null;
  };
  bank: VietQrBankSource | null;
  orders: DeliveryOrder[];
};

export const DeliveryService = {
  async getByToken(rawToken: string): Promise<DeliveryTokenPayload> {
    const token = typeof rawToken === "string" ? rawToken.trim() : "";
    if (!token || token.length > 128) {
      throw new DeliveryServiceError("DELIVERY_TOKEN_INVALID", 404);
    }

    const db = await getDbClient();

    const { data: restaurant, error: restaurantError } = await db
      .from("restaurants")
      .select(
        "id, name, avatar_url, location, status, operating_status, delivery_token_updated_at",
      )
      .eq("delivery_token", token)
      .maybeSingle();

    if (restaurantError) {
      throw new DeliveryServiceError("DELIVERY_READ_FAILED", 503);
    }
    if (!restaurant) {
      throw new DeliveryServiceError("DELIVERY_TOKEN_INVALID", 404);
    }

    const { data: banksData, error: bankError } = await db
      .from("restaurant_banks")
      .select("bank_name, account_no, account_name, is_default")
      .eq("restaurant_id", restaurant.id);

    if (bankError) {
      throw new DeliveryServiceError("DELIVERY_READ_FAILED", 503);
    }

    const bankList = (Array.isArray(banksData) ? banksData : []) as BankRow[];
    const chosenBank =
      bankList.find((entry) => entry.is_default) ?? bankList[0] ?? null;

    const bank: VietQrBankSource | null = chosenBank
      ? {
          bank_id: chosenBank.bank_name,
          bank_name: chosenBank.bank_name,
          bank_account_no: chosenBank.account_no,
          bank_account_name: chosenBank.account_name,
        }
      : null;

    const { data: ordersData, error: ordersError } = await db
      .from("orders")
      .select(
        "id, order_code, order_status, payment_method, total, delivery_address, customer_notes, created_at, accepted_at, completed_at, student_id, order_items(id, item_name_snapshot, quantity, total_price, unit_price_snapshot, image_url)",
      )
      .eq("restaurant_id", restaurant.id)
      .in("order_status", ["accepted", "completed"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (ordersError) {
      throw new DeliveryServiceError("DELIVERY_READ_FAILED", 503);
    }

    const rawOrders = (Array.isArray(ordersData) ? ordersData : []) as OrderRow[];
    const studentIds = [
      ...new Set(rawOrders.map((row) => row.student_id).filter(Boolean)),
    ];

    const userMap = new Map<string, UserRow>();
    if (studentIds.length > 0) {
      const { data: usersData, error: usersError } = await db
        .from("users")
        .select("id, name, phone")
        .in("id", studentIds);

      if (usersError) {
        throw new DeliveryServiceError("DELIVERY_READ_FAILED", 503);
      }

      for (const user of (Array.isArray(usersData) ? usersData : []) as UserRow[]) {
        userMap.set(user.id, user);
      }
    }

    const orders: DeliveryOrder[] = rawOrders.map((row) => {
      const customer = userMap.get(row.student_id);
      const orderItems = Array.isArray(row.order_items) ? row.order_items : [];
      const itemCount = orderItems.reduce(
        (sum, entry) => sum + (Number(entry.quantity) || 0),
        0,
      );
      const dishItems: DeliveryOrderItemDetail[] = orderItems.map((entry) => {
        const qty = Number(entry.quantity) || 1;
        const unit = Number(entry.total_price ?? entry.unit_price_snapshot ?? 0);
        return {
          id: entry.id,
          name: entry.item_name_snapshot,
          quantity: qty,
          unitLabel: `${qty} phần`,
          price: unit * qty,
          imageUrl: entry.image_url ?? null,
        };
      });

      const isCompleted = row.order_status === "completed";
      const address = row.delivery_address ?? "";

      return {
        id: row.id,
        orderCode: row.order_code.startsWith("#")
          ? row.order_code
          : `#${row.order_code}`,
        badgeState: isCompleted ? "done" : "new",
        time: formatTimeHm(row.accepted_at ?? row.created_at),
        deliveredAt: row.completed_at ? formatTimeHm(row.completed_at) : undefined,
        customerName: customer?.name || "Sinh viên",
        phone: customer?.phone || "Chưa có SĐT",
        dorm: /ktx\s*b/i.test(address) ? "KTX B" : "KTX A",
        addressDetail: address || "Chưa có địa chỉ chi tiết",
        itemCount: itemCount > 0 ? itemCount : orderItems.length,
        paymentMethod: row.payment_method === "bank_transfer" ? "transfer" : "cash",
        total: Number(row.total) || 0,
        items: orderItems.map(
          (entry) => `${entry.item_name_snapshot} x${entry.quantity}`,
        ),
        dishItems,
        note: row.customer_notes || undefined,
        status: isCompleted ? "delivered" : "delivering",
      };
    });

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        avatar_url: restaurant.avatar_url ?? null,
        location: restaurant.location ?? null,
      },
      bank,
      orders,
    };
  },

  async completeOrderByToken(rawToken: string, orderId: string) {
    const token = typeof rawToken === "string" ? rawToken.trim() : "";
    if (!token || token.length > 128) {
      throw new DeliveryServiceError("DELIVERY_TOKEN_INVALID", 404);
    }
    if (!orderId || !UUID_RE.test(orderId)) {
      throw new DeliveryServiceError("INVALID_ORDER_ID", 400);
    }

    const db = await getDbClient();

    const { data: restaurant, error: restaurantError } = await db
      .from("restaurants")
      .select("id")
      .eq("delivery_token", token)
      .maybeSingle();

    if (restaurantError) {
      throw new DeliveryServiceError("DELIVERY_READ_FAILED", 503);
    }
    if (!restaurant) {
      throw new DeliveryServiceError("DELIVERY_TOKEN_INVALID", 404);
    }

    const { data: order, error: orderError } = await db
      .from("orders")
      .select("id, order_status, completed_at")
      .eq("id", orderId)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();

    if (orderError) {
      throw new DeliveryServiceError("DELIVERY_READ_FAILED", 503);
    }
    if (!order) {
      throw new DeliveryServiceError("ORDER_NOT_FOUND", 404);
    }

    if (order.order_status === "completed") {
      return {
        orderId,
        order_status: "completed" as const,
        completed_at: order.completed_at,
        alreadyCompleted: true,
      };
    }

    if (order.order_status !== "accepted") {
      throw new DeliveryServiceError("ORDER_NOT_DELIVERABLE", 409);
    }

    const completedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await db
      .from("orders")
      .update({
        order_status: "completed",
        completed_at: completedAt,
      })
      .eq("id", orderId)
      .eq("restaurant_id", restaurant.id)
      .eq("order_status", "accepted")
      .select("id, order_status, completed_at")
      .maybeSingle();

    if (updateError || !updated) {
      throw new DeliveryServiceError("DELIVERY_COMPLETE_FAILED", 503);
    }

    return {
      orderId: updated.id,
      order_status: "completed" as const,
      completed_at: updated.completed_at ?? completedAt,
      alreadyCompleted: false,
    };
  },
};
