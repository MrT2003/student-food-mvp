import type { Database } from "@/types/database.types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export type AuthProfile = Pick<
  UserRow,
  | "id"
  | "role"
  | "name"
  | "phone"
  | "avatar_url"
  | "status"
  | "work_for_restaurant_id"
>;

export type UpdateProfileInput = {
  name: string;
  phone: string;
  avatarUrl: string | null;
};