import { Search } from "lucide-react";
import styles from "./home.module.css";
type Props = { input: string; onChange: (value: string) => void; onSearch: () => void };
export default function HomeHero({ input, onChange, onSearch }: Props) {
  return <section className={styles.hero} aria-labelledby="home-title">
    <h1 id="home-title">Tìm món ngon quanh <span>khu ký túc xá</span></h1>
    <p>Hàng trăm quán ăn ngon, giao nhanh, dành riêng cho sinh viên.</p>
    <form className={styles.search} role="search" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
      <Search size={27} strokeWidth={1.7} aria-hidden="true" />
      <label htmlFor="home-search" className="sr-only">Tìm quán ăn hoặc món ăn</label>
      <input id="home-search" type="search" value={input} onChange={(event) => onChange(event.target.value)} placeholder="Tìm quán ăn hoặc món ăn..." />
      <button type="submit" className={styles.primaryButton}>Tìm kiếm</button>
    </form>
  </section>;
}
