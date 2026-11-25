import { useId } from "react";
import styles from "@/styles/shipper-loader.module.css";

type ShipperLoaderProps = {
  label?: string;
  subtitle?: string;
  fullPage?: boolean;
  overlay?: boolean;
};

export default function ShipperLoader({
  label,
  subtitle,
  fullPage = false,
  overlay = false,
}: ShipperLoaderProps) {
  const clipId = useId();
  const message = label ?? subtitle ?? "Đang tải dữ liệu…";

  const wrapperClass = [
    styles.wrapper,
    fullPage ? styles.fullPage : "",
    overlay ? styles.overlay : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass} role="status" aria-live="polite">
      <div className={styles.stage} aria-hidden="true">
        <svg
          className={styles.svg}
          viewBox="14 24 190 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Nền tròn ấm nhẹ làm nổi bật nhân vật */}
          <ellipse cx="116" cy="100" rx="82" ry="52" fill="#FFF3E0" />

          {/* Mặt đường & vạch kẻ chạy */}
          <rect x="20" y="148" width="178" height="12" rx="6" fill="#EBD7BC" />
          <clipPath id={clipId}>
            <rect x="24" y="148" width="170" height="12" rx="6" />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            <g className={styles.roadDashes}>
              <rect x="14" y="152.5" width="16" height="3" rx="1.5" fill="#FFFFFF" />
              <rect x="44" y="152.5" width="16" height="3" rx="1.5" fill="#FFFFFF" />
              <rect x="74" y="152.5" width="16" height="3" rx="1.5" fill="#FFFFFF" />
              <rect x="104" y="152.5" width="16" height="3" rx="1.5" fill="#FFFFFF" />
              <rect x="134" y="152.5" width="16" height="3" rx="1.5" fill="#FFFFFF" />
              <rect x="164" y="152.5" width="16" height="3" rx="1.5" fill="#FFFFFF" />
              <rect x="194" y="152.5" width="16" height="3" rx="1.5" fill="#FFFFFF" />
            </g>
          </g>

          {/* Vệt gió & khói ống xả */}
          <g className={styles.windGroup} stroke="#B89B7D" strokeWidth="2.4" strokeLinecap="round">
            <line x1="66" y1="53" x2="88" y2="53" />
            <line x1="28" y1="78" x2="41" y2="78" />
            <line x1="22" y1="90" x2="38" y2="90" />
          </g>
          <g className={styles.exhaustPuff} stroke="#B89B7D" strokeWidth="2.3" strokeLinecap="round" fill="none">
            <path d="M58 136C51 136 47 132 42 134C38 135 37 139 40 140" />
            <path d="M62 142C55 142 50 144 45 142" />
          </g>

          {/* Bánh sau (tâm tại 82, 134) */}
          <g className={styles.wheel}>
            <circle cx="82" cy="134" r="15.5" fill="#5D4D45" stroke="#533728" strokeWidth="2.8" />
            <circle cx="82" cy="134" r="9.2" fill="#DCC7AA" stroke="#533728" strokeWidth="2" />
            <line x1="82" y1="125" x2="82" y2="143" stroke="#533728" strokeWidth="1.9" />
            <line x1="73" y1="134" x2="91" y2="134" stroke="#533728" strokeWidth="1.9" />
            <circle cx="82" cy="134" r="3.4" fill="#8C7768" stroke="#533728" strokeWidth="1.6" />
          </g>

          {/* Bánh trước (tâm tại 175, 134) */}
          <g className={styles.wheel}>
            <circle cx="175" cy="134" r="15.5" fill="#5D4D45" stroke="#533728" strokeWidth="2.8" />
            <circle cx="175" cy="134" r="9.2" fill="#DCC7AA" stroke="#533728" strokeWidth="2" />
            <line x1="175" y1="125" x2="175" y2="143" stroke="#533728" strokeWidth="1.9" />
            <line x1="166" y1="134" x2="184" y2="134" stroke="#533728" strokeWidth="1.9" />
            <circle cx="175" cy="134" r="3.4" fill="#8C7768" stroke="#533728" strokeWidth="1.6" />
          </g>

          {/* Thân xe, thùng giao hàng & shipper */}
          <g className={styles.scooterBody}>
            <path d="M46 105H92" stroke="#533728" strokeWidth="3.2" strokeLinecap="round" />
            <rect x="46" y="71" width="42" height="33" rx="4" fill="#F49D3F" stroke="#533728" strokeWidth="2.6" />
            <rect x="44" y="67" width="46" height="8" rx="3" fill="#F8B65E" stroke="#533728" strokeWidth="2.6" />
            <rect x="52" y="67" width="5" height="37" fill="#6F4C39" stroke="#533728" strokeWidth="1.4" />
            <rect x="77" y="67" width="5" height="37" fill="#6F4C39" stroke="#533728" strokeWidth="1.4" />
            <path d="M61.5 91.5C61.5 95 64 97.5 67 97.5C70 97.5 72.5 95 72.5 91.5H61.5Z" fill="#FFF8EE" stroke="#533728" strokeWidth="1.3" />
            <path d="M63 91.5C64 89.5 70 89.5 71 91.5" fill="#FFF8EE" stroke="#533728" strokeWidth="1.2" />
            <path d="M68.5 89L73 84.5" stroke="#533728" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M65 86V83.5M67 85.5V83M69 86V84" stroke="#FFF8EE" strokeWidth="1.2" strokeLinecap="round" />

            <rect
              x="66"
              y="129"
              width="27"
              height="9"
              rx="4.5"
              transform="rotate(-7 66 129)"
              fill="#BCC5CE"
              stroke="#533728"
              strokeWidth="2.2"
            />

            <path
              d="M66 125C68 109 80 105 97 107L117 108L114 132L76 132C71 132 66 129 66 125Z"
              fill="#F7E4BC"
              stroke="#533728"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path d="M66 114C63 114 62 119 65 122L69 120L69 114Z" fill="#D94B38" stroke="#533728" strokeWidth="2" />
            <path
              d="M110 132H147C152 132 154 127 153 121L146 120L142 127H111Z"
              fill="#EBD2A0"
              stroke="#533728"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <path
              d="M89 105C93 99 112 99 124 103C126 106 121 110 113 110L90 109C88 109 87 107 89 105Z"
              fill="#7A4F3A"
              stroke="#533728"
              strokeWidth="2.4"
            />
            <path
              d="M146 132L152 72C153 66 161 66 163 72L168 122C163 125 156 129 152 132Z"
              fill="#F7E4BC"
              stroke="#533728"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path
              d="M156 128C161 116 184 115 191 128C182 127 166 128 156 128Z"
              fill="#F7E4BC"
              stroke="#533728"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <ellipse cx="163" cy="70" rx="3.8" ry="5.5" fill="#FFF9DE" stroke="#533728" strokeWidth="2.1" />
            <path d="M153 66L149 55" stroke="#533728" strokeWidth="2.2" strokeLinecap="round" />
            <ellipse cx="147.5" cy="52" rx="4.5" ry="5.8" transform="rotate(-18 147.5 52)" fill="#E3EAF0" stroke="#533728" strokeWidth="2.1" />
            <path d="M155 71L143 72" stroke="#533728" strokeWidth="3.2" strokeLinecap="round" />
            <rect x="139" y="69.5" width="8" height="4.5" rx="2.2" fill="#7A4F3A" stroke="#533728" strokeWidth="1.8" />

            <path
              d="M105 95C113 94 123 99 133 105C136 107 137 111 136 117L134 129H122L123 113L106 106Z"
              fill="#4E7394"
              stroke="#533728"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path
              d="M122 128C121 125 128 124 134 126L142 129C144 130 144 133 141 134H122C120 134 120 130 122 128Z"
              fill="#7A4C36"
              stroke="#533728"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path d="M122 134H142" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />

            <path
              d="M99 67C103 60 116 60 121 66L124 96C116 99 102 99 95 95L99 67Z"
              fill="#51A76D"
              stroke="#533728"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path d="M100 66C106 62 114 62 119 66L117 75L101 75Z" fill="#F49D3F" stroke="#533728" strokeWidth="1.8" />
            <path
              d="M111 71L125 81L142 75L143 81L125 89C122 90 118 89 115 86L107 78Z"
              fill="#59B276"
              stroke="#533728"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <circle cx="143" cy="76" r="4" fill="#FBD3B3" stroke="#533728" strokeWidth="2.1" />

            <circle cx="122" cy="49" r="12.5" fill="#FBD3B3" stroke="#533728" strokeWidth="2.5" />
            <circle cx="129.5" cy="48.5" r="1.6" fill="#533728" />
            <circle cx="127" cy="52" r="2.2" fill="#F49B86" opacity="0.55" />
            <path d="M128 54.5C130 56 132.5 55.5 133.5 53.5" stroke="#533728" strokeWidth="1.7" strokeLinecap="round" />

            <path
              d="M105 49C104 37 113 29 124 30C132 31 137 37 137 44L126 44C121 44 117 47 117 52C117 55 113 58 109 56C107 55 105 52 105 49Z"
              fill="#4EA66D"
              stroke="#533728"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path d="M112 43C117 39 124 39 135 41" stroke="#F49D3F" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M135 42L144 44.5L135 45.5Z" fill="#6F4C39" stroke="#533728" strokeWidth="2" strokeLinejoin="round" />
            <path d="M119 56L121 62" stroke="#533728" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      <p className={styles.label}>
        {message}
        <span className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </p>
    </div>
  );
}
