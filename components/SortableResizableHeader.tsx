import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

interface SortableResizableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: { key: string; direction: 'asc' | 'desc' } | null;
  requestSort: (key: string) => void;
  minWidth?: string;
  width?: number;
  onResize?: (startX: number, startWidth: number) => void;
}

export const SortableResizableHeader: React.FC<SortableResizableHeaderProps> = ({
  label,
  sortKey,
  currentSort,
  requestSort,
  minWidth = '120px',
  width,
  onResize
}) => {
  const isSorted = currentSort?.key === sortKey;
  const isAsc = isSorted && currentSort.direction === 'asc';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onResize) {
      const startWidth = e.currentTarget.parentElement?.getBoundingClientRect().width || 0;
      onResize(e.clientX, startWidth);
    }
  };

  return (
    <th 
      className="p-0 border-b border-slate-700 bg-slate-800 text-[10px] uppercase font-black tracking-widest text-slate-400 group align-middle relative"
      style={{ width: width ? `${width}px` : undefined, minWidth }}
    >
      <div className="flex items-center h-full min-h-[48px]">
        <button
          onClick={() => requestSort(sortKey)}
          className="flex items-center gap-2 px-6 py-4 hover:text-slate-200 transition-colors w-full text-left h-full"
        >
          <span className="truncate flex-1">{label}</span>
          {isSorted ? (
            isAsc ? (
              <ArrowUp size={14} className="text-blue-400 shrink-0" />
            ) : (
              <ArrowDown size={14} className="text-blue-400 shrink-0" />
            )
          ) : (
            <ArrowUpDown size={14} className="text-slate-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      </div>
      {onResize && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 z-10"
          onMouseDown={handleMouseDown}
        />
      )}
    </th>
  );
};
