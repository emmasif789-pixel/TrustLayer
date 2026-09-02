"use client";

interface HistoryItem {
  id: string;
  input_raw: string;
  overall_score: number;
  verdict_label: string;
  created_at: string;
}

export default function HistorySidebar({
  items,
  onSelect,
}: {
  items: HistoryItem[];
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-xs text-ink-soft surface-flat p-5">
        Your analysis history will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className="w-full text-left surface-flat surface-hover p-4 transition-all duration-300 hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm">{item.overall_score}</span>
            <span className="text-xs text-ink-soft">{new Date(item.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-xs text-ink-soft mt-1.5 line-clamp-2 leading-relaxed">{item.input_raw}</p>
        </button>
      ))}
    </div>
  );
}
