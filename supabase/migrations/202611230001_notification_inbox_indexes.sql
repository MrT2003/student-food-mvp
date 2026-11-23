-- Inbox đọc theo người nhận; index riêng cho badge và phân trang ổn định.
BEGIN;
ALTER TABLE public.notifications ALTER COLUMN is_read SET DEFAULT false;
CREATE INDEX IF NOT EXISTS notifications_unread_user ON public.notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS notifications_user_timeline ON public.notifications(user_id, created_at DESC, id DESC);
COMMIT;
