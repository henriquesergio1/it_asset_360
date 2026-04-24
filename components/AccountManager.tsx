
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SoftwareAccount, AccountType, User, Device } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, Shield, X, Eye, EyeOff, User as UserIcon, Smartphone, Briefcase, Lock, Save, AlertTriangle, FileText, SlidersHorizontal, Check, ChevronLeft, ChevronRight, ChevronDown, Info, ExternalLink, Globe, ArrowUp, ArrowDown, CreditCard, Key, ShieldCheck, UserCheck, Smartphone as DeviceIcon, FileSpreadsheet, Download, Copy } from 'lucide-react';
import { SortableResizableHeader } from './SortableResizableHeader';
import { DataTable, Column } from './DataTable';
import { normalizeString, copyToClipboard } from '../utils/stringUtils';
import { UI_LABEL_SMALL, UI_ICON_SIZE_SMALL, UI_BUTTON_PRIMARY, UI_BUTTON_SECONDARY, UI_BUTTON_SUCCESS, UI_BUTTON_DANGER } from '../constants';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';

// --- SUB-COMPONENTE: SearchableDropdown ---
interface Option {
  value: string;
  label: string;
  subLabel?: string;
}

interface SearchableDropdownProps {
  options: Option[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({ options, value, onChange, placeholder, icon, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchNormalized = normalizeString(searchTerm);
  const filteredOptions = options.filter(opt => 
    normalizeString(opt.label).includes(searchNormalized) || 
    (opt.subLabel && normalizeString(opt.subLabel).includes(searchNormalized))
  );

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full p-3 border-2 rounded-xl flex items-center justify-between transition-all
          ${disabled ? 'bg-slate-900 cursor-not-allowed border-slate-800 opacity-70' : 'bg-slate-800 cursor-pointer hover:border-indigo-400 border-slate-700'}
          ${isOpen ? 'ring-4 ring-indigo-900/20 border-indigo-500' : ''}
        `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {icon && <span className="shrink-0">{icon}</span>}
          <div className="flex flex-col truncate">
            {selectedOption ? (
              <>
                <span className={`font-bold text-sm truncate ${disabled ? '' : 'text-slate-100'}`}>{selectedOption.label}</span>
                {selectedOption.subLabel && <span className={`text-[11px] truncate font-mono uppercase tracking-tighter ${disabled ? '' : ''}`}>{selectedOption.subLabel}</span>}
              </>
            ) : (
              <span className="text-sm">{placeholder}</span>
            )}
          </div>
        </div>
        <ChevronDown size={16} className={`text-indigo-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-[120] mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl max-h-60 overflow-hidden flex flex-col animate-fade-in shadow-2xl">
          <div className="p-2 border-b border-slate-700 bg-slate-900 flex items-center gap-2 sticky top-0">
            <Search size={14} className="ml-2 text-slate-400"/>
            <input 
              type="text"
              className="flex-1 bg-transparent outline-none text-sm text-slate-200 placeholder-slate-400 py-1"
              placeholder="Buscar..."
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <div 
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }}
                className={`px-4 py-3 cursor-pointer hover:bg-indigo-900/20 border-b border-slate-700 last:border-b-0 ${value === opt.value ? 'bg-indigo-900/30' : ''}`}
              >
                <div className="font-bold text-slate-100 text-sm">{opt.label}</div>
                {opt.subLabel && <div className="text-[11px] font-mono uppercase text-slate-400">{opt.subLabel}</div>}
              </div>
            )) : (
              <div className="px-4 py-8 text-center text-xs italic text-slate-500">Nenhum resultado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const COLUMN_OPTIONS = [
  { id: 'name', label: 'Nome / Adicional' },
  { id: 'login', label: 'Login / E-mail' },
  { id: 'password', label: 'Senha' },
  { id: 'accessUrl', label: 'Acesso / URL' },
  { id: 'link', label: 'Vínculo' },
  { id: 'status', label: 'Status' }
];

const AccountManager = () => {
  const { accounts, addAccount, updateAccount, deleteAccount, users, devices, models, brands, isReadOnly } = useData();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accountId = params.get('accountId');
    if (accountId) {
      const acc = accounts.find(a => a.id === accountId);
      if (acc) {
        setEditingAccount(acc);
        setIsModalOpen(true);
      }
    }
  }, [location.search, accounts]);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<AccountType | 'ALL'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<SoftwareAccount> | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // UI States
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('account_manager_columns');
    return saved ? JSON.parse(saved) : ['name', 'login', 'accessUrl', 'link', 'status'];
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('account_manager_widths');
    return saved ? JSON.parse(saved) : {};
  });

  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(20);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const accountColumns: Column<SoftwareAccount>[] = [
    { key: 'name', label: 'Nome / Adicional', minWidth: '200px', sortable: true },
    { key: 'login', label: 'Login / E-mail', minWidth: '180px', sortable: true },
    ...(visibleColumns.includes('password') ? [{ key: 'password', label: 'Senha', minWidth: '120px', sortable: false } as Column<SoftwareAccount>] : []),
    ...(visibleColumns.includes('accessUrl') ? [{ key: 'accessUrl', label: 'Acesso / URL', minWidth: '150px', sortable: true } as Column<SoftwareAccount>] : []),
    ...(visibleColumns.includes('link') ? [{ key: 'link', label: 'Vínculo', minWidth: '150px', sortable: false } as Column<SoftwareAccount>] : []),
    { key: 'status', label: 'Status', minWidth: '100px', sortable: true },
    { key: 'actions', label: 'Ações', minWidth: '120px', sortable: false }
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) setIsColumnSelectorOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('account_manager_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('account_manager_widths', JSON.stringify(columnWidths));
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

  const toggleColumn = (id: string) => {
    setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const exportData = filteredAccounts.map(acc => {
      const respUsers = (acc.userIds || []).map(id => users.find(u => u.id === id)?.fullName || '').join(', ');
      const respDevices = (acc.deviceIds || []).map(id => devices.find(d => d.id === id)?.assetTag || '').join(', ');
      return {
        'Nome': acc.name,
        'Tipo': acc.type,
        'Login': acc.login,
        'Vínculo': `${respUsers} ${respDevices}`.trim() || '---',
        'Status': acc.status
      };
    });

    const fileName = `licencas_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') exportToCSV(exportData, fileName);
    if (format === 'excel') exportToExcel(exportData, fileName);
    if (format === 'pdf') {
      const headers = ['Nome', 'Tipo', 'Login', 'Status'];
      const rows = exportData.map(d => [d.Nome, d.Tipo, d.Login, d.Status]);
      exportToPDF(headers, rows, fileName, 'Relatório de Licenças e Contas');
    }
  };

  const handleOpenModal = (account?: SoftwareAccount) => {
    if (account) {
      setEditingAccount(account);
    } else {
      setEditingAccount({ 
        name: '', 
        type: AccountType.EMAIL, 
        login: '', 
        status: 'Ativo',
        userIds: [],
        deviceIds: [],
        accessUrl: '',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    try {
      const adminName = currentUser?.name || 'Sistema';
      if (editingAccount.id) {
        await updateAccount(editingAccount as SoftwareAccount, adminName);
        showToast('Licença atualizada com sucesso!', 'success');
      } else {
        await addAccount({ ...editingAccount, id: Math.random().toString(36).substr(2, 9) } as SoftwareAccount, adminName);
        showToast('Licença criada com sucesso!', 'success');
      }
      setIsModalOpen(false);
    } catch (error) {
      showToast('Erro ao salvar licença: ' + (error as Error).message, 'error');
    }
  };

  const handleOpenUrl = (url?: string) => {
    if (!url) return;
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('ftp://')) {
      finalUrl = 'https://' + finalUrl;
    }
    window.open(finalUrl, '_blank');
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
  };

  const confirmDelete = async () => {
    if (!isDeleting) return;
    
    try {
      const adminName = currentUser?.name || 'Sistema';
      await deleteAccount(isDeleting, adminName);
      showToast('Licença excluída com sucesso!', 'success');
      setIsDeleting(null);
    } catch (error) {
      showToast('Erro ao excluir licença: ' + (error as Error).message, 'error');
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAccounts = React.useMemo(() => {
    let sortableItems = [...accounts];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof SoftwareAccount];
        let bValue: any = b[sortConfig.key as keyof SoftwareAccount];

        // Resolução de nomes para chaves de ID
        if (sortConfig.key === 'link') {
          const aUsers = (a.userIds || []).map(id => users.find(u => u.id === id)?.fullName || '').join(', ');
          const aDevices = (a.deviceIds || []).map(id => devices.find(d => d.id === id)?.assetTag || '').join(', ');
          aValue = `${aUsers} ${aDevices}`.trim();

          const bUsers = (b.userIds || []).map(id => users.find(u => u.id === id)?.fullName || '').join(', ');
          const bDevices = (b.deviceIds || []).map(id => devices.find(d => d.id === id)?.assetTag || '').join(', ');
          bValue = `${bUsers} ${bDevices}`.trim();
        }

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
      sortableItems.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sortableItems;
  }, [accounts, sortConfig, users, devices]);

  const filteredAccounts = sortedAccounts.filter(acc => {
    const searchNormalized = normalizeString(searchTerm);
    const matchesSearch = normalizeString(acc.name).includes(searchNormalized) ||
      normalizeString(acc.login).includes(searchNormalized) ||
      normalizeString(acc.accessUrl || '').includes(searchNormalized) ||
      normalizeString(acc.notes || '').includes(searchNormalized);
    
    const matchesType = activeFilter === 'ALL' || acc.type === activeFilter;
    
    return matchesSearch && matchesType;
  });

  // Paginação
  const totalItems = filteredAccounts.length;
  const currentItemsPerPage = itemsPerPage === 'ALL' ? totalItems : itemsPerPage;
  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(totalItems / currentItemsPerPage);
  const startIndex = (currentPage - 1) * (itemsPerPage === 'ALL' ? 0 : itemsPerPage as number);
  const paginatedAccounts = itemsPerPage === 'ALL' ? filteredAccounts : filteredAccounts.slice(startIndex, startIndex + (itemsPerPage as number));

  const userOptions = users.map(u => ({ value: u.id, label: u.fullName, subLabel: `CPF: ${u.cpf}`}));
  const deviceOptions = devices.map(d => {
    const model = models.find(m => m.id === d.modelId);
    return { 
      value: d.id, 
      label: `${model?.name || 'Ativo'} - ${d.assetTag || d.serialNumber}`,
      subLabel: d.imei ? `IMEI: ${d.imei}` : d.assetTag
    };
  });

  return (
    <div className="space-y-6 animate-fade-in pb-20 relative">
      {/* CABEÇALHO PADRONIZADO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-xl border border-slate-800 transition-colors shadow-2xl">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-indigo-400" size={28} />
            Gestão de Contas e Licenças
          </h2>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1.5 opacity-80">Controle de credenciais e acessos corporativos</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
            <button onClick={() => handleExport('csv')} className="p-3 hover:bg-slate-800 border-r border-slate-800 text-slate-400 hover:text-indigo-400 transition-all shadow-inner" title="Exportar CSV"><FileText size={18}/></button>
            <button onClick={() => handleExport('excel')} className="p-3 hover:bg-slate-800 border-r border-slate-800 text-slate-400 hover:text-indigo-400 transition-all shadow-inner" title="Exportar Excel"><FileSpreadsheet size={18}/></button>
            <button onClick={() => handleExport('pdf')} className="p-3 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-all shadow-inner" title="Exportar PDF"><Download size={18}/></button>
          </div>

          <div className="relative" ref={columnRef}>
            <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-slate-950 border border-slate-800 text-slate-300 px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-800 font-black text-[10px] uppercase tracking-widest transition-all shadow-inner border-b-4 border-b-slate-800 active:border-b-0 active:translate-y-[2px]">
              <SlidersHorizontal size={18} /> Colunas
            </button>
            {isColumnSelectorOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl z-[80] overflow-hidden animate-fade-in shadow-2xl ring-1 ring-white/5">
                <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-widest">Personalizar Visão</span>
                  <button onClick={() => setIsColumnSelectorOpen(false)} className="hover:text-white transition-colors"><X size={14}/></button>
                </div>
                <div className="p-2 space-y-1 bg-slate-900/50">
                  {COLUMN_OPTIONS.map(col => (
                    <button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${visibleColumns.includes(col.id) ? ' bg-indigo-900/20 text-indigo-400 ' : ' hover:bg-slate-800 text-slate-500 hover:text-slate-300 '}`}>
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
            className={`bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-900/40 border-b-4 border-b-indigo-800 active:border-b-0 active:translate-y-[2px] ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Plus size={18} /> Nova Conta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-indigo-500/30 group shadow-lg">
          <div>
            <span className="text-[11px] font-black text-indigo-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Total de Contas</span>
            <p className="text-2xl font-black text-slate-100">{accounts.length}</p>
          </div>
          <div className="h-12 w-12 bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-800/30 group-hover:scale-110 transition-transform"><Shield size={24}/></div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-emerald-500/30 group shadow-lg">
          <div>
            <span className="text-[11px] font-black text-emerald-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Ativas</span>
            <p className="text-2xl font-black text-slate-100">{accounts.filter(a => a.status === 'Ativo').length}</p>
          </div>
          <div className="h-12 w-12 bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-800/30 group-hover:scale-110 transition-transform"><UserCheck size={24}/></div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-blue-500/30 group shadow-lg">
          <div>
            <span className="text-[11px] font-black text-blue-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Vínculos</span>
            <p className="text-2xl font-black text-slate-100">{accounts.reduce((acc, a) => acc + (a.userIds?.length || 0) + (a.deviceIds?.length || 0), 0)}</p>
          </div>
          <div className="h-12 w-12 bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-800/30 group-hover:scale-110 transition-transform"><Globe size={24}/></div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-800 overflow-x-auto p-1.5 bg-slate-950 rounded-2xl transition-colors shadow-inner mb-6">
        <button 
          onClick={() => setActiveFilter('ALL')} 
          className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 rounded-xl whitespace-nowrap ${activeFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
        >
          Todas
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'}`}>{accounts.length}</span>
        </button>
        {Object.values(AccountType).map(type => (
          <button 
            key={type} 
            onClick={() => setActiveFilter(type)} 
            className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 rounded-xl whitespace-nowrap ${activeFilter === type ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
          >
            {type}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeFilter === type ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'}`}>{accounts.filter(a => a.type === type).length}</span>
          </button>
        ))}
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
        <input 
          type="text"
          placeholder="Buscar por nome, login ou endereço de acesso..."
          className="pl-12 w-full border-none rounded-2xl py-4 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-100 bg-slate-900 transition-all border-2 border-transparent focus:border-indigo-900/50 shadow-inner"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl ring-1 ring-white/5 transition-all">
        <DataTable
          columns={accountColumns}
          data={paginatedAccounts}
          sortConfig={sortConfig}
          requestSort={handleSort}
          columnWidths={columnWidths}
          onResize={handleResize}
          renderRow={(acc) => (
            <tr 
              key={acc.id} 
              onClick={() => handleOpenModal(acc)} 
              className="hover:bg-slate-800/60 border-l-4 border-l-transparent hover:border-l-indigo-500 transition-all cursor-pointer bg-slate-900 border-b border-slate-800/50 group"
            >
              {visibleColumns.includes('name') && (
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-100 group-hover:text-white transition-colors">{acc.name}</div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500/80">{acc.type}</div>
                </td>
              )}
              {visibleColumns.includes('login') && (
                <td className="px-6 py-4 truncate font-medium text-xs tracking-tight text-slate-300">{acc.login}</td>
              )}
              {visibleColumns.includes('password') && (
                <td className="px-6 py-4 truncate">
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-slate-800 px-3 py-1 rounded-full font-mono text-[11px] font-bold text-slate-300 border border-slate-700/50">
                      {showPasswords[acc.id] ? (acc.password || '---') : '••••••••'}
                    </div>
                    <button type="button" onClick={(e) => { e.preventDefault(); setShowPasswords(p => ({...p, [acc.id]: !p[acc.id]})); }} className="text-slate-500 hover:text-white p-1 hover:bg-slate-700 rounded-lg transition-all" title={showPasswords[acc.id] ? "Ocultar Senha" : "Mostrar Senha"}>
                      {showPasswords[acc.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </button>
                    {acc.password && (
                      <button 
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const success = await copyToClipboard(acc.password || '');
                          if (success) {
                            showToast('Senha copiada para a área de transferência', 'success');
                          } else {
                            showToast('Erro ao copiar senha', 'error');
                          }
                        }} 
                        className="text-slate-500 hover:text-blue-400 p-1 hover:bg-slate-700 rounded-lg transition-all" 
                        title="Copiar Senha"
                      >
                        <Copy size={14} />
                      </button>
                    )}
                  </div>
                </td>
              )}
              {visibleColumns.includes('accessUrl') && (
                <td className="px-6 py-4 truncate">
                  {acc.accessUrl ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-400 truncate max-w-[150px] font-mono hover:underline">{acc.accessUrl}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenUrl(acc.accessUrl); }}
                        className="p-1.5 hover:text-blue-400 hover:bg-blue-900/30 rounded-lg transition-all text-slate-500"
                        title="Abrir Link"
                      >
                        <ExternalLink size={14}/>
                      </button>
                    </div>
                  ) : <span className="text-slate-500 italic text-[11px] font-bold uppercase tracking-tighter">Não informado</span>}
                </td>
              )}
              {visibleColumns.includes('link') && (
                <td className="px-6 py-4 truncate">
                  <div className="flex flex-wrap gap-1.5">
                    {(acc.userIds || []).map(uid => {
                      const u = users.find(user => user.id === uid);
                      return u ? (
                        <span key={uid} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-900/30 text-indigo-400 text-[11px] font-bold border border-indigo-800 animate-fade-in shadow-sm">
                          <UserIcon size={UI_ICON_SIZE_SMALL} /> {u.fullName}
                        </span>
                      ) : null;
                    })}
                    {(acc.deviceIds || []).map(did => {
                      const d = devices.find(dev => dev.id === did);
                      return d ? (
                        <span key={did} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/30 text-emerald-400 text-[11px] font-bold border border-emerald-800 animate-fade-in shadow-sm">
                          <Smartphone size={UI_ICON_SIZE_SMALL} /> {d.assetTag}
                        </span>
                      ) : null;
                    })}
                    {(!acc.userIds?.length && !acc.deviceIds?.length) && (
                      <span className="text-[11px] italic text-slate-600 font-bold uppercase tracking-tighter">Sem vínculos</span>
                    )}
                  </div>
                </td>
              )}
              {visibleColumns.includes('status') && (
                <td className="px-6 py-4 text-center truncate">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${acc.status === 'Ativo' ? ' bg-emerald-900/20 text-emerald-400 border border-emerald-800/50' : ' bg-rose-900/20 text-rose-400 border border-rose-800/50'}`}>
                    {acc.status}
                  </span>
                </td>
              )}
              <td className="px-6 py-4 text-right truncate">
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => handleOpenModal(acc)} 
                    disabled={isReadOnly}
                    className={`p-2 text-indigo-400 hover:bg-indigo-900/30 rounded-xl transition-all ${isReadOnly ? 'opacity-50' : 'hover:scale-110 active:scale-95'}`}
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(acc.id)} 
                    disabled={isReadOnly}
                    className={`p-2 text-red-400 hover:bg-red-900/30 rounded-xl transition-all ${isReadOnly ? 'opacity-50' : 'hover:scale-110 active:scale-95'}`}
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
        
        {/* Pagination Footer */}
        <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors font-bold uppercase tracking-widest">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500">Exibir:</span>
              <select 
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-black text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value={100}>100</option>
                <option value="ALL">Todos</option>
              </select>
            </div>
            <p className="text-[11px] text-slate-500">Total: {totalItems} registros</p>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className={`p-2 rounded-xl border border-slate-800 transition-all ${currentPage === 1 ? 'text-slate-700 cursor-not-allowed' : ' text-indigo-400 hover:bg-indigo-900/30 hover:border-indigo-800'}`}
              >
                <ChevronLeft size={18}/>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-indigo-400 bg-indigo-900/20 px-3 py-1.5 rounded-xl border border-indigo-900/30">{currentPage}</span>
                <span className="text-[11px] font-black text-slate-600">DE</span>
                <span className="text-xs font-black text-slate-400">{totalPages}</span>
              </div>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className={`p-2 rounded-xl border border-slate-800 transition-all ${currentPage === totalPages ? 'text-slate-700 cursor-not-allowed' : ' text-indigo-400 hover:bg-indigo-900/30 hover:border-indigo-800'}`}
              >
                <ChevronRight size={18}/>
              </button>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && editingAccount && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-2xl overflow-hidden animate-scale-up border border-slate-800 flex flex-col max-h-[95vh] shadow-2xl transition-all ring-1 ring-white/10">
            <div className="bg-black px-10 py-6 flex justify-between items-center border-b border-white/5 shrink-0">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner ${editingAccount.id ? 'bg-indigo-900/30 text-indigo-400' : 'bg-emerald-900/30 text-emerald-400'}`}>
                   {editingAccount.id ? <ShieldCheck size={24}/> : <Plus size={24}/>}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight leading-tight">
                    {editingAccount.id ? 'Editar Credencial' : 'Nova Credencial'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500/80 uppercase tracking-wider">{editingAccount.id ? `ID: ${editingAccount.id}` : 'Cadastro no Sistema'}</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white transition-all hover:rotate-90"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2 bg-slate-800/30 p-6 rounded-3xl border border-slate-800">
                  <label className="block text-[11px] font-bold uppercase text-indigo-400 mb-2 ml-1 tracking-wider">Identificação da Licença / Conta</label>
                  <input 
                    required 
                    className="w-full border-2 border-slate-800 rounded-2xl p-4 text-base font-bold bg-slate-800 text-slate-100 focus:border-indigo-500 outline-none transition-all shadow-inner"
                    value={editingAccount.name} 
                    onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} 
                    placeholder="Ex: Google Workspace, AWS Production..."
                  />
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500/80 mb-2 ml-1 tracking-wider">Tipo de Serviço</label>
                    <select 
                      className="w-full border-2 border-slate-800 rounded-2xl p-4 text-sm font-bold bg-slate-800 text-slate-100 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                      value={editingAccount.type} 
                      onChange={e => setEditingAccount({...editingAccount, type: e.target.value as AccountType})}
                    >
                      {Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500/80 mb-2 ml-1 tracking-wider">Status Atual</label>
                    <select 
                      className={`w-full border-2 rounded-2xl p-4 text-sm font-bold outline-none transition-all cursor-pointer ${editingAccount.status === 'Ativo' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/30 focus:border-emerald-500' : 'bg-rose-900/20 text-rose-400 border-rose-900/30 focus:border-rose-500'}`}
                      value={editingAccount.status} 
                      onChange={e => setEditingAccount({...editingAccount, status: e.target.value as any})}
                    >
                      <option value="Ativo">Ativo / Em uso</option>
                      <option value="Inativo">Inativo / Suspenso</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-2 ml-1 tracking-widest">Login / Credencial Primary</label>
                    <input 
                      required 
                      className="w-full border-2 border-slate-800 rounded-2xl p-4 text-sm font-bold bg-slate-800 text-slate-100 focus:border-indigo-500 outline-none transition-all"
                      value={editingAccount.login} 
                      onChange={e => setEditingAccount({...editingAccount, login: e.target.value})} 
                      placeholder="e-mail ou usuário"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-2 ml-1 tracking-widest">Master Key / Senha</label>
                    <div className="relative">
                      <input 
                        type={showPasswords['modal'] ? 'text' : 'password'}
                        className="w-full border-2 border-slate-800 rounded-2xl p-4 pr-12 text-sm font-mono bg-slate-800 text-slate-100 focus:border-indigo-500 outline-none transition-all"
                        value={editingAccount.password || ''} 
                        onChange={e => setEditingAccount({...editingAccount, password: e.target.value})} 
                        placeholder="••••••••"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPasswords(p => ({...p, modal: !p.modal}))}
                        className="absolute right-4 top-3.5 p-1 text-slate-500 hover:text-white transition-colors"
                      >
                        {showPasswords['modal'] ? <EyeOff size={18}/> : <Eye size={18}/>}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-2 ml-1 tracking-widest">URL de Gestão / Acesso Web</label>
                  <div className="relative group">
                    <Globe className="absolute left-4 top-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18}/>
                    <input 
                      className="w-full border-2 border-slate-800 rounded-2xl p-4 pl-12 text-sm font-mono bg-slate-800 text-slate-100 focus:border-blue-500 outline-none transition-all"
                      value={editingAccount.accessUrl || ''} 
                      onChange={e => setEditingAccount({...editingAccount, accessUrl: e.target.value})} 
                      placeholder="https://dashboard.service.com"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-6 pt-4">
                  <h4 className="text-[11px] font-black uppercase text-indigo-400 border-b border-slate-800 pb-2 flex items-center gap-2 mb-2">
                    <Info size={16}/> Vínculos e Dependências
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 tracking-[0.2em] ml-1">Colaboradores Associados</label>
                      <SearchableDropdown 
                        options={userOptions.filter(o => !(editingAccount.userIds || []).includes(o.value))} 
                        value=""
                        onChange={val => {
                          if (val) setEditingAccount({...editingAccount, userIds: [...(editingAccount.userIds || []), val]});
                        }} 
                        placeholder="Vincular Pessoa..."
                        icon={<UserCheck size={18} className="text-indigo-400"/>}
                      />
                      
                      <div className="flex flex-wrap gap-2 min-h-12 bg-slate-800/20 p-2 rounded-2xl border border-slate-800/50">
                        {(editingAccount.userIds || []).length > 0 ? (editingAccount.userIds || []).map(uid => {
                          const u = users.find(user => user.id === uid);
                          return u ? (
                            <div key={uid} className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-900/30 border border-indigo-800 hover:border-red-500 transition-all animate-scale-up">
                              <span className="text-[11px] font-bold text-indigo-300">{u.fullName}</span>
                              <button type="button" onClick={() => setEditingAccount({...editingAccount, userIds: (editingAccount.userIds || []).filter(id => id !== uid)})} className="text-indigo-500 group-hover:text-red-500">
                                <X size={12}/>
                              </button>
                            </div>
                          ) : null;
                        }) : <span className="text-[11px] font-bold italic text-slate-600 self-center mx-auto uppercase">Nenhum Vínculo Humano</span>}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 tracking-[0.2em] ml-1">Dispositivos Associados</label>
                      <SearchableDropdown 
                        options={deviceOptions.filter(o => !(editingAccount.deviceIds || []).includes(o.value))} 
                        value=""
                        onChange={val => {
                          if (val) setEditingAccount({...editingAccount, deviceIds: [...(editingAccount.deviceIds || []), val]});
                        }} 
                        placeholder="Vincular Ativo..."
                        icon={<DeviceIcon size={18} className="text-emerald-400"/>}
                      />

                      <div className="flex flex-wrap gap-2 min-h-12 bg-slate-800/20 p-2 rounded-2xl border border-slate-800/50">
                        {(editingAccount.deviceIds || []).length > 0 ? (editingAccount.deviceIds || []).map(did => {
                          const d = devices.find(dev => dev.id === did);
                          return d ? (
                            <div key={did} className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-900/30 border border-emerald-800 hover:border-red-500 transition-all animate-scale-up">
                              <span className="text-[11px] font-bold text-emerald-300">{d.assetTag}</span>
                              <button type="button" onClick={() => setEditingAccount({...editingAccount, deviceIds: (editingAccount.deviceIds || []).filter(id => id !== did)})} className="text-emerald-500 group-hover:text-red-500">
                                <X size={12}/>
                              </button>
                            </div>
                          ) : null;
                        }) : <span className="text-[11px] font-bold italic text-slate-600 self-center mx-auto uppercase">Nenhum Vínculo de Hardware</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-4">
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-2 ml-1 tracking-widest">Histórico / Notas Internas</label>
                  <textarea 
                    className="w-full border-2 border-slate-800 rounded-3xl p-5 text-sm bg-slate-800 text-slate-100 focus:border-indigo-500 outline-none transition-all min-h-[120px] resize-none"
                    rows={4} 
                    value={editingAccount.notes || ''} 
                    onChange={e => setEditingAccount({...editingAccount, notes: e.target.value})} 
                    placeholder="Logs de alteração, motivos de suspensão, finalidade da conta..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-8 py-4 text-[11px] font-black uppercase hover:bg-slate-800 rounded-2xl transition-all tracking-[0.2em] text-slate-500 hover:text-white"
                >
                  Descartar
                </button>
                <button 
                  type="submit" 
                  disabled={isReadOnly}
                  className={`px-12 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-black text-[11px] uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-xl shadow-indigo-900/30 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Confirmar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {isDeleting && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-sm overflow-hidden border border-slate-800 animate-scale-up shadow-2xl">
            <div className="p-10 text-center">
              <div className="h-24 w-24 bg-rose-900/30 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-rose-900/40">
                <Trash2 size={44} className="animate-pulse" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-3">Expurgar Registro?</h3>
              <p className="font-medium text-slate-400 mb-10 text-sm leading-relaxed px-4">
                Esta ação é irreversível e removerá todos os vínculos desta credencial do ecossistema.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleting(null)}
                  className="flex-1 py-5 px-6 rounded-2xl bg-slate-800 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:bg-slate-700 transition-all"
                >
                  Manter
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-5 px-6 rounded-2xl bg-rose-600 text-white font-black uppercase text-[11px] tracking-widest hover:bg-rose-700 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-rose-900/40"
                >
                  Expurgar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManager;
