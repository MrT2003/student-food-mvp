"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, MapPin, Search, ClipboardList, Utensils } from "lucide-react";
import type { ExploreRestaurant } from "@/lib/explore/mock-data";
import { useExplore, type SortBy } from "@/lib/explore/useExplore";
import ExploreFilters from "../explore/ExploreFilters";
import ExploreFoodPlaceholder from "../explore/ExploreFoodPlaceholder";
import styles from "@/styles/open-restaurants.module.css";

const pageSize = 12;

export default function OpenRestaurantsView({ initialRestaurants }: { initialRestaurants: ExploreRestaurant[] }) {
  // Resetting filters must never bring closed restaurants into this collection.
  const openRestaurants = useMemo(() => initialRestaurants.filter((restaurant) => restaurant.isOpen), [initialRestaurants]);
  const explore = useExplore(openRestaurants);
  const [page, setPage] = useState(1);
  const pageCount = Math.ceil(explore.restaurants.length / pageSize);
  const currentPage = Math.min(page, Math.max(1, pageCount));
  const visibleRestaurants = explore.restaurants.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstPage = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPage + index);

  function resetFilters() {
    explore.resetFilters();
    setPage(1);
  }

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}><ArrowLeft size={20} /> Trang chủ</Link>
      <section className={styles.hero} aria-labelledby="open-restaurants-title">
        <h1 id="open-restaurants-title">Quán <span>đang mở</span></h1>
        <p>Khám phá tất cả cửa hàng đang hoạt động quanh khu ký túc xá.</p>
        <form className={styles.search} role="search" onSubmit={(event) => { event.preventDefault(); explore.submitSearch(); setPage(1); }}>
          <Search aria-hidden="true" size={26} />
          <input aria-label="Tìm quán ăn hoặc món ăn" placeholder="Tìm quán ăn hoặc món ăn..." value={explore.searchInput} onChange={(event) => explore.setSearchInput(event.target.value)} />
          <button type="submit">Tìm kiếm</button>
        </form>
      </section>
      <div className={styles.filters}>
        <ExploreFilters
          isAllSelected={explore.isAllSelected} openOnly={explore.openOnly}
          location={explore.location} category={explore.category}
          onReset={resetFilters}
          onToggleOpenOnly={() => { explore.setOpenOnly(!explore.openOnly); setPage(1); }}
          onSelectLocation={(location) => { explore.setLocation(location); setPage(1); }}
          onSelectCategory={(category) => { explore.setCategory(category); setPage(1); }}
        />
      </div>
      <section aria-labelledby="open-results-title">
        <div className={styles.resultsHeading}>
          <h2 id="open-results-title" aria-live="polite"><span>{explore.restaurants.length}</span> quán đang mở</h2>
          <label className={styles.sort}>Sắp xếp:
            <select value={explore.sortBy} onChange={(event) => { explore.setSortBy(event.target.value as SortBy); setPage(1); }}>
              <option value="popular">Phổ biến</option><option value="name">Tên A–Z</option><option value="menu">Nhiều món nhất</option>
            </select>
          </label>
        </div>
        {visibleRestaurants.length ? (
          <div className={styles.grid}>
            {visibleRestaurants.map((restaurant) => (
              <article key={restaurant.id} className={styles.card}>
                <div className={styles.media}>
                  <ExploreFoodPlaceholder kind={restaurant.kind} imageUrl={restaurant.imageUrl} />
                  <span className={styles.badge}><i /> Đang nhận đơn</span>
                </div>
                <h3>{restaurant.name}</h3>
                <p className={styles.location}><MapPin size={17} aria-hidden="true" />{restaurant.location || "Chưa cập nhật khu vực"}</p>
                <div className={styles.meta}>
                  <span><ClipboardList size={16} aria-hidden="true" />{restaurant.menuCount} món</span>
                  <span title={restaurant.categories.join(", ")}><Utensils size={16} aria-hidden="true" />{restaurant.categories.join(", ") || "Ẩm thực"}</span>
                </div>
                <Link className={styles.visit} href={`/restaurants/${encodeURIComponent(restaurant.slug)}`} aria-label={`Xem quán ${restaurant.name}`}>Xem quán <ArrowRight size={18} aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
        ) : <div className={styles.empty}><h3>Chưa có quán đang mở phù hợp</h3><p>Thử từ khóa khác hoặc xóa bộ lọc để xem các quán đang nhận đơn.</p><button type="button" onClick={resetFilters}>Xóa bộ lọc</button></div>}
        {pageCount > 1 && (
          <nav className={styles.pagination} aria-label="Phân trang quán đang mở">
            <button type="button" disabled={currentPage === 1} aria-label="Trang trước" onClick={() => setPage(currentPage - 1)}><ChevronLeft size={20} /></button>
            {pages.map((number) => <button key={number} type="button" aria-label={`Trang ${number}`} aria-current={number === currentPage ? "page" : undefined} onClick={() => setPage(number)}>{number}</button>)}
            <button type="button" disabled={currentPage === pageCount} aria-label="Trang sau" onClick={() => setPage(currentPage + 1)}><ChevronRight size={20} /></button>
            <span className="sr-only" aria-live="polite">Trang {currentPage} trên {pageCount}</span>
          </nav>
        )}
      </section>
    </div>
  );
}
