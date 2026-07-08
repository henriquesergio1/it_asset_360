import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, AlertTriangle, Edit, Trash2, ArrowUpRight, ArrowDownRight, TrendingDown, X, History, FileText, ArrowUp, ArrowDown, Download, FileSpreadsheet, SlidersHorizontal, CheckCircle, Check, Bell, BellOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { SortableResizableHeader } from './SortableResizableHeader';
import { UI_LABEL_SMALL, UI_ICON_SIZE_SMALL, UI_BUTTON_PRIMARY, UI_BUTTON_SECONDARY, UI_BUTTON_SUCCESS, UI_BUTTON_DANGER, UI_BUTTON_WARNING, UI_ICON_SIZE_BASE } from '../constants';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import { normalizeString } from '../utils/stringUtils';
import { useRef } from 'react';

interface Consumable {
    Id: string;
    Name: string;
    Category: string;
    CurrentStock: number;
    MinStock: number;
    Unit: string;
    AvgDailyConsumption: number;
    EstimatedDaysLeft: number | null;
}

const Consumables = () => {
    const { user } = useAuth();
    const { consumableTransactions, refreshData } = useData();
    const [consumables, setConsumables] = useState<Consumable[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Gerenciamento de alertas de estoque crítico por insumo (sininho)
    const [disabledConsumableAlerts, setDisabledConsumableAlerts] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('consumable_alerts_disabled');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const toggleConsumableAlert = (id: string, name: string) => {
        const isCurrentlyDisabled = disabledConsumableAlerts.includes(id);
        let updated: string[];
        if (isCurrentlyDisabled) {
            updated = disabledConsumableAlerts.filter(cid => cid !== id);
        } else {
            updated = [...disabledConsumableAlerts, id];
        }
        setDisabledConsumableAlerts(updated);
        localStorage.setItem('consumable_alerts_disabled', JSON.stringify(updated));
        
        // Emite o evento global para a central de alertas atualizar em tempo real
        window.dispatchEvent(new Event('app-alerts-updated'));
    };
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    
    const [editingConsumable, setEditingConsumable] = useState<Consumable | null>(null);
    const [transactionConsumable, setTransactionConsumable] = useState<Consumable | null>(null);
    const [selectedConsumableForLogs, setSelectedConsumableForLogs] = useState<Consumable | null>(null);
    const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('IN');
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
    const columnRef = useRef<HTMLDivElement>(null);

    const COLUMN_OPTIONS = [
        { id: 'Name', label: 'Item' },
        { id: 'Category', label: 'Categoria' },
        { id: 'CurrentStock', label: 'Estoque Atual' },
        { id: 'MinStock', label: 'Mínimo' },
        { id: 'AvgDailyConsumption', label: 'Consumo Médio' },
        { id: 'EstimatedDaysLeft', label: 'Duração Estimada' }
    ];

    const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
        const saved = localStorage.getItem('consumables_columns');
        return saved ? JSON.parse(saved) : COLUMN_OPTIONS.map(c => c.id);
    });

    useEffect(() => {
        localStorage.setItem('consumables_columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    const toggleColumn = (id: string) => {
        setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        currentStock: 0,
        minStock: 0,
        unit: 'Unidade'
    });
    
    const [transactionData, setTransactionData] = useState({
        quantity: 1,
        notes: ''
    });

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('consumables_widths');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem('consumables_widths', JSON.stringify(columnWidths));
    }, [columnWidths]);

    const handleResize = (colId: string, startX: number, startWidth: number) => {
        const onMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startX;
            setColumnWidths(prev => ({
                ...prev,
                [colId]: Math.max(startWidth + delta, 50)
            }));
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const fetchConsumables = async () => {
        try {
            const res = await fetch('/api/consumables', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setConsumables(data);
            }
        } catch (error) {
            console.error('Erro ao buscar consumíveis:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConsumables();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingConsumable ? `/api/consumables/${editingConsumable.Id}` : '/api/consumables';
            const method = editingConsumable ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ ...formData, adminUser: user?.name })
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchConsumables();
            } else {
                const err = await res.text();
                alert(err);
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar.');
        }
    };

    const handleTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transactionConsumable) return;

        try {
            const res = await fetch(`/api/consumables/${transactionConsumable.Id}/transaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    type: transactionType,
                    quantity: transactionData.quantity,
                    notes: transactionData.notes,
                    adminUser: user?.name
                })
            });

            if (res.ok) {
                setIsTransactionModalOpen(false);
                fetchConsumables();
                refreshData(); // Atualiza o contexto global para o relatório
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao registrar transação.');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao registrar transação.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este item? O histórico também será perdido.')) return;
        try {
            const res = await fetch(`/api/consumables/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                fetchConsumables();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const openEditModal = (c: Consumable) => {
        setEditingConsumable(c);
        setFormData({
            name: c.Name,
            category: c.Category,
            currentStock: c.CurrentStock,
            minStock: c.MinStock,
            unit: c.Unit
        });
        setIsModalOpen(true);
    };

    const openNewModal = () => {
        setEditingConsumable(null);
        setFormData({
            name: '',
            category: 'Toner',
            currentStock: 0,
            minStock: 5,
            unit: 'Unidade'
        });
        setIsModalOpen(true);
    };

    const openTransactionModal = (c: Consumable, type: 'IN' | 'OUT') => {
        setTransactionConsumable(c);
        setTransactionType(type);
        setTransactionData({ quantity: 1, notes: '' });
        setIsTransactionModalOpen(true);
    };

    const openLogsModal = (c: Consumable) => {
        setSelectedConsumableForLogs(c);
        setIsLogsModalOpen(true);
    };

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const dataToExport = filteredConsumables.map(c => {
            const row: any = {};
            if (visibleColumns.includes('Name')) row['Item'] = c.Name;
            if (visibleColumns.includes('Category')) row['Categoria'] = c.Category;
            if (visibleColumns.includes('CurrentStock')) row['Estoque Atual'] = `${c.CurrentStock} ${c.Unit}`;
            if (visibleColumns.includes('MinStock')) row['Mínimo'] = `${c.MinStock} ${c.Unit}`;
            if (visibleColumns.includes('AvgDailyConsumption')) row['Consumo Médio'] = c.AvgDailyConsumption.toFixed(2);
            if (visibleColumns.includes('EstimatedDaysLeft')) row['Duração Estimada'] = c.EstimatedDaysLeft !== null ? `${c.EstimatedDaysLeft} dias` : 'N/A';
            return row;
        });

        const filename = `relatorio_consumiveis_${new Date().toISOString().split('T')[0]}`;

        if (format === 'csv') exportToCSV(dataToExport, filename);
        else if (format === 'excel') exportToExcel(dataToExport, filename);
        else if (format === 'pdf') {
            const headers = ['Item', 'Categoria', 'Estoque Atual', 'Mínimo', 'Consumo Médio', 'Duração Estimada'];
            const rows = dataToExport.map(r => [
                r['Item'] || '---',
                r['Categoria'] || '---',
                r['Estoque Atual'] || '---',
                r['Mínimo'] || '---',
                r['Consumo Médio'] || '---',
                r['Duração Estimada'] || '---'
            ]);
            exportToPDF(headers, rows, filename, 'Relatório de Consumíveis');
        }
    };

    const sortedConsumables = React.useMemo(() => {
        let sortableItems = [...consumables];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof Consumable];
                const bValue = b[sortConfig.key as keyof Consumable];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'asc' 
                        ? aValue.localeCompare(bValue) 
                        : bValue.localeCompare(aValue);
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            sortableItems.sort((a, b) => a.Name.localeCompare(b.Name));
        }
        return sortableItems;
    }, [consumables, sortConfig]);

    const filteredConsumables = sortedConsumables.filter(c => {
        const term = normalizeString(searchTerm);
        return normalizeString(c.Name).includes(term) ||
               normalizeString(c.Category).includes(term);
    });

    const lowStockItems = consumables.filter(c => c.CurrentStock <= c.MinStock);

    if (loading) return <div className="p-8 text-center text-slate-600 dark:text-slate-400">Carregando consumíveis...</div>;

    return (
        <div className="space-y-6 animate-fade-in relative pb-20">
            {/* NOVO CABEÇALHO PADRONIZADO */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shadow-2xl relative z-30">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                        <Package className="text-blue-500" size={28} />
                        Gestão de Consumíveis / Insumos
                    </h2>
                    <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-1.5 opacity-80">Controle de estoque, toners, etiquetas e insumos técnicos</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner">
                        <button 
                            onClick={() => handleExport('csv')} 
                            className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700 transition-all text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400"
                            title="Exportar CSV"
                        >
                            <FileText size={UI_ICON_SIZE_BASE}/>
                        </button>
                        <button 
                            onClick={() => handleExport('excel')} 
                            className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700 transition-all text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400"
                            title="Exportar Excel"
                        >
                            <FileSpreadsheet size={UI_ICON_SIZE_BASE}/>
                        </button>
                        <button 
                            onClick={() => handleExport('pdf')} 
                            className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400"
                            title="Exportar PDF"
                        >
                            <Download size={UI_ICON_SIZE_BASE}/>
                        </button>
                    </div>

                    <div className={`relative ${isColumnSelectorOpen ? 'z-[9999]' : 'z-[10]'}`} ref={columnRef}>
                        <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 font-black text-[11px] uppercase tracking-widest transition-all shadow-inner border-b-4 border-b-slate-800 active:border-b-0 active:translate-y-[2px]">
                            <SlidersHorizontal size={UI_ICON_SIZE_BASE} /> Colunas
                        </button>
                        {isColumnSelectorOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-2xl z-[500] overflow-hidden animate-fade-in shadow-2xl ring-1 ring-white/5">
                                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center text-slate-600 dark:text-slate-400">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Personalizar Visão</span>
                                    <button onClick={() => setIsColumnSelectorOpen(false)} className="hover:text-slate-900 dark:text-white transition-colors"><X size={14}/></button>
                                </div>
                                <div className="p-2 space-y-1 bg-white dark:bg-slate-800/50">
                                    {COLUMN_OPTIONS.map(col => (
                                        <button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${visibleColumns.includes(col.id) ? ' bg-blue-50 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400' : ' hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}>
                                            {col.label}
                                            {visibleColumns.includes(col.id) && <Check size={14}/>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={openNewModal}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-900/40 border-b-4 border-b-blue-800 active:border-b-0 active:translate-y-[2px]"
                    >
                        <Plus size={UI_ICON_SIZE_BASE} /> Novo Item
                    </button>
                </div>
            </div>

            {/* Dashboard Cards PADRONIZADOS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-blue-500/30 group shadow-lg">
                    <div>
                        <span className="text-[11px] font-black text-blue-600 dark:text-sky-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Total Itens</span>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{consumables.length}</p>
                    </div>
                    <div className="h-12 w-12 bg-blue-50 dark:bg-sky-500/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-sky-400 border border-blue-800/30 group-hover:scale-110 transition-transform"><Package size={24}/></div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-red-500/30 group shadow-lg">
                    <div>
                        <span className="text-[11px] font-black text-red-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Estoque Crítico</span>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{lowStockItems.length}</p>
                    </div>
                    <div className="h-12 w-12 bg-red-900/20 rounded-2xl flex items-center justify-center text-red-400 border border-red-800/30 group-hover:scale-110 transition-transform"><AlertTriangle size={24}/></div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-emerald-500/30 group shadow-lg">
                    <div>
                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Movimentações</span>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{consumableTransactions.length}</p>
                    </div>
                    <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-800/30 group-hover:scale-110 transition-transform"><History size={24}/></div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-indigo-500/30 group shadow-lg">
                    <div>
                        <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Categorias</span>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{new Set(consumables.map(c => c.Category)).size}</p>
                    </div>
                    <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-800/30 group-hover:scale-110 transition-transform"><FileText size={24}/></div>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/5">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-900/20">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por nome ou categoria..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full border-none rounded-xl py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 transition-colors text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto shadow-inner">
                    <table className="w-full text-left table-fixed border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-900/80 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                {visibleColumns.includes('Name') && <SortableResizableHeader label="Item" sortKey="Name" currentSort={sortConfig} requestSort={handleSort} minWidth="250px" width={columnWidths['Name']} onResize={(x, w) => handleResize('Name', x, w)} />}
                                {visibleColumns.includes('CurrentStock') && <SortableResizableHeader label="Estoque Atual" sortKey="CurrentStock" currentSort={sortConfig} requestSort={handleSort} minWidth="150px" width={columnWidths['CurrentStock']} onResize={(x, w) => handleResize('CurrentStock', x, w)} />}
                                {visibleColumns.includes('MinStock') && <SortableResizableHeader label="Mínimo" sortKey="MinStock" currentSort={sortConfig} requestSort={handleSort} minWidth="100px" width={columnWidths['MinStock']} onResize={(x, w) => handleResize('MinStock', x, w)} />}
                                {visibleColumns.includes('AvgDailyConsumption') && <SortableResizableHeader label="Consumo Médio (30d)" sortKey="AvgDailyConsumption" currentSort={sortConfig} requestSort={handleSort} minWidth="180px" width={columnWidths['AvgDailyConsumption']} onResize={(x, w) => handleResize('AvgDailyConsumption', x, w)} />}
                                {visibleColumns.includes('EstimatedDaysLeft') && <SortableResizableHeader label="Duração Estimada" sortKey="EstimatedDaysLeft" currentSort={sortConfig} requestSort={handleSort} minWidth="150px" width={columnWidths['EstimatedDaysLeft']} onResize={(x, w) => handleResize('EstimatedDaysLeft', x, w)} />}
                                <th className="px-6 py-4 text-right border-b border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-[11px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-400/80 align-middle" style={{ width: '180px', minWidth: '180px' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30 bg-white dark:bg-slate-800/50">
                            {filteredConsumables.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleColumns.length + 1} className="p-12 text-center text-slate-500 dark:text-slate-400 font-bold italic">Nenhum consumível encontrado.</td>
                                </tr>
                            ) : (
                                filteredConsumables.map(c => {
                                    const isLowStock = c.CurrentStock <= c.MinStock;
                                    return (
                                        <tr key={c.Id} className="hover:bg-slate-100 dark:hover:bg-slate-700/60 border-l-4 border-l-transparent hover:border-l-blue-500 transition-all cursor-pointer group">
                                            {visibleColumns.includes('Name') && (
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-blue-600 dark:text-sky-400 transition-colors">{c.Name}</div>
                                                    <div className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider bg-slate-50 dark:bg-slate-900/50 w-fit px-2 py-0.5 rounded mt-1">{c.Category}</div>
                                                </td>
                                            )}
                                            {visibleColumns.includes('CurrentStock') && (
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-black text-lg ${isLowStock ? 'text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                            {c.CurrentStock}
                                                        </span>
                                                        <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">{c.Unit}</span>
                                                        {isLowStock && <div className="bg-red-900/20 p-1 rounded border border-red-800/30" title="Estoque Crítico"><AlertTriangle size={14} className="text-red-400 animate-pulse" /></div>}
                                                    </div>
                                                </td>
                                            )}
                                            {visibleColumns.includes('MinStock') && <td className="p-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">{c.MinStock} {c.Unit}</td>}
                                            {visibleColumns.includes('AvgDailyConsumption') && (
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                        <TrendingDown size={14} className="text-amber-500" />
                                                        {c.AvgDailyConsumption > 0 ? `${c.AvgDailyConsumption.toFixed(2)} / dia` : 'Sem dados'}
                                                    </div>
                                                </td>
                                            )}
                                            {visibleColumns.includes('EstimatedDaysLeft') && (
                                                <td className="p-4">
                                                    {c.EstimatedDaysLeft !== null ? (
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${c.EstimatedDaysLeft <= 7 ? 'bg-red-900/20 text-red-400 border-red-800/30' : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-800/30'}`}>
                                                            ~ {c.EstimatedDaysLeft} dias
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Indeterminado</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5 transition-opacity">
                                                    <button onClick={() => openTransactionModal(c, 'IN')} className="p-2 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-700 hover:text-white rounded-xl transition-all border border-emerald-800/30" title="Adicionar Estoque (Compra)">
                                                        <ArrowUp size={16} />
                                                    </button>
                                                    <button onClick={() => openTransactionModal(c, 'OUT')} className="p-2 bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-700 hover:text-white rounded-xl transition-all border border-amber-800/30" title="Registrar Uso (Saída)">
                                                        <ArrowDown size={16} />
                                                    </button>
                                                    <div className="w-px h-6 bg-slate-100 dark:bg-slate-800 mx-1"></div>
                                                    <button
                                                        onClick={() => toggleConsumableAlert(c.Id, c.Name)}
                                                        className={`p-2 rounded-xl transition-all border shadow-inner ${
                                                            !disabledConsumableAlerts.includes(c.Id)
                                                                ? 'bg-amber-950/20 text-amber-500 border-amber-800/30 hover:bg-amber-100 dark:bg-amber-500/20'
                                                                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                        }`}
                                                        title={!disabledConsumableAlerts.includes(c.Id) ? "Alertas de Insumo Habilitados (clique para desabilitar)" : "Alertas de Insumo Desabilitados (clique para ativar)"}
                                                    >
                                                        {!disabledConsumableAlerts.includes(c.Id) ? <Bell size={16} /> : <BellOff size={16} />}
                                                    </button>
                                                    <button onClick={() => openEditModal(c)} className="p-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400 hover:bg-blue-50 dark:bg-sky-500/20 rounded-xl transition-all" title="Editar">
                                                        <Edit size={16} />
                                                    </button>
                                                    <button onClick={() => openLogsModal(c)} className="p-2 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:bg-amber-500/20 rounded-xl transition-all" title="Ver Histórico">
                                                        <History size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(c.Id)} className="p-2 text-slate-600 dark:text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-xl transition-all" title="Excluir">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Add/Edit Consumable */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editingConsumable ? 'Editar Consumível' : 'Novo Consumível'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className={UI_LABEL_SMALL}>Nome / Descrição</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-700 dark:text-slate-200 focus:border-blue-500 outline-none" placeholder="Ex: Toner HP 85A" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={UI_LABEL_SMALL}>Categoria</label>
                                    <input required type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-700 dark:text-slate-200 focus:border-blue-500 outline-none" placeholder="Ex: Toner" />
                                </div>
                                <div>
                                    <label className={UI_LABEL_SMALL}>Unidade</label>
                                    <input required type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-700 dark:text-slate-200 focus:border-blue-500 outline-none" placeholder="Ex: Unidade, Rolo" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={UI_LABEL_SMALL}>Estoque Mínimo</label>
                                    <input required type="number" min="0" value={formData.minStock} onChange={e => setFormData({...formData, minStock: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-700 dark:text-slate-200 focus:border-blue-500 outline-none" />
                                </div>
                                {!editingConsumable && (
                                    <div>
                                        <label className={UI_LABEL_SMALL}>Estoque Inicial</label>
                                        <input required type="number" min="0" value={formData.currentStock} onChange={e => setFormData({...formData, currentStock: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-700 dark:text-slate-200 focus:border-blue-500 outline-none" />
                                    </div>
                                )}
                            </div>
<div className="pt-4 flex justify-end gap-3">
 <button type="button" onClick={() => setIsModalOpen(false)} className={`px-4 py-2 rounded-xl ${UI_BUTTON_SECONDARY} text-sm`}>Cancelar</button>
 <button type="submit" className={`px-6 py-2 rounded-xl ${UI_BUTTON_PRIMARY}`}>Salvar</button>
 </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Transaction */}
            {isTransactionModalOpen && transactionConsumable && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className={`p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center ${transactionType === 'IN' ? 'bg-emerald-900/10' : 'bg-amber-900/10'}`}>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                {transactionType === 'IN' ? <ArrowUpRight className="text-emerald-500"/> : <ArrowDownRight className="text-amber-500"/>}
                                {transactionType === 'IN' ? 'Adicionar Estoque' : 'Registrar Uso'}
                            </h2>
                            <button onClick={() => setIsTransactionModalOpen(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleTransaction} className="p-6 space-y-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">Item selecionado</p>
                                <p className="font-bold text-slate-700 dark:text-slate-200">{transactionConsumable.Name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Estoque atual: {transactionConsumable.CurrentStock} {transactionConsumable.Unit}</p>
                            </div>
                              <div>
                                <label className={UI_LABEL_SMALL}>Quantidade</label>
                                <input 
                                    required 
                                    type="number" 
                                    min="1" 
                                    max={transactionType === 'OUT' ? transactionConsumable.CurrentStock : undefined}
                                    value={transactionData.quantity} 
                                    onChange={e => setTransactionData({...transactionData, quantity: parseInt(e.target.value)})} 
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-700 dark:text-slate-200 focus:border-blue-500 outline-none" 
                                />
                                {transactionType === 'OUT' && transactionData.quantity > transactionConsumable.CurrentStock && (
                                    <p className="text-xs text-red-400 mt-1">Quantidade maior que o estoque disponível.</p>
                                )}
                            </div>
                            <div>
                                <label className={UI_LABEL_SMALL}>Observações (Opcional)</label>
                                <input 
                                    type="text" 
                                    value={transactionData.notes} 
                                    onChange={e => setTransactionData({...transactionData, notes: e.target.value})} 
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-700 dark:text-slate-200 focus:border-blue-500 outline-none" 
                                    placeholder={transactionType === 'IN' ? "Ex: Nota Fiscal 1234" : "Ex: Impressora RH"} 
                                />
                            </div>
<div className="pt-4 flex justify-end gap-3">
 <button type="button" onClick={() => setIsTransactionModalOpen(false)} className={`px-4 py-2 rounded-xl ${UI_BUTTON_SECONDARY} text-sm`}>Cancelar</button>
 <button 
 type="submit" 
 disabled={transactionType === 'OUT' && transactionData.quantity > (transactionConsumable?.CurrentStock || 0)}
 className={`px-6 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${transactionType === 'IN' ? UI_BUTTON_SUCCESS : UI_BUTTON_WARNING}`}
 >
 Confirmar
 </button>
 </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal de Histórico */}
            {isLogsModalOpen && selectedConsumableForLogs && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800/50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <History className="text-amber-600 dark:text-amber-400" /> Histórico de Movimentações
                                </h2>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{selectedConsumableForLogs.Name}</p>
                            </div>
                            <button onClick={() => setIsLogsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X size={20} className="text-slate-600 dark:text-slate-400" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-4">
                                {consumableTransactions
                                    .filter(t => t.consumableId === selectedConsumableForLogs.Id)
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map(t => (
                                        <div key={t.id} className="bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 flex items-start gap-4">
                                            <div className={`p-2 rounded-xl ${t.type === 'IN' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-red-500/20 text-rose-600 dark:text-red-400'}`}>
                                                {t.type === 'IN' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <p className="font-bold text-slate-900 dark:text-white">
                                                        {t.type === 'IN' ? 'Entrada' : 'Saída'} de {t.quantity} {selectedConsumableForLogs.Unit}
                                                    </p>
                                                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                        {new Date(t.date).toLocaleString('pt-BR')}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                                    <span className="flex items-center gap-1"><Package size={12} /> {t.adminUser}</span>
                                                    {t.notes && <span className="flex items-center gap-1 italic"><FileText size={12} /> {t.notes}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                {consumableTransactions.filter(t => t.consumableId === selectedConsumableForLogs.Id).length === 0 && (
                                    <div className="py-12 text-center">
                                        <History size={48} className="mx-auto text-slate-700 mb-4 opacity-20" />
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum registro de movimentação encontrado.</p>
                                    </div>
                                )}
                            </div>
                        </div>

<div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 flex justify-end">
 <button 
 onClick={() => setIsLogsModalOpen(false)}
 className={`px-6 py-2 rounded-xl ${UI_BUTTON_SECONDARY}`}
 >
 Fechar
 </button>
 </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Consumables;
