import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { RhAssetItem } from '../types';
import { DataTable, Column } from './DataTable';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import { 
  Package, Plus, Edit3, Trash2, ShieldAlert, ArrowRight, Save, X, 
  Search, AlertCircle, ShoppingCart, Download, FileText, Briefcase, 
  ChevronLeft, ChevronRight
} from 'lucide-react';

export const RhAssetManager: React.FC = () => {
  const { rhAssetItems, addRhAssetItem, updateRhAssetItem, deleteRhAssetItem } = useData();
  const { user } = useAuth();
  const adminName = user?.name || 'Gestor R.H.';

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'TODOS' | 'ATIVO' | 'CONSUMIVEL'>('TODOS');
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RhAssetItem | null>(null);
  
  const [name, setName] = useState('');
  const [type, setType] = useState<'ATIVO' | 'CONSUMIVEL'>('CONSUMIVEL');
  const [totalStock, setTotalStock] = useState(0);
  const [currentStock, setCurrentStock] = useState(0);
  const [minStock, setMinStock] = useState(0);
  const [notes, setNotes] = useState('');

  // Details Modal
  const [selectedItem, setSelectedItem] = useState<RhAssetItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const openAddForm = () => {
    setEditingItem(null);
    setName('');
    setType('CONSUMIVEL');
    setTotalStock(10);
    setCurrentStock(10);
    setMinStock(2);
    setNotes('');
    setIsFormOpen(true);
  };

  const openEditForm = (item: RhAssetItem) => {
    setEditingItem(item);
    setName(item.name);
    setType(item.type);
    setTotalStock(item.totalStock);
    setCurrentStock(item.currentStock);
    setMinStock(item.minStock || 0);
    setNotes(item.notes || '');
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const itemData: RhAssetItem = {
      id: editingItem ? editingItem.id : 'rha-' + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      type,
      totalStock: Number(totalStock),
      currentStock: Number(currentStock),
      minStock: Number(minStock),
      notes: notes.trim() || undefined
    };

    if (editingItem) {
      updateRhAssetItem(itemData, adminName);
    } else {
      addRhAssetItem(itemData, adminName);
    }

    setIsFormOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza de que deseja excluir este item do estoque de R.H.?')) {
      deleteRhAssetItem(id, adminName);
      setSelectedItem(null);
      setIsDetailModalOpen(false);
    }
  };

  // Filtragem
  const filteredItems = rhAssetItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'TODOS' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  // Métricas
  const totalItemsCount = rhAssetItems.length;
  const lowStockItems = rhAssetItems.filter(item => item.currentStock <= (item.minStock || 0));
  const totalPhysicalStock = rhAssetItems.reduce((acc, curr) => acc + curr.currentStock, 0);

  // Table Configuration
  const columns: Column<RhAssetItem>[] = [
    { key: 'name', label: 'Item / Recurso', sortable: true },
    { key: 'type', label: 'Tipo', sortable: true },
    { key: 'minStock', label: 'Mínimo Alerta', sortable: true },
    { key: 'currentStock', label: 'Disponível / Total', sortable: true },
    { key: 'notes', label: 'Notas / Especificações', sortable: true }
  ];

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    name: 260,
    type: 140,
    minStock: 120,
    currentStock: 160,
    notes: 240
  });

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleResize = (key: string, startX: number, startWidth: number) => {
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
      setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const sortedData = [...filteredItems].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aVal: any = a[key as keyof RhAssetItem];
    let bVal: any = b[key as keyof RhAssetItem];

    if (aVal === undefined || aVal === null) return direction === 'asc' ? 1 : -1;
    if (bVal === undefined || bVal === null) return direction === 'asc' ? -1 : 1;

    if (typeof aVal === 'string') {
      return direction === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    
    return direction === 'asc' 
      ? (aVal > bVal ? 1 : -1) 
      : (bVal > aVal ? 1 : -1);
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(10);

  const totalItems = sortedData.length;
  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(totalItems / itemsPerPage);
  
  const paginatedData = itemsPerPage === 'ALL' 
    ? sortedData 
    : sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Export functions
  const handleExportCSV = () => {
    const exportData = filteredItems.map(item => ({
      'Item / Recurso': item.name,
      'Tipo de Recurso': item.type,
      'Estoque Mínimo': item.minStock || 0,
      'Estoque Atual': item.currentStock,
      'Estoque Total': item.totalStock,
      'Observações': item.notes || ''
    }));
    exportToCSV(exportData, 'estoque_rh');
  };

  const handleExportExcel = () => {
    const exportData = filteredItems.map(item => ({
      'Item / Recurso': item.name,
      'Tipo de Recurso': item.type,
      'Estoque Mínimo': item.minStock || 0,
      'Estoque Atual': item.currentStock,
      'Estoque Total': item.totalStock,
      'Observações': item.notes || ''
    }));
    exportToExcel(exportData, 'estoque_rh');
  };

  const handleExportPDF = () => {
    const headers = ['Item / Recurso', 'Tipo', 'Mínimo', 'Disponível', 'Estoque Total'];
    const exportData = filteredItems.map(item => [
      item.name,
      item.type,
      String(item.minStock || 0),
      String(item.currentStock),
      String(item.totalStock)
    ]);
    exportToPDF(headers, exportData, 'estoque_rh', 'Relatório de Estoque de Ativos e Consumíveis R.H.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 id="rh-assets-title" className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">ESTOQUE DE ATIVOS E CONSUMÍVEIS R.H.</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gestão de Equipamentos de Proteção, Uniformes, Consumíveis e Brindes</p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow-md transition-all uppercase tracking-wider"
        >
          <Plus size={16} /> Cadastrar Novo Item
        </button>
      </div>

      {/* Bento Grid de Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl">
            <Package size={24} />
          </div>
          <div>
            <span className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">Total de Itens</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalItemsCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
            <AlertCircle size={24} />
          </div>
          <div>
            <span className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">Estoque Crítico (Baixo)</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{lowStockItems.length}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <ShoppingCart size={24} />
          </div>
          <div>
            <span className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">Unidades Disponíveis</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalPhysicalStock}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nome do item ou especificações..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Resource Type Filter */}
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value as any); setCurrentPage(1); }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="TODOS">Todos os Itens</option>
            <option value="ATIVO">Ativos (Retornáveis)</option>
            <option value="CONSUMIVEL">Consumíveis (Uniformes/EPIs)</option>
          </select>

          {/* Exports Dropdown */}
          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-3">
            <button
              onClick={handleExportExcel}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1"
              title="Exportar para Excel"
            >
              <Download size={14} /> <span className="hidden lg:inline">XLS</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1"
              title="Exportar para PDF"
            >
              <FileText size={14} /> <span className="hidden lg:inline">PDF</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1"
              title="Exportar para CSV"
            >
              <Briefcase size={14} /> <span className="hidden lg:inline">CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main DataTable Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={paginatedData}
          sortConfig={sortConfig}
          requestSort={requestSort}
          columnWidths={columnWidths}
          onResize={handleResize}
          emptyMessage="Nenhum ativo ou consumível cadastrado no estoque de R.H."
          renderRow={(item) => {
            const isLow = item.currentStock <= (item.minStock || 0);
            return (
              <tr
                key={item.id}
                onClick={() => {
                  setSelectedItem(item);
                  setIsDetailModalOpen(true);
                }}
                className="border-b border-slate-200 dark:border-slate-700/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/30 cursor-pointer transition-all text-xs text-slate-900 dark:text-slate-200"
              >
                <td className="px-6 py-4 font-black">{item.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wide ${
                    item.type === 'ATIVO' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400'
                  }`}>
                    {item.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-center font-bold text-slate-500">{item.minStock || 0} un</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`font-black font-mono text-[13px] ${isLow ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-slate-900 dark:text-white'}`}>
                      {item.currentStock}
                    </span>
                    <span className="text-slate-400 font-bold">/</span>
                    <span className="text-slate-400 font-mono font-bold">{item.totalStock} un</span>
                    {isLow && (
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 border border-rose-500/10 text-[9px] font-black uppercase rounded">Baixo Estoque</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 truncate max-w-xs">{item.notes || '-'}</td>
              </tr>
            );
          }}
        />

        {/* Footer Pagination */}
        <div className="bg-slate-50 dark:bg-slate-900/20 border-t border-slate-200 dark:border-slate-700/60 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Exibir:</span>
              <select
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={itemsPerPage}
                onChange={e => {
                  setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value="ALL">Todos</option>
              </select>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total: {totalItems} recursos cadastrados</p>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className={`p-2 rounded-lg transition-all ${currentPage === 1 ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-indigo-600 bg-indigo-500/10 px-3 py-1.5 rounded-lg">{currentPage}</span>
                <span className="text-xs font-bold uppercase mx-1 text-slate-400">de</span>
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{totalPages}</span>
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className={`p-2 rounded-lg transition-all ${currentPage === totalPages ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DETALHES DO RECURSO MODAL (Popup de visualização polida) */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700 animate-scale-up">
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-[10px] font-black rounded uppercase tracking-wider ${
                  selectedItem.type === 'ATIVO' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400'
                }`}>{selectedItem.type}</span>
                <div className="flex flex-col">
                  <h2 className="text-md font-black text-slate-900 dark:text-white leading-none">{selectedItem.name}</h2>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Item ID: {selectedItem.id}</span>
                </div>
              </div>
              <button onClick={() => { setIsDetailModalOpen(false); setSelectedItem(null); }} className="h-10 w-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-700 dark:text-white transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-700/60 p-5 rounded-2xl">
                <span className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider block mb-3">Métricas de Estoque</span>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Qtd Atual</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white">{selectedItem.currentStock} un</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Mínimo Alerta</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white">{selectedItem.minStock || 0} un</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Estoque Total</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white">{selectedItem.totalStock} un</span>
                  </div>
                </div>

                {selectedItem.currentStock <= (selectedItem.minStock || 0) && (
                  <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/10 rounded-xl flex items-center gap-3 text-rose-500 font-bold">
                    <AlertCircle size={18} />
                    <span>Atenção: Este item atingiu o estoque mínimo de alerta e necessita de reposição.</span>
                  </div>
                )}
              </div>

              {/* Especificações / Notas */}
              <div className="space-y-2">
                <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block leading-none">Observações e Especificações</span>
                <p className="p-4 bg-slate-100 dark:bg-slate-900 text-xs rounded-xl text-slate-800 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                  {selectedItem.notes || 'Nenhuma observação ou especificação cadastrada.'}
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-between items-center">
              <button
                onClick={() => handleDelete(selectedItem.id)}
                className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs px-4 py-3 rounded-xl uppercase tracking-wider shadow-sm transition-all"
              >
                <Trash2 size={14} /> Excluir do Estoque
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={() => { setIsDetailModalOpen(false); setSelectedItem(null); }}
                  className="px-5 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs rounded-xl uppercase tracking-wider transition-all"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    openEditForm(selectedItem);
                  }}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-6 py-3 rounded-xl uppercase tracking-wider shadow-md transition-all"
                >
                  <Edit3 size={14} /> Editar Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CADASTRO & EDIÇÃO MODAL (Popup de formulário) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-700 animate-scale-up shadow-2xl">
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <h2 className="text-sm font-black uppercase text-indigo-600 tracking-wider">
                {editingItem ? 'Editar Recurso de R.H.' : 'Cadastrar Novo Recurso'}
              </h2>
              <button onClick={() => setIsFormOpen(false)} className="h-10 w-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-700 dark:text-white transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nome do Item / Descrição *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Botina de Segurança N42, Camiseta G"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tipo de Recurso *</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                >
                  <option value="ATIVO">Ativo (Retornável / Patrimônio)</option>
                  <option value="CONSUMIVEL">Consumível (Descartável / Uniforme)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Estoque Total</label>
                  <input
                    type="number"
                    min={0}
                    value={totalStock}
                    onChange={e => setTotalStock(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Disponível Atual</label>
                  <input
                    type="number"
                    min={0}
                    value={currentStock}
                    onChange={e => setCurrentStock(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Mínimo Alerta</label>
                  <input
                    type="number"
                    min={0}
                    value={minStock}
                    onChange={e => setMinStock(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Observações / Detalhes</label>
                <textarea
                  rows={3}
                  placeholder="Especificações do fabricante, tamanho, materiais ou detalhes adicionais..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-6 py-3 bg-slate-250 hover:bg-slate-350 dark:bg-slate-700 text-slate-700 dark:text-slate-250 font-black text-xs rounded-xl uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl uppercase tracking-wider hover:shadow-md transition-all"
              >
                Salvar Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
