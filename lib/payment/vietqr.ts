export type VietQrBankSource = {
  bank_id?: string | null;
  bank_name?: string | null;
  bankName?: string | null;
  bank_account_no?: string | null;
  account_no?: string | null;
  accountNo?: string | null;
  bank_account_name?: string | null;
  account_name?: string | null;
  accountName?: string | null;
};

export type NormalizedVietQrBank = {
  bank_id: string;
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
};

/**
 * Bảng ánh xạ tên ngân hàng hoặc mã viết tắt sang mã chuẩn VietQR (Napas BIN / ShortCode)
 */
const VIETQR_BANK_MAP: Record<string, string> = {
  vietcombank: "VCB",
  vcb: "VCB",
  "970436": "VCB",
  bidv: "BIDV",
  "970418": "BIDV",
  vietinbank: "ICB",
  icb: "ICB",
  "970415": "ICB",
  agribank: "VBA",
  vba: "VBA",
  "970405": "VBA",
  techcombank: "TCB",
  tcb: "TCB",
  "970407": "TCB",
  "mb bank": "MB",
  mbbank: "MB",
  mb: "MB",
  "970422": "MB",
  acb: "ACB",
  "970416": "ACB",
  tpbank: "TPB",
  tpb: "TPB",
  "970423": "TPB",
  vpbank: "VPB",
  vpb: "VPB",
  "970432": "VPB",
  sacombank: "STB",
  stb: "STB",
  "970403": "STB",
  hdbank: "HDB",
  hdb: "HDB",
  "970437": "HDB",
  vib: "VIB",
  "970441": "VIB",
  shb: "SHB",
  "970443": "SHB",
  msb: "MSB",
  "970426": "MSB",
  ocb: "OCB",
  "970448": "OCB",
  seabank: "SEAB",
  seab: "SEAB",
  "970440": "SEAB",
  lpbank: "LPB",
  lpb: "LPB",
  "970449": "LPB",
  eximbank: "EIB",
  eib: "EIB",
  "970431": "EIB",
  "bac a bank": "BAB",
  bab: "BAB",
  pvcombank: "PVCB",
  pvcb: "PVCB",
  abbank: "ABB",
  abb: "ABB",
  "nam a bank": "NAB",
  nab: "NAB",
  vietbank: "VIETBANK",
  vietabank: "VAB",
  vab: "VAB",
  ncb: "NCB",
  bvbank: "BVB",
  bvb: "BVB",
  kienlongbank: "KLB",
  klb: "KLB",
  saigonbank: "SGB",
  sgb: "SGB",
  pgbank: "PGB",
  pgb: "PGB",
  baovietbank: "BVB",
  "donga bank": "DOB",
  dob: "DOB",
  "vikki bank": "VIKKI",
  gpbank: "GPB",
  mbv: "MBV",
  cbbank: "CBB",
  "co-opbank": "COOPBANK",
  "shinhan bank": "SHBVN",
  "woori bank": "WVN",
  hsbc: "HSBC",
  "standard chartered": "SCVN",
  uob: "UOB",
  cimb: "CIMB",
  "public bank": "PBVN",
  "hong leong bank": "HLBVN",
  indovinabank: "IVB",
  vrb: "VRB",
  citibank: "CITIBANK",
  "cake by vpbank": "CAKE",
  cake: "CAKE",
  timo: "TIMO",
};

export function sanitizeVietQrText(value: string, maxLength = 50): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (ch) => (ch === "đ" ? "d" : "D"))
    .replace(/[^a-zA-Z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function resolveVietQrBankId(rawBankIdOrName?: string | null): string {
  const cleaned = (rawBankIdOrName ?? "").trim();
  if (!cleaned) return "";
  const key = cleaned.toLowerCase();
  if (VIETQR_BANK_MAP[key]) return VIETQR_BANK_MAP[key];
  // Cho phép truyền thẳng mã BIN (6 chữ số) hoặc mã code VietQR hợp lệ
  if (/^[A-Za-z0-9]{2,12}$/.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  return "";
}

export function normalizeVietQrBankInfo(
  source?: VietQrBankSource | null,
): NormalizedVietQrBank {
  const rawBank =
    source?.bank_id?.trim() ||
    source?.bank_name?.trim() ||
    source?.bankName?.trim() ||
    "";
  const bank_id = resolveVietQrBankId(rawBank);
  const bank_name =
    source?.bank_name?.trim() ||
    source?.bankName?.trim() ||
    source?.bank_id?.trim() ||
    bank_id;
  const bank_account_no = (
    source?.bank_account_no ??
    source?.account_no ??
    source?.accountNo ??
    ""
  )
    .trim()
    .replace(/\s+/g, "");
  const bank_account_name = sanitizeVietQrText(
    source?.bank_account_name ??
      source?.account_name ??
      source?.accountName ??
      "",
    64,
  ).toUpperCase();

  return {
    bank_id,
    bank_name,
    bank_account_no,
    bank_account_name,
  };
}

export function buildVietQrImageUrl(params: {
  bank_id?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_account_name?: string | null;
  amount?: number | null;
  addInfo?: string | null;
  template?: "qr_only" | "compact" | "compact2" | "print";
}): string | null {
  const normalized = normalizeVietQrBankInfo(params);
  if (!normalized.bank_id || !normalized.bank_account_no) {
    return null;
  }

  const template = params.template ?? "qr_only";
  const baseUrl = `https://img.vietqr.io/image/${encodeURIComponent(
    normalized.bank_id,
  )}-${encodeURIComponent(normalized.bank_account_no)}-${template}.png`;

  const searchParams = new URLSearchParams();
  if (
    typeof params.amount === "number" &&
    Number.isFinite(params.amount) &&
    params.amount > 0
  ) {
    searchParams.set("amount", String(Math.round(params.amount)));
  }

  if (params.addInfo && params.addInfo.trim()) {
    const cleanInfo = sanitizeVietQrText(params.addInfo, 50);
    if (cleanInfo) {
      searchParams.set("addInfo", cleanInfo);
    }
  }

  if (normalized.bank_account_name) {
    searchParams.set("accountName", normalized.bank_account_name);
  }

  const query = searchParams.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}
