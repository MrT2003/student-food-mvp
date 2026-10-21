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
  slug = "",
}: {
  drink: boolean;
  imageUrl?: string | null;
  alt?: string;
  slug?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const validUrl = imageUrl && imageUrl !== failedUrl ? imageUrl : null;

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
      ) : drink ? (
        <MilkTeaHeroSvg slug={slug} />
      ) : (
        <RiceDishHeroSvg slug={slug} />
      )}
    </div>
  );
}

function MilkTeaHeroSvg({ slug }: { slug?: string }) {
  const isFruitTea = /tra-dao|tra-tac/.test(slug ?? "");

  return (
    <svg
      viewBox="0 0 240 240"
      className={styles.heroSvg}
      role="img"
      aria-label="Minh họa đồ uống"
    >
      <defs>
        <linearGradient id="mt-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6f4324" />
          <stop offset="52%" stopColor="#9d6840" />
          <stop offset="100%" stopColor="#5b3419" />
        </linearGradient>
        <linearGradient id="mt-table" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9aa78" />
          <stop offset="50%" stopColor="#b97b45" />
          <stop offset="100%" stopColor="#7f4b21" />
        </linearGradient>
        <linearGradient id="mt-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isFruitTea ? "#f8a73f" : "#f7d5b1"} />
          <stop offset="35%" stopColor={isFruitTea ? "#ee7b22" : "#e8ab74"} />
          <stop offset="75%" stopColor={isFruitTea ? "#d35413" : "#d98c4e"} />
          <stop offset="100%" stopColor="#7b431f" />
        </linearGradient>
        <radialGradient id="mt-bokeh" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe5c2" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffe5c2" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Warm café background */}
      <rect width="240" height="240" fill="url(#mt-bg)" />
      <circle cx="48" cy="46" r="28" fill="url(#mt-bokeh)" />
      <circle cx="195" cy="58" r="36" fill="url(#mt-bokeh)" />
      <circle cx="152" cy="28" r="22" fill="url(#mt-bokeh)" />

      {/* Wooden tabletop */}
      <path d="M0 154 L240 154 L240 240 L0 240 Z" fill="url(#mt-table)" />
      <path
        d="M0 178 L240 184 M0 208 L240 212"
        stroke="#6d3c16"
        strokeWidth="1.5"
        opacity="0.35"
      />

      {/* Soft cloth napkin on right */}
      <path
        d="M174 166 Q204 156 238 172 L240 205 Q196 206 168 188 Z"
        fill="#f3ece2"
        opacity="0.92"
      />
      <path
        d="M180 174 Q206 168 234 180"
        stroke="#d6cabe"
        strokeWidth="2"
        fill="none"
      />

      {/* Small bowl of black pearls on bottom-left */}
      <ellipse cx="26" cy="186" rx="34" ry="14" fill="#3a281d" />
      <path
        d="M-6 174 Q26 206 58 174 L52 194 Q26 212 0 194 Z"
        fill="#5b4638"
      />
      <ellipse cx="26" cy="174" rx="32" ry="11" fill="#22150e" />
      <circle cx="14" cy="172" r="4.5" fill="#0d0806" />
      <circle cx="24" cy="170" r="4.8" fill="#170e0a" />
      <circle cx="34" cy="173" r="4.5" fill="#0d0806" />
      <circle cx="20" cy="176" r="4.5" fill="#1c120d" />
      <circle cx="30" cy="177" r="4.3" fill="#0e0906" />
      <circle cx="41" cy="175" r="4" fill="#1b110c" />

      {/* Cup shadow */}
      <ellipse cx="122" cy="212" rx="48" ry="11" fill="#3c1e09" opacity="0.45" />

      {/* Black boba straw */}
      <path d="M126 18 L141 20 L127 78 L113 76 Z" fill="#181514" />
      <path d="M129 18 L133 19 L120 77 L116 76 Z" fill="#3b3533" opacity="0.7" />

      {/* Transparent cup body */}
      <path
        d="M66 64 L176 64 L158 202 C157 209, 148 214, 121 214 C94 214, 85 209, 84 202 Z"
        fill="url(#mt-body)"
      />

      {/* Milk swirl & ice cubes at top of cup */}
      <path
        d="M72 72 Q96 86 121 74 Q146 64 170 74 L166 108 Q140 94 118 106 Q92 116 75 98 Z"
        fill="#faead7"
        opacity="0.65"
      />
      <rect
        x="82"
        y="68"
        width="22"
        height="16"
        rx="4"
        fill="#ffffff"
        opacity="0.55"
        transform="rotate(-8 82 68)"
      />
      <rect
        x="132"
        y="70"
        width="24"
        height="16"
        rx="4"
        fill="#ffffff"
        opacity="0.5"
        transform="rotate(7 132 70)"
      />

      {/* GOOD DAY logo emblem in middle of cup */}
      <path
        d="M101 116 L121 105 L141 116 L137 131 L124 123 L124 134 L118 134 L118 123 L105 131 Z"
        fill="#161210"
      />
      <text
        x="121"
        y="145"
        textAnchor="middle"
        fill="#161210"
        fontSize="10"
        fontWeight="800"
        letterSpacing="1"
      >
        GOOD
      </text>
      <text
        x="121"
        y="155"
        textAnchor="middle"
        fill="#161210"
        fontSize="9"
        fontWeight="800"
        letterSpacing="1.2"
      >
        DAY
      </text>

      {/* Tapioca pearls at bottom of cup */}
      {[
        [92, 176],
        [106, 179],
        [121, 177],
        [136, 180],
        [149, 175],
        [89, 189],
        [101, 191],
        [114, 189],
        [128, 191],
        [141, 189],
        [152, 187],
        [93, 201],
        [106, 203],
        [119, 202],
        [132, 203],
        [145, 200],
      ].map(([cx, cy], idx) => (
        <g key={idx}>
          <circle cx={cx} cy={cy} r="5.4" fill="#18100c" />
          <circle cx={cx - 1.6} cy={cy - 1.6} r="1.5" fill="#6e4b35" opacity="0.7" />
        </g>
      ))}

      {/* Clear plastic rim at top of cup */}
      <ellipse
        cx="121"
        cy="64"
        rx="58"
        ry="11"
        fill="#ffffff"
        fillOpacity="0.28"
        stroke="#f7efe6"
        strokeWidth="2.5"
      />
      <path
        d="M68 66 L85 202"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.38"
      />
    </svg>
  );
}

function RiceDishHeroSvg({ slug }: { slug?: string }) {
  const isNoodle = /bun|mi-cay|pho/.test(slug ?? "");

  return (
    <svg
      viewBox="0 0 240 240"
      className={styles.heroSvg}
      role="img"
      aria-label="Minh họa món ăn"
    >
      <defs>
        <linearGradient id="food-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9c6438" />
          <stop offset="50%" stopColor="#7c4923" />
          <stop offset="100%" stopColor="#522d13" />
        </linearGradient>
        <radialGradient id="food-plate" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="82%" stopColor="#f5f0e8" />
          <stop offset="100%" stopColor="#dfd6c9" />
        </radialGradient>
        <linearGradient id="food-rib" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d96b27" />
          <stop offset="55%" stopColor="#a84210" />
          <stop offset="100%" stopColor="#6e2606" />
        </linearGradient>
      </defs>

      <rect width="240" height="240" fill="url(#food-wood)" />
      <circle cx="120" cy="122" r="96" fill="#2e2118" opacity="0.28" />
      <circle cx="120" cy="120" r="92" fill="url(#food-plate)" />
      <circle
        cx="120"
        cy="120"
        r="82"
        fill="none"
        stroke="#e4dcd0"
        strokeWidth="2"
      />

      {isNoodle ? (
        <>
          <circle cx="120" cy="120" r="76" fill="#c83e1b" />
          <path
            d="M72 112 Q105 86 138 112 T174 108 M68 134 Q104 108 140 134 T172 130"
            stroke="#f7b441"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="96" cy="92" r="16" fill="#ff7f47" />
          <circle cx="146" cy="96" r="15" fill="#f7d27a" />
          <circle cx="120" cy="122" r="16" fill="#41a62a" />
        </>
      ) : (
        <>
          {/* Fluffy white steamed rice mound */}
          <ellipse cx="92" cy="105" rx="44" ry="38" fill="#ffffff" />
          <ellipse cx="92" cy="105" rx="40" ry="34" fill="#fbf9f5" />
          <circle cx="84" cy="96" r="4" fill="#46a829" />
          <circle cx="96" cy="102" r="3.5" fill="#46a829" />
          <circle cx="90" cy="110" r="3.5" fill="#5ec23d" />

          {/* Grilled caramelized pork chop / ribs (Sườn nướng) */}
          <path
            d="M112 108 C126 88, 174 92, 184 118 C192 142, 168 176, 132 174 C104 172, 98 130, 112 108 Z"
            fill="url(#food-rib)"
          />
          <path
            d="M124 118 L168 126 M120 134 L166 142 M122 150 L156 156"
            stroke="#4d1803"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.65"
          />

          {/* Sunny-side up egg (Trứng ốp la) */}
          <ellipse cx="78" cy="156" rx="28" ry="22" fill="#ffffff" />
          <circle cx="80" cy="156" r="11" fill="#ff9f1a" />
          <circle cx="77" cy="153" r="4" fill="#ffd275" opacity="0.8" />

          {/* Cucumber & tomato slices */}
          <circle cx="144" cy="68" r="15" fill="#52b836" />
          <circle cx="144" cy="68" r="9" fill="#c5f2af" />
          <circle cx="166" cy="78" r="14" fill="#46a62b" />
          <circle cx="166" cy="78" r="8" fill="#c5f2af" />
          <circle cx="118" cy="64" r="13" fill="#e83825" />
          <circle cx="118" cy="64" r="7" fill="#ff8370" />

          {/* Dipping fish sauce bowl (Nước mắm) */}
          <circle cx="174" cy="166" r="18" fill="#ffffff" stroke="#e2d9cc" strokeWidth="2" />
          <circle cx="174" cy="166" r="13" fill="#d9531e" />
          <circle cx="171" cy="164" r="2.5" fill="#ff2a14" />
          <circle cx="178" cy="168" r="2" fill="#ffe194" />
        </>
      )}
    </svg>
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
        {/* Cute flan pudding icon matching mockup */}
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
        {/* Cup with straw & golden drink matching mockup */}
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
        {/* Blue 3D stacked ice cubes matching mockup */}
        {/* Top cube */}
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
        {/* Bottom-left cube */}
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
        {/* Bottom-right cube */}
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
          {/* Caramel sauce pool */}
          <ellipse cx="32" cy="42" rx="18" ry="6.5" fill="#8f3911" />
          {/* Golden flan body */}
          <path
            d="M17 40 L21 21 C22 17, 42 17, 43 21 L47 40 C43 44, 21 44, 17 40 Z"
            fill="#f7be52"
          />
          {/* Dark caramel top */}
          <ellipse cx="32" cy="20" rx="11" ry="4.2" fill="#5e2107" />
          <path
            d="M22 21 Q26 27 29 22 Q33 28 36 22 Q40 26 42 21"
            fill="#6e2809"
          />
        </svg>
      );

    case "extra-rice":
      return (
        <svg viewBox="0 0 64 64" className={styles.optionSvg} aria-hidden="true">
          <ellipse cx="32" cy="50" rx="20" ry="5" fill="#e5ebf5" />
          <path
            d="M12 28 C14 14, 50 14, 52 28 Z"
            fill="#ffffff"
            stroke="#dce4f2"
            strokeWidth="1.5"
          />
          <circle cx="26" cy="22" r="2" fill="#d8e0ed" />
          <circle cx="34" cy="20" r="2" fill="#d8e0ed" />
          <circle cx="38" cy="24" r="2" fill="#d8e0ed" />
          <path
            d="M10 28 L54 28 L48 46 C46 50, 18 50, 16 46 Z"
            fill="#ff6a28"
          />
          <path d="M13 33 L51 33" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
        </svg>
      );

    case "extra-soup":
      return (
        <svg viewBox="0 0 64 64" className={styles.optionSvg} aria-hidden="true">
          <ellipse cx="32" cy="34" rx="24" ry="18" fill="#2c3545" />
          <ellipse cx="32" cy="32" rx="21" ry="15" fill="#f5bd58" />
          <circle cx="24" cy="30" r="5" fill="#2d7a31" />
          <circle cx="37" cy="34" r="5.5" fill="#2d7a31" />
          <circle cx="32" cy="26" r="3.5" fill="#ffffff" />
          <circle cx="27" cy="36" r="3.5" fill="#ffffff" />
          <circle cx="40" cy="27" r="2" fill="#5cd65c" />
        </svg>
      );

    case "extra-ribs":
      return (
        <svg viewBox="0 0 64 64" className={styles.optionSvg} aria-hidden="true">
          <circle cx="32" cy="34" r="24" fill="#f7efe6" />
          <path
            d="M14 32 C16 18, 44 16, 50 28 C54 38, 42 50, 24 46 C14 44, 12 38, 14 32 Z"
            fill="#b84714"
          />
          <path
            d="M21 26 L43 30 M19 33 L42 37 M22 40 L37 42"
            stroke="#591c04"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="30" cy="29" r="2.2" fill="#4cd964" />
          <circle cx="35" cy="34" r="2" fill="#4cd964" />
        </svg>
      );

    case "extra-egg":
      return (
        <svg viewBox="0 0 64 64" className={styles.optionSvg} aria-hidden="true">
          <circle cx="32" cy="34" r="24" fill="#eef4fc" />
          <path
            d="M14 33 C14 20, 28 14, 41 18 C52 22, 54 36, 46 45 C37 53, 14 48, 14 33 Z"
            fill="#ffffff"
            stroke="#e5dec9"
            strokeWidth="1.5"
          />
          <circle cx="33" cy="33" r="10" fill="#ff9500" />
          <circle cx="30" cy="30" r="3" fill="#ffe082" />
        </svg>
      );

    case "extra-pork-skin":
      return (
        <svg viewBox="0 0 64 64" className={styles.optionSvg} aria-hidden="true">
          <circle cx="32" cy="34" r="23" fill="#faf3e8" stroke="#e4d6c3" strokeWidth="1.5" />
          <path
            d="M18 30 Q30 18 44 28 M16 36 Q32 24 46 35 M20 42 Q33 32 44 41 M22 25 Q34 36 42 24"
            stroke="#d99b4e"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="28" cy="31" r="2" fill="#3eb52c" />
          <circle cx="36" cy="35" r="2" fill="#3eb52c" />
        </svg>
      );

    case "extra-meatloaf":
      return (
        <svg viewBox="0 0 64 64" className={styles.optionSvg} aria-hidden="true">
          <circle cx="32" cy="34" r="23" fill="#f4f7fc" />
          <path
            d="M14 27 L48 22 C52 29, 50 42, 43 46 L14 40 Z"
            fill="#f2d29b"
            stroke="#d49b4b"
            strokeWidth="1.5"
          />
          <path d="M14 27 L48 22 L49 27 L14 32 Z" fill="#e67e22" />
          <circle cx="26" cy="35" r="1.8" fill="#8c6239" />
          <circle cx="35" cy="33" r="1.8" fill="#8c6239" />
          <circle cx="40" cy="38" r="1.8" fill="#8c6239" />
        </svg>
      );

    case "extra-fish-sauce":
      return (
        <svg viewBox="0 0 64 64" className={styles.optionSvg} aria-hidden="true">
          <circle cx="32" cy="34" r="22" fill="#ffffff" stroke="#d5e0f2" strokeWidth="2" />
          <circle cx="32" cy="34" r="16" fill="#d9531e" />
          <circle cx="27" cy="30" r="3" fill="#ff2a14" />
          <circle cx="37" cy="36" r="3" fill="#ff2a14" />
          <circle cx="34" cy="28" r="2" fill="#fff2b2" />
          <circle cx="28" cy="38" r="2" fill="#fff2b2" />
        </svg>
      );

    case "extra-cutlery":
      return (
        <svg viewBox="0 0 64 64" className={styles.optionSvg} aria-hidden="true">
          <circle cx="32" cy="34" r="23" fill="#edf4ff" />
          {/* Spoon */}
          <ellipse cx="24" cy="21" rx="5.5" ry="7.5" fill="#5475b8" />
          <rect x="22.5" y="27" width="3" height="22" rx="1.5" fill="#5475b8" />
          {/* Chopsticks */}
          <path d="M36 14 L39 14 L37.5 49 L35.5 49 Z" fill="#c97a3e" />
          <path d="M42 14 L45 14 L43.5 49 L41.5 49 Z" fill="#b3652b" />
        </svg>
      );

    default:
      return <CookingPot size={28} strokeWidth={1.5} aria-hidden="true" />;
  }
}
