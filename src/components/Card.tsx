import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  tone?: "default" | "blue" | "amber" | "green";
};

const tones = {
  default: "border-slate-200 bg-white",
  blue: "border-navy-100 bg-navy-50",
  amber: "border-amber-200 bg-amber-50",
  green: "border-emerald-200 bg-emerald-50",
};

export function Card({ children, className = "", tone = "default" }: CardProps) {
  return (
    <section className={`rounded-lg border p-4 shadow-soft ${tones[tone]} ${className}`}>
      {children}
    </section>
  );
}
