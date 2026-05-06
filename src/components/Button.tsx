import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
};

const variants = {
  primary: "bg-navy-700 text-white hover:bg-navy-800 focus:ring-navy-200",
  secondary:
    "border border-navy-100 bg-white text-navy-800 hover:bg-navy-50 focus:ring-navy-100",
  ghost: "bg-transparent text-navy-800 hover:bg-navy-50 focus:ring-navy-100",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-200",
};

export function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${
        variants[variant]
      } ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
