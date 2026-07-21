import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { RhOccurrence } from '../types';
import { DataTable, Column } from './DataTable';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import { 
  Plus, Trash2, Calendar, FileText, AlertTriangle, Search, X, 
  Download, ChevronLeft, ChevronRight, Briefcase, Paperclip, Check, Eye, Upload
} from 'lucide-react';
import FilePreviewModal from './FilePreviewModal';

const formatDateForInput = (val?: string) => val ? (val.includes('T') ? val.split('T')[0] : val.substring(0, 10)) : '';

export const RhOccurrenceManager: React.FC = () => {
  const { rhCollaborators, rhOccurrences, addRhOccurrence, deleteRhOccurrence } = useData();
  const { user } = useAuth();
  const adminName = user?.name || 'Gestor R.H.';

  // Search/Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  // Modals & Selections
  const [selectedOccurrence, setSelectedOccurrence] = useState<RhOccurrence | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ url: string; name: string }>({ url: '', name: '' });

  // Form State
  const [form, setForm] = useState({
    collaboratorId: '',
    type: 'Atestado Médico' as 'Falta Justificada' | 'Falta Injustificada' | 'Atestado Médico' | 'Licença Maternidade' | 'Licença Paternidade' | 'Afastamento INSS',
    startDate: '',
    endDate: '',
    notes: '',
    fileUrl: ''
  });

  // File upload state
  const [attachedFileName, setAttachedFileName] = useState('');
  const [fileBase64, setFileBase64] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileBase64(event.target?.result as string || '');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.collaboratorId || !form.startDate || !form.endDate) return;

    const colab = rhCollaborators.find(c => c.id === form.collaboratorId);
    if (!colab) return;

    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const computedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const finalOccurrence: RhOccurrence = {
      id: 'occ-' + Math.random().toString(36).substr(2, 9),
      collaboratorId: form.collaboratorId,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      daysCount: computedDays,
      notes: form.notes || '',
      fileUrl: fileBase64 || form.fileUrl || ''
    };

    addRhOccurrence(finalOccurrence, adminName);
    
    // Reset form
    setForm({
      collaboratorId: '',
      type: 'Atestado Médico',
      startDate: '',
      endDate: '',
      notes: '',
      fileUrl: ''
    });
    setAttachedFileName('');
    setFileBase64('');
    setShowCreate(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza de que deseja remover este lançamento de ocorrência de R.H.?')) {
      deleteRhOccurrence(id, adminName);
      setSelectedOccurrence(null);
      setIsDetailModalOpen(false);
    }
  };

  // Filter Logic
  const filtered = rhOccurrences.filter(o => {
    const colabName = rhCollaborators.find(c => c.id === o.collaboratorId)?.fullName || '';
    
    const matchesSearch = colabName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (o.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || o.type === filterType;

    return matchesSearch && matchesType;
  });

  // Table Configuration
  const columns: Column<RhOccurrence>[] = [
    { key: 'collaboratorId', label: 'Colaborador', sortable: true },
    { key: 'type', label: 'Tipo de Ocorrência', sortable: true },
    { key: 'startDate', label: 'Data Início', sortable: true },
    { key: 'endDate', label: 'Data Fim', sortable: true },
    { key: 'daysCount', label: 'Dias Afastado', sortable: true },
    { key: 'fileUrl', label: 'Anexo', sortable: false }
  ];

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    collaboratorId: 260,
    type: 180,
    startDate: 130,
    endDate: 130,
    daysCount: 120,
    fileUrl: 100
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

  const sortedData = [...filtered].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aVal: any = a[key as keyof RhOccurrence];
    let bVal: any = b[key as keyof RhOccurrence];

    if (key === 'collaboratorId') {
      aVal = rhCollaborators.find(c => c.id === a.collaboratorId)?.fullName || '';
      bVal = rhCollaborators.find(c => c.id === b.collaboratorId)?.fullName || '';
    }

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
    const exportData = filtered.map(o => ({
      'Colaborador': rhCollaborators.find(c => c.id === o.collaboratorId)?.fullName || 'Desconhecido',
      'CPF': rhCollaborators.find(c => c.id === o.collaboratorId)?.cpf || '',
      'Tipo': o.type,
      'Data Início': o.startDate,
      'Data Fim': o.endDate,
      'Quantidade de Dias': o.daysCount,
      'Observações': o.notes || '',
      'Anexo Presente': o.fileUrl ? 'Sim' : 'Não'
    }));
    exportToCSV(exportData, 'ocorrencias_rh');
  };

  const handleExportExcel = () => {
    const exportData = filtered.map(o => ({
      'Colaborador': rhCollaborators.find(c => c.id === o.collaboratorId)?.fullName || 'Desconhecido',
      'CPF': rhCollaborators.find(c => c.id === o.collaboratorId)?.cpf || '',
      'Tipo': o.type,
      'Data Início': o.startDate,
      'Data Fim': o.endDate,
      'Quantidade de Dias': o.daysCount,
      'Observações': o.notes || '',
      'Anexo Presente': o.fileUrl ? 'Sim' : 'Não'
    }));
    exportToExcel(exportData, 'ocorrencias_rh');
  };

  const handleExportPDF = () => {
    const headers = ['Colaborador', 'Tipo de Ocorrência', 'Início', 'Fim', 'Dias'];
    const exportData = filtered.map(o => [
      rhCollaborators.find(c => c.id === o.collaboratorId)?.fullName || 'Desconhecido',
      o.type,
      new Date(o.startDate).toLocaleDateString('pt-BR'),
      new Date(o.endDate).toLocaleDateString('pt-BR'),
      String(o.daysCount)
    ]);
    exportToPDF(headers, exportData, 'ocorrencias_rh', 'Relatório de Afastamentos e Ocorrências R.H.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 id="rh-occurrence-title" className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">FALTAS, ATESTADOS E OCORRÊNCIAS</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Controle rigoroso de afastamentos, atestados médicos, licenças e férias</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow-md transition-all uppercase tracking-wider"
        >
          <Plus size={16} /> Lançar Ocorrência
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por colaborador ou tipo de ocorrência..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Occurrence Type Filter */}
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="">Todos os Tipos</option>
            <option value="Atestado Médico">Atestado Médico</option>
            <option value="Falta Justificada">Falta Justificada</option>
            <option value="Falta Injustificada">Falta Injustificada</option>
            <option value="Licença Maternidade">Licença Maternidade</option>
            <option value="Licença Paternidade">Licença Paternidade</option>
            <option value="Afastamento INSS">Afastamento INSS</option>
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
          emptyMessage="Nenhuma ocorrência registrada com os filtros atuais."
          renderRow={(o) => {
            const colabName = rhCollaborators.find(c => c.id === o.collaboratorId)?.fullName || 'Desconhecido';
            return (
              <tr
                key={o.id}
                onClick={() => {
                  setSelectedOccurrence(o);
                  setIsDetailModalOpen(true);
                }}
                className="border-b border-slate-200 dark:border-slate-700/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/30 cursor-pointer transition-all text-xs text-slate-900 dark:text-slate-200"
              >
                <td className="px-6 py-4 font-black">{colabName}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-[10px] font-black rounded uppercase tracking-wider ${
                    o.type === 'Atestado Médico' ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400' :
                    o.type.includes('Licença') ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-400' :
                    o.type.includes('Injustificada') ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400' :
                    'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400'
                  }`}>
                    {o.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">{new Date(o.startDate).toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-4 text-slate-500">{new Date(o.endDate).toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{o.daysCount} dias</td>
                <td className="px-6 py-4">
                  {o.fileUrl ? (
                    <span className="bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 font-extrabold text-[9px] px-2 py-0.5 rounded uppercase border border-indigo-500/20 flex items-center gap-1 w-max">
                      <Paperclip size={10} /> 1 anexo
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
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
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total: {totalItems} ocorrências</p>
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

      {/* DETALHES DA OCORRÊNCIA MODAL (Popup de visualização polida) */}
      {isDetailModalOpen && selectedOccurrence && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700 animate-scale-up">
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-black rounded uppercase tracking-wider">{selectedOccurrence.type}</span>
                <div className="flex flex-col">
                  <h2 className="text-md font-black text-slate-900 dark:text-white leading-none">Ocorrência de R.H.</h2>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lançamento ID: {selectedOccurrence.id}</span>
                </div>
              </div>
              <button onClick={() => { setIsDetailModalOpen(false); setSelectedOccurrence(null); }} className="h-10 w-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-700 dark:text-white transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 text-xs">
              {(() => {
                const colab = rhCollaborators.find(c => c.id === selectedOccurrence.collaboratorId);
                const colabName = colab?.fullName || 'Desconhecido';
                const colabCpf = colab?.cpf || '---';

                return (
                  <div className="space-y-6">
                    {/* Ficha técnica em duas colunas */}
                    <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-700/60 p-5 rounded-2xl space-y-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block leading-none mb-1">Colaborador Ausente</span>
                        <p className="font-black text-slate-900 dark:text-white">{colabName}</p>
                        <p className="text-slate-500 font-bold font-mono">CPF: {colabCpf}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-150 dark:border-slate-800">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block leading-none mb-1">Data Início</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(selectedOccurrence.startDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block leading-none mb-1">Data Fim</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(selectedOccurrence.endDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-150 dark:border-slate-800 flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block leading-none">Dias de Afastamento Total</span>
                        <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-xs rounded-lg">{selectedOccurrence.daysCount} dias corridos</span>
                      </div>
                    </div>

                    {/* Observações / Descrição */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block leading-none">Observações e Detalhes</span>
                      <p className="p-4 bg-slate-100 dark:bg-slate-900 text-xs rounded-xl text-slate-800 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                        {selectedOccurrence.notes || 'Nenhuma observação informada.'}
                      </p>
                    </div>

                    {/* Anexos de certificado/atestado */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block leading-none">Anexo Regulamentar</span>
                      {selectedOccurrence.fileUrl ? (
                        <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-lg shrink-0">
                              <FileText size={16} />
                            </div>
                            <div>
                              <span className="block font-bold text-xs text-slate-800 dark:text-white leading-none">Cópia do Atestado / Comprovante</span>
                              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Arquivo anexado à ocorrência</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewData({ url: selectedOccurrence.fileUrl!, name: `Atestado_${selectedOccurrence.type}` });
                              setIsPreviewOpen(true);
                            }}
                            className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          >
                            <Eye size={12} /> Visualizar
                          </button>
                        </div>
                      ) : (
                        <p className="text-slate-400 text-xs italic">Nenhum certificado ou atestado anexado a esta ocorrência.</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-between items-center">
              <button
                onClick={() => handleDelete(selectedOccurrence.id)}
                className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs px-4 py-3 rounded-xl uppercase tracking-wider shadow-sm transition-all"
              >
                <Trash2 size={14} /> Excluir Registro
              </button>
              
              <button
                onClick={() => { setIsDetailModalOpen(false); setSelectedOccurrence(null); }}
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs rounded-xl uppercase tracking-wider transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LANÇAMENTO DE OCORRÊNCIA MODAL (Popup de cadastro) */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-700 animate-scale-up shadow-2xl">
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <h2 className="text-sm font-black uppercase text-indigo-600 tracking-wider">
                Lançar Nova Ocorrência R.H.
              </h2>
              <button onClick={() => setShowCreate(false)} className="h-10 w-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-700 dark:text-white transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Colaborador Afetado *</label>
                <select
                  required
                  value={form.collaboratorId}
                  onChange={e => setForm(p => ({ ...p, collaboratorId: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-bold"
                >
                  <option value="">Selecione o Colaborador...</option>
                  {rhCollaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.fullName} ({c.cpf})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tipo de Ocorrência / Motivo *</label>
                <select
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-bold"
                >
                  <option value="Atestado Médico">Atestado Médico</option>
                  <option value="Falta Justificada">Falta Justificada</option>
                  <option value="Falta Injustificada">Falta Injustificada</option>
                  <option value="Licença Maternidade">Licença Maternidade</option>
                  <option value="Licença Paternidade">Licença Paternidade</option>
                  <option value="Afastamento INSS">Afastamento INSS</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data Início Afastamento *</label>
                  <input
                    type="date"
                    required
                    value={formatDateForInput(form.startDate)}
                    onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data Fim Afastamento *</label>
                  <input
                    type="date"
                    required
                    value={formatDateForInput(form.endDate)}
                    onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Observações / Detalhes CID</label>
                <textarea
                  rows={3}
                  placeholder="Escreva detalhes adicionais, justificativas ou CID se necessário..."
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                />
              </div>

              {/* Upload de Atestado / Comprovante */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-150 dark:border-slate-700/60">
                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Anexar Cópia do Atestado / Comprovante</span>
                <label className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition-all">
                  <Upload size={16} className="text-indigo-500 shrink-0" />
                  <span className="truncate">{attachedFileName ? attachedFileName : 'Selecionar arquivo (PDF, Imagem, Doc)...'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                {attachedFileName && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-2 flex items-center gap-1">
                    <Check size={12} /> Arquivo '{attachedFileName}' carregado com sucesso.
                  </p>
                )}
              </div>
            </form>

            {/* Form Footer */}
            <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-6 py-3 bg-slate-250 hover:bg-slate-350 dark:bg-slate-700 text-slate-700 dark:text-slate-250 font-black text-xs rounded-xl uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl uppercase tracking-wider hover:shadow-md transition-all"
              >
                Lançar Ocorrência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pré-visualização de Arquivos */}
      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        fileUrl={previewData.url}
        fileName={previewData.name}
      />
    </div>
  );
};
