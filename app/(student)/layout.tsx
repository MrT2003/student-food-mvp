import type { ReactNode } from "react";
import StudentHeader from "@/components/layout/StudentHeader";
import StudentStorageBoundary from "@/components/layout/StudentStorageBoundary";
import styles from "@/styles/home.module.css";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <StudentStorageBoundary>
      <div className={styles.page}>
        <StudentHeader />
        <div className={styles.decoration} aria-hidden="true" />
        <main className={styles.main}>{children}</main>
      </div>
    </StudentStorageBoundary>
  );
}
