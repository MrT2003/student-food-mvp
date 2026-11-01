import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseConfigurationError, getDatabasePool } from "@/lib/database/server";
import { isRecord } from "@/utilities/system.utility";
import type {
  SellerBankCreate,
  SellerBankPatch,
  SellerBankResult,
  StaffInvitationResult,
  StaffJoinResult,
  SellerDayId,
  SellerOperatingHours,
  SellerRegistrationResult,
  SellerRegistrationSchedule,
  SellerRestaurantPatch,
  SellerRestaurantUpdateResult,
  ValidatedSellerRegistration,
} from "@/types/seller.types";

export class SellerValidationError extends Error {}

export type SellerRegistrationErrorCode =
  | "PROFILE_NOT_FOUND" | "ACCOUNT_INACTIVE" | "ROLE_CONFLICT"
  | "SLUG_CONFLICT" | "DATABASE_CONFIGURATION_MISSING" | "DATABASE_CONFIGURATION_INVALID" | "REGISTRATION_FAILED";

export class SellerRegistrationError extends Error {
  constructor(public readonly code: SellerRegistrationErrorCode) {
    super(code);
  }
}

export type SellerRestaurantUpdateErrorCode =
  | "PROFILE_NOT_FOUND" | "ACCOUNT_INACTIVE" | "SELLER_REQUIRED" | "RESTAURANT_NOT_FOUND"
  | "DATABASE_CONFIGURATION_MISSING" | "DATABASE_CONFIGURATION_INVALID" | "UPDATE_FAILED";

export class SellerRestaurantUpdateError extends Error {
  constructor(public readonly code: SellerRestaurantUpdateErrorCode) {
    super(code);
  }
}

export type SellerBankErrorCode =
  | "PROFILE_NOT_FOUND" | "ACCOUNT_INACTIVE" | "SELLER_REQUIRED" | "RESTAURANT_NOT_FOUND"
  | "BANK_NOT_FOUND" | "BANK_ACCOUNT_CONFLICT" | "BANK_WRITE_FAILED"
  | "DATABASE_CONFIGURATION_MISSING" | "DATABASE_CONFIGURATION_INVALID";

export class SellerBankError extends Error {
  constructor(public readonly code: SellerBankErrorCode) {
    super(code);
  }
}

export type SellerStaffErrorCode =
  | "PROFILE_NOT_FOUND" | "ACCOUNT_INACTIVE" | "SELLER_REQUIRED" | "RESTAURANT_NOT_FOUND"
  | "ISSUER_NOT_ALLOWED" | "STAFF_ROLE_CONFLICT" | "STAFF_MEMBERSHIP_CONFLICT"
  | "STAFF_TOKEN_CONFIGURATION_MISSING" | "INVALID_STAFF_TOKEN" | "STAFF_TOKEN_EXPIRED"
  | "DATABASE_CONFIGURATION_MISSING" | "DATABASE_CONFIGURATION_INVALID" | "STAFF_OPERATION_FAILED";

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

async function staffTransaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await (async () => {
    try { return await getDatabasePool().connect(); }
    catch (error) { throw new SellerStaffError(error instanceof DatabaseConfigurationError ? error.code : "STAFF_OPERATION_FAILED"); }
  })();
  let started = false;
  let discard = false;
  try {
    await client.query("BEGIN");
    started = true;
    const result = await action(client);
    await client.query("COMMIT");
    started = false;
    return result;
  } catch (error) {
    if (started) {
      try { await client.query("ROLLBACK"); }
      catch { discard = true; throw new SellerStaffError("STAFF_OPERATION_FAILED"); }
    } else discard = true;
    if (error instanceof SellerStaffError) throw error;
    throw new SellerStaffError("STAFF_OPERATION_FAILED");
  } finally { client.release(discard); }
}

const dayIds: readonly string[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const registrationFields = [
  "name", "description", "location", "cash", "bank", "scheduleMode",
  "days", "openTime", "closeTime", "startClosed",
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

function restaurantSlug(name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "quan"}-${randomUUID()}`;
}

function isSlugConflict(error: unknown): boolean {
  // Tên constraint mặc định từ UNIQUE(slug) trong schema repository.
  // Không retry lỗi unique của owner, ID hoặc lỗi phát sinh từ bảng khác trong trigger.
  return isRecord(error) && error.code === "23505" && error.schema === "public"
    && error.table === "restaurants" && error.constraint === "restaurants_slug_key";
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

async function writeRestaurantBank(userId: string, restaurantId: string, operation: BankOperation): Promise<SellerBankResult> {
  const client = await (async () => {
    try {
      return await getDatabasePool().connect();
    } catch (error) {
      throw new SellerBankError(error instanceof DatabaseConfigurationError ? error.code : "BANK_WRITE_FAILED");
    }
  })();
  let transactionStarted = false;
  let discardConnection = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    // Cùng thứ tự khóa với đăng ký/cập nhật quán: user → restaurant → bank.
    // Theo repo, public.users.id là Auth UUID; vẫn tự kiểm tra quyền nếu DB vượt RLS.
    const profile = await client.query<{ role: string; status: string }>(
      "SELECT role, status FROM public.users WHERE id = $1 FOR UPDATE", [userId],
    );
    const user = profile.rows[0];
    if (!user) throw new SellerBankError("PROFILE_NOT_FOUND");
    if (user.status !== "active") throw new SellerBankError("ACCOUNT_INACTIVE");
    if (user.role !== "seller") throw new SellerBankError("SELLER_REQUIRED");
    const owned = await client.query<{ id: string }>(
      "SELECT id FROM public.restaurants WHERE id = $1 AND owner_id = $2 FOR UPDATE", [restaurantId, userId],
    );
    // Khóa quán kể cả chưa có bank để tuần tự hóa thao tác mặc định của cùng quán.
    if (!owned.rows.length) throw new SellerBankError("RESTAURANT_NOT_FOUND");
    if (operation.mode === "update") {
      const bank = await client.query<{ id: string }>(
        "SELECT id FROM public.restaurant_banks WHERE id = $1 AND restaurant_id = $2 FOR UPDATE",
        [operation.bankId, restaurantId],
      );
      // Xác minh tài khoản đích trước mọi thay đổi mặc định, không tiết lộ quán khác.
      if (!bank.rows.length) throw new SellerBankError("BANK_NOT_FOUND");
    }

    if (operation.data.is_default === true) {
      // Bỏ mặc định cũ trước khi ghi đích để không va partial unique index.
      // Không đụng quán khác; PATCH loại chính tài khoản đích khỏi truy vấn này.
      if (operation.mode === "update") {
        await client.query(
          `UPDATE public.restaurant_banks SET is_default = false, updated_at = now()
           WHERE restaurant_id = $1 AND is_default = true AND id <> $2`, [restaurantId, operation.bankId],
        );
      } else {
        await client.query(
          `UPDATE public.restaurant_banks SET is_default = false, updated_at = now()
           WHERE restaurant_id = $1 AND is_default = true`, [restaurantId],
        );
      }
    }

    let result;
    if (operation.mode === "create") {
      const data = operation.data;
      result = await client.query<SellerBankResult["bank"]>(
        `INSERT INTO public.restaurant_banks (id, restaurant_id, bank_name, account_no, account_name, is_default)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, restaurant_id, bank_name, account_no, account_name, is_default`,
        [randomUUID(), restaurantId, data.bank_name, data.account_no, data.account_name, data.is_default],
      );
    } else {
      const values: (string | boolean)[] = [];
      const assignments: string[] = [];
      // Tên cột từ allowlist cố định, chỉ ghi field PATCH đã được kiểm tra.
      for (const column of [...bankTextFields, "is_default"] as const) {
        if (Object.hasOwn(operation.data, column)) {
          values.push(operation.data[column]!);
          assignments.push(`${column} = $${values.length}`);
        }
      }
      assignments.push("updated_at = now()");
      values.push(operation.bankId, restaurantId);
      result = await client.query<SellerBankResult["bank"]>(
        `UPDATE public.restaurant_banks SET ${assignments.join(", ")}
         WHERE id = $${values.length - 1} AND restaurant_id = $${values.length}
         RETURNING id, restaurant_id, bank_name, account_no, account_name, is_default`, values,
      );
      if (result.rowCount === 0) throw new SellerBankError("BANK_NOT_FOUND");
    }
    if (result.rowCount !== 1 || result.rows.length !== 1) throw new SellerBankError("BANK_WRITE_FAILED");
    const row = result.rows[0];
    const response: SellerBankResult = { bank: {
      id: row.id, restaurant_id: row.restaurant_id, bank_name: row.bank_name,
      account_no: row.account_no, account_name: row.account_name, is_default: row.is_default,
    } };
    await client.query("COMMIT");
    transactionStarted = false;
    return response;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        discardConnection = true;
        throw new SellerBankError("BANK_WRITE_FAILED");
      }
    } else {
      discardConnection = true;
    }
    // Chỉ đúng unique (restaurant_id, account_no) mới là lỗi trùng tài khoản.
    // Không UPSERT/retry; lỗi khác kể cả unique default được trả chung, không lộ DB.
    if (isRecord(error) && error.code === "23505" && error.schema === "public"
      && error.table === "restaurant_banks" && error.constraint === "uq_restaurant_banks_account") {
      throw new SellerBankError("BANK_ACCOUNT_CONFLICT");
    }
    if (error instanceof SellerBankError) throw error;
    throw new SellerBankError("BANK_WRITE_FAILED");
  } finally {
    client.release(discardConnection);
  }
}

export const SellerServices = {
  async createStaffInvitation(userId: string, restaurantId: unknown, input: unknown): Promise<StaffInvitationResult> {
    const id = uuidValue(restaurantId).toLowerCase();
    if (!isRecord(input)) invalid("payload", "Phải là object JSON.");
    assertFields(input, [], "payload");
    // Import lười để thiếu secret QR không ảnh hưởng đăng ký/quán/ngân hàng.
    const tokens = await import("@/lib/seller/staff-token");
    staffTokenCall(tokens, () => tokens.assertStaffTokenConfiguration());
    await staffTransaction(async (client) => {
      const profile = await client.query<{ role: string; status: string }>(
        "SELECT role, status FROM public.users WHERE id = $1 FOR UPDATE", [userId],
      );
      const user = profile.rows[0];
      if (!user) throw new SellerStaffError("PROFILE_NOT_FOUND");
      if (user.status !== "active") throw new SellerStaffError("ACCOUNT_INACTIVE");
      if (user.role !== "seller") throw new SellerStaffError("SELLER_REQUIRED");
      const restaurant = await client.query<{ id: string }>(
        "SELECT id FROM public.restaurants WHERE id = $1 AND owner_id = $2 FOR UPDATE", [id, userId],
      );
      // Không lọc status/operating_status: quán inactive hoặc closed vẫn tuyển được.
      if (!restaurant.rows.length) throw new SellerStaffError("RESTAURANT_NOT_FOUND");
    });
    const issued = staffTokenCall(tokens, () => tokens.issueStaffToken(id, userId));
    const qrPayload = JSON.stringify({ type: "studentfood.staff-invite", version: 1, token: issued.token });
    try {
      // Tạo PNG cục bộ, không gửi bearer token tới dịch vụ QR bên ngoài.
      const { toDataURL } = await import("qrcode");
      const qrImageDataUrl = await toDataURL(qrPayload, { type: "image/png", errorCorrectionLevel: "M", width: 512, margin: 4 });
      return { restaurantId: id, ...issued, qrPayload, qrImageDataUrl };
    } catch { throw new SellerStaffError("STAFF_OPERATION_FAILED"); }
  },

  async joinStaff(userId: string, input: unknown): Promise<StaffJoinResult> {
    if (!isRecord(input)) invalid("payload", "Phải là object JSON.");
    assertFields(input, ["token"], "payload");
    if (typeof input.token !== "string" || !input.token) invalid("token", "Phải gửi token.");
    const tokens = await import("@/lib/seller/staff-token");
    const claims = staffTokenCall(tokens, () => tokens.verifyStaffToken(input.token));
    const studentId = uuidValue(userId, "userId").toLowerCase();
    return await staffTransaction(async (client) => {
      // Khóa tất cả user theo thứ tự UUID cố định trước quán để tránh vòng chờ.
      const ids = Array.from(new Set([studentId, claims.issuedBy])).sort();
      const profiles = await client.query<{ id: string; role: string; status: string; work_for_restaurant_id: string | null }>(
        `SELECT id, role, status, work_for_restaurant_id FROM public.users
         WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [ids],
      );
      const issuer = profiles.rows.find((row) => row.id === claims.issuedBy);
      if (!issuer || issuer.status !== "active" || issuer.role !== "seller") throw new SellerStaffError("ISSUER_NOT_ALLOWED");
      const student = profiles.rows.find((row) => row.id === studentId);
      if (!student) throw new SellerStaffError("PROFILE_NOT_FOUND");
      if (student.status !== "active") throw new SellerStaffError("ACCOUNT_INACTIVE");
      if (student.work_for_restaurant_id !== null) throw new SellerStaffError("STAFF_MEMBERSHIP_CONFLICT");
      if (student.role !== "student") throw new SellerStaffError("STAFF_ROLE_CONFLICT");
      const restaurant = await client.query<{ id: string }>(
        "SELECT id FROM public.restaurants WHERE id = $1 AND owner_id = $2 FOR UPDATE", [claims.restaurantId, claims.issuedBy],
      );
      if (!restaurant.rows.length) throw new SellerStaffError("RESTAURANT_NOT_FOUND");
      // Kiểm tra lại hạn dùng sau khi chờ khóa. Không tiêu thụ nonce, không lưu token.
      staffTokenCall(tokens, () => tokens.verifyStaffToken(input.token));
      const updated = await client.query<StaffJoinResult["profile"]>(
        `UPDATE public.users SET role = 'staff', work_for_restaurant_id = $1, updated_at = now()
         WHERE id = $2 AND status = 'active' AND role = 'student' AND work_for_restaurant_id IS NULL
         RETURNING id, role, work_for_restaurant_id`, [claims.restaurantId, studentId],
      );
      if (updated.rowCount !== 1 || updated.rows.length !== 1) throw new SellerStaffError("STAFF_ROLE_CONFLICT");
      const row = updated.rows[0];
      if (row.id !== studentId || row.role !== "staff" || row.work_for_restaurant_id !== claims.restaurantId) {
        throw new SellerStaffError("STAFF_OPERATION_FAILED");
      }
      return { profile: { id: row.id, role: row.role, work_for_restaurant_id: row.work_for_restaurant_id } };
    });
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
  async createRestaurantBank(userId: string, restaurantId: unknown, input: unknown): Promise<SellerBankResult> {
    const id = uuidValue(restaurantId);
    const data = SellerServices.validateBankCreate(input);
    return await writeRestaurantBank(userId, id, { mode: "create", data });
  },

  async updateRestaurantBank(userId: string, restaurantId: unknown, bankId: unknown, input: unknown): Promise<SellerBankResult> {
    const id = uuidValue(restaurantId);
    const targetId = uuidValue(bankId, "bankId");
    const data = SellerServices.validateBankUpdate(input);
    return await writeRestaurantBank(userId, id, { mode: "update", bankId: targetId, data });
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

  // Danh tính userId được API xác minh; kiểm tra ID và toàn bộ PATCH trước khi xin connection.
  async updateRestaurant(userId: string, restaurantId: unknown, input: unknown): Promise<SellerRestaurantUpdateResult> {
    const id = uuidValue(restaurantId);
    const patch = SellerServices.validateRestaurantUpdate(input);
    const client = await (async () => {
      try {
        return await getDatabasePool().connect();
      } catch (error) {
        throw new SellerRestaurantUpdateError(error instanceof DatabaseConfigurationError ? error.code : "UPDATE_FAILED");
      }
    })();
    let transactionStarted = false;
    let discardConnection = false;
    try {
      await client.query("BEGIN");
      transactionStarted = true;
      // Giữ cùng thứ tự khóa với đăng ký: user trước, quán sau.
      // public.users.id = Auth UUID là giả định theo repository, chưa xác minh DB thật.
      const profile = await client.query<{ role: string; status: string }>(
        "SELECT role, status FROM public.users WHERE id = $1 FOR UPDATE", [userId],
      );
      const user = profile.rows[0];
      if (!user) throw new SellerRestaurantUpdateError("PROFILE_NOT_FOUND");
      if (user.status !== "active") throw new SellerRestaurantUpdateError("ACCOUNT_INACTIVE");
      if (user.role !== "seller") throw new SellerRestaurantUpdateError("SELLER_REQUIRED");

      const owned = await client.query<{ id: string }>(
        "SELECT id FROM public.restaurants WHERE id = $1 AND owner_id = $2 FOR UPDATE", [id, userId],
      );
      // Không phân biệt quán không tồn tại và quán thuộc người khác; không lọc status quán.
      if (!owned.rows.length) throw new SellerRestaurantUpdateError("RESTAURANT_NOT_FOUND");
      const values: (string | null)[] = [];
      const assignments: string[] = [];
      // Tên cột chỉ xuất phát từ allowlist cố định, không nội suy tên field của client.
      for (const column of ["name", "description", "location"] as const) {
        if (Object.hasOwn(patch, column)) {
          values.push(patch[column]!);
          assignments.push(`${column} = $${values.length}`);
        }
      }
      if (patch.schedule !== undefined) {
        const hours = operatingHours(patch.schedule);
        values.push(hours === null ? null : JSON.stringify(hours));
        assignments.push(`operating_hours = $${values.length}::jsonb`);
      }
      assignments.push("updated_at = now()");
      values.push(id, userId);
      const updated = await client.query<SellerRestaurantUpdateResult["restaurant"]>(
        `UPDATE public.restaurants SET ${assignments.join(", ")}
         WHERE id = $${values.length - 1} AND owner_id = $${values.length}
         RETURNING id, name, description, location, operating_hours`, values,
      );
      if (updated.rowCount === 0) throw new SellerRestaurantUpdateError("RESTAURANT_NOT_FOUND");
      if (updated.rowCount !== 1 || updated.rows.length !== 1) throw new SellerRestaurantUpdateError("UPDATE_FAILED");
      // Dựng response theo allowlist trước commit; không trả slug, status hoặc delivery_token.
      const row = updated.rows[0];
      const result: SellerRestaurantUpdateResult = { restaurant: {
        id: row.id, name: row.name, description: row.description,
        location: row.location, operating_hours: row.operating_hours,
      } };
      await client.query("COMMIT");
      transactionStarted = false;
      return result;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch {
          discardConnection = true;
          throw new SellerRestaurantUpdateError("UPDATE_FAILED");
        }
      } else {
        discardConnection = true;
      }
      if (error instanceof SellerRestaurantUpdateError) throw error;
      throw new SellerRestaurantUpdateError("UPDATE_FAILED");
    } finally {
      client.release(discardConnection);
    }
  },

  // Nhận JSON đã parse dưới dạng unknown; kiểm tra toàn bộ trước khi trả kết quả.
  // Hàm validation không tự xác thực/ghi DB. API lấy danh tính từ session;
  // register gọi hàm này trước khi xin connection và thực hiện transaction.
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

    // Chấp nhận boolean của UI cũ nhưng không trả lại: quán mới phải closed
    // theo quy tắc server; client không được quyết định trạng thái ban đầu.
    if (input.startClosed !== undefined) booleanValue(input.startClosed, "startClosed");
    const schedule = validateSchedule(input);
    return { name, description, location, cash, bank, schedule };
  },

  // userId chỉ do server truyền sau auth.getUser(), không lấy từ JSON client.
  async register(userId: string, input: unknown): Promise<SellerRegistrationResult> {
    const validated = SellerServices.validateRegistration(input);
    const hours = operatingHours(validated.schedule);
    // Validation hoàn tất trước khi xin connection; không fallback qua Supabase Data API.
    const client = await (async () => {
      try {
        return await getDatabasePool().connect();
      } catch (error) {
        throw new SellerRegistrationError(error instanceof DatabaseConfigurationError
          ? error.code : "REGISTRATION_FAILED");
      }
    })();
    let discardConnection = false;
    try {
      // Chỉ retry tối đa 3 lần khi đúng constraint slug; mỗi lần là transaction mới
      // trên cùng connection và phải khóa/kiểm tra lại user sau rollback.
      for (let attempt = 0; attempt < 3; attempt++) {
        let transactionStarted = false;
        try {
          await client.query("BEGIN");
          transactionStarted = true;
          // Giả định theo code hiện có: public.users.id chính là Supabase Auth UUID.
          // Khóa user, không đếm quán hoặc áp đặt giới hạn một quán mỗi chủ.
          const profile = await client.query<{ role: string; status: string }>(
            "SELECT role, status FROM public.users WHERE id = $1 FOR UPDATE", [userId],
          );
          const user = profile.rows[0];
          if (!user) throw new SellerRegistrationError("PROFILE_NOT_FOUND");
          if (user.status !== "active") throw new SellerRegistrationError("ACCOUNT_INACTIVE");
          // Request lặp/sau request đồng thời đã commit sẽ dừng ở đây trước insert.
          if (user.role !== "student") throw new SellerRegistrationError("ROLE_CONFLICT");

          const restaurant = await client.query<SellerRegistrationResult["restaurant"]>(
            `INSERT INTO public.restaurants
              (id, owner_id, name, slug, description, location, operating_hours, operating_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'closed')
             RETURNING id, slug, operating_status`,
            [randomUUID(), userId, validated.name, restaurantSlug(validated.name), validated.description,
              validated.location, hours === null ? null : JSON.stringify(hours)],
          );
          if (restaurant.rowCount !== 1 || restaurant.rows.length !== 1
            || restaurant.rows[0].operating_status !== "closed") {
            throw new SellerRegistrationError("REGISTRATION_FAILED");
          }
          // Không truyền status để dùng default trong schema repo; không trả delivery_token.
          const updated = await client.query(
            `UPDATE public.users SET role = 'seller', updated_at = now()
             WHERE id = $1 AND role = 'student' AND status = 'active'`, [userId],
          );
          if (updated.rowCount !== 1) throw new SellerRegistrationError("ROLE_CONFLICT");
          await client.query("COMMIT");
          transactionStarted = false;
          const row = restaurant.rows[0];
          return {
            restaurant: { id: row.id, slug: row.slug, operating_status: row.operating_status },
            role: "seller",
            paymentSelectionPersisted: false,
            message: "Đăng ký thành công. Cửa hàng đang đóng; lựa chọn thanh toán chưa được lưu hoặc áp dụng.",
          };
        } catch (error) {
          if (transactionStarted) {
            try {
              await client.query("ROLLBACK");
            } catch {
              // Không trả connection có transaction lỗi vào pool.
              discardConnection = true;
              throw new SellerRegistrationError("REGISTRATION_FAILED");
            }
          } else {
            discardConnection = true;
          }
          if (isSlugConflict(error)) {
            if (attempt < 2) continue;
            throw new SellerRegistrationError("SLUG_CONFLICT");
          }
          if (error instanceof SellerRegistrationError) throw error;
          // Không log/trả lỗi PostgreSQL thô, query parameters hoặc credential.
          throw new SellerRegistrationError("REGISTRATION_FAILED");
        }
      }
      throw new SellerRegistrationError("REGISTRATION_FAILED");
    } finally {
      client.release(discardConnection);
    }
  },
};
