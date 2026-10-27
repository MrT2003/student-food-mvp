"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CookingPot,
  CupSoda,
  Drumstick,
  Sandwich,
  Soup,
} from "lucide-react";
import type { FoodKind } from "@/lib/explore/mock-data";
import styles from "@/styles/explore.module.css";

const foodIcons = {
  rice: CookingPot,
  tea: CupSoda,
  noodles: Soup,
  snack: Drumstick,
  bread: Sandwich,
};

export default function ExploreFoodPlaceholder({
  kind,
  imageUrl,
}: {
  kind: FoodKind;
  imageUrl: string | null;
}) {
  const Icon = foodIcons[kind];
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return (
    <div className={styles.placeholder} data-kind={kind} aria-hidden="true">
      {imageUrl && imageUrl !== failedUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 760px) 45vw, 20vw"
          className={styles.foodImage}
          unoptimized
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <span>
          <Icon size={36} strokeWidth={1.4} />
        </span>
      )}
    </div>
  );
}
