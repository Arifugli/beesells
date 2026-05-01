import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { formatMonth, currentMonth } from "@/lib/utils";

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  const { data: availableMonths = [] } = useQuery({
    queryKey: ["archive-months"],
    queryFn: api.archive.months,
    staleTime: 60_000,
  });

  const all = Array.from(new Set([...availableMonths, currentMonth(), value])).sort().reverse();
  const idx = all.indexOf(value);
  const canPrev = idx < all.length - 1;
  const canNext = idx > 0;

  return (
    <div className="inline-flex items-center rounded-lg border border-[#E0E0E0] bg-white overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <button onClick={() => canPrev && onChange(all[idx + 1])} disabled={!canPrev}
        className="h-9 w-9 flex items-center justify-center text-[#888] hover:bg-[#F5F5F5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="relative flex items-center border-x border-[#E0E0E0]">
        <Calendar className="w-3.5 h-3.5 text-[#FFD200] absolute left-2.5 pointer-events-none" />
        <select value={value} onChange={e => onChange(e.target.value)}
          className="h-9 pl-8 pr-3 bg-transparent text-sm font-semibold text-[#1A1A1A] cursor-pointer focus:outline-none appearance-none min-w-[190px]">
          {all.map(m => (
            <option key={m} value={m}>
              {formatMonth(m)}{m === currentMonth() ? " (текущий)" : ""}
            </option>
          ))}
        </select>
      </div>
      <button onClick={() => canNext && onChange(all[idx - 1])} disabled={!canNext}
        className="h-9 w-9 flex items-center justify-center text-[#888] hover:bg-[#F5F5F5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
