import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

export function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
