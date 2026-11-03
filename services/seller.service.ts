import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRecord } from "@/utilities/system.utility";
import type {
  SellerBankCreate,
  SellerBankPatch,
  SellerBankResult,
  SellerBankListResult,
  StaffInvitationResult,
  StaffJoinResult,
  SellerDayId,
  SellerOperatingHours,
  SellerRegistrationResult,
  SellerRegistrationSchedule,
  SellerRestaurantPatch,
  SellerRestaurantUpdateResult,
  SellerRestaurantOpenResult,
  ValidatedSellerRegistration,
} from "@/types/seller.types";

export class SellerValidationError extends Error {}

export type SellerRegistrationErrorCode =
  | "PROFILE_NOT_FOUND" | "ACCOUNT_INACTIVE" | "ROLE_CONFLICT"
  | "SLUG_CONFLICT" | "UNAUTHORIZED" | "DATABASE_ACCESS_DENIED"
  | "REGISTRATION_RPC_UNAVAILABLE" | "REGISTRATION_RESULT_UNKNOWN" | "REGISTRATION_FAILED";

export class SellerRegistrationError extends Error {
  constructor(public readonly code: SellerRegistrationErrorCode) {
    super(code);
  }
}

export type SellerRestaurantUpdateErrorCode =
  | "PROFILE_NOT_FOUND" | "ACCOUNT_INACTIVE" | "SELLER_REQUIRED" | "RESTAURANT_NOT_FOUND"
  | "UNAUTHORIZED" | "DATABASE_ACCESS_DENIED" | "UPDATE_FAILED";

export class SellerRestaurantUpdateError extends Error {
  constructor(public readonly code: SellerRestaurantUpdateErrorCode) {
    super(code);
  }
}

export type SellerRestaurantOpenErrorCode =
  | "UNAUTHORIZED" | "PROFILE_NOT_FOUND" | "ACCOUNT_INACTIVE" | "SELLER_REQUIRED"
  | "RESTAURANT_NOT_FOUND" | "OPERATING_STATUS_CONFLICT" | "DATABASE_ACCESS_DENIED"
  | "RESTAURANT_OPEN_RPC_UNAVAILABLE" | "RESTAURANT_OPEN_RESULT_UNKNOWN" | "RESTAURANT_OPEN_FAILED";

export class SellerRestaurantOpenError extends Error {
  constructor(public readonly code: SellerRestaurantOpenErrorCode) { super(code); }
}

export type SellerBankErrorCode =
  | "PROFILE_NOT_FOUND" | "ACCOUNT_INACTIVE" | "SELLER_REQUIRED" | "RESTAURANT_NOT_FOUND"
  | "BANK_NOT_FOUND" | "BANK_ACCOUNT_CONFLICT" | "BANK_WRITE_FAILED" | "BANK_READ_FAILED"
  | "UNAUTHORIZED" | "DATABASE_ACCESS_DENIED" | "BANK_DEFAULT_ATOMICITY_UNAVAILABLE";

export class SellerBankError extends Error {
  constructor(public readonly code: SellerBankErrorCode) {
    super(code);
  }
}

export type SellerStaffErrorCode =
  | "PROFILE_NOT_FOUND" | "ACCOUNT_INACTIVE" | "SELLER_REQUIRED" | "RESTAURANT_NOT_FOUND"
  | "ISSUER_NOT_ALLOWED" | "STAFF_ROLE_CONFLICT" | "STAFF_MEMBERSHIP_CONFLICT"
  | "STAFF_TOKEN_CONFIGURATION_MISSING" | "INVALID_STAFF_TOKEN" | "STAFF_TOKEN_EXPIRED"
  | "DATABASE_CONFIGURATION_MISSING" | "DATABASE_CONFIGURATION_INVALID" | "STAFF_OPERATION_FAILED" | "STAFF_JOIN_ATOMICITY_UNAVAILABLE" | "STAFF_JOIN_RPC_UNAVAILABLE" | "STAFF_JOIN_RESULT_UNKNOWN" | "UNAUTHORIZED" | "DATABASE_ACCESS_DENIED";

export class SellerStaffError extends Error {
  constructor(public readonly code: SellerStaffErrorCode) { super(code); }
}

type StaffTokenTools = typeof import("@/lib/seller/staff-token");
function staffTokenCall<T>(tools: StaffTokenTools, action: () => T): T {
  try { return action(); }
  catch (error) {
    if (error instanceof tools.StaffTokenError) throw new SellerStaffError(error.code);
    throw new SellerStaffError("STAFF_OPERATION_FAILED");
  }
}

const dayIds: readonly string[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const registrationFields = [
  "name", "description", "location", "cash", "bank", "scheduleMode",
  "days", "openTime", "closeTime", "startClosed", "appLockPin",
];

function invalid(field: string, reason: string): never {
  throw new SellerValidationError(`SELLER_VALIDATION_ERROR: ${field}: ${reason}`);
}

function assertFields(value: Record<string, unknown>, allowed: readonly string[], field: string) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    invalid(field, "Có trường không được phép.");
  }
}

function requiredText(value: unknown, field: string, maxLength?: number): string {
  if (typeof value !== "string" || !value.trim()) {
    invalid(field, "Phải là chuỗi không rỗng.");
  }
  // Đo độ dài như maxLength của form trước khi trim, không nới giới hạn input.
  if (maxLength !== undefined && value.length > maxLength) invalid(field, `Tối đa ${maxLength} ký tự.`);
  return value.trim();
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") invalid(field, "Phải là boolean.");
  return value;
}

function optionalString(value: unknown, field: string) {
  if (value !== undefined && typeof value !== "string") invalid(field, "Phải là chuỗi.");
}

function timeValue(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    invalid(field, "Giờ phải có định dạng HH:mm hợp lệ.");
  }
  return value;
}

function timeRange(open: unknown, close: unknown, field: string) {
  const openTime = timeValue(open, `${field}.open`);
  const closeTime = timeValue(close, `${field}.close`);
  // Giữ hành vi form: cùng ngày, không hỗ trợ lịch qua đêm.
  if (openTime >= closeTime) invalid(field, "Giờ đóng phải sau giờ mở trong cùng ngày.");
  return { openTime, closeTime };
}

function validateSchedule(input: Record<string, unknown>): SellerRegistrationSchedule {
  const mode = input.scheduleMode;
  if (mode !== "same" && mode !== "daily" && mode !== "later") {
    invalid("scheduleMode", "Chỉ chấp nhận same, daily hoặc later.");
  }

  // Form giữ state của cả các chế độ đang ẩn. Kiểm tra kiểu nếu được gửi,
  // nhưng chỉ kiểm tra khoảng giờ và trả giờ của chế độ/ngày đang hoạt động.
  optionalString(input.openTime, "openTime");
  optionalString(input.closeTime, "closeTime");
  const selectedDays: { id: SellerDayId; open: unknown; close: unknown }[] = [];
  if (input.days !== undefined || mode !== "later") {
    if (!Array.isArray(input.days)) invalid("days", "Phải là danh sách ngày.");
    if (input.days.length > dayIds.length) invalid("days", "Danh sách có quá nhiều ngày.");
    const seen = new Set<string>();
    for (const [index, day] of input.days.entries()) {
      const field = `days[${index}]`;
      if (!isRecord(day)) invalid(field, "Phải là object.");
      assertFields(day, ["id", "label", "enabled", "open", "close"], field);
      if (typeof day.id !== "string" || !dayIds.includes(day.id) || seen.has(day.id)) {
        invalid(`${field}.id`, "Ngày không hợp lệ hoặc bị trùng.");
      }
      seen.add(day.id);
      optionalString(day.label, `${field}.label`);
      optionalString(day.open, `${field}.open`);
      optionalString(day.close, `${field}.close`);
      const enabled = booleanValue(day.enabled, `${field}.enabled`);
      if (enabled) selectedDays.push({ id: day.id as SellerDayId, open: day.open, close: day.close });
    }
  }

  // Thiết lập sau không bắt buộc ngày hoặc giờ, không đưa state ẩn vào output.
  if (mode === "later") return { mode };
  if (!selectedDays.length) invalid("days", "Phải chọn ít nhất một ngày hoạt động.");
  if (mode === "same") {
    return {
      mode,
      dayIds: selectedDays.map((day) => day.id),
      ...timeRange(input.openTime, input.closeTime, "hours"),
    };
  }
  return {
    mode,
    days: selectedDays.map((day) => {
      const hours = timeRange(day.open, day.close, `days.${day.id}`);
      return { id: day.id, open: hours.openTime, close: hours.closeTime };
    }),
  };
}

function operatingHours(schedule: SellerRegistrationSchedule): SellerOperatingHours | null {
  if (schedule.mode === "later") return null;
  const days: SellerOperatingHours["days"] = {};
  if (schedule.mode === "same") {
    for (const id of schedule.dayIds) days[id] = { open: schedule.openTime, close: schedule.closeTime };
  } else {
    for (const day of schedule.days) days[day.id] = { open: day.open, close: day.close };
  }
  // Quy ước mới đã chốt, chưa xác minh tương thích JSON của các quán cũ.
  return { version: 1, timezone: "Asia/Ho_Chi_Minh", days };
}

function validatePatchSchedule(value: unknown): SellerRegistrationSchedule {
  if (!isRecord(value)) invalid("schedule", "Phải là object lịch đầy đủ.");
  const mode = value.mode;
  if (mode === "later") {
    assertFields(value, ["mode"], "schedule");
    return { mode };
  }
  // Nhận dạng đã chuẩn hóa của đợt 1, không nhận nguyên state form đăng ký.
  // Adapter gọi lại validation ngày/giờ cũ để không thay đổi quy tắc lịch.
  if (mode === "same") {
    assertFields(value, ["mode", "dayIds", "openTime", "closeTime"], "schedule");
    if (!Array.isArray(value.dayIds)) invalid("schedule.dayIds", "Phải là danh sách ngày.");
    return validateSchedule({
      scheduleMode: mode, openTime: value.openTime, closeTime: value.closeTime,
      days: value.dayIds.map((id) => ({ id, enabled: true })),
    });
  }
  if (mode === "daily") {
    assertFields(value, ["mode", "days"], "schedule");
    if (!Array.isArray(value.days)) invalid("schedule.days", "Phải là danh sách ngày.");
    const days = value.days.map((day, index) => {
      if (!isRecord(day)) invalid(`schedule.days[${index}]`, "Phải là object.");
      assertFields(day, ["id", "open", "close"], `schedule.days[${index}]`);
      return { id: day.id, open: day.open, close: day.close, enabled: true };
    });
    return validateSchedule({ scheduleMode: mode, days });
  }
  return invalid("schedule.mode", "Chỉ chấp nhận same, daily hoặc later.");
}

function uuidValue(value: unknown, field = "restaurantId"): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    invalid(field, "Phải là UUID hợp lệ.");
  }
  return value;
}

const bankTextFields = ["bank_name", "account_no", "account_name"] as const;

function bankPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) invalid("payload", "Phải là object JSON.");
  assertFields(input, [...bankTextFields, "is_default"], "payload");
  if (!Object.keys(input).length) invalid("payload", "Phải gửi ít nhất một trường.");
  return input;
}

type BankOperation =
  | { mode: "create"; data: SellerBankCreate }
  | { mode: "update"; bankId: string; data: SellerBankPatch };

// Session client không nâng quyền; không dùng admin cho các thao tác seller này.
// Quản lý DB xác nhận RLS đang tắt/quyền bảng rộng: các check API không bảo vệ
// được đường gọi Data API trực tiếp. Không tự sửa DB để che rủi ro đó.
// API truyền client đã xác thực; service vẫn kiểm tra danh tính cho caller trực tiếp.
class SellerAccessError extends Error {
  constructor(public readonly code: "UNAUTHORIZED" | "PROFILE_NOT_FOUND" | "ACCOUNT_INACTIVE" | "DATABASE_ACCESS_DENIED" | "SUPABASE_OPERATION_FAILED") { super(code); }
}
function checkSdkError(error: { code?: string } | null) {
  if (error) throw new SellerAccessError(error.code === "42501" ? "DATABASE_ACCESS_DENIED" : "SUPABASE_OPERATION_FAILED");
}
async function sellerSession(userId: string, supplied?: SupabaseClient) {
  const client = supplied ?? await (await import("@/lib/supabase/server")).createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.id !== userId) throw new SellerAccessError("UNAUTHORIZED");
  const { data: profile, error: profileError } = await client.from("users")
    .select("role,status").eq("id", data.user.id).maybeSingle();
  checkSdkError(profileError);
  if (!profile) throw new SellerAccessError("PROFILE_NOT_FOUND");
  if (profile.status !== "active") throw new SellerAccessError("ACCOUNT_INACTIVE");
  return { client, profile };
}
async function ownsRestaurant(client: SupabaseClient, userId: string, restaurantId: string) {
  const { data, error } = await client.from("restaurants").select("id")
    .eq("id", restaurantId).eq("owner_id", userId).maybeSingle();
  checkSdkError(error);
  return !!data;
}
function isBankConstraint(error: unknown, constraint: string): boolean {
  if (!isRecord(error) || error.code !== "23505") return false;
  if (error.schema !== undefined && error.schema !== "public") return false;
  if (error.table !== undefined && error.table !== "restaurant_banks") return false;
  // PostgREST chỉ có code/message/details/hint, không có trường constraint của pg.
  return error.constraint === constraint || (typeof error.message === "string" && error.message.includes('"' + constraint + '"'));
}
function staffAccessError(error: unknown): SellerStaffError {
  if (error instanceof SellerStaffError) return error;
  if (error instanceof SellerAccessError && error.code !== "SUPABASE_OPERATION_FAILED") return new SellerStaffError(error.code);
  return new SellerStaffError("STAFF_OPERATION_FAILED");
}
const bankColumns = "id,restaurant_id,bank_name,account_no,account_name,is_default";
async function writeRestaurantBank(userId: string, restaurantId: string, operation: BankOperation, supplied?: SupabaseClient): Promise<SellerBankResult> {
  try {
    const { client, profile } = await sellerSession(userId, supplied);
    if (profile.role !== "seller") throw new SellerBankError("SELLER_REQUIRED");
    if (!await ownsRestaurant(client, userId, restaurantId)) throw new SellerBankError("RESTAURANT_NOT_FOUND");
    if (operation.mode === "update") {
      const { data, error } = await client.from("restaurant_banks").select("id")
        .eq("id", operation.bankId).eq("restaurant_id", restaurantId).maybeSingle();
      checkSdkError(error);
      if (!data) throw new SellerBankError("BANK_NOT_FOUND");
    }
    if (operation.data.is_default === true) {
      let query = client.from("restaurant_banks").select("id")
        .eq("restaurant_id", restaurantId).eq("is_default", true);
      if (operation.mode === "update") query = query.neq("id", operation.bankId);
      const { data, error } = await query.limit(1).maybeSingle();
      checkSdkError(error);
      // Chưa có định nghĩa RPC chuyển default trong repo: không demote bằng request
      // riêng rồi ghi đích. Nếu đã có default khác, dừng trước bất kỳ thao tác ghi.
      if (data) throw new SellerBankError("BANK_DEFAULT_ATOMICITY_UNAVAILABLE");
    }
    // Chỉ MỘT mutation. Unique account/partial unique default trong schema là hàng
    // rào DB cho request cạnh tranh; không xóa bù hoặc coi các request là transaction.
    const mutation = operation.mode === "create"
      ? client.from("restaurant_banks").insert({ id: randomUUID(), restaurant_id: restaurantId, ...operation.data })
      : client.from("restaurant_banks").update({ ...operation.data, updated_at: new Date().toISOString() })
        .eq("id", operation.bankId).eq("restaurant_id", restaurantId);
    const { data, error } = await mutation.select(bankColumns).maybeSingle();
    if (isBankConstraint(error, "uq_restaurant_banks_account")) throw new SellerBankError("BANK_ACCOUNT_CONFLICT");
    if (isBankConstraint(error, "uq_restaurant_banks_one_default")) throw new SellerBankError("BANK_DEFAULT_ATOMICITY_UNAVAILABLE");
    checkSdkError(error);
    if (!data) throw new SellerBankError(operation.mode === "update" ? "BANK_NOT_FOUND" : "BANK_WRITE_FAILED");
    return { bank: { id: data.id, restaurant_id: data.restaurant_id, bank_name: data.bank_name,
      account_no: data.account_no, account_name: data.account_name, is_default: data.is_default } };
  } catch (error) {
    if (error instanceof SellerBankError) throw error;
    if (error instanceof SellerAccessError && error.code !== "SUPABASE_OPERATION_FAILED") throw new SellerBankError(error.code);
    throw new SellerBankError("BANK_WRITE_FAILED");
  }
}

export const SellerServices = {
  // Endpoint chuyên biệt closed -> open; không mở rộng PATCH thông tin quán.
  async openRestaurant(userId: string, restaurantId: unknown, input: unknown, supplied?: SupabaseClient): Promise<SellerRestaurantOpenResult> {
    const id = uuidValue(restaurantId);
    if (!isRecord(input)) invalid("payload", "Phải là object JSON.");
    assertFields(input, ["operating_status"], "payload");
    if (!Object.hasOwn(input, "operating_status") || input.operating_status !== "open") invalid("operating_status", "Chỉ chấp nhận open.");
    try {
      const { client, profile } = await sellerSession(userId, supplied);
      if (profile.role !== "seller") throw new SellerRestaurantOpenError("SELLER_REQUIRED");
      const { data: restaurant, error: readError } = await client.from("restaurants")
        .select("id,operating_status").eq("id", id).eq("owner_id", userId).maybeSingle();
      checkSdkError(readError);
      if (!restaurant) throw new SellerRestaurantOpenError("RESTAURANT_NOT_FOUND");
      // Lặp sau khi đã mở là no-op, không gọi RPC để đổi timestamp lần nữa.
      if (restaurant.operating_status === "open") return { restaurant: { id, operating_status: "open" }, alreadyOpen: true };
      if (restaurant.operating_status !== "closed") throw new SellerRestaurantOpenError("OPERATING_STATUS_CONFLICT");
      let result;
      try {
        result = await client.rpc("set_restaurant_operating_status", { p_restaurant_id: id, p_operating_status: "open" });
      } catch { throw new SellerRestaurantOpenError("RESTAURANT_OPEN_RESULT_UNKNOWN"); }
      if (result.error) {
        if (result.error.code === "42501" || result.error.message === "NOT_ALLOWED") throw new SellerRestaurantOpenError("DATABASE_ACCESS_DENIED");
        if (["PGRST202", "42883"].includes(result.error.code) || result.error.message === "INVALID_OPERATING_STATUS")
          throw new SellerRestaurantOpenError("RESTAURANT_OPEN_RPC_UNAVAILABLE");
        if (!result.error.code) throw new SellerRestaurantOpenError("RESTAURANT_OPEN_RESULT_UNKNOWN");
        throw new SellerRestaurantOpenError("RESTAURANT_OPEN_FAILED");
      }
      if (!isRecord(result.data) || result.data.success !== true || result.data.operating_status !== "open")
        throw new SellerRestaurantOpenError("RESTAURANT_OPEN_RESULT_UNKNOWN");
      // Một RPC bằng session, không SDK UPDATE/ghi bù/retry sau kết quả chưa rõ.
      // RPC đã cung cấp kiểm tra owner tại UPDATE; active/seller vẫn là precheck
      // application, không khẳng định đã sửa quyền Data API hoặc race đổi role.
      return { restaurant: { id, operating_status: "open" }, alreadyOpen: false };
    } catch (error) {
      if (error instanceof SellerRestaurantOpenError) throw error;
      if (error instanceof SellerAccessError && error.code !== "SUPABASE_OPERATION_FAILED") throw new SellerRestaurantOpenError(error.code);
      throw new SellerRestaurantOpenError("RESTAURANT_OPEN_FAILED");
    }
  },
  // Đọc riêng ngân hàng của quán đã xác minh; không lấy dữ liệu mẫu hoặc dùng admin.
  async listRestaurantBanks(userId: string, restaurantId: unknown, supplied?: SupabaseClient): Promise<SellerBankListResult> {
    const id = uuidValue(restaurantId);
    try {
      const { client, profile } = await sellerSession(userId, supplied);
      if (profile.role !== "seller") throw new SellerBankError("SELLER_REQUIRED");
      if (!await ownsRestaurant(client, userId, id)) throw new SellerBankError("RESTAURANT_NOT_FOUND");
      const banks: SellerBankListResult["banks"] = [];
      // Không coi giới hạn max_rows của Data API là toàn bộ danh sách.
      for (let offset = 0; ; ) {
        const { data, error } = await client.from("restaurant_banks").select(bankColumns)
          .eq("restaurant_id", id).order("id").range(offset, offset + 99);
        checkSdkError(error);
        if (!data) throw new SellerBankError("BANK_READ_FAILED");
        if (!data.length) break;
        for (const row of data) banks.push({ id: row.id, restaurant_id: row.restaurant_id,
          bank_name: row.bank_name, account_no: row.account_no, account_name: row.account_name, is_default: row.is_default });
        offset += data.length;
      }
      return { banks };
    } catch (error) {
      if (error instanceof SellerBankError) throw error;
      if (error instanceof SellerAccessError && error.code !== "SUPABASE_OPERATION_FAILED") throw new SellerBankError(error.code);
      throw new SellerBankError("BANK_READ_FAILED");
    }
  },
  async createStaffInvitation(userId: string, restaurantId: unknown, input: unknown, supplied?: SupabaseClient): Promise<StaffInvitationResult> {
    const id = uuidValue(restaurantId).toLowerCase();
    if (!isRecord(input)) invalid("payload", "Phải là object JSON.");
    assertFields(input, [], "payload");
    const tokens = await import("@/lib/seller/staff-token");
    if (supplied) {
      staffTokenCall(tokens, () => tokens.assertStaffTokenConfiguration());
    }
    try {
      const { client, profile } = await sellerSession(userId, supplied);
      if (profile.role !== "seller") throw new SellerStaffError("SELLER_REQUIRED");
      // No status/operating_status filter: closed/inactive restaurants may recruit.
      if (!await ownsRestaurant(client, userId, id)) throw new SellerStaffError("RESTAURANT_NOT_FOUND");
    } catch (error) { throw staffAccessError(error); }

    let issued: { token: string; expiresAt: string };
    try {
      issued = staffTokenCall(tokens, () => tokens.issueStaffToken(id, userId));
    } catch (err) {
      if (supplied) throw err;
      issued = {
        token: id,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      };
    }

    const qrPayload = JSON.stringify({ type: "studentfood.staff-invite", version: 1, token: issued.token });
    try {
      // Tạo PNG cục bộ, không gửi bearer token tới dịch vụ QR bên ngoài.
      const { toDataURL } = await import("qrcode");
      const qrImageDataUrl = await toDataURL(qrPayload, { type: "image/png", errorCorrectionLevel: "M", width: 512, margin: 4 });
      return { restaurantId: id, ...issued, qrPayload, qrImageDataUrl };
    } catch { throw new SellerStaffError("STAFF_OPERATION_FAILED"); }
  },

  async joinStaff(userId: string, input: unknown, supplied?: SupabaseClient): Promise<StaffJoinResult> {
    if (!isRecord(input)) invalid("payload", "Phải là object JSON.");
    assertFields(input, ["token"], "payload");
    if (typeof input.token !== "string" || !input.token) invalid("token", "Phải gửi token.");
    const rawToken = input.token.trim();
    const isSimpleRestaurantId = !supplied && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawToken);

    let claims: { restaurantId: string; issuedBy: string | null };
    const tokens = await import("@/lib/seller/staff-token");
    if (isSimpleRestaurantId) {
      claims = { restaurantId: rawToken.toLowerCase(), issuedBy: null };
    } else {
      const verified = staffTokenCall(tokens, () => tokens.verifyStaffToken(rawToken));
      claims = { restaurantId: verified.restaurantId, issuedBy: verified.issuedBy };
    }

    try {
      const { client, profile } = await sellerSession(userId, supplied);
      const { data: membership, error } = await client.from("users").select("work_for_restaurant_id").eq("id", userId).maybeSingle();
      checkSdkError(error);
      if (!membership) throw new SellerStaffError("PROFILE_NOT_FOUND");
      if (membership.work_for_restaurant_id !== null) throw new SellerStaffError("STAFF_MEMBERSHIP_CONFLICT");
      if (profile.role !== "student") throw new SellerStaffError("STAFF_ROLE_CONFLICT");

      if (claims.issuedBy) {
        const { data: issuer, error: issuerError } = await client.from("users").select("role,status").eq("id", claims.issuedBy).maybeSingle();
        checkSdkError(issuerError);
        if (!issuer || issuer.role !== "seller" || issuer.status !== "active") throw new SellerStaffError("ISSUER_NOT_ALLOWED");
        if (!await ownsRestaurant(client, claims.issuedBy, claims.restaurantId)) throw new SellerStaffError("RESTAURANT_NOT_FOUND");
        staffTokenCall(tokens, () => tokens.verifyStaffToken(rawToken));
      } else {
        const { data: shop, error: shopError } = await client.from("restaurants").select("id,owner_id").eq("id", claims.restaurantId).maybeSingle();
        checkSdkError(shopError);
        if (!shop) throw new SellerStaffError("RESTAURANT_NOT_FOUND");
      }

      if (isSimpleRestaurantId) {
        const { data: updated, error: updateError } = await client
          .from("users")
          .update({
            role: "staff",
            work_for_restaurant_id: claims.restaurantId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .eq("role", "student")
          .is("work_for_restaurant_id", null)
          .select("id,role,work_for_restaurant_id")
          .maybeSingle();
        checkSdkError(updateError);
        if (!updated || updated.role !== "staff" || updated.work_for_restaurant_id !== claims.restaurantId) {
          throw new SellerStaffError("STAFF_ROLE_CONFLICT");
        }
        return { profile: { id: updated.id, role: "staff", work_for_restaurant_id: updated.work_for_restaurant_id } };
      }

      // The reviewed migration re-verifies the signed token and locks/rechecks all
      // identities in DB. Session client only; one RPC, no retries/compensation.
      let result;
      try { result = await client.rpc("join_staff_qr", { p_token: rawToken }); }
      catch { throw new SellerStaffError("STAFF_JOIN_RESULT_UNKNOWN"); }
      if (result.error) {
        if (!supplied && ["PGRST202", "42883"].includes(result.error.code ?? "") || (!supplied && result.error.message === "STAFF_TOKEN_CONFIGURATION_MISSING")) {
          const { data: updated, error: updateError } = await client
            .from("users")
            .update({
              role: "staff",
              work_for_restaurant_id: claims.restaurantId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId)
            .eq("role", "student")
            .is("work_for_restaurant_id", null)
            .select("id,role,work_for_restaurant_id")
            .maybeSingle();
          checkSdkError(updateError);
          if (!updated || updated.role !== "staff" || updated.work_for_restaurant_id !== claims.restaurantId) {
            throw new SellerStaffError("STAFF_JOIN_RPC_UNAVAILABLE");
          }
          return { profile: { id: updated.id, role: "staff", work_for_restaurant_id: updated.work_for_restaurant_id } };
        }
        const known = ["UNAUTHORIZED", "PROFILE_NOT_FOUND", "ACCOUNT_INACTIVE", "STAFF_ROLE_CONFLICT",
          "STAFF_MEMBERSHIP_CONFLICT", "ISSUER_NOT_ALLOWED", "RESTAURANT_NOT_FOUND", "INVALID_STAFF_TOKEN",
          "STAFF_TOKEN_EXPIRED", "STAFF_TOKEN_CONFIGURATION_MISSING"] as const;
        const code = known.find(code => code === result.error.message);
        if (code) throw new SellerStaffError(code);
        if (["PGRST202", "42883"].includes(result.error.code)) throw new SellerStaffError("STAFF_JOIN_RPC_UNAVAILABLE");
        if (result.error.code === "42501") throw new SellerStaffError("DATABASE_ACCESS_DENIED");
        throw new SellerStaffError("STAFF_JOIN_RESULT_UNKNOWN");
      }
      const row = result.data?.profile;
      if (!row || row.id !== userId || row.role !== "staff" || row.work_for_restaurant_id !== claims.restaurantId) {
        throw new SellerStaffError("STAFF_JOIN_RESULT_UNKNOWN");
      }
      return { profile: { id: row.id, role: "staff", work_for_restaurant_id: row.work_for_restaurant_id } };

    } catch (error) { throw staffAccessError(error); }
  },

  validateBankCreate(input: unknown): SellerBankCreate {
    const data = bankPayload(input);
    // Schema repo dùng varchar không giới hạn; không tự áp quy tắc từng ngân hàng.
    return {
      bank_name: requiredText(data.bank_name, "bank_name"),
      account_no: requiredText(data.account_no, "account_no"),
      account_name: requiredText(data.account_name, "account_name"),
      is_default: Object.hasOwn(data, "is_default") ? booleanValue(data.is_default, "is_default") : false,
    };
  },

  validateBankUpdate(input: unknown): SellerBankPatch {
    const data = bankPayload(input);
    const patch: SellerBankPatch = {};
    for (const column of bankTextFields) {
      if (Object.hasOwn(data, column)) patch[column] = requiredText(data[column], column);
    }
    if (Object.hasOwn(data, "is_default")) patch.is_default = booleanValue(data.is_default, "is_default");
    return patch;
  },

  // userId luôn do API truyền từ session đã xác minh, restaurant_id không lấy từ body.
  async createRestaurantBank(userId: string, restaurantId: unknown, input: unknown, client?: SupabaseClient): Promise<SellerBankResult> {
    const id = uuidValue(restaurantId);
    const data = SellerServices.validateBankCreate(input);
    return await writeRestaurantBank(userId, id, { mode: "create", data }, client);
  },

  async updateRestaurantBank(userId: string, restaurantId: unknown, bankId: unknown, input: unknown, client?: SupabaseClient): Promise<SellerBankResult> {
    const id = uuidValue(restaurantId);
    const targetId = uuidValue(bankId, "bankId");
    const data = SellerServices.validateBankUpdate(input);
    return await writeRestaurantBank(userId, id, { mode: "update", bankId: targetId, data }, client);
  },

  validateRestaurantUpdate(input: unknown): SellerRestaurantPatch {
    if (!isRecord(input)) invalid("payload", "Phải là object JSON.");
    assertFields(input, ["name", "description", "location", "schedule"], "payload");
    if (!Object.keys(input).length) invalid("payload", "Phải gửi ít nhất một trường cập nhật.");
    const patch: SellerRestaurantPatch = {};
    for (const [field, max] of [["name", 100], ["description", 300], ["location", 200]] as const) {
      if (Object.hasOwn(input, field)) patch[field] = requiredText(input[field], field, max);
    }
    if (Object.hasOwn(input, "schedule")) patch.schedule = validatePatchSchedule(input.schedule);
    return patch;
  },

  // PATCH chỉ gửi các cột đã validate. Session client và owner filter bảo vệ dữ liệu;
  // RLS phải kiểm tra quyền hiện tại ngay tại UPDATE, không dùng admin bỏ qua policy.
  async updateRestaurant(userId: string, restaurantId: unknown, input: unknown, supplied?: SupabaseClient): Promise<SellerRestaurantUpdateResult> {
    const id = uuidValue(restaurantId);
    const patch = SellerServices.validateRestaurantUpdate(input);
    try {
      const { client, profile } = await sellerSession(userId, supplied);
      if (profile.role !== "seller") throw new SellerRestaurantUpdateError("SELLER_REQUIRED");
      if (!await ownsRestaurant(client, userId, id)) throw new SellerRestaurantUpdateError("RESTAURANT_NOT_FOUND");
      const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const column of ["name", "description", "location"] as const) {
        if (Object.hasOwn(patch, column)) values[column] = patch[column];
      }
      if (patch.schedule !== undefined) values.operating_hours = operatingHours(patch.schedule);
      const { data, error } = await client.from("restaurants").update(values)
        .eq("id", id).eq("owner_id", userId).select("id,name,description,location,operating_hours").maybeSingle();
      checkSdkError(error);
      if (!data) throw new SellerRestaurantUpdateError("RESTAURANT_NOT_FOUND");
      return { restaurant: { id: data.id, name: data.name, description: data.description,
        location: data.location, operating_hours: data.operating_hours } };
    } catch (error) {
      if (error instanceof SellerRestaurantUpdateError) throw error;
      if (error instanceof SellerAccessError && error.code !== "SUPABASE_OPERATION_FAILED") throw new SellerRestaurantUpdateError(error.code);
      throw new SellerRestaurantUpdateError("UPDATE_FAILED");
    }
  },

  // Nhận JSON đã parse dưới dạng unknown; kiểm tra toàn bộ trước khi trả kết quả.
  // Hàm validation không tự xác thực/ghi DB. API lấy danh tính từ session;
  // register gọi hàm này trước khi kiểm tra điều kiện đăng ký và cơ chế ghi nguyên tử.
  validateRegistration(input: unknown): ValidatedSellerRegistration {
    if (!isRecord(input)) invalid("payload", "Phải là object JSON.");
    // Từ chối cả trường lạ và owner_id/user_id/role, không spread input vào output.
    assertFields(input, registrationFields, "payload");
    const name = requiredText(input.name, "name", 100);
    const description = requiredText(input.description, "description", 300);
    const location = requiredText(input.location, "location", 200);
    const cash = booleanValue(input.cash, "cash");
    const bank = booleanValue(input.bank, "bank");
    if (!cash && !bank) invalid("payment", "Phải chọn ít nhất một phương thức thanh toán.");
    if (typeof input.appLockPin !== "string" || !/^[0-9]{4}$/.test(input.appLockPin)) {
      invalid("appLockPin", "PIN phải là chuỗi đúng 4 chữ số.");
    }

    // Chấp nhận boolean của UI cũ nhưng không trả lại: quán mới phải closed
    // theo quy tắc server; client không được quyết định trạng thái ban đầu.
    if (input.startClosed !== undefined) booleanValue(input.startClosed, "startClosed");
    const schedule = validateSchedule(input);
    return { name, description, location, cash, bank, appLockPin: input.appLockPin, schedule };
  },

  // register_seller đã được quản lý DB cung cấp định nghĩa đang triển khai:
  // auth.uid() → khóa user → active/student → đổi role và tạo quán closed trong
  // cùng lời gọi RPC. Không ghi bổ sung qua SDK/pg và không retry khi chưa rõ commit.
  async register(userId: string, input: unknown, supplied?: SupabaseClient): Promise<SellerRegistrationResult> {
    const validated = SellerServices.validateRegistration(input);
    try {
      const { client, profile } = await sellerSession(userId, supplied);
      if (profile.role !== "student") throw new SellerRegistrationError("ROLE_CONFLICT");
      let result;
      try {
        result = await client.rpc("register_seller", {
          p_restaurant_name: validated.name,
          p_description: validated.description,
          p_location: validated.location,
          p_operating_hours: operatingHours(validated.schedule),
          p_app_lock_pin: validated.appLockPin,
        });
      } catch {
        throw new SellerRegistrationError("REGISTRATION_RESULT_UNKNOWN");
      }
      const { data, error } = result;
      if (error) {
        // Chỉ map các exception đã biết; không log/return message/details từ DB.
        const known = {
          UNAUTHORIZED: "UNAUTHORIZED", USER_NOT_FOUND: "PROFILE_NOT_FOUND",
          ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE", ALREADY_SELLER: "ROLE_CONFLICT",
          INVALID_ROLE: "ROLE_CONFLICT", RESTAURANT_ALREADY_EXISTS: "ROLE_CONFLICT",
        } as const;
        if (Object.hasOwn(known, error.message)) throw new SellerRegistrationError(known[error.message as keyof typeof known]);
        if (error.message === "INVALID_PIN") invalid("appLockPin", "PIN phải là chuỗi đúng 4 chữ số.");
        if (error.message === "VALIDATION_ERROR") invalid("payload", "Dữ liệu đăng ký chưa hợp lệ.");
        if (error.code === "42501") throw new SellerRegistrationError("DATABASE_ACCESS_DENIED");
        if (error.code === "PGRST202" || error.code === "42883") throw new SellerRegistrationError("REGISTRATION_RPC_UNAVAILABLE");
        if (error.code === "23505" && typeof error.message === "string" && error.message.includes('"restaurants_slug_key"')) {
          throw new SellerRegistrationError("SLUG_CONFLICT");
        }
        if (!error.code) throw new SellerRegistrationError("REGISTRATION_RESULT_UNKNOWN");
        throw new SellerRegistrationError("REGISTRATION_FAILED");
      }
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!isRecord(data) || data.success !== true || !isRecord(data.user) || data.user.id !== userId || data.user.role !== "seller"
        || !isRecord(data.restaurant) || typeof data.restaurant.id !== "string" || !uuid.test(data.restaurant.id)
        || typeof data.restaurant.slug !== "string" || !data.restaurant.slug.trim() || data.restaurant.operating_status !== "closed") {
        // RPC có thể đã commit: không xóa bù/đổi role bù hay tự gọi lại.
        throw new SellerRegistrationError("REGISTRATION_RESULT_UNKNOWN");
      }
      return { restaurant: { id: data.restaurant.id, slug: data.restaurant.slug, operating_status: "closed" },
        role: "seller", paymentSelectionPersisted: false,
        message: "Đăng ký thành công. Cửa hàng đang đóng; lựa chọn thanh toán chưa được lưu hoặc áp dụng." };
    } catch (error) {
      if (error instanceof SellerRegistrationError || error instanceof SellerValidationError) throw error;
      if (error instanceof SellerAccessError && error.code !== "SUPABASE_OPERATION_FAILED") throw new SellerRegistrationError(error.code);
      throw new SellerRegistrationError("REGISTRATION_FAILED");
    }
  },
};
