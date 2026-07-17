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
      className="p-0 border-b border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-[11px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-400/80 group align-middle relative select-none"
      style={{ width: width ? `${width}px` : undefined, minWidth }}
    >
      <div className="flex items-center h-full min-h-[48px] relative">
        <button
          onClick={() => requestSort(sortKey)}
          className="flex items-center px-3 py-4 hover:text-slate-700 dark:text-slate-200 transition-colors w-full text-left h-full"
          title={`Clique para ordenar por ${label}`}
        >
          <span className="truncate w-full">{label}</span>
        </button>

        {/* Indicador de ordenação absoluto visível apenas sob hover do mouse (Tooltip acima do cabeçalho) */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-7 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 bg-slate-900 dark:bg-slate-950 border border-slate-700 px-2 py-0.5 rounded shadow-xl text-[9px] font-black text-slate-100 z-[200] whitespace-nowrap group-hover:-top-8">
          {isSorted ? (
            isAsc ? (
              <>
                <ArrowUp size={10} className="text-blue-600 dark:text-sky-400 shrink-0" />
                <span>ASC</span>
              </>
            ) : (
              <>
                <ArrowDown size={10} className="text-blue-600 dark:text-sky-400 shrink-0" />
                <span>DESC</span>
              </>
            )
          ) : (
            <>
              <ArrowUpDown size={10} className="text-slate-500 shrink-0" />
              <span>ORDENAR</span>
            </>
          )}
        </div>
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
