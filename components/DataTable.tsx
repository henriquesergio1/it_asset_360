
import React from 'react';
import { SortableResizableHeader } from './SortableResizableHeader';

/**
 * Interface para a definição de uma coluna na DataTable.
 */
export interface Column<T> {
  key: string;
  label: string;
  minWidth?: string;
  sortable?: boolean;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  requestSort: (key: string) => void;
  columnWidths: Record<string, number>;
  onResize: (key: string, startX: number, startWidth: number) => void;
  renderRow: (item: T) => React.ReactNode;
  selectedIds?: string[];
  onSelectAll?: () => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

/**
 * Componente genérico DataTable para padronização de tabelas no sistema.
 * Inclui comportamento de hover padronizado e ordenação/redimensionamento.
 */
export function DataTable<T extends { id: string }>({
  columns,
  data,
  sortConfig,
  requestSort,
  columnWidths,
  onResize,
  renderRow,
  selectedIds = [],
  onSelectAll,
  isLoading = false,
  emptyMessage = "Nenhum registro encontrado."
}: DataTableProps<T>) {
  
  const allSelected = data.length > 0 && selectedIds.length === data.length;

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-600 dark:text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        Carregando dados...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left table-fixed border-collapse">
        <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
          <tr>
            {onSelectAll && (
              <th className="px-6 py-4 w-[60px] border-b border-slate-300 dark:border-slate-600 bg-slate-800">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 dark:border-slate-600 bg-slate-800 focus:ring-blue-500"
                  checked={allSelected}
                  onChange={onSelectAll}
                />
              </th>
            )}
            {columns.map(col => (
              col.sortable !== false ? (
                <SortableResizableHeader 
                  key={col.key}
                  label={col.label}
                  sortKey={col.key}
                  currentSort={sortConfig}
                  requestSort={requestSort}
                  minWidth={col.minWidth || '120px'}
                  width={columnWidths[col.key]}
                  onResize={(x, w) => onResize(col.key, x, w)}
                />
              ) : (
                <th 
                  key={col.key}
                  className="px-6 py-4 border-b border-slate-300 dark:border-slate-600 bg-slate-800 text-[10px] uppercase font-black tracking-widest text-slate-600 dark:text-slate-400"
                  style={{ width: columnWidths[col.key] || 'auto', minWidth: col.minWidth || '120px' }}
                >
                  {col.label}
                </th>
              )
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onSelectAll ? 1 : 0)} className="p-12 text-center text-slate-400 dark:text-slate-500 italic">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map(item => (
                <React.Fragment key={item.id}>
                    {renderRow(item)}
                </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
