"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { readSellerAccess } from "@/lib/seller/access-client";
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
    const key = JSON.stringify([status, user?.id, user?.role, user?.status, user?.work_for_restaurant_id, path]);
    const eligible = status === "ready" && user?.status === "active" && ["student", "seller"].includes(user.role) && user.work_for_restaurant_id === null;
    const [state, setState] = useState<State>({ key: "", data: null, error: "", loading: true });
    const generation = useRef(0);
    const cancel = useCallback(() => { generation.current++; }, []);
    const retry = useCallback(() => {
        const run = ++generation.current;
        const owner = user?.id;
        if (!eligible) {
            setState({ key, data: null, error: "", loading: false });
            return;
        }
        setState(current => current.key === key && current.data ? { ...current, error: "", loading: true } : { key, data: null, error: "", loading: true });
        void readSellerAccess().then(data => {
            // Never expose a late response for an account/session that has changed.
            if (run === generation.current && useAuthStore.getState().user?.id === owner) {
                if (data.user.id !== owner)
                    throw Error("ACCOUNT_CHANGED");
                const current = useAuthStore.getState().user;
                if (current && current.role === user?.role && current.status === user?.status && current.work_for_restaurant_id === user?.work_for_restaurant_id) {
                    if (current.role !== data.user.role || current.work_for_restaurant_id !== data.user.work_for_restaurant_id)
                        useAuthStore.getState().setUser({ ...current, ...data.user });
                }
                setState({ key, data, error: "", loading: false });
            }
        }).catch(() => { if (run === generation.current && useAuthStore.getState().user?.id === owner)
            setState({ key, data: null, error: "Không tải được thông tin cửa hàng. Hãy thử lại.", loading: false }); });
    }, [eligible, key, user]);
    useEffect(() => { let mounted = true; Promise.resolve().then(() => { if (mounted)
        retry(); }); window.addEventListener("focus", retry); window.addEventListener("seller-access-changed", retry); return () => { mounted = false; cancel(); window.removeEventListener("focus", retry); window.removeEventListener("seller-access-changed", retry); }; }, [retry, cancel]);
    const value = eligible && state.key === key ? { ...state, retry } : { data: null, error: "", loading: status === "loading" || eligible, retry };
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useSellerAccess = () => useContext(Context);
