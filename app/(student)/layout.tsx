import type { ReactNode } from "react";
import StudentHeader from "@/components/layout/StudentHeader";
import styles from "@/components/features/home/home.module.css";

export default function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <StudentHeader />
      <div className={styles.decoration} aria-hidden="true" />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
