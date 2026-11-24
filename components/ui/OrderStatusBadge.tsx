import { CircleCheck, CircleX, Clock3 } from "lucide-react";
import {
  orderStatusLabels,
  type OrderDetailStatus,
} from "@/lib/orders/order-detail";

type Props = {
  status: OrderDetailStatus;
  className?: string;
  iconSize?: number;
};

export default function OrderStatusBadge({
  status,
  className,
  iconSize = 20,
}: Props) {
  const Icon =
    status === "pending"
      ? Clock3
      : status === "cancelled" || status === "rejected"
        ? CircleX
        : CircleCheck;

  return (
    <span className={className}>
      <Icon size={iconSize} aria-hidden="true" />
      {orderStatusLabels[status]}
    </span>
  );
}
