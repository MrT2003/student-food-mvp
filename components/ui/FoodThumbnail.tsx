import { CookingPot, CupSoda } from "lucide-react";

type Props = {
  kind: "food" | "drink";
  className?: string;
};

export default function FoodThumbnail({ kind, className }: Props) {
  const Icon = kind === "drink" ? CupSoda : CookingPot;

  return (
    <div className={className} aria-hidden="true">
      <Icon strokeWidth={1.4} />
    </div>
  );
}
