"use client";

import Image from "next/image";
import { useState } from "react";
import { CookingPot, CupSoda, Drumstick, Sandwich, Soup } from "lucide-react";
import type { PreviewRestaurant } from "@/lib/home/mock-data";
import styles from "@/styles/home.module.css";

const icons = {
  rice: CookingPot,
  tea: CupSoda,
  noodles: Soup,
  spicy: Soup,
  bread: Sandwich,
  chicken: Drumstick,
};

export default function FoodPlaceholder({
  restaurant,
  small = false,
}: {
  restaurant: Pick<PreviewRestaurant, "illustration" | "avatar_url">;
  small?: boolean;
}) {
  const Icon = icons[restaurant.illustration];
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = restaurant.avatar_url;

  return (
    <div
      className={`${styles.foodPlaceholder} ${small ? styles.smallPlaceholder : ""}`}
      data-illustration={restaurant.illustration}
      aria-hidden="true"
    >
      {imageUrl && imageUrl !== failedUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes={small ? "68px" : "(max-width: 760px) 45vw, 20vw"}
          className={styles.foodImage}
          unoptimized
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <>
          <span className={styles.placeholderCircle} />
          <Icon strokeWidth={1.25} />
        </>
      )}
    </div>
  );
}
