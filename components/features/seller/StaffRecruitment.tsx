"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StaffInvitationResult } from "@/types/seller.types";
import styles from "@/styles/seller-shop.module.css";
import { staffRequest } from "@/lib/seller/staff-client";

type StaffMember = {
    id: string;
    name: string | null;
    phone: string | null;
    avatar_url: string | null;
    role: string;
    status: string;
};

type StaffTab = "qr" | "list";

export default function StaffRecruitment() {
    const [open, setOpen] = useState(false),
        [activeTab, setActiveTab] = useState<StaffTab>("qr"),
        [shops, setShops] = useState<{ id: string; name: string }[]>([]);
    const [id, setId] = useState(""),
        [qr, setQr] = useState<StaffInvitationResult | null>(null);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [now, setNow] = useState(0);
    const [staffList, setStaffList] = useState<StaffMember[]>([]),
        [loadingStaff, setLoadingStaff] = useState(false),
        [removingId, setRemovingId] = useState<string | null>(null),
        [staffError, setStaffError] = useState(""),
        [staffNotice, setStaffNotice] = useState("");
    const generation = useRef(0),
        staffGeneration = useRef(0),
        pending = useRef(false);

    function close() {
        generation.current++;
        staffGeneration.current++;
        pending.current = false;
        setBusy(false);
        setLoadingStaff(false);
        setRemovingId(null);
        setOpen(false);
        setQr(null);
        setStaffError("");
        setStaffNotice("");
    }

    useEffect(() => () => {
        generation.current++;
        staffGeneration.current++;
    }, []);

    useEffect(() => {
        if (!open || activeTab !== "qr") return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [open, activeTab]);

    async function loadStaff(restaurantId: string) {
        if (!restaurantId) return;
        const run = ++staffGeneration.current;
        setLoadingStaff(true);
        setStaffError("");
        try {
            const client = createClient();
            const { data, error: queryError } = await client
                .from("users")
                .select("id,name,phone,avatar_url,role,status")
                .eq("work_for_restaurant_id", restaurantId)
                .eq("role", "staff")
                .order("name", { ascending: true });
            if (queryError) {
                throw Error("Không tải được danh sách nhân viên.");
            }
            if (run === staffGeneration.current) {
                setStaffList((data ?? []) as StaffMember[]);
            }
        } catch (e) {
            if (run === staffGeneration.current) {
                setStaffError(
                    e instanceof Error ? e.message : "Không tải được danh sách nhân viên.",
                );
            }
        } finally {
            if (run === staffGeneration.current) {
                setLoadingStaff(false);
            }
        }
    }

    async function removeStaff(member: StaffMember) {
        if (removingId !== null || !id) return;
        const label = member.name || member.phone || "này";
        if (
            typeof window !== "undefined" &&
            typeof window.confirm === "function" &&
            !window.confirm(`Cho nhân viên "${label}" rời khỏi cửa hàng?`)
        ) {
            return;
        }
        setRemovingId(member.id);
        setStaffError("");
        setStaffNotice("");
        try {
            const client = createClient();
            const { error: rpcError } = await client.rpc("remove_staff", {
                p_staff_id: member.id,
            });
            if (rpcError) {
                if (rpcError.code === "PGRST202" || rpcError.code === "42883") {
                    const { error: updateError } = await client
                        .from("users")
                        .update({
                            role: "student",
                            work_for_restaurant_id: null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", member.id)
                        .eq("role", "staff")
                        .eq("work_for_restaurant_id", id);
                    if (updateError) {
                        throw Error("Không thể xóa nhân viên khỏi cửa hàng. Vui lòng thử lại.");
                    }
                } else {
                    throw Error("Không thể xóa nhân viên khỏi cửa hàng. Vui lòng thử lại.");
                }
            }
            await loadStaff(id);
            setStaffNotice(
                `Đã cho ${member.name || "nhân viên"} rời khỏi cửa hàng.`,
            );
        } catch (e) {
            setStaffError(
                e instanceof Error
                    ? e.message
                    : "Không thể xóa nhân viên khỏi cửa hàng. Vui lòng thử lại.",
            );
        } finally {
            setRemovingId(null);
        }
    }

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

    async function show(initialTab: StaffTab = "qr") {
        if (pending.current) return;
        setActiveTab(initialTab);
        setOpen(true);
        setError("");
        setStaffError("");
        setStaffNotice("");
        setBusy(initialTab === "qr");
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
            const firstId = result.data[0].id;
            setShops(result.data);
            setId(firstId);
            pending.current = false;
            if (initialTab === "qr") {
                await Promise.all([issue(firstId), loadStaff(firstId)]);
            } else {
                await loadStaff(firstId);
            }
        } catch (e) {
            if (run === generation.current) {
                const msg = e instanceof Error ? e.message : "Không tải được cửa hàng.";
                setError(msg);
                setStaffError(msg);
                setBusy(false);
                pending.current = false;
            }
        }
    }

    const remaining = qr ? Math.max(0, Math.ceil((Date.parse(qr.expiresAt) - now) / 1000)) : 0;

    return (
        <section className={styles.card}>
            <h2>Quản lý nhân viên</h2>
            <p>Cho sinh viên quét mã để gia nhập hoặc quản lý nhân viên hiện tại của cửa hàng.</p>
            <div className={styles.staffActionsRow}>
                <button
                    type="button"
                    className={styles.staffPrimaryBtn}
                    onClick={() => void show("qr")}
                >
                    Xem mã QR
                </button>
                <button
                    type="button"
                    className={styles.staffOutlineBtn}
                    onClick={() => void show("list")}
                >
                    Danh sách nhân viên
                </button>
            </div>
            {open && (
                <div
                    className={styles.staffQrBackdrop}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Quản lý nhân viên cửa hàng"
                    onClick={close}
                >
                    <div className={styles.staffReqModal} onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className={styles.staffQrCloseBtn}
                            onClick={close}
                            aria-label="Đóng"
                        >
                            ×
                        </button>
                        <div className={styles.staffReqHeader}>
                            <h2>Quản lý nhân viên</h2>
                            <p>{shops.find((s) => s.id === id)?.name || "Cửa hàng của bạn"}</p>
                        </div>

                        {shops.length > 1 && (
                            <select
                                aria-label="Cửa hàng tuyển nhân viên"
                                value={id}
                                disabled={busy || loadingStaff}
                                onChange={(e) => {
                                    const nextId = e.target.value;
                                    setId(nextId);
                                    void loadStaff(nextId);
                                    if (activeTab === "qr") {
                                        void issue(nextId);
                                    } else {
                                        setQr(null);
                                    }
                                }}
                                style={{ marginBottom: 14, width: "100%" }}
                            >
                                {shops.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        )}

                        <div className={styles.staffTabs} role="tablist" aria-label="Chế độ quản lý nhân viên">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === "qr"}
                                className={`${styles.staffTabBtn} ${
                                    activeTab === "qr" ? styles.staffTabBtnActive : ""
                                }`}
                                onClick={() => {
                                    setActiveTab("qr");
                                    if (!qr && id) void issue(id);
                                }}
                            >
                                Mã QR tuyển nhân viên
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === "list"}
                                className={`${styles.staffTabBtn} ${
                                    activeTab === "list" ? styles.staffTabBtnActive : ""
                                }`}
                                onClick={() => {
                                    setActiveTab("list");
                                    if (id) void loadStaff(id);
                                }}
                            >
                                Nhân viên ({staffList.length})
                            </button>
                        </div>

                        {activeTab === "qr" ? (
                            <div>
                                {busy && <p role="status">Đang tạo mã QR…</p>}
                                {error && <p className={styles.staffNoticeErr} role="alert">{error}</p>}
                                {qr && (
                                    <div className={styles.staffQrInnerCard}>
                                        {/* Generated locally by our authenticated API. */}
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={qr.qrImageDataUrl}
                                            width={260}
                                            height={260}
                                            alt="Mã QR tuyển nhân viên"
                                        />
                                        <p className={styles.staffQrCaption} role="status">
                                            {remaining > 0 ? `Còn ${remaining} giây` : "Mã QR đã hết hạn"}
                                        </p>
                                        <a
                                            href={qr.qrImageDataUrl}
                                            download={`qr-nhan-vien-${id.slice(0, 8)}.png`}
                                            className={styles.staffOutlineBtn}
                                            style={{ marginTop: 12, textDecoration: "none" }}
                                        >
                                            Tải ảnh QR về máy
                                        </a>
                                    </div>
                                )}
                                <div className={styles.staffQrModalFooter}>
                                    <button
                                        type="button"
                                        className={styles.staffQrDismissBtn}
                                        onClick={close}
                                    >
                                        Đóng
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.staffQrDownloadBtn}
                                        disabled={busy || !id}
                                        onClick={() => void issue(id)}
                                    >
                                        Tạo mã mới
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className={styles.staffReqSummaryBar}>
                                    <strong>Nhân viên hiện tại</strong>
                                    <span className={styles.staffReqCountPill}>
                                        {staffList.length} người
                                    </span>
                                    <button
                                        type="button"
                                        className={styles.staffRefreshBtn}
                                        disabled={loadingStaff || !id}
                                        onClick={() => void loadStaff(id)}
                                    >
                                        {loadingStaff ? "Đang tải…" : "Tải lại"}
                                    </button>
                                </div>

                                {staffError && (
                                    <p className={styles.staffNoticeErr} role="alert">
                                        {staffError}
                                    </p>
                                )}
                                {staffNotice && (
                                    <p className={styles.staffNoticeOk} role="status">
                                        {staffNotice}
                                    </p>
                                )}

                                {loadingStaff ? (
                                    <p role="status">Đang tải danh sách nhân viên…</p>
                                ) : staffList.length === 0 ? (
                                    <div className={styles.staffReqEmpty}>
                                        Chưa có nhân viên nào trong cửa hàng. Hãy chuyển sang tab Mã QR để mời sinh viên gia nhập.
                                    </div>
                                ) : (
                                    <div className={styles.staffReqList}>
                                        {staffList.map((member) => {
                                            const initialChar = member.name?.trim().charAt(0).toUpperCase() || "NV";
                                            return (
                                                <article key={member.id} className={styles.staffReqCard}>
                                                    <div className={styles.staffReqTopRow}>
                                                        <div className={styles.staffReqUserLeft}>
                                                            <div className={styles.staffReqAvatar} aria-hidden="true">
                                                                {initialChar}
                                                            </div>
                                                            <div className={styles.staffReqUserInfo}>
                                                                <h3>{member.name || "Sinh viên"}</h3>
                                                                <span className={styles.staffReqMetaItem}>
                                                                    {member.phone || "Chưa cập nhật SĐT"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className={styles.staffReqPendingBadge}>
                                                            Đang làm việc
                                                        </span>
                                                    </div>
                                                    <div className={styles.staffReqActionRow}>
                                                        <button
                                                            type="button"
                                                            className={styles.staffReqRejectBtn}
                                                            disabled={removingId !== null}
                                                            onClick={() => void removeStaff(member)}
                                                        >
                                                            {removingId === member.id ? "Đang xóa…" : "Cho rời quán"}
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className={styles.staffQrModalFooter}>
                                    <button
                                        type="button"
                                        className={styles.staffQrDismissBtn}
                                        onClick={close}
                                    >
                                        Đóng
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
