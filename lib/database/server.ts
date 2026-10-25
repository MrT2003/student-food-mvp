import "server-only";
import { Pool } from "pg";

let pool: Pool | undefined;

export class DatabaseConfigurationError extends Error {
  constructor(public readonly code: "DATABASE_CONFIGURATION_MISSING" | "DATABASE_CONFIGURATION_INVALID" = "DATABASE_CONFIGURATION_MISSING") {
    super(code);
  }
}

// Khởi tạo lười: import service/validation không mở kết nối hoặc đọc credential.
// DATABASE_URL chỉ có ở server; không để pg mặc định kết nối không TLS.
export function getDatabasePool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new DatabaseConfigurationError();
  if (!pool) {
    let connectionUrl: URL;
    try {
      connectionUrl = new URL(connectionString);
      if (!["postgres:", "postgresql:"].includes(connectionUrl.protocol) || !connectionUrl.hostname) throw new Error();
      const mode = connectionUrl.searchParams.get("sslmode");
      const ssl = connectionUrl.searchParams.get("ssl");
      if ((mode !== null && !["verify-full", "verify-ca", "require", "prefer"].includes(mode))
        || (ssl !== null && !["true", "1"].includes(ssl))) throw new Error();
      // pg cho phép sslmode/ssl trong URL ghi đè Pool.ssl. Chuẩn hóa ngay URL,
      // giữ sslrootcert nếu nhà cung cấp cần CA riêng, luôn xác minh hostname.
      connectionUrl.searchParams.set("sslmode", "verify-full");
    } catch {
      throw new DatabaseConfigurationError("DATABASE_CONFIGURATION_INVALID");
    }
    pool = new Pool({ connectionString: connectionUrl.toString(), max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
    // pg phát lỗi của connection đang idle qua pool; không log URL/lỗi DB có thể chứa secret.
    pool.on("error", () => console.error("[database] Idle connection failed."));
  }
  return pool;
}
