import { ReceiptText, Store, Zap } from "lucide-react";

type Props = {
  mode?: "register" | "login";
};

const registerFeatures = [
  {
    icon: Zap,
    title: "Đặt món tiện lợi",
    description: "Tìm món ngon quanh khu ký túc xá nhanh chóng.",
  },
  {
    icon: Store,
    title: "Tạo cửa hàng sau này",
    description:
      "Khi muốn bán hàng, bạn có thể chuyển tài khoản sang người bán.",
  },
  {
    icon: ReceiptText,
    title: "Quản lý đơn dễ dàng",
    description: "Theo dõi đơn hiện tại và xem lại lịch sử đặt món.",
  },
];

const loginFeatures = [
  {
    icon: Zap,
    title: "Đặt món nhanh chóng",
    description: "Chỉ vài thao tác, món ngon đến ngay.",
  },
  {
    icon: Store,
    title: "Tạo cửa hàng khi muốn bán hàng",
    description: "Dễ dàng, miễn phí, dành cho sinh viên.",
  },
  {
    icon: ReceiptText,
    title: "Theo dõi đơn hàng dễ dàng",
    description: "Cập nhật trạng thái real-time, mọi lúc mọi nơi.",
  },
];

export default function AuthIntro({ mode = "register" }: Props) {
  const isLogin = mode === "login";
  const features = isLogin ? loginFeatures : registerFeatures;

  return (
    <section className="h-full bg-gradient-to-br from-[#fffcf8] to-[#fff5eb] p-7 sm:p-10 lg:p-12">
      <p className="inline-flex rounded-full bg-[#ffeadf] px-5 py-2 text-sm font-medium text-[#e94a12]">
        {isLogin
          ? "Ăn ngon • Tiết kiệm • Kết nối sinh viên"
          : "Một tài khoản • Đặt món • Tạo cửa hàng"}
      </p>

      <h2 className="mt-7 text-4xl leading-[1.12] font-bold tracking-tight sm:text-5xl">
        {isLogin ? "Đăng nhập vào" : "Bắt đầu cùng"}
        <br />
        Student<span className="text-[#ff4d0a]">Food</span>
      </h2>

      <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#526a9e]">
        {isLogin
          ? "Nền tảng đặt món và kết nối ẩm thực dành riêng cho sinh viên. Ngon hơn mỗi ngày, gần nhau hơn mỗi bữa ăn."
          : "Chỉ với một tài khoản, bạn có thể dễ dàng đặt những món ăn yêu thích ngay hôm nay và tạo cửa hàng khi muốn bán hàng trong tương lai."}
      </p>

      <ul className="mt-8 space-y-6">
        {features.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex items-start gap-5">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#ffe8db] text-[#ff531b]">
              <Icon
                size={31}
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </span>

            <div className="pt-1">
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-1 leading-relaxed text-[#526a9e]">
                {description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}