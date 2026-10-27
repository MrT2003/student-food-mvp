"use client";

import { useState } from "react";
import { CookingPot, CupSoda, Utensils } from "lucide-react";
import {
  getOptionArtworkKind,
  type OptionArtworkKind,
  type OptionGroupKind,
} from "@/lib/dish/options";
import styles from "@/styles/dish.module.css";

export function DishHeroMedia({
  drink,
  imageUrl,
  alt = "",
}: {
  drink: boolean;
  imageUrl?: string | null;
  alt?: string;
  slug?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const validUrl = imageUrl && imageUrl !== failedUrl ? imageUrl : null;
  const Icon = drink ? CupSoda : CookingPot;

  return (
    <div
      className={styles.placeholder}
      data-kind={drink ? "drink" : "food"}
      aria-hidden={!validUrl}
    >
      {validUrl ? (
        <img
          src={validUrl}
          alt={alt}
          onError={() => setFailedUrl(validUrl)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <Icon strokeWidth={1.3} />
      )}
    </div>
  );
}

export function SectionGroupIcon({ kind }: { kind: OptionGroupKind | "quantity" }) {
  if (kind === "topping") {
    return (
      <svg
        viewBox="0 0 36 36"
        className={styles.sectionSvgIcon}
        aria-hidden="true"
      >
        <ellipse cx="18" cy="27" rx="14" ry="5.5" fill="#fff3e6" stroke="#1859c9" strokeWidth="1.6" />
        <path
          d="M7 26 L10 13 C10.5 10.5, 25.5 10.5, 26 13 L29 26 C26 29, 10 29, 7 26 Z"
          fill="#ff6a1a"
          stroke="#1859c9"
          strokeWidth="1.5"
        />
        <ellipse cx="18" cy="12.5" rx="8" ry="3.2" fill="#ffe066" stroke="#1859c9" strokeWidth="1.5" />
        <path
          d="M12 14 Q15 18 18 14 Q21 18 24 14"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === "sugar") {
    return (
      <svg
        viewBox="0 0 36 36"
        className={styles.sectionSvgIcon}
        aria-hidden="true"
      >
        <path
          d="M18 4 L21 4 L18 16 L15 16 Z"
          fill="#ff2e17"
        />
        <path
          d="M9 12 L27 12 L24.5 30 C24.2 31.8, 22.5 33, 18 33 C13.5 33, 11.8 31.8, 11.5 30 Z"
          fill="#eaf2ff"
          stroke="#1859c9"
          strokeWidth="1.8"
        />
        <path
          d="M11 17 L25 17 L23.2 29.5 C23 30.8, 21.5 31.5, 18 31.5 C14.5 31.5, 13 30.8, 12.8 29.5 Z"
          fill="#ff9f1c"
        />
        <rect x="13" y="18" width="4.5" height="4.5" rx="1" fill="#ffffff" opacity="0.85" />
        <rect x="18.5" y="19" width="4.5" height="4.5" rx="1" fill="#ffffff" opacity="0.85" />
        <line x1="7" y1="12" x2="29" y2="12" stroke="#1859c9" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "ice" || kind === "quantity") {
    return (
      <svg
        viewBox="0 0 36 36"
        className={styles.sectionSvgIcon}
        aria-hidden="true"
      >
        <polygon
          points="18,4 26,8 18,12 10,8"
          fill="#eef5ff"
          stroke="#1859c9"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polygon
          points="10,8 18,12 18,20 10,16"
          fill="#dceaff"
          stroke="#1859c9"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polygon
          points="26,8 18,12 18,20 26,16"
          fill="#c2dbff"
          stroke="#1859c9"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polygon
          points="11,16 18,19.5 11,23 4,19.5"
          fill="#eef5ff"
          stroke="#1859c9"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polygon
          points="4,19.5 11,23 11,31 4,27.5"
          fill="#dceaff"
          stroke="#1859c9"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polygon
          points="18,19.5 11,23 11,31 18,27.5"
          fill="#c2dbff"
          stroke="#1859c9"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polygon
          points="25,16 32,19.5 25,23 18,19.5"
          fill="#eef5ff"
          stroke="#1859c9"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polygon
          points="18,19.5 25,23 25,31 18,27.5"
          fill="#dceaff"
          stroke="#1859c9"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polygon
          points="32,19.5 25,23 25,31 32,27.5"
          fill="#c2dbff"
          stroke="#1859c9"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === "food-extra") {
    return (
      <svg
        viewBox="0 0 36 36"
        className={styles.sectionSvgIcon}
        aria-hidden="true"
      >
        <path
          d="M8 18 C8 12, 28 12, 28 18 Z"
          fill="#fff5eb"
          stroke="#1859c9"
          strokeWidth="1.6"
        />
        <path
          d="M6 18 L30 18 L27 28 C26 30.5, 22.5 32, 18 32 C13.5 32, 10 30.5, 9 28 Z"
          fill="#ff6a1a"
          stroke="#1859c9"
          strokeWidth="1.6"
        />
        <path
          d="M14 9 Q15 6 14 4 M18 8 Q19 5 18 3 M22 9 Q23 6 22 4"
          stroke="#ff4d12"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }

  return <Utensils size={24} aria-hidden="true" />;
}

export function OptionItemArtwork({ optionName }: { optionName: string }) {
  const kind: OptionArtworkKind = getOptionArtworkKind(optionName);

  switch (kind) {
    case "pearls":
      return (
        <svg viewBox="0 0 64 64" className={styles.optionSvg} aria-hidden="true">
          <ellipse cx="32" cy="52" rx="22" ry="6" fill="#e5ebf5" />
          <path
            d="M10 30 C10 48, 54 48, 54 30 Z"
            fill="#f4f6fa"
            stroke="#d0d8e8"
            strokeWidth="1.5"
          />
          <ellipse cx="32" cy="29" rx="22" ry="10" fill="#23140d" />
          {[
            [22, 26],
            [30, 24],
            [39, 26],
            [18, 31],
            [26, 31],
            [35, 31],
            [43, 30],
            [29, 19],
            [36, 20],
            [23, 21],
          ].map(([cx, cy], idx) => (
            <g key={idx}>
              <circle cx={cx} cy={cy} r="5.2" fill="#140b07" />
              <circle cx={cx - 1.5} cy={cy - 1.5} r="1.5" fill="#7c5238" />
            </g>
          ))}
        </svg>
      );

    case "fruit-jelly":
      return (
        <svg viewBox="0 0 64 64" className={styles.optionSvg} aria-hidden="true">
          <circle cx="32" cy="34" r="24" fill="#eef3fb" />
          {[
            [24, 22, "#ff3b30"],
            [35, 20, "#ffcc00"],
            [43, 26, "#ff9500"],
            [20, 31, "#ff9500"],
            [30, 29, "#ffffff"],
            [39, 34, "#4cd964"],
            [24, 40, "#ff2d55"],
            [33, 41, "#ffcc00"],
            [44, 39, "#ffffff"],
            [17, 37, "#ffcc00"],
          ].map(([cx, cy, color], idx) => (
            <g key={idx}>
              <circle
                cx={Number(cx)}
                cy={Number(cy)}
                r="6.2"
                fill={String(color)}
                stroke="#ffffff"
                strokeWidth="0.8"
              />
              <circle
                cx={Number(cx) - 1.8}
                cy={Number(cy) - 1.8}
                r="1.8"
                fill="#ffffff"
                opacity="0.75"
              />
            </g>
          ))}
        </svg>
      );

    case "pudding":
      return (
        <svg viewBox="0 0 64 64" className={styles.optionSvg} aria-hidden="true">
          <ellipse cx="32" cy="44" rx="26" ry="11" fill="#e6ecf5" />
          <ellipse cx="32" cy="42" rx="24" ry="9.5" fill="#ffffff" stroke="#d5deec" strokeWidth="1.2" />
          <ellipse cx="32" cy="42" rx="18" ry="6.5" fill="#8f3911" />
          <path
            d="M17 40 L21 21 C22 17, 42 17, 43 21 L47 40 C43 44, 21 44, 17 40 Z"
            fill="#f7be52"
          />
          <ellipse cx="32" cy="20" rx="11" ry="4.2" fill="#5e2107" />
          <path
            d="M22 21 Q26 27 29 22 Q33 28 36 22 Q40 26 42 21"
            fill="#6e2809"
          />
        </svg>
      );

    default:
      return <CookingPot size={28} strokeWidth={1.5} aria-hidden="true" />;
  }
}
