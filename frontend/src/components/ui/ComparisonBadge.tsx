import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ComparisonBadgeProps {
  current: number;
  previous: number;
  /** show absolute delta instead of percentage */
  absolute?: boolean;
  className?: string;
}

export function ComparisonBadge({ current, previous, absolute = false, className = "" }: ComparisonBadgeProps) {
  // No meaningful comparison if previous is 0 or missing
  if (previous === 0 && current === 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-gray-400 ${className}`}>
        <Minus className="w-3 h-3" />
        нет данных
      </span>
    );
  }

  const delta = current - previous;
  const percentDelta = previous === 0 ? 100 : Math.round((delta / previous) * 100);

  const isUp = delta > 0;
  const isZero = delta === 0;

  const color = isZero ? "text-gray-400" : isUp ? "text-emerald-600" : "text-red-500";
  const bg = isZero ? "bg-gray-100" : isUp ? "bg-emerald-50" : "bg-red-50";
  const Icon = isZero ? Minus : isUp ? TrendingUp : TrendingDown;

  const text = absolute
    ? `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`
    : `${percentDelta > 0 ? "+" : ""}${percentDelta}%`;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color} ${bg} ${className}`}>
      <Icon className="w-3 h-3" />
      {text}
    </span>
  );
}
