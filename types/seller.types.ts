import type { Json } from "@/types/database.types";

export type SellerDayId = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

// Contract sau validation, không phải dữ liệu insert vào restaurants.
// Chỉ giữ ngày bật và giờ có hiệu lực; label của UI không được lưu ở đây.
export type SellerRegistrationSchedule =
  | { mode: "later" }
  | { mode: "same"; dayIds: SellerDayId[]; openTime: string; closeTime: string }
  | { mode: "daily"; days: { id: SellerDayId; open: string; close: string }[] };

export type ValidatedSellerRegistration = {
  name: string;
  description: string;
  location: string;
  cash: boolean;
  bank: boolean;
  schedule: SellerRegistrationSchedule;
};

export type SellerOperatingHours = {
  version: 1;
  timezone: "Asia/Ho_Chi_Minh";
  days: Partial<Record<SellerDayId, { open: string; close: string }>>;
};

export type SellerRegistrationResult = {
  restaurant: { id: string; slug: string; operating_status: "closed" };
  role: "seller";
  paymentSelectionPersisted: false;
  message: string;
};

// Field vắng mặt phải được giữ nguyên; schedule nếu có là cấu hình thay thế đầy đủ.
export type SellerRestaurantPatch = {
  name?: string;
  description?: string;
  location?: string;
  schedule?: SellerRegistrationSchedule;
};

export type SellerRestaurantUpdateResult = {
  restaurant: {
    id: string;
    name: string;
    description: string | null;
    location: string | null;
    // Lịch cũ không bị ép sang quy ước mới khi PATCH không gửi schedule.
    operating_hours: Json | null;
  };
};

export type SellerBankCreate = {
  bank_name: string;
  account_no: string;
  account_name: string;
  is_default: boolean;
};

export type SellerBankPatch = Partial<SellerBankCreate>;

export type SellerBankResult = {
  bank: SellerBankCreate & { id: string; restaurant_id: string };
};

export type StaffInvitationResult = {
  restaurantId: string;
  token: string;
  expiresAt: string;
  qrPayload: string;
  qrImageDataUrl: string;
};

export type StaffJoinResult = {
  profile: { id: string; role: "staff"; work_for_restaurant_id: string };
};
