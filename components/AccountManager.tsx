import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SoftwareAccount, AccountType, User, Device } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, Shield, X, Eye, EyeOff, User as UserIcon, Smartphone, Briefcase, Lock, Save, AlertTriangle, FileText, SlidersHorizontal, Check, ChevronLeft, ChevronRight, ChevronDown, Info } from 'lucide-react';

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

    const filteredOptions = options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="relative" ref={wrapperRef}>
            <div 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full p-3 border-2 rounded-xl flex items-center justify-between cursor-pointer bg-white dark:bg-slate-800 transition-all
                    ${disabled ? 'bg-slate-100 dark:bg-slate-900 cursor-not-allowed text-gray-400 border-slate-200 dark:border-slate-800' : 'hover:border-indigo-400 border-indigo-200/50 dark:border-slate-700'}
                    ${isOpen ? 'ring-4 ring-indigo-100 dark:ring-indigo-900/20 border-indigo-500' : 'shadow-sm'}
                `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {icon && <span className="text-indigo-400 dark:text-indigo-500 shrink-0">{icon}</span>}
                    <div className="flex flex-col truncate">
                         {selectedOption ? (
                             <>
                                <span className="text-gray-900 dark:text-slate-100 font-bold text-sm truncate">{selectedOption.label}</span>
                                {selectedOption.subLabel && <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate font-mono uppercase">{selectedOption.subLabel}</span>}
                             </>
                         ) : (
                             <span className="text-gray-400 dark:text-slate-500 text-sm">{placeholder}</span>
                         )}
                    </div>
                </div>
                <ChevronDown size={16} className={`text-indigo-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-[120] mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-hidden flex flex-col animate-fade-in">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center gap-2 sticky top-0">
                        <Search size={14} className="text-slate-400 ml-2" />
                        <input 
                            type="text" 
                            className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 py-1"
                            placeholder="Pesquisar..."
                            autoFocus
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="overflow-y-auto flex-1">
                        <div 
                            onClick={() => { onChange(''); setIsOpen(false); setSearchTerm(''); }}
                            className="px-4 py-3 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 border-b border-slate-50 dark:border-slate-700 text-red-500 font-bold text-xs uppercase"
                        >
                            Nenhum / Remover Vínculo
                        </div>
                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                            <div 
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }}
                                className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-slate-50 dark:border-slate-700 last:border-0 ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                            >
                                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{opt.label}</div>
                                {opt.subLabel && <div className="text-[10px] text-gray-500 dark:text-slate-400 font-mono uppercase mt-0.5">{opt.subLabel}</div>}
                            </div>
                        )) : (
                            <div className="px-4 py-8 text-center text-slate-400 text-xs italic">Sem resultados.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Componente divisor para redimensionamento
const Resizer = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
    <div 
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-400/50 transition-colors z-10"
    />
);

const COLUMN_OPTIONS = [
    { id: 'name', label: 'Software / Serviço' },
    { id: 'type', label: 'Tipo' },
    { id: 'login', label: 'Login / Acesso' },
    { id: 'password', label: 'Senha' },
    { id: 'license', label: 'Adicional / Outros' },
    { id: 'vinc', label: 'Vínculo Atual' },
    { id: 'notes', label: 'Observações' }
];

const AccountManager = () => {
  const { accounts, addAccount, updateAccount, deleteAccount, users, devices, sectors, models, brands } = useData();
  const { user: currentUser } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<AccountType | 'ALL'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [editReason, setEditReason] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
      const saved = localStorage.getItem('account_manager_columns');
      return saved ? JSON.parse(saved) : ['name', 'login', 'license', 'vinc'];
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

  const [formData, setFormData] = useState<Partial<SoftwareAccount>>({
      type: AccountType.EMAIL,
      status: 'Ativo'
  });

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

  // Reset paginação ao filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter, itemsPerPage]);

  const adminName = currentUser?.name || 'Sistema';

  const toggleColumn = (id: string) => {
      setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

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

  const togglePassword = (id: string) => {
      setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenModal = (acc?: SoftwareAccount) => {
      if (acc) {
          setEditingId(acc.id);
          setFormData(acc);
      } else {
          setEditingId(null);
          setFormData({ type: AccountType.EMAIL, status: 'Ativo', name: '', login: '', password: '', licenseKey: '', notes: '', userId: null, deviceId: null });
      }
      setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.login || !formData.name) return;

      if (editingId) {
          setEditReason('');
          setIsReasonModalOpen(true);
      } else {
          addAccount({
              ...formData,
              id: Math.random().toString(36).substr(2, 9)
          } as SoftwareAccount, adminName);
          setIsModalOpen(false);
      }
  };

  const confirmEdit = () => {
      if (!editReason.trim()) {
          alert('Por favor, informe o motivo da alteração.');
          return;
      }
      updateAccount({ ...formData } as SoftwareAccount, adminName);
      setIsReasonModalOpen(false);
      setIsModalOpen(false);
  };

  const handleDeleteClick = (id: string) => {
      setDeleteTargetId(id);
      setDeleteReason('');
      setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
      if (!deleteReason.trim()) {
          alert('Por favor, informe o motivo da exclusão.');
          return;
      }
      deleteAccount(deleteTargetId!, `${adminName} (Motivo: ${deleteReason})`);
      setIsDeleteModalOpen(false);
  };

  const filteredAccounts = accounts.filter(acc => {
      if (activeFilter !== 'ALL' && acc.type !== activeFilter) return false;
      const search = searchTerm.toLowerCase();
      const linkedUser = users.find(u => u.id === acc.userId);
      const linkedDevice = devices.find(d => d.id === acc.deviceId);
      
      return acc.name.toLowerCase().includes(search) || 
             acc.login.toLowerCase().includes(search) ||
             (acc.licenseKey && acc.licenseKey.toLowerCase().includes(search)) ||
             (linkedUser && linkedUser.fullName.toLowerCase().includes(search)) ||
             (linkedDevice && linkedDevice.assetTag.toLowerCase().includes(search));
  }).sort((a,b) => a.name.localeCompare(b.name));

  // Cálculo de paginação
  const totalItems = filteredAccounts.length;
  const currentItemsPerPage = itemsPerPage === 'ALL' ? totalItems : itemsPerPage;
  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(totalItems / currentItemsPerPage);
  const startIndex = (currentPage - 1) * (itemsPerPage === 'ALL' ? 0 : itemsPerPage as number);
  const paginatedAccounts = itemsPerPage === 'ALL' ? filteredAccounts : filteredAccounts.slice(startIndex, startIndex + (itemsPerPage as number));

  // Opções para Dropdowns de Alocação
  const userOptions: Option[] = users.map(u => ({
      value: u.id,
      label: u.fullName,
      subLabel: `${u.email} • CPF: ${u.cpf} • ${u.internalCode || 'S/ Setor'}`
  })).sort((a,b) => a.label.localeCompare(b.label));

  const deviceOptions: Option[] = devices.map(d => {
      const { model } = models.find(m => m.id === d.modelId) ? { model: models.find(m => m.id === d.modelId) } : { model: null };
      const brand = brands.find(b => b.id === model?.brandId);
      return {
          value: d.id,
          label: `${d.assetTag} - ${brand?.name || ''} ${model?.name || 'Equipamento'}`,
          subLabel: `IMEI: ${d.imei || 'N/A'} • SN: ${d.serialNumber}`
      };
  }).sort((a,b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Software & Contas</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">Gestão centralizada de e-mails, acessos e licenças de software.</p>
        </div>
        <div className="flex gap-2">
            <div className="relative" ref={columnRef}>
                <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-800 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold transition-all">
                    <SlidersHorizontal size={18} /> Colunas
                </button>
                {isColumnSelectorOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[80] overflow-hidden animate-fade-in">
                        <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-500">Exibir Colunas</span>
                            <button onClick={() => setIsColumnSelectorOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                        </div>
                        <div className="p-2 space-y-1">
                            {COLUMN_OPTIONS.map(col => (
                                <button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${visibleColumns.includes(col.id) ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                    {col.label}
                                    {visibleColumns.includes(col.id) && <Check size={14}/>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all active:scale-95 font-bold">
              <Plus size={18} /> Novo Registro
            </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {['ALL', ...Object.values(AccountType)].map(type => (
              <button 
                key={type} 
                onClick={() => setActiveFilter(type as any)}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap
                    ${activeFilter === type ? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-400 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                  {type === 'ALL' ? 'Todos' : type}
              </button>
          ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3 text-gray-400 dark:text-slate-500" size={20} />
        <input 
            type="text" 
            placeholder="Pesquisar por nome, login, colaborador ou ativo..." 
            className="pl-12 w-full border-none rounded-xl py-3 shadow-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700 dark:text-slate-100 bg-white dark:bg-slate-900 transition-colors" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left table-fixed">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-widest border-b dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 relative" style={{ width: columnWidths['name'] || '220px' }}>
                    Software / Serviço
                    <Resizer onMouseDown={(e) => handleResize('name', e.clientX, columnWidths['name'] || 220)} />
                  </th>
                  {visibleColumns.includes('type') && (
                      <th className="px-6 py-4 relative" style={{ width: columnWidths['type'] || '120px' }}>
                          Tipo
                          <Resizer onMouseDown={(e) => handleResize('type', e.clientX, columnWidths['type'] || 120)} />
                      </th>
                  )}
                  {visibleColumns.includes('login') && (
                      <th className="px-6 py-4 relative" style={{ width: columnWidths['login'] || '200px' }}>
                          Login / Acesso
                          <Resizer onMouseDown={(e) => handleResize('login', e.clientX, columnWidths['login'] || 200)} />
                      </th>
                  )}
                  {visibleColumns.includes('password') && (
                      <th className="px-6 py-4 relative" style={{ width: columnWidths['password'] || '150px' }}>
                          Senha
                          <Resizer onMouseDown={(e) => handleResize('password', e.clientX, columnWidths['password'] || 150)} />
                      </th>
                  )}
                  {visibleColumns.includes('license') && (
                      <th className="px-6 py-4 relative" style={{ width: columnWidths['license'] || '180px' }}>
                          Adicional / Outros
                          <Resizer onMouseDown={(e) => handleResize('license', e.clientX, columnWidths['license'] || 180)} />
                      </th>
                  )}
                  {visibleColumns.includes('vinc') && (
                      <th className="px-6 py-4 relative" style={{ width: columnWidths['vinc'] || '200px' }}>
                          Vínculo Atual
                          <Resizer onMouseDown={(e) => handleResize('vinc', e.clientX, columnWidths['vinc'] || 200)} />
                      </th>
                  )}
                  {visibleColumns.includes('notes') && (
                      <th className="px-6 py-4 relative" style={{ width: columnWidths['notes'] || '200px' }}>
                          Observações
                          <Resizer onMouseDown={(e) => handleResize('notes', e.clientX, columnWidths['notes'] || 200)} />
                      </th>
                  )}
                  <th className="px-6 py-4 text-right" style={{ width: '120px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAccounts.map(acc => {
                    const linkedUser = users.find(u => u.id === acc.userId);
                    const linkedDevice = devices.find(d => d.id === acc.deviceId);

                    return (
                        <tr key={acc.id} onClick={() => handleOpenModal(acc)} className="border-b dark:border-slate-800 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/20 transition-all group bg-white dark:bg-slate-900 cursor-pointer">
                            <td className="px-6 py-4 truncate">
                                <div className="flex items-center gap-3">
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-sm transition-colors shrink-0 
                                        ${acc.type === AccountType.EMAIL ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 
                                          acc.type === AccountType.OFFICE ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                                          acc.type === AccountType.ERP ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                        {acc.type === AccountType.EMAIL ? <Mail size={16}/> : 
                                         acc.type === AccountType.OFFICE ? <FileText size={16}/> :
                                         acc.type === AccountType.ERP ? <Lock size={16}/> : <Shield size={16}/>}
                                    </div>
                                    <div className="truncate">
                                        <p className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">{acc.name}</p>
                                    </div>
                                </div>
                            </td>
                            {visibleColumns.includes('type') && (
                                <td className="px-6 py-4 truncate">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{acc.type}</span>
                                </td>
                            )}
                            {visibleColumns.includes('login') && (
                                <td className="px-6 py-4 truncate">
                                    <p className="font-medium text-slate-600 dark:text-slate-400 text-[11px] truncate">{acc.login}</p>
                                </td>
                            )}
                            {visibleColumns.includes('password') && (
                                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                        <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono text-[10px] text-slate-700 dark:text-slate-300 min-w-[80px] border dark:border-slate-700 shadow-inner truncate">
                                            {showPasswords[acc.id] ? (acc.password || '---') : '••••••••'}
                                        </div>
                                        <button onClick={() => togglePassword(acc.id)} className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                            {showPasswords[acc.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                                        </button>
                                    </div>
                                </td>
                            )}
                            {visibleColumns.includes('license') && (
                                <td className="px-6 py-4 truncate">
                                    <p className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 truncate">{acc.licenseKey || '---'}</p>
                                </td>
                            )}
                            {visibleColumns.includes('vinc') && (
                                <td className="px-6 py-4 truncate">
                                    {linkedUser ? (
                                        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                            <UserIcon size={12}/>
                                            <span className="text-[11px] font-bold truncate">{linkedUser.fullName}</span>
                                        </div>
                                    ) : linkedDevice ? (
                                        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                            <Smartphone size={12}/>
                                            <span className="text-[11px] font-bold truncate">{linkedDevice.assetTag}</span>
                                        </div>
                                    ) : (
                                        <span className="text-[9px] text-slate-300 dark:text-slate-700 font-black uppercase italic">Sem Vínculo</span>
                                    )}
                                </td>
                            )}
                            {visibleColumns.includes('notes') && (
                                <td className="px-6 py-4 truncate text-[10px] text-slate-500 dark:text-slate-400 italic">
                                    {acc.notes || '---'}
                                </td>
                            )}
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-1">
                                    <button onClick={() => handleOpenModal(acc)} className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-indigo-900/30 p-2 rounded-lg transition-all shadow-sm" title="Editar"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDeleteClick(acc.id)} className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-all shadow-sm" title="Excluir"><Trash2 size={16} /></button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
                {filteredAccounts.length === 0 && (
                    <tr>
                        <td colSpan={10} className="px-6 py-10 text-center text-slate-400 italic">Nenhum registro localizado.</td>
                    </tr>
                )}
              </tbody>
            </table>
        </div>

        {/* Paginação */}
        <div className="bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Exibir:</span>
                    <select 
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value="ALL">Todos</option>
                    </select>
                </div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total: {totalItems} registros</p>
            </div>
            
            {totalPages > 1 && (
                <div className="flex items-center gap-2">
                    <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className={`p-2 rounded-lg transition-all ${currentPage === 1 ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'}`}
                    >
                        <ChevronLeft size={18}/>
                    </button>
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 px-3 py-1.5 rounded-lg shadow-sm">{currentPage}</span>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mx-1">de</span>
                        <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">{totalPages}</span>
                    </div>
                    <button 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className={`p-2 rounded-lg transition-all ${currentPage === totalPages ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'}`}
                    >
                        <ChevronRight size={18}/>
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up border border-indigo-100 dark:border-indigo-900/40 transition-colors">
                  <div className="bg-slate-900 dark:bg-black px-8 py-5 flex justify-between items-center border-b border-white/10">
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter">{editingId ? 'Editar Registro' : 'Novo Software / Conta'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-8 space-y-5">
                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Nome do Software / Serviço</label>
                          <input required type="text" placeholder="Ex: Office 365, Zoom, ERP..." className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-bold transition-colors" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Tipo de Conta</label>
                              <select className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-bold" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as AccountType})}>
                                  {Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Status</label>
                              <select className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-bold" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                                  <option value="Ativo">Ativo</option>
                                  <option value="Inativo">Inativo</option>
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Login / E-mail / Acesso</label>
                          <input required type="text" placeholder="usuario@empresa.com" className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-medium transition-colors" value={formData.login || ''} onChange={e => setFormData({...formData, login: e.target.value})}/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Senha (Opcional)</label>
                              <input type="text" className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-mono" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••"/>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Adicional / Outros</label>
                              <input type="text" className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 font-mono" value={formData.licenseKey || ''} onChange={e => setFormData({...formData, licenseKey: e.target.value})} placeholder="Informações extras..."/>
                          </div>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Observações</label>
                          <textarea rows={2} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 italic" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Histórico ou detalhes adicionais..."/>
                      </div>

                      <div className="pt-2 border-t dark:border-slate-800">
                          <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-3 ml-1 tracking-widest">Alocação / Vínculo</label>
                          <div className="grid grid-cols-1 gap-4">
                              <div className="space-y-1">
                                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1 flex items-center gap-1"><UserIcon size={10}/> Colaborador</label>
                                  <SearchableDropdown 
                                      options={userOptions}
                                      value={formData.userId || ''}
                                      onChange={val => setFormData({...formData, userId: val || null, deviceId: null})}
                                      placeholder="Pesquisar por Nome, E-mail, CPF ou Setor..."
                                      icon={<UserIcon size={18}/>}
                                  />
                              </div>
                              <div className="space-y-1">
                                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1 flex items-center gap-1"><Smartphone size={10}/> Dispositivo</label>
                                  <SearchableDropdown 
                                      options={deviceOptions}
                                      value={formData.deviceId || ''}
                                      onChange={val => setFormData({...formData, deviceId: val || null, userId: null})}
                                      placeholder="Pesquisar por Patrimônio, IMEI, Modelo ou SN..."
                                      icon={<Smartphone size={18}/>}
                                  />
                              </div>
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-800">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all tracking-widest border border-slate-200 dark:border-slate-700">Fechar</button>
                          <button type="submit" className="px-8 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 shadow-xl font-black text-xs uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95">Salvar Registro</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: Motivo da Alteração */}
      {isReasonModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-indigo-100 dark:border-indigo-900/40">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-4 shadow-inner border border-indigo-100 dark:border-indigo-900/40"><Save size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Confirmar Alterações?</h3>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Informe o motivo da alteração para auditoria:</p>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 focus:border-indigo-300 dark:focus:border-indigo-700 outline-none mb-6 transition-all bg-white dark:bg-slate-800 dark:text-slate-100" rows={3} placeholder="Descreva o que foi alterado..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors">Voltar</button>
                          <button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-all">Salvar Alterações</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal de Exclusão */}
      {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-sm overflow-hidden border border-red-100 dark:border-red-900/40">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-500 dark:text-red-400 mb-4 shadow-inner border border-red-100 dark:border-red-900/40"><AlertTriangle size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter leading-tight">Remover Registro?</h3>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Esta ação é permanente. Informe o motivo abaixo:</p>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-red-100 dark:focus:ring-red-900/20 focus:border-red-300 dark:focus:border-red-700 outline-none mb-6 transition-all bg-white dark:bg-slate-800 dark:text-slate-100" rows={3} placeholder="Motivo da exclusão..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors">Manter</button>
                          <button onClick={confirmDelete} disabled={!deleteReason.trim()} className="flex-1 py-3 bg-red-600 dark:bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 dark:hover:bg-red-600 transition-all disabled:opacity-50">Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AccountManager;