
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, DeviceStatus, MaintenanceRecord, MaintenanceType, ActionType, AssetType, CustomField, User, SimCard, AccountType, AuditLog } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, Settings, Image as ImageIcon, Wrench, DollarSign, Paperclip, ExternalLink, X, RotateCcw, AlertTriangle, RefreshCw, FileText, Calendar, Box, Hash, Tag as TagIcon, FileCode, Briefcase, Cpu, History, SlidersHorizontal, Check, Info, ShieldCheck, ChevronDown, Save, Globe, Lock, Eye, EyeOff, Mail, Key, UserCheck, UserX, FileWarning, SlidersHorizontal as Sliders, ChevronLeft, ChevronRight, Users, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import ModelSettings from './ModelSettings';

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
                    ${isOpen ? 'ring-4 ring-indigo-100 dark:ring-indigo-900/20 border-indigo-500' : ''}
                `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {icon && <span className="text-indigo-300 dark:text-indigo-500 shrink-0">{icon}</span>}
                    <div className="flex flex-col truncate">
                         {selectedOption ? (
                             <>
                                <span className="text-gray-900 dark:text-slate-100 font-bold text-sm truncate">{selectedOption.label}</span>
                                {selectedOption.subLabel && <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate font-mono uppercase tracking-tighter">{selectedOption.subLabel}</span>}
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
                            placeholder="Buscar..."
                            autoFocus
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="overflow-y-auto flex-1">
                        <div 
                            onClick={() => { onChange(''); setIsOpen(false); setSearchTerm(''); }}
                            className="px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-50 dark:border-slate-700 text-red-500 font-bold text-xs uppercase"
                        >
                            Nenhum Chip Vinculado
                        </div>
                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                            <div 
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }}
                                className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-slate-50 dark:border-slate-700 last:border-0 ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                            >
                                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{opt.label}</div>
                                {opt.subLabel && <div className="text-[10px] text-gray-500 dark:text-slate-400 font-mono uppercase">{opt.subLabel}</div>}
                            </div>
                        )) : (
                            <div className="px-4 py-8 text-center text-slate-400 text-xs italic">Nenhum resultado.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const FIELD_LABELS: Record<string, string> = {
    sectorId: 'Setor/Cargo',
    linkedSimId: 'Chip Vinculado',
    currentUserId: 'Responsável Atual',
    userId: 'Colaborador',
    modelId: 'Modelo do Ativo',
    purchaseDate: 'Data de Compra',
    purchaseCost: 'Custo de Aquisição',
    invoiceNumber: 'Número da Nota',
    internalCode: 'Código Interno',
    pulsusId: 'ID MDM Pulsus',
    serialNumber: 'Nº Série',
    assetTag: 'Patrimônio',
    customData: 'Dados Extras',
    fullName: 'Nome Completo',
    email: 'E-mail',
    active: 'Status Ativo',
    address: 'Endereço Residencial',
    phoneNumber: 'Linha Telefônica',
    operator: 'Operadora',
    iccid: 'ICCID',
    planDetails: 'Plano',
    status: 'Estado Global',
    id: 'ID Sistema'
};

const LogNoteRenderer = ({ log }: { log: AuditLog }) => {
    const { devices, sims, users, sectors, models, customFields } = useData();
    const navigate = useNavigate();
    const note = log.notes || '';

    const resolveValue = (key: string, val: any): string => {
        if (val === null || val === undefined || val === '---' || val === '') return 'Nenhum';
        if (key.toLowerCase().includes('date') || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))) {
            try { return new Date(val).toLocaleDateString('pt-BR'); } catch (e) { return val; }
        }
        if (key === 'purchaseCost') {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        }
        if (key === 'sectorId') return sectors.find(s => s.id === val)?.name || val;
        if (key === 'linkedSimId') return sims.find(s => s.id === val)?.phoneNumber || val;
        if (key === 'currentUserId' || key === 'userId') return users.find(u => u.id === val)?.fullName || val;
        if (key === 'modelId') return models.find(m => m.id === val)?.name || val;
        if (key === 'active') return val ? 'Ativo/Sim' : 'Inativo/Não';
        if (key === 'customData') {
            try {
                const data = typeof val === 'string' ? JSON.parse(val) : val;
                return Object.entries(data).map(([fieldId, fieldVal]) => {
                    const fieldName = customFields.find(f => f.id === fieldId)?.name || fieldId;
                    return `${fieldName}: ${fieldVal || 'vazio'}`;
                }).join('; ');
            } catch (e) { return String(val); }
        }
        return String(val);
    };

    const lines = note.split('\n');

    return (
        <div className="space-y-1.5 py-1">
            {lines.map((line, i) => {
                if (!line.trim()) return null;
                if (line.includes('➔')) {
                    const parts = line.split(':');
                    const rawKey = parts[0]?.trim();
                    const fieldLabel = FIELD_LABELS[rawKey] || rawKey;
                    const valuesPart = parts.slice(1).join(':');
                    const [oldVal, newVal] = (valuesPart || '').split('➔');
                    const cleanOld = oldVal?.trim().replace(/'/g, '');
                    const cleanNew = newVal?.trim().replace(/'/g, '');
                    return (
                        <div key={i} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter shrink-0">{fieldLabel}:</span>
                            <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/30 line-through opacity-70">
                                {resolveValue(rawKey, cleanOld)}
                            </span>
                            <ArrowRight size={10} className="text-slate-300"/>
                            <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40 font-bold">
                                {resolveValue(rawKey, cleanNew)}
                            </span>
                        </div>
                    );
                }
                if (line.includes('Alvo:') || line.includes('Origem:')) {
                    const [label, name] = line.split(':');
                    const trimmedName = name?.trim();
                    const foundUser = users.find(u => u.fullName.toLowerCase() === trimmedName?.toLowerCase());
                    return (
                        <div key={i} className="font-bold text-[11px] flex items-center gap-2">
                             <span className="text-slate-400 uppercase text-[10px]">{label}:</span>
                             {foundUser ? (
                                 <span onClick={() => navigate(`/users?userId=${foundUser.id}`)} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Users size={10}/> {trimmedName}
                                 </span>
                             ) : <span className="text-slate-700 dark:text-slate-200">{trimmedName}</span>}
                        </div>
                    );
                }
                return <div key={i} className="text-slate-600 dark:text-slate-300 font-medium">{line}</div>;
            })}
        </div>
    );
};

const PossessionHistory = ({ deviceId }: { deviceId: string }) => {
    const { getHistory, users } = useData();
    const history = getHistory(deviceId);
    const navigate = useNavigate();
    const chain = history
        .filter(l => l.action === ActionType.CHECKOUT || l.action === ActionType.CHECKIN)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (chain.length === 0) {
        return (
            <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <History size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4 opacity-50"/>
                <p className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest italic">Nenhum registro de posse encontrado para este dispositivo.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                <ShieldCheck size={14}/> Cadeia de Custódia (Rastreabilidade Total)
            </h4>
            <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-6 space-y-10 py-2">
                {chain.map((log, idx) => {
                    let userName = 'Colaborador';
                    const userPattern = new RegExp('(Alvo|Origem|Entregue para|Devolvido por):\\s+([^.\n •]+)', 'i');
                    const match = (log.notes || '').match(userPattern);
                    if (match) { userName = match[2].trim(); } 
                    else {
                        try {
                            const data = log.action === ActionType.CHECKOUT ? JSON.parse(log.newData || '{}') : JSON.parse(log.previousData || '{}');
                            if (data.userName) userName = data.userName;
                        } catch(e) {}
                    }
                    const foundUser = users.find(u => u.fullName.toLowerCase() === userName.toLowerCase());
                    return (
                        <div key={log.id} className="relative pl-10">
                            <div className={`absolute -left-[11px] top-0 h-5 w-5 rounded-full border-4 border-white dark:border-slate-950 shadow-md flex items-center justify-center 
                                ${log.action === ActionType.CHECKOUT ? 'bg-blue-600' : 'bg-orange-50'}`}>
                                {log.action === ActionType.CHECKOUT ? <UserCheck size={10} className="text-white"/> : <UserX size={10} className="text-orange-600"/>}
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-blue-200 dark:hover:border-blue-800 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${log.action === ActionType.CHECKOUT ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/40' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-800'}`}>
                                        {log.action === ActionType.CHECKOUT ? 'RECEBEU' : 'DEVOLVEU'}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold">{new Date(log.timestamp).toLocaleString()}</span>
                                </div>
                                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                                    <Users size={14} className="text-slate-400 dark:text-slate-500"/> 
                                    {foundUser ? (
                                        <span onClick={() => navigate(`/users?userId=${foundUser.id}`)} className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                                            {userName}
                                        </span>
                                    ) : <span>{userName}</span>}
                                </p>
                                <div className="mt-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border-l-2 border-slate-200 dark:border-slate-700">
                                    <LogNoteRenderer log={log} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const COLUMN_OPTIONS = [
    { id: 'assetTag', label: 'Patrimônio' },
    { id: 'imei', label: 'IMEI' },
    { id: 'serial', label: 'S/N Fabricante' },
    { id: 'sectorCode', label: 'Cód. Setor' },
    { id: 'sectorName', label: 'Cargo / Função' },
    { id: 'pulsusId', label: 'Pulsus ID' },
    { id: 'linkedSim', label: 'Chip Vinculado' },
    { id: 'purchaseInfo', label: 'Valor/Data Compra' }
];

const formatCurrencyBR = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const parseCurrencyBR = (value: string): number => {
    const cleanedValue = value.replace(/\D/g, '');
    return cleanedValue ? parseFloat(cleanedValue) / 100 : 0;
};

const formatDateBR = (isoString: string): string => {
    if (!isoString) return '---';
    const datePart = isoString.substring(0, 10);
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
};

const Resizer = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
    <div 
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50 transition-colors z-10 bg-slate-200/50 dark:bg-slate-700/50"
    />
);

const DeviceManager = () => {
  const { 
    devices, addDevice, updateDevice, deleteDevice, restoreDevice,
    users, models, brands, assetTypes, sims, customFields, sectors,
    maintenances, addMaintenance, deleteMaintenance, accounts,
    getHistory, getDeviceInvoice, getMaintenanceInvoice
  } = useData();
  const { user: currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewStatus, setViewStatus] = useState<DeviceStatus | 'ALL'>('ALL'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'FINANCIAL' | 'MAINTENANCE' | 'LICENSES' | 'CUSTODY' | 'HISTORY'>('GENERAL');
  
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
      const saved = localStorage.getItem('device_manager_columns');
      return saved ? JSON.parse(saved) : ['assetTag', 'imei', 'serial', 'linkedSim'];
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
      const saved = localStorage.getItem('device_manager_widths');
      return saved ? JSON.parse(saved) : {};
  });
  
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [idType, setIdType] = useState<'TAG' | 'IMEI'>('TAG');
  const [formData, setFormData] = useState<Partial<Device>>({ status: DeviceStatus.AVAILABLE, customData: {} });
  const [isUploadingNF, setIsUploadingNF] = useState(false);
  const [isUploadingMaint, setIsUploadingMaint] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [newMaint, setNewMaint] = useState<Partial<MaintenanceRecord>>({ 
      description: '', 
      cost: 0, 
      invoiceUrl: '',
      type: MaintenanceType.CORRECTIVE,
      date: new Date().toISOString().split('T')[0]
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(20);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (columnRef.current && !columnRef.current.contains(e.target as Node)) setIsColumnSelectorOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewStatus, itemsPerPage]);

  const toggleColumn = (id: string) => {
      setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleResize = (colId: string, startX: number, startWidth: number) => {
    const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        setColumnWidths(prev => ({ ...prev, [colId]: Math.max(startWidth + delta, 50) }));
    };
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        localStorage.setItem('device_manager_widths', JSON.stringify(columnWidths));
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetTag && !formData.imei) { alert('Patrimônio ou IMEI obrigatório para TI.'); return; }
    if (editingId) { setEditReason(''); setIsReasonModalOpen(true); } 
    else { addDevice({ ...formData, id: Math.random().toString(36).substr(2, 9), currentUserId: null } as Device, adminName); setIsModalOpen(false); }
  };

  const confirmEdit = () => {
    if (!editReason.trim()) { alert('Informe o motivo para auditoria.'); return; }
    updateDevice(formData as Device, adminName);
    setIsReasonModalOpen(false);
    setIsModalOpen(false);
  };

  const handleOpenModal = (device?: Device, viewOnly: boolean = false) => {
    setActiveTab('GENERAL');
    const isRetired = device?.status === DeviceStatus.RETIRED;
    setIsViewOnly(isRetired || viewOnly);
    if (device) { 
        setEditingId(device.id); 
        setFormData({ ...device, customData: device.customData || {} }); 
        setIdType(device.imei && !device.assetTag ? 'IMEI' : 'TAG'); 
    } 
    else { 
        setEditingId(null); 
        setFormData({ status: DeviceStatus.AVAILABLE, purchaseDate: new Date().toISOString().split('T')[0], purchaseCost: 0, customData: {}, linkedSimId: null }); 
        setIdType('TAG'); 
    }
    setIsModalOpen(true);
  };

  const adminName = currentUser?.name || 'Sistema';

  const simOptions: Option[] = sims.filter(s => s.status === DeviceStatus.AVAILABLE || s.id === formData.linkedSimId).map(s => ({
      value: s.id,
      label: s.phoneNumber,
      subLabel: s.operator
  })).sort((a,b) => a.label.localeCompare(b.label));

  const filteredDevices = devices.filter(d => {
    if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;
    const model = models.find(m => m.id === d.modelId);
    const searchString = `${model?.name} ${d.assetTag || ''} ${d.imei || ''} ${d.serialNumber || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  }).sort((a, b) => {
      const modelA = models.find(m => m.id === a.modelId)?.name || '';
      const modelB = models.find(m => m.id === b.modelId)?.name || '';
      return modelA.localeCompare(modelB);
  });

  const totalItems = filteredDevices.length;
  const currentItemsPerPage = itemsPerPage === 'ALL' ? totalItems : itemsPerPage;
  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(totalItems / currentItemsPerPage);
  const startIndex = (currentPage - 1) * (itemsPerPage === 'ALL' ? 0 : itemsPerPage as number);
  const paginatedDevices = itemsPerPage === 'ALL' ? filteredDevices : filteredDevices.slice(startIndex, startIndex + (itemsPerPage as number));

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Área de T.I - Gestão de Ativos</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">Controle centralizado de Celulares, Computadores e Periféricos.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsModelSettingsOpen(true)} className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-800 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold transition-all"><Settings size={18} /> Configurações</button>
            <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold transition-all active:scale-95"><Plus size={18} /> Cadastrar Ativo</button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800 overflow-x-auto bg-white dark:bg-slate-900 px-4 pt-2 rounded-t-xl transition-colors">
          {(['ALL', DeviceStatus.AVAILABLE, DeviceStatus.IN_USE, DeviceStatus.MAINTENANCE, DeviceStatus.RETIRED] as (DeviceStatus | 'ALL')[]).map(status => (
              <button key={status} onClick={() => setViewStatus(status)} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${viewStatus === status ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}`}>{status === 'ALL' ? 'Todos' : status}</button>
          ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3 text-gray-400" size={20} />
        <input type="text" placeholder="Filtrar por Patrimônio, IMEI, S/N ou Modelo..." className="pl-12 w-full border-none rounded-xl py-3 shadow-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-900 transition-colors" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[1200px] table-fixed">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-widest">
                <tr>
                  <th className="px-6 py-4 relative" style={{ width: columnWidths['model'] || '220px' }}>Foto/Modelo<Resizer onMouseDown={(e) => handleResize('model', e.clientX, columnWidths['model'] || 220)} /></th>
                  {visibleColumns.includes('assetTag') && (<th className="px-6 py-4 relative" style={{ width: columnWidths['assetTag'] || '130px' }}>Patrimônio<Resizer onMouseDown={(e) => handleResize('assetTag', e.clientX, columnWidths['assetTag'] || 130)} /></th>)}
                  {visibleColumns.includes('imei') && (<th className="px-6 py-4 relative" style={{ width: columnWidths['imei'] || '160px' }}>IMEI<Resizer onMouseDown={(e) => handleResize('imei', e.clientX, columnWidths['imei'] || 160)} /></th>)}
                  {visibleColumns.includes('serial') && (<th className="px-6 py-4 relative" style={{ width: columnWidths['serial'] || '140px' }}>Serial Number<Resizer onMouseDown={(e) => handleResize('serial', e.clientX, columnWidths['serial'] || 140)} /></th>)}
                  <th className="px-6 py-4 relative" style={{ width: columnWidths['status'] || '120px' }}>Status<Resizer onMouseDown={(e) => handleResize('status', e.clientX, columnWidths['status'] || 120)} /></th>
                  <th className="px-6 py-4 relative" style={{ width: columnWidths['user'] || '200px' }}>Responsável<Resizer onMouseDown={(e) => handleResize('user', e.clientX, columnWidths['user'] || 200)} /></th>
                  <th className="px-6 py-4 text-right" style={{ width: '150px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.map(d => {
                  const model = models.find(m => m.id === d.modelId);
                  const brand = brands.find(b => b.id === model?.brandId);
                  const user = users.find(u => u.id === d.currentUserId);
                  return (
                    <tr key={d.id} onClick={() => handleOpenModal(d, true)} className="border-b dark:border-slate-800 transition-colors cursor-pointer hover:bg-blue-50/30 dark:hover:bg-slate-800/40 bg-white dark:bg-slate-900">
                      <td className="px-6 py-4 truncate">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden border shrink-0">
                            {model?.imageUrl ? <img src={model.imageUrl} className="h-full w-full object-cover" alt="Ativo" /> : <ImageIcon className="text-slate-300 dark:text-slate-600" size={16}/>}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 dark:text-slate-100 truncate text-xs">{model?.name}</div>
                            <div className="text-[9px] text-slate-400 uppercase font-black">{brand?.name}</div>
                          </div>
                        </div>
                      </td>
                      {visibleColumns.includes('assetTag') && (<td className="px-6 py-4 truncate font-bold text-slate-700 dark:text-slate-300">{d.assetTag || '---'}</td>)}
                      {visibleColumns.includes('imei') && (<td className="px-6 py-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">{d.imei || '---'}</td>)}
                      {visibleColumns.includes('serial') && (<td className="px-6 py-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">{d.serialNumber || '---'}</td>)}
                      <td className="px-6 py-4 truncate">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${d.status === DeviceStatus.AVAILABLE ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 truncate">{user ? <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{user.fullName}</span> : <span className="text-[9px] font-bold text-slate-300 uppercase italic">Estoque</span>}</td>
                      <td className="px-6 py-4 text-right truncate">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleOpenModal(d, false)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={16}/></button>
                          <button onClick={() => { setDeleteTargetId(d.id); setIsDeleteModalOpen(true); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up border dark:border-slate-800">
            <div className="bg-slate-900 dark:bg-black px-8 py-5 flex justify-between items-center shrink-0 border-b border-white/10">
               <h3 className="text-lg font-black text-white uppercase tracking-tighter">Cadastro de Ativo de TI</h3>
               <button onClick={() => setIsModalOpen(false)} className="h-10 w-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-full transition-all"><X size={20}/></button>
            </div>
            
            <form id="devForm" onSubmit={handleDeviceSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Modelo e Marca</label>
                        <select required disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold bg-white dark:bg-slate-800 dark:text-slate-100 focus:border-blue-500 outline-none transition-all" value={formData.modelId || ''} onChange={e => setFormData({...formData, modelId: e.target.value})}>
                            <option value="">Selecione o modelo...</option>
                            {models.map(m => <option key={m.id} value={m.id}>{brands.find(b => b.id === m.brandId)?.name} {m.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                            <label className="block text-[10px] font-black uppercase text-blue-400 mb-3 tracking-widest">Identificador Principal (TI)</label>
                            <div className="flex bg-blue-100/50 dark:bg-blue-900/40 p-1 rounded-lg mb-4">
                                <button type="button" onClick={() => setIdType('TAG')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all ${idType === 'TAG' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-blue-400'}`}>Patrimônio</button>
                                <button type="button" onClick={() => setIdType('IMEI')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all ${idType === 'IMEI' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-blue-400'}`}>IMEI (Celular)</button>
                            </div>
                            {idType === 'TAG' ? (
                                <input disabled={isViewOnly} className="w-full border-2 border-blue-200 dark:border-blue-800 rounded-xl p-3 text-lg font-black text-blue-900 dark:text-blue-100 bg-white dark:bg-slate-800 focus:ring-4 focus:ring-blue-100 outline-none" value={formData.assetTag || ''} onChange={e => setFormData({...formData, assetTag: e.target.value.toUpperCase()})} placeholder="TAG-0000"/>
                            ) : (
                                <input disabled={isViewOnly} className="w-full border-2 border-blue-200 dark:border-blue-800 rounded-xl p-3 text-lg font-black text-blue-900 dark:text-blue-100 bg-white dark:bg-slate-800 focus:ring-4 focus:ring-blue-100 outline-none" value={formData.imei || ''} onChange={e => setFormData({...formData, imei: e.target.value})} placeholder="000.000..."/>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Serial Number (Fabricante)</label>
                            <input required disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-mono focus:border-blue-500 outline-none bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100" value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value.toUpperCase()})} placeholder="S/N"/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Código Interno / Setor</label>
                            <input disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-50 dark:bg-slate-800/50" value={formData.internalCode || ''} onChange={e => setFormData({...formData, internalCode: e.target.value})} placeholder="SJC-001"/>
                        </div>
                    </div>
                </div>
            </form>

            <div className="bg-slate-50 dark:bg-slate-950 px-8 py-5 flex justify-end gap-3 border-t dark:border-slate-800 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-black text-[10px] uppercase text-slate-500 tracking-widest">Fechar</button>
                {!isViewOnly && <button type="submit" form="devForm" className="px-10 py-3 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">Salvar Ativo</button>}
            </div>
          </div>
        </div>
      )}

      {isReasonModalOpen && (<div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-blue-100"><div className="p-8"><div className="flex flex-col items-center text-center mb-6"><div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-4 shadow-inner border border-blue-100"><Save size={32} /></div><h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Confirmar Alterações?</h3><p className="text-xs text-slate-400 mt-2">Informe o motivo da alteração para auditoria:</p></div><textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none mb-6 transition-all bg-white dark:bg-slate-800 dark:text-slate-100" rows={3} placeholder="Descreva o que foi alterado..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors hover:bg-slate-200">Voltar</button><button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all">Salvar</button></div></div></div></div>)}
      {isDeleteModalOpen && (<div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-sm overflow-hidden border border-red-100"><div className="p-8"><div className="flex flex-col items-center text-center mb-6"><div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-inner border border-red-100"><AlertTriangle size={32} /></div><h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Confirma o Descarte?</h3></div><textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-red-100 outline-none mb-6 transition-all bg-white dark:bg-slate-800 dark:text-slate-100" rows={3} placeholder="Motivo..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors hover:bg-slate-200">Manter</button><button onClick={() => { deleteDevice(deleteTargetId!, adminName, deleteReason); setIsDeleteModalOpen(false); }} disabled={!deleteReason.trim()} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 disabled:opacity-50 transition-all">Confirmar</button></div></div></div></div>)}
      {isModelSettingsOpen && <ModelSettings onClose={() => setIsModelSettingsOpen(false)} />}
    </div>
  );
};

export default DeviceManager;