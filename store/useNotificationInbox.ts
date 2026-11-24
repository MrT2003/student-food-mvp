"use client";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

export type InboxItem = { id: string; title: string | null; content: string | null; type: string; related_order_id: string | null; is_read: boolean; created_at: string };
type Inbox = { userId: string | null; items: InboxItem[]; unreadCount: number; nextCursor: string | null; loading: boolean; error: string | null; countAt: number; listAt: number; open: boolean };
const initial: Inbox = { userId: null, items: [], unreadCount: 0, nextCursor: null, loading: false, error: null, countAt: 0, listAt: 0, open: false };
export const useNotificationInbox = create<Inbox>(() => ({ ...initial }));
let epoch = 0;
let revision = 0;
let queue = Promise.resolve();
let scheduled: ReturnType<typeof setTimeout> | undefined;
const seen = new Set<string>();
const reads = new Map<string, Promise<boolean>>();
let fetching: Promise<void> | null = null;
function reset(userId: string | null) {
  epoch++; revision++; queue = Promise.resolve(); fetching = null; reads.clear(); seen.clear();
  clearTimeout(scheduled); scheduled = undefined;
  useNotificationInbox.setState({ ...initial, userId });
}
useAuthStore.subscribe((auth, previous) => {
  if (auth.user?.id !== previous.user?.id || auth.logoutStatus === "pending") reset(auth.logoutStatus === "pending" ? null : auth.user?.id ?? null);
});
function syncOwner() {
  const auth = useAuthStore.getState();
  const id = auth.logoutStatus === "pending" || auth.logoutStatus === "failed" ? null : auth.user?.id ?? null;
  if (useNotificationInbox.getState().userId !== id) reset(id);
  return id;
}
async function api(init?: RequestInit, suffix = "") {
  const response = await fetch(`/api/notifications/inbox${suffix}`, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000), ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Không thể cập nhật thông báo.");
  return data;
}
// Tuần tự hóa GET và đánh dấu đọc để response cũ không ghi đè kết quả thao tác mới.
function enqueue(task: () => Promise<void>) {
  const job = queue.then(task, task);
  queue = job.catch(() => {});
  return job;
}
export function fetchInbox(list = false, more = false): Promise<void> {
  if (!syncOwner()) return Promise.resolve();
  if (fetching) return fetching.then(() => {
    const state = useNotificationInbox.getState();
    if (list && !more && Date.now() - state.listAt >= 60000 && !state.error) return fetchInbox(true);
  });
  const state = useNotificationInbox.getState();
  if (!more && Date.now() - (list ? state.listAt : state.countAt) < 60000) return Promise.resolve();
  if (more && !state.nextCursor) return Promise.resolve();
  const run = epoch;
  const job = enqueue(async () => {
    if (run !== epoch) return;
    const version = revision;
    useNotificationInbox.setState({ loading: true, error: null });
    try {
      const cursor = more ? useNotificationInbox.getState().nextCursor : null;
      const data = await api(undefined, list ? `?list=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}` : "");
      if (run !== epoch) return;
      useNotificationInbox.setState(current => ({ unreadCount: data.unreadCount, countAt: version === revision ? Date.now() : 0,
        ...(list ? { items: more ? [...new Map([...current.items, ...data.items].map(item => [item.id, item])).values()] : data.items,
          nextCursor: data.nextCursor, listAt: version === revision ? Date.now() : 0 } : {}) }));
    } catch (error) { if (run === epoch) useNotificationInbox.setState({ error: error instanceof Error ? error.message : "Chưa tải được thông báo." }); }
    finally { if (run === epoch) useNotificationInbox.setState({ loading: false }); }
  });
  fetching = job;
  void job.finally(() => { if (fetching === job) fetching = null; });
  return job;
}
export function notificationArrived(id: string) {
  if (!syncOwner() || seen.has(id)) return;
  seen.add(id); if (seen.size > 200) seen.delete(seen.values().next().value!);
  revision++;
  useNotificationInbox.setState({ countAt: 0, listAt: 0 });
  // Cửa sổ gom cố định 1 giây, không reset timer mỗi message.
  if (!scheduled) scheduled = setTimeout(async () => {
    scheduled = undefined;
    const run = epoch;
    if (fetching) await fetching;
    if (run === epoch) await fetchInbox(useNotificationInbox.getState().open);
  }, 1000);
}
export function markNotificationRead(id: string | "all"): Promise<boolean> {
  if (!syncOwner()) return Promise.resolve(false);
  if (reads.has(id)) return reads.get(id)!;
  const run = epoch;
  let success = false;
  const job = enqueue(async () => {
    if (run !== epoch) return;
    useNotificationInbox.setState({ error: null });
    try {
      const version = revision;
      const data = await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id === "all" ? { all: true } : { id }) });
      if (run !== epoch) return;
      // Chỉ hiển thị đã đọc sau khi server lưu thành công; lỗi không làm mất dấu chưa đọc.
      useNotificationInbox.setState(state => ({ unreadCount: data.unreadCount, countAt: version === revision ? Date.now() : 0,
        items: state.items.map(item => id === "all" || item.id === id ? { ...item, is_read: true } : item),
        ...(id === "all" ? { listAt: 0 } : {}) }));
      success = true;
    } catch (error) { if (run === epoch) useNotificationInbox.setState({ error: error instanceof Error ? error.message : "Chưa lưu được trạng thái đã đọc." }); }
  }).then(() => success);
  reads.set(id, job);
  void job.finally(() => { if (reads.get(id) === job) reads.delete(id); });
  return job;
}
export function notificationHref(item: InboxItem) {
  return ["restaurant_order_created", "order_cancelled"].includes(item.type) ? "/seller/orders"
    : item.related_order_id ? `/orders/${encodeURIComponent(item.related_order_id)}` : "/orders";
}
