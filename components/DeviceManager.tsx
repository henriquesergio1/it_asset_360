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
        
        // Formatação de data
        if (key.toLowerCase().includes('date') || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))) {
            try { return new Date(val).toLocaleDateString('pt-BR'); } catch (e) { return val; }
        }

        // Formatação de dinheiro
        if (key === 'purchaseCost') {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        }

        // Resolução de IDs
        if (key === 'sectorId') return sectors.find(s => s.id === val)?.name || val;
        if (key === 'linkedSimId') return sims.find(s => s.id === val)?.phoneNumber || val;
        if (key === 'currentUserId' || key === 'userId') return users.find(u => u.id === val)?.fullName || val;
        if (key === 'modelId') return models.find(m => m.id === val)?.name || val;
        if (key === 'active') return val ? 'Ativo/Sim' : 'Inativo/Não';

        // Resolução de Dados Customizados
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

                // Caso 1: Mudança de valor (estilo Snipe-IT: 'Campo: 'antigo' ➔ 'novo'')
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

                // Caso 2: Menção a colaborador ou ativo (Linkable)
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
                    if (match) {
                        userName = match[2].trim();
                    } else {
                        try {
                            const data = log.action === ActionType.CHECKOUT 
                                ? JSON.parse(log.newData || '{}') 
                                : JSON.parse(log.previousData || '{}');
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
                                <div className="mt-3 text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter">Registrado por: {log.adminUser}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-start gap-3">
                <Info size={18} className="text-blue-500 shrink-0"/>
                <p className="text-[10px] text-blue-700 dark:text-blue-300 font-medium leading-relaxed uppercase">
                    Esta linha do tempo exibe a rastreabilidade completa do ativo. Cada entrada representa uma transferência de responsabilidade jurídica registrada no sistema.
                </p>
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
      return saved ? JSON.parse(saved) : ['assetTag', 'linkedSim'];
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
  const [filterNoPulsusId, setFilterNoPulsusId] = useState(false);
  const [filterNoInvoice, setFilterNoInvoice] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (columnRef.current && !columnRef.current.contains(e.target as Node)) setIsColumnSelectorOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      localStorage.setItem('device_manager_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
      localStorage.setItem('device_manager_widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

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
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleNFFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingNF(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, purchaseInvoiceUrl: reader.result as string });
        setIsUploadingNF(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMaintFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingMaint(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMaint({ ...newMaint, invoiceUrl: reader.result as string });
        setIsUploadingMaint(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const openBase64File = async (type: 'DEVICE' | 'MAINTENANCE', id?: string, url?: string) => {
      if (!url && id) {
          setLoadingFiles(prev => ({ ...prev, [id]: true }));
          try {
              const fileUrl = type === 'DEVICE' ? await getDeviceInvoice(id) : await getMaintenanceInvoice(id);
              if (fileUrl) openBlob(fileUrl);
              else alert("Documento não encontrado no servidor.");
          } catch (e) {
              alert("Erro ao baixar documento.");
          } finally {
              setLoadingFiles(prev => ({ ...prev, [id]: false }));
          }
          return;
      }
      if (url) openBlob(url);
  };

  const openBlob = (base64: string) => {
      if (!base64.startsWith('data:')) { window.open(base64, '_blank'); return; }
      const parts = base64.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const binary = atob(parts[1]);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      const blob = new Blob([array], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
  };

  const saveMaintenance = () => {
    if (!editingId || !newMaint.description) return;
    const isoDate = newMaint.date ? `${newMaint.date}T12:00:00.000Z` : new Date().toISOString();
    const record: MaintenanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      deviceId: editingId,
      type: newMaint.type || MaintenanceType.CORRECTIVE,
      date: isoDate,
      description: newMaint.description,
      cost: newMaint.cost || 0,
      provider: 'Interno',
      invoiceUrl: newMaint.invoiceUrl
    };
    addMaintenance(record, adminName);
    setNewMaint({ description: '', cost: 0, invoiceUrl: '', type: MaintenanceType.CORRECTIVE, date: new Date().toISOString().split('T')[0] });

    // Após salvar, pergunta se deseja concluir a manutenção
    if (window.confirm('Registro salvo. Deseja concluir a manutenção e retornar o ativo ao status anterior?')) {
        const device = devices.find(d => d.id === editingId);
        if (device) {
            const statusToRestore = device.previousStatus || DeviceStatus.AVAILABLE;
            updateDevice({ ...device, status: statusToRestore, previousStatus: undefined }, adminName);
            setIsModalOpen(false); // Fecha o modal após a ação
        }
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const deviceId = params.get('deviceId');
    if (deviceId) {
        const device = devices.find(d => d.id === deviceId);
        if (device) handleOpenModal(device, true);
    }
  }, [location, devices]);

  const adminName = currentUser?.name || 'Sistema';

  const availableSims = sims.filter(s => s.status === DeviceStatus.AVAILABLE || s.id === formData.linkedSimId);
  const simOptions: Option[] = availableSims.map(s => ({
      value: s.id,
      label: s.phoneNumber,
      subLabel: s.operator
  })).sort((a,b) => a.label.localeCompare(b.label));

  const getModelDetails = (modelId?: string) => {
    const model = models.find(m => m.id === modelId);
    const brand = brands.find(b => b.id === model?.brandId);
    const type = assetTypes.find(t => t.id === model?.typeId);
    return { model, brand, type };
  };

  const getRelevantFields = () => {
      const { model } = getModelDetails(formData.modelId);
      const selectedAssetType = assetTypes.find(t => t.id === model?.typeId);
      if (!selectedAssetType?.customFieldIds) return [];
      return selectedAssetType.customFieldIds.map(id => customFields.find(cf => cf.id === id)).filter(Boolean) as CustomField[];
  };

  const relevantFields = getRelevantFields();

  const filteredDevices = devices.filter(d => {
    if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;

    // Lógica dos novos filtros
    if (filterNoPulsusId && (d.pulsusId && d.pulsusId.trim() !== '')) return false;
    if (filterNoInvoice && d.hasInvoice) return false;

    const { model, brand } = getModelDetails(d.modelId);
    const sectorName = sectors.find(s => s.id === d.sectorId)?.name || '';
    const userName = users.find(u => u.id === d.currentUserId)?.fullName || '';
    const chipNumber = sims.find(s => s.id === d.linkedSimId)?.phoneNumber || '';
    const searchString = `${model?.name} ${brand?.name} ${d.assetTag || ''} ${d.internalCode || ''} ${d.imei || ''} ${d.serialNumber || ''} ${sectorName} ${userName} ${chipNumber}`.toLowerCase();
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

  const handleOpenModal = (device?: Device, viewOnly: boolean = false) => {
    setActiveTab('GENERAL');
    const isRetired = device?.status === DeviceStatus.RETIRED;
    setIsViewOnly(isRetired || viewOnly);
    if (device) { setEditingId(device.id); setFormData({ ...device, customData: device.customData || {} }); setIdType(device.imei && !device.assetTag ? 'IMEI' : 'TAG'); } 
    else { setEditingId(null); setFormData({ status: DeviceStatus.AVAILABLE, purchaseDate: new Date().toISOString().split('T')[0], purchaseCost: 0, customData: {}, linkedSimId: null }); setIdType('TAG'); }
    setIsModalOpen(true);
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetTag && !formData.imei) { alert('Patrimônio ou IMEI obrigatório.'); return; }
    if (formData.assetTag) {
        const dupTag = devices.find(d => d.assetTag === formData.assetTag && d.id !== editingId);
        if (dupTag) { alert(`O número de patrimônio ${formData.assetTag} já está cadastrado.`); return; }
    }
    if (formData.imei) {
        const dupImei = devices.find(d => d.imei === formData.imei && d.id !== editingId);
        if (dupImei) { alert(`O IMEI ${formData.imei} já está cadastrado.`); return; }
    }
    if (editingId) { setEditReason(''); setIsReasonModalOpen(true); } 
    else { addDevice({ ...formData, id: Math.random().toString(36).substr(2, 9), currentUserId: null } as Device, adminName); setIsModalOpen(false); }
  };

  const confirmEdit = () => {
    if (!editReason.trim()) { alert('Informe o motivo da alteração.'); return; }
    updateDevice(formData as Device, adminName);
    setIsReasonModalOpen(false);
    setIsModalOpen(false);
  };

  const handleSectorChange = (val: string) => { setFormData({ ...formData, sectorId: val || null }); };

  const handleDeleteAttempt = (device: Device) => {
      if (device.status === DeviceStatus.IN_USE || device.currentUserId) { alert('Não é possível descartar um dispositivo em uso.'); return; }
      setDeleteTargetId(device.id); setDeleteReason(''); setIsDeleteModalOpen(true);
  };

  const toggleMaintenanceStatus = (device: Device) => {
      
      if (device.status === DeviceStatus.MAINTENANCE) {
          // Ao invés de apenas mudar o status, abrimos o modal na aba de manutenção
          handleOpenModal(device, false); // false para permitir edição
          // Forçar a aba de manutenção a ser a ativa
          setTimeout(() => setActiveTab('MAINTENANCE'), 50);
      } else if (device.status === DeviceStatus.AVAILABLE || device.status === DeviceStatus.IN_USE) {
          if (window.confirm('Enviar para Manutenção?')) {
              // Salva o status atual antes de enviar para manutenção
              const deviceWithPrevStatus = { 
                  ...device, 
                  status: DeviceStatus.MAINTENANCE, 
                  previousStatus: device.status 
              };
              updateDevice(deviceWithPrevStatus, adminName);
          }
      }
  };

  const handleOpenUrl = (url?: string) => {
    if (!url) return;
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('ftp://')) { finalUrl = 'https://' + finalUrl; }
    window.open(finalUrl, '_blank');
  };

  const deviceMaintenances = maintenances.filter(m => m.deviceId === editingId);
  const totalMaintenanceCost = deviceMaintenances.reduce((sum, m) => sum + (m.cost || 0), 0);
  const purchaseCost = formData.purchaseCost || 0;
  const lccValue = purchaseCost + totalMaintenanceCost;
  const maintenanceRatio = purchaseCost > 0 ? (totalMaintenanceCost / purchaseCost) : 0;
  
  const deviceAgeYears = formData.purchaseDate ? 
    (new Date().getTime() - new Date(formData.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 0;

  const deviceAccounts = editingId ? accounts.filter(a => a.deviceId === editingId) : [];

  // v2.12.39 - Lógica para o indicador visual financeiro
  const isFinancialOk = formData.invoiceNumber && (formData.purchaseInvoiceUrl || formData.hasInvoice);

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Inventário de Dispositivos</h1><p className="text-gray-500 dark:text-slate-400 text-sm">Gestão centralizada de ativos.</p></div>
        <div className="flex gap-2">
            <div className="relative" ref={columnRef}>
                <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-800 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold transition-all"><SlidersHorizontal size={18} /> Colunas</button>
                {isColumnSelectorOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[80] overflow-hidden animate-fade-in">
                        <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-500">Exibir Colunas</span><button onClick={() => setIsColumnSelectorOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button></div>
                        <div className="p-2 space-y-1">{COLUMN_OPTIONS.map(col => (<button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${visibleColumns.includes(col.id) ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{col.label}{visibleColumns.includes(col.id) && <Check size={14}/>}</button>))}</div>
                    </div>
                )}
            </div>
            <button onClick={() => setIsModelSettingsOpen(true)} className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-800 text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold transition-all"><Settings size={18} /> Catálogo</button>
            <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold transition-all active:scale-95"><Plus size={18} /> Novo Ativo</button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800 overflow-x-auto bg-white dark:bg-slate-900 px-4 pt-2 rounded-t-xl transition-colors">
          {(['ALL', DeviceStatus.AVAILABLE, DeviceStatus.IN_USE, DeviceStatus.MAINTENANCE, DeviceStatus.RETIRED] as (DeviceStatus | 'ALL')[]).map(status => (
              <button key={status} onClick={() => setViewStatus(status)} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${viewStatus === status ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}`}>{status === 'ALL' ? 'Todos' : status}<span className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{status === 'ALL' ? devices.length : devices.filter(d => d.status === status).length}</span></button>
          ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
          <input type="text" placeholder="Pesquisar por modelo, tag, IMEI, S/N, responsável..." className="pl-12 w-full border-none rounded-xl py-3 shadow-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-900 transition-colors" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
        </div>
        <div className="flex items-center justify-end gap-4 bg-white dark:bg-slate-900 p-2 rounded-xl shadow-lg">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Filtros:</span>
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filterNoPulsusId} onChange={() => setFilterNoPulsusId(!filterNoPulsusId)} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors cursor-pointer" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Sem ID Pulsus</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filterNoInvoice} onChange={() => setFilterNoInvoice(!filterNoInvoice)} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors cursor-pointer" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Sem Nota Fiscal</span>
            </label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[1200px] table-fixed">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-widest">
                <tr>
                  <th className="px-6 py-4 relative" style={{ width: columnWidths['model'] || '200px' }}>Foto/Modelo<Resizer onMouseDown={(e) => handleResize('model', e.clientX, columnWidths['model'] || 200)} /></th>
                  {visibleColumns.includes('assetTag') && (<th className="px-6 py-4 relative" style={{ width: columnWidths['assetTag'] || '120px' }}>Patrimônio<Resizer onMouseDown={(e) => handleResize('assetTag', e.clientX, columnWidths['assetTag'] || 120)} /></th>)}
                  {visibleColumns.includes('imei') && (<th className="px-6 py-4 relative" style={{ width: columnWidths['imei'] || '150px' }}>IMEI<Resizer onMouseDown={(e) => handleResize('imei', e.clientX, columnWidths['imei'] || 150)} /></th>)}
                  {visibleColumns.includes('serial') && (<th className="px-6 py-4 relative" style={{ width: columnWidths['serial'] || '120px' }}>S/N<Resizer onMouseDown={(e) => handleResize('serial', e.clientX, columnWidths['serial'] || 120)} /></th>)}
                  {visibleColumns.includes('sectorCode') && (<th className="px-6 py-4 relative" style={{ width: columnWidths['sectorCode'] || '100px' }}>Cód. Setor<Resizer onMouseDown={(e) => handleResize('sectorCode', e.clientX, columnWidths['sectorCode'] || 100)} /></th>)}
                  {visibleColumns.includes('sectorName') && (<th className="px-6 py-4 relative" style={{ width: columnWidths['sectorName'] || '150px' }}>Cargo / Função<Resizer onMouseDown={(e) => handleResize('sectorName', e.clientX, columnWidths['sectorName'] || 150)} /></th>)}
                  {visibleColumns.includes('pulsusId') && (<th className="px-6 py-4 relative text-center" style={{ width: columnWidths['pulsusId'] || '100px' }}>Pulsus ID<Resizer onMouseDown={(e) => handleResize('pulsusId', e.clientX, columnWidths['pulsusId'] || 100)} /></th>)}
                  {visibleColumns.includes('linkedSim') && (<th className="px-6 py-4 relative" style={{ width: columnWidths['linkedSim'] || '150px' }}>Chip<Resizer onMouseDown={(e) => handleResize('linkedSim', e.clientX, columnWidths['linkedSim'] || 150)} /></th>)}
                  {visibleColumns.includes('purchaseInfo') && (<th className="px-6 py-4 relative" style={{ width: columnWidths['purchaseInfo'] || '120px' }}>Aquisição<Resizer onMouseDown={(e) => handleResize('purchaseInfo', e.clientX, columnWidths['purchaseInfo'] || 120)} /></th>)}
                  <th className="px-6 py-4 relative" style={{ width: columnWidths['status'] || '120px' }}>Status<Resizer onMouseDown={(e) => handleResize('status', e.clientX, columnWidths['status'] || 120)} /></th>
                  <th className="px-6 py-4 relative" style={{ width: columnWidths['user'] || '180px' }}>Responsável Atual<Resizer onMouseDown={(e) => handleResize('user', e.clientX, columnWidths['user'] || 180)} /></th>
                  <th className="px-6 py-4 text-right" style={{ width: '150px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.map(d => {
                  const { model, brand } = getModelDetails(d.modelId);
                  const user = users.find(u => u.id === d.currentUserId);
                  const isRet = d.status === DeviceStatus.RETIRED;
                  const linkedSim = sims.find(s => s.id === d.linkedSimId);
                  const sector = sectors.find(s => s.id === d.sectorId);
                  return (
                    <tr key={d.id} onClick={() => handleOpenModal(d, true)} className={`border-b dark:border-slate-800 transition-colors cursor-pointer ${isRet ? 'opacity-60 grayscale hover:bg-slate-50 dark:hover:bg-slate-800/40' : 'hover:bg-blue-50/30 dark:hover:bg-slate-800/40 bg-white dark:bg-slate-900'}`}>
                      <td className="px-6 py-4 truncate"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-700 shadow-inner shrink-0">{model?.imageUrl ? <img src={model.imageUrl} className="h-full w-full object-cover" alt="Ativo" /> : <ImageIcon className="text-slate-300 dark:text-slate-600" size={16}/>}</div><div className="min-w-0"><div className="font-bold text-gray-900 dark:text-slate-100 truncate text-xs">{model?.name}</div><div className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-tighter">{brand?.name}</div></div></div></td>
                      {visibleColumns.includes('assetTag') && (<td className="px-6 py-4 truncate"><div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300"><TagIcon size={12} className="text-blue-500"/> {d.assetTag || '---'}</div></td>)}
                      {visibleColumns.includes('imei') && (<td className="px-6 py-4 font-mono text-[9px] text-slate-500 dark:text-slate-400 truncate">{d.imei || '---'}</td>)}
                      {visibleColumns.includes('serial') && (<td className="px-6 py-4 font-mono text-[9px] text-slate-500 dark:text-slate-400 truncate">{d.serialNumber || '---'}</td>)}
                      {visibleColumns.includes('sectorCode') && (<td className="px-6 py-4 truncate"><span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-gray-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-gray-100 dark:border-slate-700">{d.internalCode || '---'}</span></td>)}
                      {visibleColumns.includes('sectorName') && (<td className="px-6 py-4 truncate"><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-700">{sector?.name || '---'}</span></td>)}
                      {visibleColumns.includes('pulsusId') && (<td className="px-6 py-4 text-center truncate">{d.pulsusId ? (<span className="text-[9px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/40">{d.pulsusId}</span>) : <span className="text-[10px] text-slate-200 dark:text-slate-700">-</span>}</td>)}
                      {visibleColumns.includes('linkedSim') && (<td className="px-6 py-4 truncate">{linkedSim ? (<span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-1 w-fit"><Cpu size={10}/> {linkedSim.phoneNumber}</span>) : <span className="text-[10px] text-slate-200 dark:text-slate-700">-</span>}</td>)}
                      {visibleColumns.includes('purchaseInfo') && (<td className="px-6 py-4 truncate"><div className="flex flex-col"><span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">R$ {formatCurrencyBR(d.purchaseCost || 0)}</span><span className="text-[9px] text-slate-400 dark:text-slate-500">{d.purchaseDate ? formatDateBR(d.purchaseDate) : '---'}</span></div></td>)}
                      <td className="px-6 py-4 truncate"><span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${d.status === DeviceStatus.AVAILABLE ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/40' : d.status === DeviceStatus.MAINTENANCE ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-900/40' : d.status === DeviceStatus.RETIRED ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/40' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/40'}`}>{d.status}</span></td>
                      <td className="px-6 py-4 truncate">{user ? (<div className="flex flex-col" onClick={(e) => e.stopPropagation()}><span className="text-xs font-bold text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-700" onClick={() => navigate(`/users?userId=${user.id}`)}>{user.fullName}</span><span className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase">{user.internalCode || 'S/ Cód'}</span></div>) : <span className="text-[9px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-tighter italic">Livre no Estoque</span>}</td>
                      <td className="px-6 py-4 text-right truncate"><div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>{(d.status === DeviceStatus.AVAILABLE || d.status === DeviceStatus.IN_USE) && (<button onClick={() => toggleMaintenanceStatus(d)} className="p-1.5 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-all" title="Enviar para Manutenção"><Wrench size={16}/></button>)}{d.status === DeviceStatus.MAINTENANCE && (<button onClick={() => toggleMaintenanceStatus(d)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-all" title="Concluir Manutenção"><CheckCircle size={16}/></button>)}{d.pulsusId && (<a href={`https://app.pulsus.mobi/devices/${d.pulsusId}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all" title="Abrir MDM Pulsus"><ShieldCheck size={16}/></a>)}{isRet ? (<button onClick={() => { setRestoreTargetId(d.id); setRestoreReason(''); setIsRestoreModalOpen(true); }} className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all" title="Restaurar Ativo"><RotateCcw size={16}/></button>) : (<><button onClick={() => handleOpenModal(d, false)} className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="Editar"><Edit2 size={16}/></button><button onClick={() => handleDeleteAttempt(d)} className="p-1.5 text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all" title="Descartar"><Trash2 size={16}/></button></>)}</div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors">
            <div className="flex items-center gap-4"><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Exibir:</span><select className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={itemsPerPage} onChange={(e) => setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={40}>40</option><option value="ALL">Todos</option></select></div><p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total: {totalItems} ativos</p></div>
            {totalPages > 1 && (<div className="flex items-center gap-2"><button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className={`p-2 rounded-lg transition-all ${currentPage === 1 ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'}`}><ChevronLeft size={18}/></button><div className="flex items-center gap-1"><span className="text-xs font-black text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-3 py-1.5 rounded-lg shadow-sm">{currentPage}</span><span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mx-1">de</span><span className="text-xs font-black text-slate-700 dark:text-slate-300">{totalPages}</span></div><button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className={`p-2 rounded-lg transition-all ${currentPage === totalPages ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'}`}><ChevronRight size={18}/></button></div>)}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up border dark:border-slate-800"><div className="bg-slate-900 dark:bg-black px-8 py-5 flex justify-between items-center shrink-0 border-b border-white/10"><div className="flex flex-col"><div className="flex items-center gap-3"><h3 className="text-lg font-black text-white uppercase tracking-tighter leading-tight">{editingId ? (isViewOnly ? 'Detalhes do Ativo' : 'Editar Ativo') : 'Novo Ativo'}</h3></div>{editingId && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {editingId}</span>}</div><button onClick={() => setIsModalOpen(false)} className="h-10 w-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-all"><X size={20}/></button></div><div className="flex bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 overflow-x-auto shrink-0 px-4 pt-2">
            <button type="button" onClick={() => setActiveTab('GENERAL')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'GENERAL' ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Geral</button>
            <button type="button" onClick={() => setActiveTab('FINANCIAL')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'FINANCIAL' ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                Financeiro 
                <span className={`w-2.5 h-2.5 rounded-full ${isFinancialOk ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'}`}></span>
            </button>
            <button type="button" onClick={() => setActiveTab('MAINTENANCE')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'MAINTENANCE' ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Manutenções ({deviceMaintenances.length})</button>
            <button type="button" onClick={() => setActiveTab('LICENSES')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all whitespace-nowrap ${activeTab === 'LICENSES' ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Licenças ({deviceAccounts.length})</button>
            <button type="button" onClick={() => setActiveTab('CUSTODY')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all whitespace-nowrap ${activeTab === 'CUSTODY' ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Cadeia de Custódia</button>
            <button type="button" onClick={() => setActiveTab('HISTORY')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all whitespace-nowrap ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-sm' : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Auditoria</button>
          </div>
          <form id="devForm" onSubmit={handleDeviceSubmit} className="flex-1 flex flex-col overflow-hidden"><div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900">{activeTab === 'GENERAL' && (<div className="grid grid-cols-1 md:grid-cols-2 gap-8">{isViewOnly && (<div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-center gap-3"><Info className="text-blue-600 dark:text-blue-400" size={20}/><p className="text-xs font-bold text-blue-800 dark:text-blue-200">Modo de visualização. Clique no botão azul "Habilitar Edição" abaixo para editar os dados.</p></div>)}{editingId && (<div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between"><div className="flex items-center gap-4"><div className="h-12 w-12 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-blue-50 border dark:border-slate-800 shadow-sm"><Users size={24}/></div><div><span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Responsável Atual</span><p className="text-sm font-black text-slate-800 dark:text-slate-100">{formData.currentUserId ? users.find(u => u.id === formData.currentUserId)?.fullName : 'LIVRE NO ESTOQUE'}</p></div></div>{formData.currentUserId && (<button type="button" onClick={() => navigate(`/users?userId=${formData.currentUserId}`)} className="px-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex items-center gap-2">Ver Perfil <ChevronRight size={14}/></button>)}</div>)}<div className="md:col-span-2 space-y-4"><div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner transition-colors"><label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-2 tracking-[0.2em] ml-1">Catálogo de Modelos (A-Z)</label><select required disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold bg-white dark:bg-slate-800 dark:text-slate-100 focus:border-blue-500 outline-none transition-all" value={formData.modelId || ''} onChange={e => setFormData({...formData, modelId: e.target.value})}><option value="">Vincular a um modelo...</option>{[...models].sort((a,b) => a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{brands.find(b => b.id === m.brandId)?.name} {m.name}</option>)}</select></div></div><div className="space-y-4"><div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-sm relative transition-colors"><label className="block text-[10px] font-black uppercase text-blue-400 dark:text-blue-500 mb-3 tracking-widest">Identificação Principal</label><div className="flex bg-blue-100/50 dark:bg-blue-900/40 p-1 rounded-lg mb-4"><button type="button" onClick={() => setIdType('TAG')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all ${idType === 'TAG' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-blue-400 dark:text-blue-600 hover:text-blue-50 dark:hover:text-blue-400'}`}>Patrimônio</button><button type="button" onClick={() => setIdType('IMEI')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all ${idType === 'IMEI' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-blue-400 dark:text-blue-600 hover:text-blue-50 dark:hover:text-blue-400'}`}>IMEI</button></div>{idType === 'TAG' ? (<input disabled={isViewOnly} className="w-full border-2 border-blue-200 dark:border-blue-800/60 rounded-xl p-3 text-lg font-black text-blue-900 dark:text-blue-100 bg-white dark:bg-slate-800 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all placeholder:text-blue-200 dark:placeholder:text-blue-900/50" value={formData.assetTag || ''} onChange={e => setFormData({...formData, assetTag: e.target.value.toUpperCase().trim()})} placeholder="TI-XXXX"/>) : (<input disabled={isViewOnly} className="w-full border-2 border-blue-200 dark:border-blue-800/60 rounded-xl p-3 text-lg font-black text-blue-900 dark:text-blue-100 bg-white dark:bg-slate-800 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all placeholder:text-blue-200 dark:placeholder:text-blue-900/50" value={formData.imei || ''} onChange={e => setFormData({...formData, imei: e.target.value.trim()})} placeholder="000.000..."/>)}</div><div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 transition-colors"><label className="block text-[10px] font-black uppercase text-indigo-400 dark:text-indigo-500 mb-2 ml-1 tracking-widest">Chip / SIM Card Vinculado</label><SearchableDropdown disabled={isViewOnly} options={simOptions} value={formData.linkedSimId || ''} onChange={val => setFormData({...formData, linkedSimId: val || null})} placeholder="Pesquisar chip..." icon={<Cpu size={18}/>}/><p className="text-[9px] text-indigo-400 dark:text-indigo-500 mt-2 font-bold px-1 italic">* Ao entregar o dispositivo, este chip será entregue automaticamente.</p></div></div><div className="space-y-4"><div><label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Estado Global</label><select disabled={isViewOnly || formData.status === DeviceStatus.IN_USE} className={`w-full border-2 rounded-xl p-3 text-sm font-black focus:border-blue-500 outline-none transition-colors ${formData.status === DeviceStatus.IN_USE ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 text-blue-700 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 dark:text-slate-100'}`} value={formData.status || ''} onChange={e => setFormData({...formData, status: e.target.value as DeviceStatus})}>{Object.values(DeviceStatus).map(s => (<option key={s} value={s} disabled={s === DeviceStatus.IN_USE && formData.status !== DeviceStatus.IN_USE}>{s}</option>))}</select></div><div><label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Serial Number</label><input required disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-mono focus:border-blue-500 outline-none bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100 transition-colors" value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value.toUpperCase().trim()})} placeholder="S/N"/></div><div><label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Código Setor</label><input disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-blue-50 dark:bg-blue-900/20 dark:text-blue-100 font-black" value={formData.internalCode || ''} onChange={e => setFormData({...formData, internalCode: e.target.value.trim()})} placeholder="S-001..."/></div><div><label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">Cargo / Função</label><div className="relative"><Briefcase className="absolute left-3 top-3.5 text-slate-300 dark:text-slate-600" size={16}/><select disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 pl-10 text-sm focus:border-blue-500 outline-none bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100 font-bold transition-colors" value={formData.sectorId || ''} onChange={e => handleSectorChange(e.target.value)}><option value="">Destinar...</option>{[...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div><div><label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1 tracking-widest">ID Pulsus</label><div className="flex gap-2"><input disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100 transition-colors flex-1" value={formData.pulsusId || ''} onChange={e => setFormData({...formData, pulsusId: e.target.value.trim()})} placeholder="ID MDM"/>{formData.pulsusId && (<a href={`https://app.pulsus.mobi/devices/${formData.pulsusId}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-all flex items-center justify-center shadow-sm" title="Abrir MDM Pulsus"><ShieldCheck size={20}/></a>)}</div></div></div>{relevantFields.length > 0 && (<div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-6 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 transition-colors">{relevantFields.map(field => (<div key={field.id}><label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 ml-1">{field.name}</label><input disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-800 dark:text-slate-100 shadow-sm" value={formData.customData?.[field.id] || ''} onChange={e => setFormData({...formData, customData: {...formData.customData, [field.id]: e.target.value}})}/></div>))}</div>)}</div>)}
                    {activeTab === 'FINANCIAL' && (
                        <div className="space-y-8 animate-fade-in">
                            {/* LCC Dashboard Section */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-900 dark:bg-black p-5 rounded-2xl border border-white/10 shadow-xl">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">LCC (Custo Ciclo Vida)</span>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-2xl font-black text-white">R$ {formatCurrencyBR(lccValue)}</span>
                                    </div>
                                    <div className="mt-3 space-y-1 border-t border-white/5 pt-3">
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span className="text-slate-500 uppercase tracking-tighter">Aquisição:</span>
                                            <span className="text-slate-300">R$ {formatCurrencyBR(purchaseCost)}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span className="text-slate-500 uppercase tracking-tighter">Manutenção:</span>
                                            <span className="text-emerald-500">R$ {formatCurrencyBR(totalMaintenanceCost)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`p-5 rounded-2xl border shadow-xl transition-all ${maintenanceRatio >= 0.6 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                    <div className="flex justify-between items-start">
                                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${maintenanceRatio >= 0.6 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>Índice de Manutenção</span>
                                        {maintenanceRatio >= 0.6 && <AlertTriangle size={16} className="text-red-500 animate-pulse"/>}
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className={`text-2xl font-black ${maintenanceRatio >= 0.6 ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>{(maintenanceRatio * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                                        <div className={`h-full transition-all duration-1000 ${maintenanceRatio >= 0.6 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(maintenanceRatio * 100, 100)}%` }}></div>
                                    </div>
                                    {maintenanceRatio >= 0.6 && <p className="text-[9px] text-red-600 dark:text-red-400 mt-2 font-black uppercase tracking-tighter">ALERTA: Gastos excedem 60% do valor do ativo!</p>}
                                </div>
                                <div className={`p-5 rounded-2xl border shadow-xl transition-all ${deviceAgeYears >= 4 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/40' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                    <div className="flex justify-between items-start">
                                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${deviceAgeYears >= 4 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500'}`}>Tempo de Uso</span>
                                        {deviceAgeYears >= 4 && <RefreshCw size={16} className="text-orange-500 animate-spin-slow"/>}
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className={`text-2xl font-black ${deviceAgeYears >= 4 ? 'text-orange-700 dark:text-orange-400' : 'text-slate-900 dark:text-slate-100'}`}>{deviceAgeYears.toFixed(1)} Anos</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 font-medium italic">Ciclo de vida recomendado: 4 anos.</p>
                                    {deviceAgeYears >= 4 && <p className="text-[9px] text-orange-600 dark:text-orange-400 mt-2 font-black uppercase tracking-tighter">ALERTA: Ativo atingiu fim do ciclo de vida!</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10"><div className="space-y-5"><h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest border-l-4 border-emerald-500 pl-3">Dados de Aquisição</h4><div><label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-2 tracking-widest"><FileText size={12}/> Número da Nota Fiscal</label><input disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100 transition-colors" value={formData.invoiceNumber || ''} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} placeholder="NF-XXXXXX"/></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-2 tracking-widest"><DollarSign size={12}/> Valor Pago (R$)</label><div className="relative"><span className="absolute left-3 top-3 text-slate-400 dark:text-slate-600 text-xs font-bold">R$</span><input type="text" disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 pl-9 text-sm focus:border-emerald-500 outline-none bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100 font-bold transition-colors" value={formatCurrencyBR(formData.purchaseCost || 0)} onChange={e => setFormData({...formData, purchaseCost: parseCurrencyBR(e.target.value)})} placeholder="0,00"/></div></div><div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-2 tracking-widest"><Calendar size={12}/> Data Compra</label><input type="date" disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100 transition-colors" value={formData.purchaseDate ? formData.purchaseDate.substring(0, 10) : ''} onChange={e => setFormData({...formData, purchaseDate: e.target.value})}/></div></div><div><label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-2 tracking-widest"><Box size={12}/> Fornecedor (A-Z)</label><input disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50 dark:bg-slate-800/50 dark:text-slate-100 transition-colors" value={formData.supplier || ''} onChange={e => setFormData({...formData, supplier: e.target.value})} placeholder="Nome da Loja"/></div></div><div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center shadow-inner transition-colors">{(formData.purchaseInvoiceUrl || formData.hasInvoice) ? (<div className="space-y-4 w-full"><div className="h-48 w-full bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 flex items-center justify-center shadow-xl overflow-hidden group relative">{(formData.purchaseInvoiceUrl && formData.purchaseInvoiceUrl.startsWith('data:image')) ? (<img src={formData.purchaseInvoiceUrl} className="h-full w-full object-contain" alt="NF" />) : (<div className="flex flex-col items-center gap-2 text-blue-600 dark:text-blue-400"><FileCode size={64}/><span className="text-[10px] font-black uppercase">Nota Fiscal Anexada</span></div>)}</div><div className="flex gap-3"><button type="button" disabled={loadingFiles[editingId!]} onClick={() => openBase64File('DEVICE', editingId!, formData.purchaseInvoiceUrl)} className="flex-1 bg-white dark:bg-slate-800 border-2 border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center justify-center gap-2 shadow-sm transition-all">{loadingFiles[editingId!] ? <Loader2 size={14} className="animate-spin"/> : <ExternalLink size={14}/>} Abrir Documento</button>{!isViewOnly && <button type="button" onClick={() => setFormData({...formData, purchaseInvoiceUrl: '', hasInvoice: false})} className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl border-2 border-red-100 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all shadow-sm"><Trash2 size={18}/></button>}</div></div>) : (<><div className="h-20 w-20 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-200 dark:text-slate-800 mb-4 shadow-lg border-2 border-slate-100 dark:border-slate-800"><Paperclip size={32}/></div><h5 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Anexo da Nota Fiscal</h5><p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">Importe a imagem ou PDF.</p>{!isViewOnly && (<label className="mt-6 cursor-pointer bg-emerald-600 dark:bg-emerald-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">{isUploadingNF ? <RefreshCw size={14} className="animate-spin"/> : <Plus size={14}/>} Escolher Arquivo<input type="file" className="hidden" onChange={handleNFFileChange} accept="application/pdf,image/*" /></label>)}</>)}</div></div></div>)}
                    {activeTab === 'MAINTENANCE' && (<div className="space-y-6 animate-fade-in">{!isViewOnly && (<div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-2xl border border-orange-200 dark:border-orange-900/40 space-y-4 shadow-sm transition-colors"><div className="flex items-center gap-2"><div className="h-8 w-8 bg-orange-200 dark:bg-orange-900/40 rounded-full flex items-center justify-center text-orange-700 dark:text-orange-400"><Wrench size={16}/></div><h5 className="text-[10px] font-black text-orange-800 dark:text-orange-200 uppercase tracking-widest">Nova Manutenção</h5></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="md:col-span-3"><label className="block text-[10px] font-bold text-orange-400 mb-1">Descrição</label><input placeholder="Ex: Troca de tela..." className="w-full border-2 border-orange-100 dark:border-orange-900/30 rounded-xl p-3 text-sm focus:border-orange-400 outline-none bg-white dark:bg-slate-800 dark:text-slate-100 shadow-inner" value={newMaint.description || ''} onChange={e => setNewMaint({...newMaint, description: e.target.value})}/></div><div><label className="block text-[10px] font-bold text-orange-400 mb-1">Custo (R$)</label><div className="relative"><span className="absolute left-3 top-3 text-orange-400 text-xs font-bold">R$</span><input type="text" className="w-full border-2 border-orange-100 dark:border-orange-900/30 rounded-xl p-3 pl-10 text-sm focus:border-orange-400 outline-none bg-white dark:bg-slate-800 dark:text-slate-100" value={formatCurrencyBR(newMaint.cost || 0)} onChange={e => setNewMaint({...newMaint, cost: parseCurrencyBR(e.target.value)})}/></div></div><div><label className="block text-[10px] font-bold text-orange-400 mb-1">Data</label><div className="relative"><Calendar className="absolute left-3 top-3 text-orange-300" size={16}/><input type="date" className="w-full border-2 border-orange-100 rounded-xl p-3 pl-10 text-sm focus:border-orange-400 outline-none bg-white dark:bg-slate-800 dark:text-slate-100" value={newMaint.date || ''} onChange={e => setNewMaint({...newMaint, date: e.target.value})}/></div></div><div><label className="block text-[10px] font-bold text-orange-400 mb-1">Anexo</label><label className={`w-full flex items-center gap-3 bg-white dark:bg-slate-800 border-2 border-dashed border-orange-200 p-2.5 rounded-xl cursor-pointer hover:bg-orange-100/50 transition-all ${isUploadingMaint ? 'opacity-50' : ''}`}><div className="h-8 w-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-400">{isUploadingMaint ? <RefreshCw size={16} className="animate-spin"/> : <Paperclip size={16}/>}</div><span className="text-[10px] font-bold text-orange-700 uppercase truncate">{newMaint.invoiceUrl ? 'Carregado' : 'Importar Nota'}</span><input type="file" className="hidden" onChange={handleMaintFileChange} accept="application/pdf,image/*" /></label></div></div><div className="flex justify-end pt-2"><button type="button" onClick={saveMaintenance} disabled={!newMaint.description || isUploadingMaint} className="bg-orange-600 text-white px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 shadow-lg transition-all active:scale-95 disabled:opacity-50">Lançar</button></div></div>)}<div className="space-y-3"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><History size={12}/> Histórico</h4><div className="grid grid-cols-1 gap-3">{deviceMaintenances.length > 0 ? deviceMaintenances.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(m => (<div key={m.id} className="flex justify-between items-center p-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-orange-200 transition-all group"><div className="flex items-center gap-4"><div className="h-10 w-10 bg-orange-50 dark:bg-orange-900/40 rounded-xl flex items-center justify-center text-orange-600"><Wrench size={20}/></div><div><p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{m.description}</p><div className="flex items-center gap-2 mt-0.5"><span className="text-[10px] font-black text-slate-400 uppercase">{formatDateBR(m.date)}</span><span className="text-[10px] font-black text-emerald-600 uppercase">R$ {formatCurrencyBR(m.cost)}</span></div></div></div><div className="flex gap-2">{(m.invoiceUrl || m.hasInvoice) && (<button disabled={loadingFiles[m.id]} type="button" onClick={() => openBase64File('MAINTENANCE', m.id, m.invoiceUrl)} className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center">{loadingFiles[m.id] ? <Loader2 size={16} className="animate-spin"/> : <ExternalLink size={16}/>}</button>)}{!isViewOnly && <button type="button" onClick={() => { if(window.confirm('Excluir?')) deleteMaintenance(m.id, adminName) }} className="p-2.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm"><Trash2 size={16}/></button>}</div></div>)) : (<div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800"><p className="text-slate-400 font-bold text-xs uppercase tracking-widest italic">Nenhuma manutenção registrada.</p></div>)}</div></div></div>)}
                    {activeTab === 'LICENSES' && (<div className="space-y-4 animate-fade-in"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Globe size={14}/> Licenças Vinculadas</h4><div className="grid grid-cols-1 gap-3">{deviceAccounts.length > 0 ? deviceAccounts.map(acc => (<div key={acc.id} className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all"><div className="flex items-center gap-4"><div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-inner ${acc.type === AccountType.EMAIL ? 'bg-blue-50 text-blue-600' : acc.type === AccountType.OFFICE ? 'bg-orange-50 text-orange-600' : acc.type === AccountType.ERP ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>{acc.type === AccountType.EMAIL ? <Mail size={24}/> : acc.type === AccountType.OFFICE ? <FileText size={24}/> : acc.type === AccountType.ERP ? <Lock size={24}/> : <Key size={24}/>}</div><div><p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{acc.name}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{acc.login}</p></div></div><div className="flex items-center gap-2">{acc.accessUrl && (<button type="button" onClick={(e) => { e.stopPropagation(); handleOpenUrl(acc.accessUrl); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><ExternalLink size={16}/></button>)}<div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono text-[10px] text-slate-700 min-w-[80px] text-center">{showPasswords[acc.id] ? (acc.password || '---') : '••••••••'}</div><button type="button" onClick={() => setShowPasswords(p => ({...p, [acc.id]: !p[acc.id]}))} className="p-2 text-slate-400 hover:text-indigo-600">{showPasswords[acc.id] ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></div>)) : (<div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800"><Globe size={32} className="mx-auto text-slate-200 mb-2"/><p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Nenhuma licença vinculada.</p></div>)}</div></div>)}
                    {activeTab === 'CUSTODY' && (<PossessionHistory deviceId={editingId || ''} />)}
                    {activeTab === 'HISTORY' && (<div className="relative border-l-4 border-slate-100 dark:border-slate-800 ml-4 space-y-8 py-4 animate-fade-in">{getHistory(editingId || '').map(log => (<div key={log.id} className="relative pl-8"><div className={`absolute -left-[10px] top-1 h-4 w-4 rounded-full border-4 border-white dark:border-slate-950 shadow-md ${log.action === ActionType.RESTORE ? 'bg-indigo-500' : 'bg-blue-500'}`}></div><div className="text-[10px] text-slate-400 uppercase mb-1 tracking-widest">{new Date(log.timestamp).toLocaleString()}</div><div className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-tight">{log.action}</div><div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mt-2 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors"><LogNoteRenderer log={log} /></div><div className="text-[9px] font-black text-slate-300 uppercase mt-2 tracking-tighter">Realizado por: {log.adminUser}</div></div>))}</div>)}
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 px-8 py-5 flex justify-end gap-3 border-t dark:border-slate-800 shrink-0 transition-colors">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-black text-[10px] uppercase text-slate-500 hover:bg-slate-100 transition-all tracking-widest">Fechar</button>
                  {isViewOnly ? (
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsViewOnly(false); }} className="px-10 py-3 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all hover:scale-105 flex items-center gap-2"><Edit2 size={16}/> Habilitar Edição</button>
                  ) : (
                    <button type="submit" form="devForm" className="px-10 py-3 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">Salvar</button>
                  )}
                </div>
            </form>
          </div>
        </div>
      )}

      {isReasonModalOpen && (<div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-blue-100"><div className="p-8"><div className="flex flex-col items-center text-center mb-6"><div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-4 shadow-inner border border-blue-100"><Save size={32} /></div><h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Confirmar Alterações?</h3><p className="text-xs text-slate-400 mt-2">Informe o motivo da alteração para auditoria:</p></div><textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none mb-6 transition-all bg-white dark:bg-slate-800 dark:text-slate-100" rows={3} placeholder="Descreva o que foi alterado..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors hover:bg-slate-200">Voltar</button><button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all">Salvar</button></div></div></div></div>)}
      {isDeleteModalOpen && (<div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-sm overflow-hidden border border-red-100"><div className="p-8"><div className="flex flex-col items-center text-center mb-6"><div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-inner border border-red-100"><AlertTriangle size={32} /></div><h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Confirma o Descarte?</h3></div><textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-red-100 outline-none mb-6 transition-all bg-white dark:bg-slate-800 dark:text-slate-100" rows={3} placeholder="Motivo..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors hover:bg-slate-200">Manter</button><button onClick={() => { deleteDevice(deleteTargetId!, adminName, deleteReason); setIsDeleteModalOpen(false); }} disabled={!deleteReason.trim()} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 disabled:opacity-50 transition-all">Confirmar</button></div></div></div></div>)}
      {isRestoreModalOpen && (<div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-indigo-100"><div className="p-8"><div className="flex flex-col items-center text-center mb-6"><div className="h-16 w-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-4 shadow-inner border border-indigo-100"><RotateCcw size={32} /></div><h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Restaurar?</h3></div><textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-indigo-100 outline-none mb-6 transition-all bg-white dark:bg-slate-800 dark:text-slate-100" rows={3} placeholder="Motivo..." value={restoreReason} onChange={(e) => setRestoreReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsRestoreModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors hover:bg-slate-200">Cancelar</button><button onClick={() => { restoreDevice(restoreTargetId!, adminName, restoreReason); setIsRestoreModalOpen(false); }} disabled={!restoreReason.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 transition-all">Restaurar</button></div></div></div></div>)}
      {isModelSettingsOpen && <ModelSettings onClose={() => setIsModelSettingsOpen(false)} />}
    </div>
  );
};

export default DeviceManager;