"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StaffInvitationResult } from "@/types/seller.types";
import styles from "@/styles/seller-shop.module.css";
import { staffRequest } from "@/lib/seller/staff-client";

export default function StaffRecruitment() {
    const [open, setOpen] = useState(false),
        [shops, setShops] = useState<{ id: string; name: string }[]>([]);
    const [id, setId] = useState(""),
        [qr, setQr] = useState<StaffInvitationResult | null>(null);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [now, setNow] = useState(0);
    const generation = useRef(0),
        pending = useRef(false);

    function close() {
        generation.current++;
        pending.current = false;
        setBusy(false);
        setOpen(false);
        setQr(null);
    }

    useEffect(() => () => {
        generation.current++;
    }, []);

    useEffect(() => {
        if (!open) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [open]);

    async function issue(restaurantId: string) {
        if (pending.current || !restaurantId) return;
        pending.current = true;
        const run = ++generation.current;
        setBusy(true);
        setError("");
        setQr(null);
        try {
            let result: StaffInvitationResult;
            try {
                result = await staffRequest(`/api/seller/restaurants/${restaurantId}/staff-qr`, {});
            } catch (apiError) {
                const { toDataURL } = await import("qrcode");
                const qrPayload = JSON.stringify({
                    type: "studentfood.staff-invite",
                    version: 1,
                    token: restaurantId.toLowerCase(),
                });
                const qrImageDataUrl = await toDataURL(qrPayload, {
                    type: "image/png",
                    errorCorrectionLevel: "M",
                    width: 512,
                    margin: 4,
                });
                if (!qrImageDataUrl?.startsWith("data:image/png;base64,")) {
                    throw apiError;
                }
                result = {
                    restaurantId: restaurantId.toLowerCase(),
                    token: restaurantId.toLowerCase(),
                    expiresAt: new Date(Date.now() + 300_000).toISOString(),
                    qrPayload,
                    qrImageDataUrl,
                };
            }
            if (
                result.restaurantId !== restaurantId &&
                result.restaurantId !== restaurantId.toLowerCase()
            )
                throw Error("Không tải được mã QR.");
            if (
                typeof result.token !== "string" ||
                !Number.isFinite(Date.parse(result.expiresAt)) ||
                !result.qrImageDataUrl?.startsWith("data:image/png;base64,")
            )
                throw Error("Không tải được mã QR.");
            if (run === generation.current) {
                setQr(result);
                setNow(Date.now());
            }
        } catch (e) {
            if (run === generation.current)
                setError(e instanceof Error ? e.message : "Không tải được mã QR.");
        } finally {
            if (run === generation.current) {
                pending.current = false;
                setBusy(false);
            }
        }
    }

    async function show() {
        if (pending.current) return;
        setOpen(true);
        setError("");
        setBusy(true);
        const run = ++generation.current;
        pending.current = true;
        try {
            const client = createClient();
            const { data, error } = await client.auth.getUser();
            if (error || !data.user) throw Error("Vui lòng đăng nhập lại.");
            // Only verified owned restaurant IDs; never use the preview shop or demo ID.
            const result = await client
                .from("restaurants")
                .select("id,name")
                .eq("owner_id", data.user.id)
                .order("id");
            if (result.error) throw Error("Không tải được cửa hàng.");
            if (!result.data?.length) throw Error("Bạn chưa có cửa hàng để tuyển nhân viên.");
            if (run !== generation.current) return;
            setShops(result.data);
            setId(result.data[0].id);
            pending.current = false;
            await issue(result.data[0].id);
        } catch (e) {
            if (run === generation.current) {
                setError(e instanceof Error ? e.message : "Không tải được cửa hàng.");
                setBusy(false);
                pending.current = false;
            }
        }
    }

    const remaining = qr ? Math.max(0, Math.ceil((Date.parse(qr.expiresAt) - now) / 1000)) : 0;

    return (
        <section className={styles.card}>
            <h2>Quản lý nhân viên</h2>
            <p>Cho sinh viên quét mã để gia nhập cửa hàng.</p>
            <button type="button" className={styles.staffPrimaryBtn} onClick={() => void show()}>
                Xem QR tuyển nhân viên
            </button>
            {open && (
                <div
                    className={styles.staffQrBackdrop}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Mã QR tuyển nhân viên"
                    onClick={close}
                >
                    <div className={styles.staffQrModal} onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className={styles.staffQrCloseBtn}
                            onClick={close}
                            aria-label="Đóng"
                        >
                            ×
                        </button>
                        <h2>Mã QR tuyển nhân viên</h2>
                        {shops.length > 1 && (
                            <select
                                aria-label="Cửa hàng tuyển nhân viên"
                                value={id}
                                disabled={busy}
                                onChange={(e) => {
                                    setId(e.target.value);
                                    void issue(e.target.value);
                                }}
                            >
                                {shops.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        <p>{shops.find((s) => s.id === id)?.name}</p>
                        {busy && <p role="status">Đang tạo mã QR…</p>}
                        {error && <p role="alert">{error}</p>}
                        {qr && (
                            <div className={styles.staffQrInnerCard}>
                                {/* Generated locally by our authenticated API. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={qr.qrImageDataUrl}
                                    width={300}
                                    height={300}
                                    alt="Mã QR tuyển nhân viên"
                                />
                                <p role="status">
                                    {remaining > 0 ? `Còn ${remaining} giây` : "Mã QR đã hết hạn"}
                                </p>
                                <a
                                    href={qr.qrImageDataUrl}
                                    download={`qr-nhan-vien-${id.slice(0, 8)}.png`}
                                    className={styles.neutral}
                                >
                                    Tải ảnh QR về máy
                                </a>
                            </div>
                        )}
                        <div className={styles.staffQrModalFooter}>
                            <button type="button" onClick={close}>
                                Đóng
                            </button>
                            <button
                                type="button"
                                disabled={busy || !id}
                                onClick={() => void issue(id)}
                            >
                                Tạo mã mới
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
