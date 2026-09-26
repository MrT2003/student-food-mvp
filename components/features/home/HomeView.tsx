"use client";

import { useEffect, useRef } from "react";
import { MapPin, X } from "lucide-react";
import { useHome } from "@/lib/home/useHome";
import HomeHero from "./HomeHero";
import HomeFilters from "./HomeFilters";
import RestaurantSection from "./RestaurantSection";
import ReorderSection from "./ReorderSection";
import FoodPlaceholder from "./FoodPlaceholder";
import styles from "./home.module.css";

export default function HomeView() {
  const home = useHome();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (home.selected && !dialog.current?.open) dialog.current?.showModal();
    if (!home.selected && dialog.current?.open) dialog.current.close();
  }, [home.selected]);

  return (
    <>
      <HomeHero input={home.input} onChange={home.setInput} onSearch={home.search} />
      <HomeFilters filters={home.filters} onChange={home.setFilters} onReset={home.reset} />
      <RestaurantSection restaurants={home.restaurants} onSelect={home.setSelected} onReset={home.reset} searching={Boolean(home.filters.query)} />
      <ReorderSection restaurants={home.recentRestaurants} onSelect={home.setSelected} />
      <dialog ref={dialog} className={styles.restaurantDialog} aria-labelledby="restaurant-preview-title" onClose={() => home.setSelected(null)} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        {home.selected && <div className={styles.dialogContent}>
          <button type="button" className={styles.dialogClose} aria-label="Đóng thông tin quán" onClick={() => dialog.current?.close()}><X size={22} /></button>
          <FoodPlaceholder restaurant={home.selected} />
          <h2 id="restaurant-preview-title">{home.selected.name}</h2>
          <p className={styles.location}><MapPin size={18} aria-hidden="true" />{home.selected.location}<span>·</span>{home.selected.menuItemCount} món</p>
          <p>{home.selected.categories.join(" · ")}</p>
          <p className={styles.dialogNote}>Bạn đang xem giao diện mẫu. Chức năng chọn món và đặt hàng sẽ được bổ sung sau.</p>
          <button type="button" className={styles.primaryButton} onClick={() => dialog.current?.close()}>Tiếp tục khám phá</button>
        </div>}
      </dialog>
    </>
  );
}
