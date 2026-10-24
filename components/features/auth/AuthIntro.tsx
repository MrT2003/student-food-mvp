import { MapPin, ReceiptText, Store } from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Khám phá món quanh trường",
    description: "Tìm món hợp gu, gần khu học tập của bạn.",
  },
  {
    icon: Store,
    title: "Đặt món thuận tiện",
    description: "Chọn món yêu thích chỉ với vài thao tác.",
  },
  {
    icon: ReceiptText,
    title: "Theo dõi đơn dễ dàng",
    description: "Nắm bắt trạng thái và xem lại lịch sử đặt món.",
  },
];

export default function AuthIntro() {
  return (
    <section className="h-full border-b border-orange-100/70 bg-gradient-to-br from-[#fffcf8] to-[#fff5eb] p-7 sm:p-10 lg:border-r lg:border-b-0 lg:p-12">
      <p className="inline-flex rounded-full bg-[#ffeadf] px-5 py-2 text-sm font-medium text-[#e94a12]">
        Ăn ngon • Tiết kiệm • Kết nối sinh viên
      </p>

      <h2 className="mt-7 text-4xl leading-[1.15] font-bold tracking-tight text-[#0d224c] sm:text-5xl">
        Món ngon sinh viên,
        <br />
        <span className="text-[#ff4d0a]">gần bạn hơn.</span>
      </h2>

      <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#526a9e]">
        Khám phá món ngon quanh trường và tận hưởng trải nghiệm đặt món dành cho
        sinh viên.
      </p>

      <ul className="mt-8 space-y-6">
        {features.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex items-start gap-5">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#ffe8db] text-[#ff531b]">
              <Icon size={29} strokeWidth={2.2} aria-hidden="true" />
            </span>

            <div className="pt-1">
              <h3 className="text-lg font-bold text-[#0d224c]">{title}</h3>
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
