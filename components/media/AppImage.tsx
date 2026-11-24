import NextImage, { type ImageProps } from "next/image";
import { cloudinaryDeliveryUrl } from "@/lib/cloudinary/delivery";

/** Cloudinary tự chọn format theo Accept của browser; không đi qua bộ nén Next lần nữa. */
export default function AppImage({ src, unoptimized, ...props }: ImageProps) {
  const delivery = typeof src === "string" ? cloudinaryDeliveryUrl(src) : src;
  const cloudinaryOptimized = typeof delivery === "string" && delivery.includes("/image/upload/f_auto,q_auto/");
  return <NextImage {...props} src={delivery} unoptimized={cloudinaryOptimized || unoptimized} />;
}
