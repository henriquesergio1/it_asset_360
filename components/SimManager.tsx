import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SimCard, DeviceStatus } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, AlertTriangle, Wifi, Signal, X, Info, Save, FileText, FileSpreadsheet, Download, SlidersHorizontal, Check, User } from 'lucide-react';
import { SortableResizableHeader } from './SortableResizableHeader';
import { normalizeString } from '../utils/stringUtils';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import { useRef } from 'react';

const SimManager = () => {
  const { sims, addSim, updateSim, deleteSim, users, isReadOnly } = useData();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const simId = params.get('simId');
    if (simId) {
      const sim = sims.find(s => s.id === simId);
      if (sim) handleOpenModal(sim, true);
    }
  }, [location.search, sims]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [formData, setFormData] = useState<Partial<SimCard>>({ status: DeviceStatus.AVAILABLE });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('sim_manager_columns');
    return saved ? JSON.parse(saved) : ['phoneNumber', 'operator', 'iccid', 'status', 'currentUserId'];
  });
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  const COLUMN_OPTIONS = [
    { id: 'phoneNumber', label: 'Número' },
    { id: 'operator', label: 'Operadora' },
    { id: 'iccid', label: 'ICCID' },
    { id: 'status', label: 'Status' },
    { id: 'currentUserId', label: 'Usuário' }
  ];

  useEffect(() => {
    localStorage.setItem('sim_manager_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) setIsColumnSelectorOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (id: string) => {
    setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const exportData = filteredSims.map(s => {
      const user = users.find(u => u.id === s.currentUserId);
      return {
        'Número': s.phoneNumber,
        'Operadora': s.operator,
        'ICCID': s.iccid,
        'Status': s.status,
        'Responsável': user?.fullName || 'Estoque'
      };
    });

    const fileName = `simcards_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') exportToCSV(exportData, fileName);
    if (format === 'excel') exportToExcel(exportData, fileName);
    if (format === 'pdf') {
      const headers = ['Número', 'Operadora', 'Status', 'Responsável'];
      const rows = exportData.map(d => [d.Número.toString(), d.Operadora, d.Status, d.Responsável]);
      exportToPDF(headers, rows, fileName, 'Relatório de Chips SIM');
    }
  };

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('sim_manager_widths');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('sim_manager_widths', JSON.stringify(columnWidths));
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

  const adminName = currentUser?.name || 'Unknown';

  const total = sims.length;
  const inUse = sims.filter(s => s.status === DeviceStatus.IN_USE).length;
  const available = sims.filter(s => s.status === DeviceStatus.AVAILABLE).length;

  const handleOpenModal = (sim?: SimCard, viewOnly: boolean = false) => {
    setIsViewOnly(viewOnly);
    if (sim) {
      setEditingId(sim.id);
      const { currentUserName, deviceName, ...validData } = sim as any;
      setFormData(validData);
    } else {
      setEditingId(null);
      setFormData({ status: DeviceStatus.AVAILABLE, operator: 'Vivo', iccid: '', phoneNumber: '', planDetails: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;

    if (formData.phoneNumber) {
      const dupPhone = sims.find(s => s.phoneNumber === formData.phoneNumber && s.id !== editingId);
      if (dupPhone) {
        alert(`FALHA DE UNICIDADE:\n\nO número de linha ${formData.phoneNumber} já está cadastrado no sistema.`);
        return;
      }
    }

    if (editingId) {
      setEditReason('');
      setIsReasonModalOpen(true);
    } else {
      try {
        addSim({ ...formData, phoneNumber: (formData.phoneNumber || '').trim(), iccid: (formData.iccid || '').trim(), id: Math.random().toString(36).substr(2, 9), currentUserId: null } as SimCard, adminName);
        setIsModalOpen(false);
        showToast('Chip cadastrado com sucesso!', 'success');
      } catch (error) {
        showToast('Erro ao cadastrar chip.', 'error');
      }
    }
  };

  const confirmEdit = () => {
    if (!editReason.trim()) {
      alert('Por favor, informe o motivo da alteração.');
      return;
    }
    try {
      updateSim({ ...formData, phoneNumber: (formData.phoneNumber || '').trim(), iccid: (formData.iccid || '').trim() } as SimCard, `${adminName} (Motivo: ${editReason})`);
      setIsReasonModalOpen(false);
      setIsModalOpen(false);
      showToast('Dados do chip atualizados!', 'success');
    } catch (error) {
      showToast('Erro ao atualizar chip.', 'error');
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setDeleteReason('');
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId && deleteReason.trim()) {
      try {
        deleteSim(deleteTargetId, adminName, deleteReason);
        setIsDeleteModalOpen(false);
        setDeleteTargetId(null);
        setDeleteReason('');
        showToast('Chip removido do inventário!', 'success');
      } catch (error) {
        showToast('Erro ao remover chip.', 'error');
      }
    } else {
      alert('Por favor, informe o motivo da exclusão.');
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedSims = React.useMemo(() => {
    let sortableItems = [...sims];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof SimCard];
        const bValue = b[sortConfig.key as keyof SimCard];
        
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
      sortableItems.sort((a, b) => a.phoneNumber.localeCompare(b.phoneNumber));
    }
    return sortableItems;
  }, [sims, sortConfig]);

  const filteredSims = sortedSims.filter(s => {
    const assignedUser = users.find(u => u.id === s.currentUserId);
    const userName = assignedUser ? assignedUser.fullName : '';
    const searchNormalized = normalizeString(searchTerm);
    
    return (
      normalizeString(s.phoneNumber).includes(searchNormalized) || 
      normalizeString(s.iccid).includes(searchNormalized) ||
      normalizeString(s.operator).includes(searchNormalized) ||
      normalizeString(userName).includes(searchNormalized)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shadow-2xl relative z-30">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Signal className="text-blue-500" size={28} />
            Gestão de Chips / SIMs
          </h2>
          <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-1.5 opacity-80">Controle de linhas e ativos de conectividade</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner">
            <button onClick={() => handleExport('csv')} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400 transition-all" title="Exportar CSV"><FileText size={18}/></button>
            <button onClick={() => handleExport('excel')} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400 transition-all" title="Exportar Excel"><FileSpreadsheet size={18}/></button>
            <button onClick={() => handleExport('pdf')} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400 transition-all" title="Exportar PDF"><Download size={18}/></button>
          </div>

          <div className={`relative ${isColumnSelectorOpen ? 'z-[9999]' : 'z-[10]'}`} ref={columnRef}>
            <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 font-black text-[11px] uppercase tracking-widest transition-all shadow-inner border-b-4 border-b-slate-800 active:border-b-0 active:translate-y-[2px]">
              <SlidersHorizontal size={18} /> Colunas
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
            disabled={isReadOnly}
            onClick={() => handleOpenModal()} 
            className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-900/40 border-b-4 border-b-blue-800 active:border-b-0 active:translate-y-[2px] ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Plus size={18} /> Novo SIM
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-blue-500/30 group shadow-lg">
          <div>
            <span className="text-[11px] font-black text-blue-600 dark:text-sky-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Total de Linhas</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{total}</p>
          </div>
          <div className="h-12 w-12 bg-blue-50 dark:bg-sky-500/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-sky-400 border border-blue-800/30 group-hover:scale-110 transition-transform"><Signal size={24}/></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-emerald-500/30 group shadow-lg">
          <div>
            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Disponíveis</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{available}</p>
          </div>
          <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-800/30 group-hover:scale-110 transition-transform"><Wifi size={24}/></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-indigo-500/30 group shadow-lg">
          <div>
            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Em Uso</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{inUse}</p>
          </div>
          <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-800/30 group-hover:scale-110 transition-transform"><User size={24}/></div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="text-slate-600 dark:text-slate-400" size={20} />
        </div>
        <input 
          type="text"
          placeholder="Buscar por número, ICCID ou operadora..."
          className="pl-12 w-full border-none rounded-xl py-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white bg-white dark:bg-slate-800 transition-colors shadow-inner"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl ring-1 ring-white/5 transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left table-fixed">
            <thead className="bg-slate-100 dark:bg-slate-800/50">
              <tr>
                {visibleColumns.includes('phoneNumber') && <SortableResizableHeader label="Número" sortKey="phoneNumber" currentSort={sortConfig} requestSort={handleSort} minWidth="180px" width={columnWidths['phoneNumber']} onResize={(x, w) => handleResize('phoneNumber', x, w)} />}
                {visibleColumns.includes('operator') && <SortableResizableHeader label="Operadora" sortKey="operator" currentSort={sortConfig} requestSort={handleSort} minWidth="140px" width={columnWidths['operator']} onResize={(x, w) => handleResize('operator', x, w)} />}
                {visibleColumns.includes('iccid') && <SortableResizableHeader label="ICCID" sortKey="iccid" currentSort={sortConfig} requestSort={handleSort} minWidth="200px" width={columnWidths['iccid']} onResize={(x, w) => handleResize('iccid', x, w)} />}
                {visibleColumns.includes('status') && <SortableResizableHeader label="Status" sortKey="status" currentSort={sortConfig} requestSort={handleSort} minWidth="120px" width={columnWidths['status']} onResize={(x, w) => handleResize('status', x, w)} />}
                {visibleColumns.includes('currentUserId') && <SortableResizableHeader label="Usuário" sortKey="currentUserId" currentSort={sortConfig} requestSort={handleSort} minWidth="200px" width={columnWidths['currentUserId']} onResize={(x, w) => handleResize('currentUserId', x, w)} />}
                <th className="px-6 py-4 text-right border-b border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-[11px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-400/80 align-middle" style={{ width: '120px', minWidth: '120px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredSims.map((sim) => {
                const assignedUser = users.find(u => u.id === sim.currentUserId);
                return (
                  <tr key={sim.id} onClick={() => handleOpenModal(sim, true)} className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all cursor-pointer group">
                    {visibleColumns.includes('phoneNumber') && (
                      <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">{sim.phoneNumber}</td>
                    )}
                    {visibleColumns.includes('operator') && (
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${sim.operator === 'Vivo' ? 'bg-purple-900/30 text-purple-400' : sim.operator === 'Claro' ? 'bg-red-900/30 text-red-400' : 'bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400'}`}>
                          {sim.operator}
                        </span>
                      </td>
                    )}
                    {visibleColumns.includes('iccid') && (
                      <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">{sim.iccid}</td>
                    )}
                    {visibleColumns.includes('status') && (
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${sim.status === DeviceStatus.AVAILABLE ? 'bg-green-900/30 text-green-400' : 'bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400'}`}>
                          {sim.status}
                        </span>
                      </td>
                    )}
                    {visibleColumns.includes('currentUserId') && (
                      <td className="px-6 py-4 truncate text-xs">
                        {assignedUser ? assignedUser.fullName : <span className="text-slate-500 dark:text-slate-400 italic">Disponível</span>}
                      </td>
                    )}
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2 text-slate-600 dark:text-slate-400 transition-opacity">
                        <button onClick={() => handleOpenModal(sim, false)} disabled={isReadOnly} className={`hover:text-blue-600 dark:text-sky-400 hover:bg-blue-100 dark:bg-sky-500/20 p-2 rounded-xl transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`} title="Editar"><Edit2 size={16} /></button>
                        <button onClick={() => !isReadOnly && handleDeleteClick(sim.id)} disabled={isReadOnly} className={`hover:text-red-400 hover:bg-red-900/30 p-2 rounded-xl transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`} title="Excluir"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredSims.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center italic text-slate-500 dark:text-slate-400">Nenhum chip encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg border border-slate-200 dark:border-slate-700 shadow-2xl relative my-8">
            <div className="bg-white dark:bg-slate-800 p-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 rounded-t-3xl">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{editingId ? (isViewOnly ? 'Detalhes do Chip' : 'Editar Chip') : 'Novo Chip / SIM'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-black uppercase mb-2 ml-1 tracking-widest text-slate-500 dark:text-slate-400">Número da Linha</label>
                  <input readOnly={isViewOnly} required type="text" placeholder="(00) 0 0000-0000" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-bold transition-all shadow-inner" value={formData.phoneNumber || ''} onChange={e => setFormData({...formData, phoneNumber: e.target.value})}/>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase mb-2 ml-1 tracking-widest text-slate-500 dark:text-slate-400">Operadora</label>
                  <select disabled={isViewOnly} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-bold transition-all shadow-inner appearance-none" value={formData.operator || ''} onChange={e => setFormData({...formData, operator: e.target.value})}>
                    <option value="Vivo">Vivo</option>
                    <option value="Claro">Claro</option>
                    <option value="Tim">Tim</option>
                    <option value="Oi">Oi</option>
                    <option value="Arquia">Arquia</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-black uppercase mb-2 ml-1 tracking-widest text-slate-500 dark:text-slate-400">ICCID (20 dígitos)</label>
                  <input readOnly={isViewOnly} required type="text" placeholder="Ex: 895510..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-mono transition-all shadow-inner" value={formData.iccid || ''} onChange={e => setFormData({...formData, iccid: e.target.value})}/>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-black uppercase mb-2 ml-1 tracking-widest text-slate-500 dark:text-slate-400">Detalhes do Plano</label>
                  <input readOnly={isViewOnly} type="text" placeholder="Ex: 50GB Mensal Corporativo" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all shadow-inner" value={formData.planDetails || ''} onChange={e => setFormData({...formData, planDetails: e.target.value})}/>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">Cancelar</button>
                {!isViewOnly ? (
                  <button type="submit" className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-blue-900/40">Confirmar</button>
                ) : (
                  <button type="button" onClick={() => setIsViewOnly(false)} disabled={isReadOnly} className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-blue-900/40 disabled:opacity-50">Habilitar Edição</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {isReasonModalOpen && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm border border-slate-200 dark:border-slate-700 shadow-2xl relative overflow-hidden">
            <div className="p-8 text-center border-b border-slate-200 dark:border-slate-700">
              <div className="h-16 w-16 bg-blue-100 dark:bg-sky-500/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-sky-400 mx-auto mb-4 border border-blue-800/30"><Save size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Motivo da Alteração</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Documente o motivo desta alteração para auditoria.</p>
            </div>
            <div className="p-8 space-y-4 bg-white dark:bg-slate-800/50">
              <textarea autoFocus className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all font-medium min-h-[100px] shadow-inner" placeholder="Ex: Correção de ICCID, mudança de operadora..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea>
              <div className="flex gap-4">
                <button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black uppercase text-[11px] tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors">Voltar</button>
                <button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-900/40">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm border border-slate-200 dark:border-slate-700 shadow-2xl relative overflow-hidden">
            <div className="p-8 text-center border-b border-slate-200 dark:border-slate-700">
              <div className="h-16 w-16 bg-red-900/30 rounded-2xl flex items-center justify-center text-red-400 mx-auto mb-4 border border-red-800/30 transition-transform"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Remover Chip</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">Esta ação requer um motivo documentado.</p>
            </div>
            <div className="p-8 space-y-4 bg-white dark:bg-slate-800/50">
              <textarea autoFocus className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all font-medium min-h-[100px] shadow-inner" placeholder="Ex: Chip extraviado, linha cancelada..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea>
              <div className="flex gap-4">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black uppercase text-[11px] tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors">Manter</button>
                <button onClick={handleConfirmDelete} disabled={!deleteReason.trim()} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/40 disabled:opacity-50">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimManager;
