import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none rounded-[var(--radius-mark)] transition-[background-color,color,border-color,box-shadow,transform] duration-150 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-[#363c35] shadow-[0_1px_0_rgba(0,0,0,0.25)]",
  accent: "bg-rust-ink text-[#fdf8f4] hover:bg-[#87392a] shadow-[0_1px_0_rgba(0,0,0,0.25)]",
  secondary: "border border-rule-strong bg-raised text-ink hover:border-ink-2 hover:bg-white",
  ghost: "text-ink-2 hover:text-ink hover:bg-sunk",
  danger: "border border-[#d9b4ab] bg-raised text-err hover:bg-err-bg",
};
const sizes: Record<Size, string> = { sm: "h-9 px-3 text-[0.8125rem]", md: "h-11 px-4 text-sm" };

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  className = "",
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode }) {
  return (
    <button {...rest} disabled={rest.disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "secondary", size = "md", icon, className = "", children, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link {...rest} className={buttonClass(variant, size, className)}>
      {icon}
      {children}
    </Link>
  );
}
