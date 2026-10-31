import type { ReactNode } from "react";
import type { Viewport } from "next";
import StudentHeader from "@/components/layout/StudentHeader";
import StudentBottomNavigation from "@/components/layout/StudentBottomNavigation";
import StudentStorageBoundary from "@/components/layout/StudentStorageBoundary";
import styles from "@/styles/home.module.css";
import mobileStyles from "@/styles/student-mobile-navigation.module.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <StudentStorageBoundary>
      <div className={`${styles.page} ${mobileStyles.shell}`}>
        <StudentHeader />
        <div className={styles.decoration} aria-hidden="true" />
        <main className={styles.main}>{children}</main>
        <StudentBottomNavigation />
      </div>
    </StudentStorageBoundary>
  );
}
