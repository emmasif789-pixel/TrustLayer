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
  onDelete,
  canDelete = false,
}: {
  items: HistoryItem[];
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
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
        <div key={item.id} className="group relative surface-flat surface-hover transition-all duration-300 hover:-translate-y-0.5">
          <button onClick={() => onSelect(item.id)} className="w-full text-left p-4">
            <div className="flex items-center justify-between gap-2 pr-5">
              <span className="font-mono text-sm">{item.overall_score}</span>
              <span className="text-xs text-ink-soft">{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-xs text-ink-soft mt-1.5 line-clamp-2 leading-relaxed pr-5">{item.input_raw}</p>
          </button>
          {canDelete && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="Delete"
              className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded-full text-ink-soft opacity-0 group-hover:opacity-100 transition-opacity hover:text-ink"
              style={{ background: "var(--hairline-soft)" }}
            >
              <span className="text-xs leading-none">×</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
