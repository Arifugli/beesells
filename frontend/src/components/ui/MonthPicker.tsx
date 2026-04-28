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
    staleTime: 60_000, // refetch at most every 60s
  });

  // Always allow navigating into current + 1 past month even if no archive yet
  const all = Array.from(new Set([...availableMonths, currentMonth(), value])).sort().reverse();
  const idx = all.indexOf(value);
  const canPrev = idx < all.length - 1;
  const canNext = idx > 0;

  const prevMonth = () => canPrev && onChange(all[idx + 1]);
  const nextMonth = () => canNext && onChange(all[idx - 1]);

  return (
    <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm">
      <button
        onClick={prevMonth}
        disabled={!canPrev}
        className="h-9 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-l-lg transition-colors"
        title="Предыдущий месяц"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="relative flex items-center">
        <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-3 pointer-events-none" />
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-9 pl-8 pr-3 bg-transparent text-sm font-medium capitalize cursor-pointer focus:outline-none appearance-none min-w-[180px]"
        >
          {all.map(m => (
            <option key={m} value={m}>
              {formatMonth(m)}{m === currentMonth() ? " (текущий)" : ""}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={nextMonth}
        disabled={!canNext}
        className="h-9 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-r-lg transition-colors"
        title="Следующий месяц"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
