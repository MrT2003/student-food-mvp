"use client";

import Image from "next/image";
import { useState } from "react";
import { Milk, Utensils } from "lucide-react";
import styles from "@/styles/orders.module.css";

export type OrderArtworkKind =
  | "com-co-ba"
  | "com-ga-chien"
  | "tra-sua-nha-lam"
  | "tra-sua-truyen-thong"
  | "bun-cha-ha-noi"
  | "mi-cay-seoul"
  | "an-vat-5k"
  | "food"
  | "drink";

type Props = {
  artwork?: OrderArtworkKind;
  kind?: "food" | "drink";
  imageUrl?: string | null;
  small?: boolean;
  className?: string;
};

function renderArtworkSvg(artwork: OrderArtworkKind) {
  switch (artwork) {
    case "com-co-ba":
      return (
        <svg
          viewBox="0 0 120 120"
          className={styles.artworkSvg}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="wood-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#9c6438" />
              <stop offset="50%" stopColor="#7c4923" />
              <stop offset="100%" stopColor="#5a3215" />
            </linearGradient>
            <radialGradient id="plate-dark" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2d2520" />
              <stop offset="82%" stopColor="#1a1512" />
              <stop offset="100%" stopColor="#0f0c0a" />
            </radialGradient>
            <radialGradient id="rice-grad" cx="45%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="75%" stopColor="#f3EFEA" />
              <stop offset="100%" stopColor="#ddd5ca" />
            </radialGradient>
            <linearGradient id="chicken-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f59f3d" />
              <stop offset="55%" stopColor="#d96b18" />
              <stop offset="100%" stopColor="#9c3f08" />
            </linearGradient>
          </defs>
          <rect width="120" height="120" rx="16" fill="url(#wood-bg)" />
          <circle cx="60" cy="62" r="52" fill="url(#plate-dark)" />
          <circle
            cx="60"
            cy="62"
            r="48"
            fill="none"
            stroke="#3d322c"
            strokeWidth="1.5"
          />
          {/* Fresh greens & cucumber */}
          <circle cx="68" cy="34" r="13" fill="#4ca626" />
          <circle cx="80" cy="40" r="11" fill="#63bd38" />
          <circle cx="72" cy="36" r="7" fill="#b7e887" />
          <circle cx="83" cy="43" r="6" fill="#c6f09c" />
          {/* Tomatoes & pickled carrots */}
          <circle cx="42" cy="36" r="10" fill="#e63725" />
          <circle cx="42" cy="36" r="6" fill="#ff735c" />
          <circle cx="31" cy="50" r="10" fill="#f05a24" />
          <circle cx="33" cy="50" r="6" fill="#ff9e44" />
          {/* Steamed white rice mound */}
          <ellipse cx="80" cy="68" rx="22" ry="20" fill="url(#rice-grad)" />
          <circle cx="75" cy="63" r="2" fill="#d8cfc4" />
          <circle cx="84" cy="66" r="1.8" fill="#d8cfc4" />
          <circle cx="79" cy="72" r="1.8" fill="#d8cfc4" />
          {/* Golden roasted/fried chicken */}
          <path
            d="M24 66 C22 54, 42 48, 56 56 C66 62, 68 78, 58 88 C46 96, 26 84, 24 66 Z"
            fill="url(#chicken-grad)"
          />
          <path
            d="M30 65 C34 58, 48 56, 54 64 C58 70, 54 80, 44 82 C34 84, 27 73, 30 65 Z"
            fill="#e67e22"
            opacity="0.7"
          />
          {/* Egg / side */}
          <ellipse cx="72" cy="92" rx="11" ry="8" fill="#f6c343" />
          <ellipse cx="72" cy="92" rx="6" ry="4.5" fill="#eb8c1f" />
        </svg>
      );

    case "com-ga-chien":
      return (
        <svg
          viewBox="0 0 80 80"
          className={styles.artworkSvg}
          aria-hidden="true"
        >
          <rect width="80" height="80" rx="12" fill="#d8cfc2" />
          <circle cx="40" cy="42" r="33" fill="#ffffff" />
          <circle cx="40" cy="42" r="28" fill="#f7f4ef" />
          {/* Greens */}
          <circle cx="28" cy="28" r="9" fill="#5dbb38" />
          <circle cx="38" cy="25" r="8" fill="#74cf4e" />
          {/* Rice */}
          <ellipse cx="28" cy="45" rx="13" ry="11" fill="#ffffff" />
          {/* Crispy chicken */}
          <path
            d="M34 34 C44 28, 60 34, 62 46 C64 56, 50 64, 36 58 C26 54, 26 40, 34 34 Z"
            fill="#e57c20"
          />
          <path
            d="M38 38 C45 34, 55 38, 56 46 C57 52, 48 57, 39 53 Z"
            fill="#f5a23d"
          />
        </svg>
      );

    case "tra-sua-nha-lam":
    case "tra-sua-truyen-thong":
      return (
        <svg
          viewBox="0 0 120 120"
          className={styles.artworkSvg}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="studio-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ede9e3" />
              <stop offset="72%" stopColor="#dfd9d0" />
              <stop offset="100%" stopColor="#c7bfb4" />
            </linearGradient>
            <linearGradient id="milk-tea" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ecc395" />
              <stop offset="55%" stopColor="#d79d66" />
              <stop offset="100%" stopColor="#b87b43" />
            </linearGradient>
          </defs>
          <rect width="120" height="120" rx="16" fill="url(#studio-bg)" />
          {/* Table surface */}
          <rect x="0" y="88" width="120" height="32" fill="#cfc7bc" />
          {/* Straw */}
          <path
            d="M57 12 L63 12 L60 38 L54 38 Z"
            fill="#231f20"
          />
          {/* Cup body */}
          <path
            d="M35 34 L85 34 L77 102 C76.5 106, 73 108, 68 108 L52 108 C47 108, 43.5 106, 43 102 Z"
            fill="url(#milk-tea)"
          />
          {/* Foam / top layer */}
          <ellipse cx="60" cy="35" rx="25" ry="6" fill="#f7e7d4" />
          <ellipse
            cx="60"
            cy="34"
            rx="26"
            ry="6.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            opacity="0.85"
          />
          {/* Cup emblem */}
          <circle cx="60" cy="64" r="10" fill="#2b2119" />
          <rect x="54" y="59" width="12" height="4" rx="1.5" fill="#ecc395" />
          <circle cx="57" cy="66" r="1.5" fill="#ecc395" />
          <circle cx="63" cy="66" r="1.5" fill="#ecc395" />
          {/* Boba pearls at bottom */}
          <circle cx="48" cy="98" r="3.5" fill="#1f140e" />
          <circle cx="56" cy="101" r="3.8" fill="#1f140e" />
          <circle cx="64" cy="100" r="3.6" fill="#1f140e" />
          <circle cx="71" cy="97" r="3.4" fill="#1f140e" />
          <circle cx="52" cy="93" r="3.3" fill="#2c1d14" />
          <circle cx="61" cy="94" r="3.5" fill="#2c1d14" />
          <circle cx="68" cy="92" r="3.2" fill="#2c1d14" />
        </svg>
      );

    case "bun-cha-ha-noi":
      return (
        <svg
          viewBox="0 0 120 120"
          className={styles.artworkSvg}
          aria-hidden="true"
        >
          <rect width="120" height="120" rx="16" fill="#7a4b2a" />
          {/* White ceramic bowl */}
          <circle cx="60" cy="60" r="52" fill="#f5f2ed" />
          <circle cx="60" cy="60" r="45" fill="#e8dfd5" />
          {/* White rice vermicelli (bún) at top-left */}
          <ellipse cx="44" cy="43" rx="22" ry="16" fill="#ffffff" />
          <path
            d="M30 40 Q44 33 56 42 M32 46 Q45 39 58 47"
            stroke="#e6e1da"
            strokeWidth="2"
            fill="none"
          />
          {/* Fresh herbs at top-right */}
          <circle cx="74" cy="38" r="13" fill="#3b9c23" />
          <circle cx="84" cy="48" r="12" fill="#4eb832" />
          <circle cx="66" cy="46" r="10" fill="#62cc43" />
          {/* Broth & grilled pork / chả at bottom */}
          <path
            d="M22 62 C26 90, 92 92, 96 62 Z"
            fill="#8c3b16"
          />
          <ellipse cx="42" cy="72" rx="14" ry="9" transform="rotate(-18 42 72)" fill="#d46524" />
          <ellipse cx="62" cy="76" rx="15" ry="9.5" transform="rotate(-12 62 76)" fill="#bf5219" />
          <ellipse cx="78" cy="68" rx="13" ry="8.5" transform="rotate(15 78 68)" fill="#e07830" />
          <circle cx="48" cy="66" r="4" fill="#f4a259" opacity="0.7" />
          <circle cx="66" cy="72" r="4" fill="#f4a259" opacity="0.7" />
        </svg>
      );

    case "mi-cay-seoul":
      return (
        <svg
          viewBox="0 0 120 120"
          className={styles.artworkSvg}
          aria-hidden="true"
        >
          <rect width="120" height="120" rx="16" fill="#d9d2c9" />
          {/* Black Korean stone bowl */}
          <circle cx="60" cy="60" r="52" fill="#1c1b1a" />
          <circle cx="60" cy="60" r="44" fill="#b82914" />
          {/* Spicy red-orange broth & noodles */}
          <circle cx="60" cy="60" r="40" fill="#df3e18" />
          <path
            d="M32 58 Q48 42 64 58 T92 56 M30 70 Q50 56 68 72 T90 68 M36 46 Q54 34 74 48"
            stroke="#f59b23"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Seafood / shrimp / toppings */}
          <circle cx="45" cy="46" r="8" fill="#ff7940" />
          <circle cx="76" cy="48" r="8" fill="#f7c46c" />
          <circle cx="42" cy="72" r="9" fill="#f26430" />
          <circle cx="72" cy="74" r="9" fill="#ff8547" />
          {/* Green scallions in center */}
          <circle cx="58" cy="56" r="9" fill="#389e26" />
          <circle cx="63" cy="60" r="7" fill="#52bf3b" />
        </svg>
      );

    case "an-vat-5k":
      return (
        <svg
          viewBox="0 0 120 120"
          className={styles.artworkSvg}
          aria-hidden="true"
        >
          <rect width="120" height="120" rx="16" fill="#f6e6cf" />
          <circle cx="60" cy="60" r="48" fill="#ffffff" />
          <circle cx="46" cy="50" r="12" fill="#f39c12" />
          <circle cx="68" cy="46" r="12" fill="#e67e22" />
          <circle cx="54" cy="70" r="12" fill="#d35400" />
          <circle cx="74" cy="68" r="11" fill="#f1c40f" />
          <circle cx="40" cy="68" r="8" fill="#2ecc71" />
        </svg>
      );

    default:
      return null;
  }
}

export default function OrderFoodMedia({
  artwork = "food",
  kind = "food",
  imageUrl,
  small = false,
  className = "",
}: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const customSvg = renderArtworkSvg(artwork);

  return (
    <div
      className={[
        styles.foodPlaceholder,
        kind === "drink" ? styles.drinkPlaceholder : "",
        small ? styles.smallPlaceholder : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-artwork={artwork}
      aria-hidden="true"
    >
      {imageUrl && imageUrl !== failedUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes={small ? "44px" : "88px"}
          className={styles.foodImage}
          unoptimized
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : customSvg ? (
        customSvg
      ) : kind === "drink" ? (
        <Milk />
      ) : (
        <Utensils />
      )}
    </div>
  );
}
