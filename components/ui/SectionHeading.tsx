import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
};

export default function SectionHeading({
  icon,
  children,
  className,
  iconClassName,
}: Props) {
  return (
    <h2 className={className}>
      <span className={iconClassName} aria-hidden="true">
        {icon}
      </span>
      {children}
    </h2>
  );
}
