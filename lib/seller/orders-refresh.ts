import type { SellerManagedOrder } from "@/types/seller-orders.types";

export const ORDER_POLL_MS = 10_000;
export type OrderReadState = {
  orders: SellerManagedOrder[] | null;
  loading: boolean;
  isRefreshing: boolean;
  error: string;
  refreshError: string;
  blocked: boolean;
};
export const initialOrderReadState = (): OrderReadState => ({
  orders: null, loading: true, isRefreshing: false, error: "", refreshError: "", blocked: false,
});
type Done = (rows: SellerManagedOrder[] | null) => void;

// One controller per mounted account/shop. All events share the same request and timer.
export class SellerOrdersRefresh {
  state = initialOrderReadState();
  private active = false;
  private disposed = false;
  private epoch = 0;
  private mutations = 0;
  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private flight: { abort: AbortController; promise: Promise<SellerManagedOrder[] | null> } | null = null;
  private queued: Done[] = [];
  constructor(private readonly options: {
    read: (signal: AbortSignal) => Promise<SellerManagedOrder[]>;
    denied: (error: unknown) => boolean;
    changed: (state: OrderReadState) => void;
  }) {}
  private publish(patch: Partial<OrderReadState>) {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.options.changed(this.state);
  }
  private clearTimer() { clearTimeout(this.timer); this.timer = undefined; }
  setActive(active: boolean) {
    if (this.disposed || this.active === active) return;
    this.active = active;
    this.clearTimer();
    if (active) { void this.refresh(); return; }
    // An ignored AbortSignal must not let a hidden/old request publish later.
    this.epoch++;
    this.flight?.abort.abort();
    this.queued.splice(0).forEach(done => done(null));
    this.publish({ isRefreshing: false });
  }
  refresh(manual = false): Promise<SellerManagedOrder[] | null> {
    if (this.disposed || !this.active || this.mutations) return Promise.resolve(null);
    if (this.state.blocked) {
      if (!manual) return Promise.resolve(null);
      this.publish({ blocked: false });
    }
    this.clearTimer();
    if (this.flight && !this.flight.abort.signal.aborted) return this.flight.promise;
    const promise = new Promise<SellerManagedOrder[] | null>(done => this.queued.push(done));
    this.pump();
    return promise;
  }
  beginMutation() {
    this.mutations++;
    this.epoch++;
    this.clearTimer();
    this.flight?.abort.abort();
    this.publish({ isRefreshing: false });
  }
  endMutation(): Promise<SellerManagedOrder[] | null> {
    this.mutations = Math.max(0, this.mutations - 1);
    if (this.disposed || !this.active || this.state.blocked) return Promise.resolve(null);
    // Concurrent actions share the read after the last action settles. Keep each
    // order busy until that reconciliation instead of enabling stale pending buttons.
    const promise = new Promise<SellerManagedOrder[] | null>(done => this.queued.push(done));
    this.pump();
    return promise;
  }
  private pump() {
    if (this.disposed || !this.active || this.state.blocked || this.mutations || this.flight) return;
    if (!this.queued.length) {
      this.clearTimer();
      const delay = Math.min(60_000, ORDER_POLL_MS * 2 ** Math.max(0, this.failures - 1));
      this.timer = setTimeout(() => { this.timer = undefined; void this.refresh(); }, delay);
      return;
    }
    const waiters = this.queued.splice(0), epoch = this.epoch, abort = new AbortController();
    this.publish({ loading: this.state.orders === null, isRefreshing: this.state.orders !== null, error: "" });
    const valid = () => !this.disposed && this.active && epoch === this.epoch;
    const promise = Promise.resolve().then(() => abort.signal.aborted ? [] : this.options.read(abort.signal)).then(rows => {
      if (!valid()) return null;
      const orders = [...new Map(rows.map(row => [row.id, row])).values()];
      this.failures = 0;
      this.publish({ orders, loading: false, isRefreshing: false, error: "", refreshError: "", blocked: false });
      return orders;
    }).catch(error => {
      if (!valid()) return null;
      if (this.options.denied(error)) {
        this.publish({ orders: null, loading: false, isRefreshing: false, blocked: true,
          error: "Phiên đăng nhập hoặc quyền xem đơn đã thay đổi. Vui lòng xác minh lại tài khoản.", refreshError: "" });
      } else {
        this.failures++;
        this.publish({ loading: false, isRefreshing: false,
          error: this.state.orders === null ? "Không tải được đơn hàng. Hãy thử lại." : "",
          refreshError: this.state.orders === null ? "" : "Chưa cập nhật được; đang giữ dữ liệu cũ." });
      }
      return null;
    }).then(rows => {
      this.flight = null;
      waiters.forEach(done => done(rows));
      if (this.state.blocked) this.queued.splice(0).forEach(done => done(null));
      this.pump();
      return rows;
    });
    this.flight = { abort, promise };
  }
  dispose() {
    this.disposed = true;
    this.epoch++;
    this.clearTimer();
    this.flight?.abort.abort();
    this.queued.splice(0).forEach(done => done(null));
  }
}
