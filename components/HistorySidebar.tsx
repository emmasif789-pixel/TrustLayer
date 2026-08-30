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
      <div className="text-xs text-ink-soft border border-hairline p-4">
        Your analysis history will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-0 border border-hairline">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className="w-full text-left p-4 border-b border-hairline last:border-0 hover:bg-black/[0.02] transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm">{item.overall_score}</span>
            <span className="text-xs text-ink-soft">{new Date(item.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-xs text-ink-soft mt-1 line-clamp-2">{item.input_raw}</p>
        </button>
      ))}
    </div>
  );
}
