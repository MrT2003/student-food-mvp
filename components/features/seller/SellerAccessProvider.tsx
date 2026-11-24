"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { isSellerAccessDenied, readSellerAccess, SellerAccessClientError } from "@/lib/seller/access-client";
import type { SellerAccess } from "@/types/seller-access.types";
type State = {
    key: string;
    data: SellerAccess | null;
    error: string;
    loading: boolean;
};
const Context = createContext<{
    data: SellerAccess | null;
    error: string;
    loading: boolean;
    retry: () => void;
}>({ data: null, error: "", loading: true, retry: () => { } });
export function SellerAccessProvider({ children }: {
    children: ReactNode;
}) {
    const user = useAuthStore(s => s.user), status = useAuthStore(s => s.status), path = usePathname();
    const owner = user?.id, role = user?.role, accountStatus = user?.status, work = user?.work_for_restaurant_id;
    const key = JSON.stringify([status, owner, role, accountStatus, work]);
    const eligible = status === "ready" && user?.status === "active" && (
        (["student", "seller"].includes(user.role) && user.work_for_restaurant_id === null) ||
        (user.role === "staff" && Boolean(user.work_for_restaurant_id))
    );
    const [state, setState] = useState<State>({ key: "", data: null, error: "", loading: true });
    const generation = useRef(0);
    const cancel = useCallback(() => { generation.current++; }, []);
    const retry = useCallback(() => {
        const run = ++generation.current;
        if (!eligible) {
            setState({ key, data: null, error: "", loading: false });
            return;
        }
        // Same identity: keep the shop mounted during focus/profile refreshes.
        setState(current => current.key === key && current.data ? { ...current, error: "", loading: false } : { key, data: null, error: "", loading: true });
        void readSellerAccess().then(data => {
            // Never expose a late response for an account/session that has changed.
            if (run === generation.current && useAuthStore.getState().user?.id === owner) {
                if (data.user.id !== owner)
                    throw new SellerAccessClientError(403, "ACCOUNT_CHANGED");
                const current = useAuthStore.getState().user;
                if (current && current.role === role && current.status === accountStatus && current.work_for_restaurant_id === work) {
                    if (current.role !== data.user.role || current.work_for_restaurant_id !== data.user.work_for_restaurant_id)
                        useAuthStore.getState().setUser({ ...current, ...data.user });
                }
                setState({ key, data, error: "", loading: false });
            }
        }).catch(error => { if (run === generation.current && useAuthStore.getState().user?.id === owner)
            setState(current => ({ key, data: !isSellerAccessDenied(error) && current.key === key ? current.data : null,
                error: "Không tải được thông tin cửa hàng. Hãy thử lại.", loading: false })); });
    }, [eligible, key, owner, role, accountStatus, work]);
    useEffect(() => { let mounted = true; Promise.resolve().then(() => { if (mounted)
        retry(); }); window.addEventListener("focus", retry); window.addEventListener("seller-access-changed", retry); return () => { mounted = false; cancel(); window.removeEventListener("focus", retry); window.removeEventListener("seller-access-changed", retry); }; }, [retry, cancel, path]);
    const value = eligible && state.key === key ? { ...state, retry } : { data: null, error: "", loading: status === "loading" || eligible, retry };
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useSellerAccess = () => useContext(Context);
