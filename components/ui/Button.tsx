import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline";
};

export default function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const variantClasses =
    variant === "primary"
      ? "border-transparent bg-[#ff531b] text-white hover:bg-[#e94713]"
      : "border-[#dce2ed] bg-white text-[#08184c] hover:bg-[#f7f9fc]";

  return (
    <button
      type={type}
      className={[
        "inline-flex min-h-14 items-center justify-center gap-3",
        "rounded-2xl border px-5 py-3 font-semibold transition",
        "focus-visible:outline-2 focus-visible:outline-offset-4",
        "focus-visible:outline-[#1677ff]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses,
        className,
      ].join(" ")}
      {...props}
    />
  );
}