import { Heart, ShieldCheck, Users } from "lucide-react";

type Props = {
  mode?: "register" | "login";
};

const registerBenefits = [
  {
    icon: ShieldCheck,
    title: "Đăng ký nhanh chóng",
    description: "Chỉ vài phút là có tài khoản.",
  },
  {
    icon: Users,
    title: "Cộng đồng sinh viên",
    description: "Cùng nhau khám phá những món ngon.",
  },
  {
    icon: Heart,
    title: "Sẵn sàng bán hàng",
    description: "Tạo cửa hàng dễ dàng khi bạn muốn.",
  },
];

const loginBenefits = [
  {
    icon: ShieldCheck,
    title: "Thanh toán an toàn",
    description:
      "Bảo mật thông tin, giao dịch an tâm với nhiều phương thức thanh toán.",
  },
  {
    icon: Users,
    title: "Hàng ngàn sinh viên tin dùng",
    description:
      "Đồng hành cùng cộng đồng sinh viên trên toàn quốc.",
  },
  {
    icon: Heart,
    title: "Hỗ trợ quán sinh viên",
    description:
      "Giúp các quán ăn sinh viên tiếp cận nhiều khách hàng hơn.",
  },
];

export default function AuthBenefits({ mode = "register" }: Props) {
  const benefits =
    mode === "login" ? loginBenefits : registerBenefits;

  return (
    <section
      aria-label="Lợi ích khi sử dụng StudentFood"
      className="mt-5 grid rounded-3xl border border-orange-100/70 bg-white p-5 shadow-[0_5px_25px_rgba(90,50,20,0.05)] md:grid-cols-3"
    >
      {benefits.map(({ icon: Icon, title, description }, index) => (
        <div
          key={title}
          className={[
            "flex items-center gap-4 px-3 py-4 lg:px-6",
            index > 0
              ? "border-t border-[#e1e6ef] md:border-t-0 md:border-l"
              : "",
          ].join(" ")}
        >
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#ffede3] text-[#ff531b]">
            <Icon size={32} aria-hidden="true" />
          </span>

          <div>
            <h3 className="font-bold">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#526a9e]">
              {description}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}