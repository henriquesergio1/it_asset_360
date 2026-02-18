import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, DeviceStatus, MaintenanceRecord, MaintenanceType, ActionType, AssetType, CustomField, User, SimCard, AccountType, AuditLog } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, Settings, Image as ImageIcon, Wrench, DollarSign, Paperclip, ExternalLink, X, RotateCcw, AlertTriangle, RefreshCw, FileText, Calendar, Box, Hash, Tag as TagIcon, FileCode, Briefcase, Cpu, History, SlidersHorizontal, Check, Info, ShieldCheck, ChevronDown, Save, Globe, Lock, Eye, EyeOff, Mail, Key, UserCheck, UserX, FileWarning, SlidersHorizontal as Sliders, ChevronLeft, ChevronRight, Users, CheckCircle, Loader2, ArrowRight, TrendingDown, Scale, Fingerprint, LayoutGrid, Database, Shield } from 'lucide-react';
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
                    ${isOpen ? 'ring-4 ring-indigo-100 dark:ring-indigo-900/20 border-indigo-50' : ''}
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
                                className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-b border-slate-50 dark:border-slate-700 last:border-0 ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
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
    const { sims, users, sectors, models, customFields } = useData();
    
    const resolveValue = (key: string, val: any): any => {
        if (val === null || val === undefined || val === '---' || val === '') return <span className="opacity-30 italic">vazio</span>;
        if (key.toLowerCase().includes('date') || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))) {
            try { return new Date(val).toLocaleDateString('pt-BR'); } catch (e) { return val; }
        }
        if (key === 'purchaseCost') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        if (key === 'sectorId') return sectors.find(s => s.id === val)?.name || val;
        if (key === 'linkedSimId') return sims.find(s => s.id === val)?.phoneNumber || val;
        if (key === 'currentUserId' || key === 'userId') return users.find(u => u.id === val)?.fullName || val;
        if (key === 'modelId') return models.find(m => m.id === val)?.name || val;
        if (key === 'active') return val ? 'Ativo' : 'Inativo';
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

    // Tenta usar dados estruturados (De/Para) se disponíveis
    let diffs: { field: string, rawKey: string, old: any, new: any }[] = [];
    try {
        if (log.previousData && log.newData) {
            const prev = typeof log.previousData === 'string' ? JSON.parse(log.previousData) : log.previousData;
            const next = typeof log.newData === 'string' ? JSON.parse(log.newData) : log.newData;
            const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
            allKeys.forEach(key => {
                if (key.startsWith('_')) return;
                if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
                    diffs.push({ field: FIELD_LABELS[key] || key, rawKey: key, old: prev[key], new: next[key] });
                }
            });
        }
    } catch (e) {}

    if (diffs.length > 0) {
        return (
            <div className="mt-2 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                {diffs.map((d, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{d.field}</span>
                        <div className="flex items-center gap-2 text-[11px]">
                            <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/30 line-through opacity-70">{resolveValue(d.rawKey, d.old)}</span>
                            <ArrowRight size={10} className="text-slate-300"/>
                            <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40 font-bold">{resolveValue(d.rawKey, d.new)}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Fallback para notas em texto (formato antigo ou mensagens simples)
    const lines = (log.notes || '').split('\n');
    return (
        <div className="space-y-1.5 py-1">
            {lines.map((line, i) => {
                if (!line.trim()) return null;
                return <div key={i} className="text-slate-600 dark:text-slate-300 font-medium text-[11px] leading-relaxed">{line}</div>;
            })}
        </div>
    );
};

const PossessionTimeline = ({ deviceId }: { deviceId: string }) => {
    const { getHistory, users } = useData();
    const history = getHistory(deviceId);
    const navigate = useNavigate();
    
    const chain = history
        .filter(l => l.action === ActionType.CHECKOUT || l.action === ActionType.CHECKIN)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (chain.length === 0) {
        return (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <History size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3 opacity-50"/>
                <p className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest italic">Sem movimentações.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-4 space-y-8 py-2">
                {chain.map((log) => {
                    const isCheckout = log.action === ActionType.CHECKOUT;
                    let userName = 'Colaborador';
                    try {
                        const data = isCheckout ? JSON.parse(log.newData || '{}') : JSON.parse(log.previousData || '{}');
                        if (data.userName) userName = data.userName;
                    } catch(e) {}
                    const foundUser = users.find(u => users.find(x => x.fullName === userName)?.id === u.id);

                    return (
                        <div key={log.id} className="relative pl-8">
                            <div className={`absolute -left-[11px] top-0 h-5 w-5 rounded-full border-4 border-white dark:border-slate-900 shadow-md flex items-center justify-center ${isCheckout ? 'bg-indigo-600' : 'bg-amber-500'}`}>
                                {isCheckout ? <UserCheck size={10} className="text-white"/> : <UserX size={10} className="text-white"/>}
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${isCheckout ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                        {isCheckout ? 'Entrega' : 'Devolução'}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400 font-bold">{new Date(log.timestamp).toLocaleDateString()}</span>
                                </div>
                                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                    {foundUser ? (
                                        <button onClick={() => navigate(`/users?userId=${foundUser.id}`)} className="text-indigo-600 hover:underline">{userName}</button>
                                    ) : userName}
                                </p>
                                <div className="mt-2 text-[11px] text-slate-500">
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
    { id: 'pulsusId', label: 'ID Pulsus' },
    { id: 'sectorName', label: 'Cargo / Função' },
    { id: 'linkedSim', label: 'Chip Vinculado' },
    { id: 'purchaseInfo', label: 'Valor/Data Compra' }
];

const formatCurrencyBR = (value: number): string => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
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

const getAgeInMonths = (dateStr?: string) => {
    if (!dateStr) return 0;
    const start = new Date(dateStr);
    const now = new Date();
    return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
};

const Resizer = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
    <div onMouseDown={onMouseDown} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-400 transition-colors z-10 bg-slate-200/50 dark:bg-slate-700/50" />
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
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
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
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'FINANCIAL' | 'MAINTENANCE' | 'LICENSES' | 'TIMELINE' | 'HISTORY'>('GENERAL');
  
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
      const saved = localStorage.getItem('device_manager_columns');
      return saved ? JSON.parse(saved) : ['assetTag', 'linkedSim', 'sectorName'];
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
      const saved = localStorage.getItem('device_manager_widths');
      return saved ? JSON.parse(saved) : {};
  });
  
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
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
      localStorage.setItem('device_manager_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
      localStorage.setItem('device_manager_widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewStatus, itemsPerPage]);

  const toggleColumn = (id: string) => setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handleResize = (colId: string, startX: number, startWidth: number) => {
    const onMouseMove = (e: MouseEvent) => setColumnWidths(prev => ({ ...prev, [colId]: Math.max(startWidth + (e.clientX - startX), 50) }));
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
      const blobUrl = URL.createObjectURL(new Blob([array], { type: mime }));
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
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const deviceId = params.get('deviceId');
    if (deviceId) {
        const device = devices.find(d => d.id === deviceId);
        if (device) handleOpenFlyout(device, true);
    }
  }, [location, devices]);

  const adminName = currentUser?.name || 'Sistema';
  const availableSims = sims.filter(s => s.status === DeviceStatus.AVAILABLE || s.id === formData.linkedSimId);
  const simOptions: Option[] = availableSims.map(s => ({ value: s.id, label: s.phoneNumber, subLabel: s.operator })).sort((a,b) => a.label.localeCompare(b.label));

  const getModelDetails = (modelId?: string) => {
    const model = models.find(m => m.id === modelId);
    const brand = brands.find(b => b.id === model?.brandId);
    const type = assetTypes.find(t => t.id === model?.typeId);
    return { model, brand, type };
  };

  const relevantFields = (() => {
      const { model } = getModelDetails(formData.modelId);
      const selectedAssetType = assetTypes.find(t => t.id === model?.typeId);
      if (!selectedAssetType?.customFieldIds) return [];
      return selectedAssetType.customFieldIds.map(id => customFields.find(cf => cf.id === id)).filter(Boolean) as CustomField[];
  })();

  const filteredDevices = devices.filter(d => {
    if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;
    const { model, brand } = getModelDetails(d.modelId);
    const sector = sectors.find(s => s.id === d.sectorId);
    const user = users.find(u => u.id === d.currentUserId);
    const sim = sims.find(s => s.id === d.linkedSimId);
    
    // Busca inteligente expandida v3.4.6
    const searchString = [
        model?.name, 
        brand?.name, 
        d.assetTag, 
        d.internalCode, 
        d.imei, 
        d.serialNumber, 
        d.pulsusId,
        sector?.name,
        user?.fullName,
        sim?.phoneNumber
    ].filter(Boolean).join(' ').toLowerCase();

    return searchString.includes(searchTerm.toLowerCase());
  }).sort((a, b) => (models.find(m => m.id === a.modelId)?.name || '').localeCompare(models.find(m => m.id === b.modelId)?.name || ''));

  const totalItems = filteredDevices.length;
  const currentItemsPerPage = itemsPerPage === 'ALL' ? totalItems : itemsPerPage;
  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(totalItems / currentItemsPerPage);
  const startIndex = (currentPage - 1) * (itemsPerPage === 'ALL' ? 0 : itemsPerPage as number);
  const paginatedDevices = itemsPerPage === 'ALL' ? filteredDevices : filteredDevices.slice(startIndex, startIndex + (itemsPerPage as number));

  const handleOpenFlyout = (device?: Device, viewOnly: boolean = false) => {
    setActiveTab('GENERAL');
    setIsViewOnly(device?.status === DeviceStatus.RETIRED || viewOnly);
    if (device) { setEditingId(device.id); setFormData({ ...device, customData: device.customData || {} }); setIdType(device.imei && !device.assetTag ? 'IMEI' : 'TAG'); } 
    else { setEditingId(null); setFormData({ status: DeviceStatus.AVAILABLE, purchaseDate: new Date().toISOString().split('T')[0], purchaseCost: 0, customData: {}, linkedSimId: null }); setIdType('TAG'); }
    setIsFlyoutOpen(true);
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetTag && !formData.imei) return alert('Identificação obrigatória.');
    if (editingId) { 
        setEditReason(''); 
        setIsReasonModalOpen(true); 
    } 
    else { addDevice({ ...formData, id: Math.random().toString(36).substr(2, 9), currentUserId: null } as Device, adminName); setIsFlyoutOpen(false); }
  };

  const confirmEdit = () => {
    if (!editReason.trim()) return alert('Motivo obrigatório.');
    updateDevice(formData as Device, adminName);
    setIsReasonModalOpen(false); setIsFlyoutOpen(false);
  };

  const handleDeleteQuick = (id: string) => {
      setDeleteTargetId(id);
      setDeleteReason('');
      setIsDeleteModalOpen(true);
  };

  const toggleMaintenanceStatus = (device: Device) => {
      if (device.status === DeviceStatus.IN_USE) return alert("Devolva o ativo antes.");
      const newStatus = device.status === DeviceStatus.MAINTENANCE ? DeviceStatus.AVAILABLE : DeviceStatus.MAINTENANCE;
      if (window.confirm(`${newStatus === DeviceStatus.MAINTENANCE ? 'Enviar' : 'Retornar'} manutenção?`)) updateDevice({ ...device, status: newStatus }, adminName);
  };

  const deviceMaintenances = maintenances.filter(m => m.deviceId === editingId);
  const deviceAccounts = editingId ? accounts.filter(a => a.deviceId === editingId) : [];
  const isFinancialOk = formData.invoiceNumber && (formData.purchaseInvoiceUrl || formData.hasInvoice);

  // TCO Calculations (v3.4.4 Adjusted Thresholds)
  const totalRepairCost = deviceMaintenances.reduce((acc, m) => acc + (m.cost || 0), 0);
  const purchaseCost = formData.purchaseCost || 0;
  const tcoValue = purchaseCost + totalRepairCost;
  const deviceAge = getAgeInMonths(formData.purchaseDate);
  const repairRatio = purchaseCost > 0 ? (totalRepairCost / purchaseCost) : 0;

  const getRetirementSuggestion = () => {
      // Ajuste v3.4.4: Idade avançada 48 meses, Reparo Crítico > 60%
      if (repairRatio >= 0.6 || deviceAge >= 48) {
          return { 
            label: 'CRÍTICO: Sugestão de Descarte', 
            color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50', 
            icon: Trash2, 
            reason: repairRatio >= 0.6 ? 'Custo de reparo excedeu o limite crítico de 60% do valor de aquisição.' : 'Equipamento atingiu o limite de ciclo operacional (48 meses).' 
          };
      }
      if (repairRatio >= 0.4 || deviceAge >= 36) {
          return { 
            label: 'ATENÇÃO: Reavaliar Manutenção', 
            color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50', 
            icon: AlertTriangle, 
            reason: repairRatio >= 0.4 ? 'Custo acumulado de reparos elevado (40%+).' : 'Idade avançada (36 meses+). Considerar renovação no próximo ciclo.' 
          };
      }
      return { 
        label: 'SAUDÁVEL: Ativo em Boas Condições', 
        color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50', 
        icon: CheckCircle, 
        reason: 'Custos de manutenção controlados e dentro do ciclo operacional planejado.' 
      };
  };

  const suggestion = getRetirementSuggestion();
  const { model: flyoutModel, brand: flyoutBrand } = getModelDetails(formData.modelId);

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
        <div><h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Inventário Helios</h1><p className="text-slate-500 dark:text-slate-400 font-medium">Gestão inteligente de ativos.</p></div>
        <div className="flex gap-2">
            <div className="relative" ref={columnRef}>
                <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm hover:shadow-md transition-all font-bold"><SlidersHorizontal size={18} /> Colunas</button>
                {isColumnSelectorOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[80] overflow-hidden animate-scale-up">
                        <div className="bg-slate-50 dark:bg-slate-950 px-4 py-3 border-b dark:border-slate-800 flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Layout de Colunas</span><button onClick={() => setIsColumnSelectorOpen(false)}><X size={14}/></button></div>
                        <div className="p-2 space-y-1">{COLUMN_OPTIONS.map(col => (<button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${visibleColumns.includes(col.id) ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{col.label}{visibleColumns.includes(col.id) && <Check size={14}/>}</button>))}</div>
                    </div>
                )}
            </div>
            <button onClick={() => setIsModelSettingsOpen(true)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm hover:shadow-md transition-all font-bold"><Settings size={18} /> Catálogo</button>
            <button onClick={() => handleOpenFlyout()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-xl shadow-indigo-600/20 font-black uppercase text-xs tracking-widest transition-all active:scale-95"><Plus size={20} strokeWidth={3} /> Adicionar</button>
        </div>
      </div>

      <div className="flex gap-4 border-b dark:border-slate-800 overflow-x-auto bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm px-6 pt-2 rounded-2xl transition-colors">
          {(['ALL', DeviceStatus.AVAILABLE, DeviceStatus.IN_USE, DeviceStatus.MAINTENANCE, DeviceStatus.RETIRED] as (DeviceStatus | 'ALL')[]).map(status => (
              <button key={status} onClick={() => setViewStatus(status)} className={`px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all whitespace-nowrap ${viewStatus === status ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{status === 'ALL' ? 'Todos' : status}<span className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full text-[9px]">{status === 'ALL' ? devices.length : devices.filter(d => d.status === status).length}</span></button>
          ))}
      </div>

      <div className="relative group">
        <Search className="absolute left-5 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={22} />
        <input type="text" placeholder="Pesquisar por TAG, IMEI, Modelo, Chip ou Colaborador..." className="pl-14 w-full border-none rounded-2xl py-4 shadow-xl shadow-slate-200/50 dark:shadow-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 transition-all text-lg font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
        <div className="overflow-x-auto custom-scrollbar max-h-[60vh] sticky-header">
            <table className="w-full text-sm text-left table-fixed border-collapse min-w-[1300px]">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-md text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] z-20">
                <tr className="border-b dark:border-slate-700">
                  <th className="px-8 py-5 relative" style={{ width: columnWidths['model'] || '220px' }}>Foto / Modelo <Resizer onMouseDown={(e) => handleResize('model', e.clientX, columnWidths['model'] || 220)} /></th>
                  {visibleColumns.includes('assetTag') && (<th className="px-6 py-5 relative" style={{ width: columnWidths['assetTag'] || '140px' }}>Patrimônio <Resizer onMouseDown={(e) => handleResize('assetTag', e.clientX, columnWidths['assetTag'] || 140)} /></th>)}
                  {visibleColumns.includes('imei') && (<th className="px-6 py-5 relative" style={{ width: columnWidths['imei'] || '160px' }}>IMEI / Ident <Resizer onMouseDown={(e) => handleResize('imei', e.clientX, columnWidths['imei'] || 160)} /></th>)}
                  {visibleColumns.includes('serial') && (<th className="px-6 py-5 relative font-mono" style={{ width: columnWidths['serial'] || '140px' }}>Nº Série <Resizer onMouseDown={(e) => handleResize('serial', e.clientX, columnWidths['serial'] || 140)} /></th>)}
                  {visibleColumns.includes('pulsusId') && (<th className="px-6 py-5 relative" style={{ width: columnWidths['pulsusId'] || '120px' }}>ID Pulsus <Resizer onMouseDown={(e) => handleResize('pulsusId', e.clientX, columnWidths['pulsusId'] || 120)} /></th>)}
                  {visibleColumns.includes('sectorName') && (<th className="px-6 py-5 relative" style={{ width: columnWidths['sectorName'] || '180px' }}>Destinação <Resizer onMouseDown={(e) => handleResize('sectorName', e.clientX, columnWidths['sectorName'] || 180)} /></th>)}
                  {visibleColumns.includes('linkedSim') && (<th className="px-6 py-5 relative" style={{ width: columnWidths['linkedSim'] || '160px' }}>Chip <Resizer onMouseDown={(e) => handleResize('linkedSim', e.clientX, columnWidths['linkedSim'] || 160)} /></th>)}
                  <th className="px-6 py-5 relative" style={{ width: columnWidths['status'] || '130px' }}>Status <Resizer onMouseDown={(e) => handleResize('status', e.clientX, columnWidths['status'] || 130)} /></th>
                  <th className="px-6 py-5 relative" style={{ width: columnWidths['user'] || '200px' }}>Responsável <Resizer onMouseDown={(e) => handleResize('user', e.clientX, columnWidths['user'] || 200)} /></th>
                  <th className="px-8 py-5 text-right w-[150px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {paginatedDevices.map(d => {
                  const { model, brand } = getModelDetails(d.modelId);
                  const user = users.find(u => u.id === d.currentUserId);
                  const linkedSim = sims.find(s => s.id === d.linkedSimId);
                  const sector = sectors.find(s => s.id === d.sectorId);
                  return (
                    <tr key={d.id} onClick={() => handleOpenFlyout(d, true)} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer group bg-white dark:bg-slate-900/40">
                      <td className="px-8 py-5 truncate"><div className="flex items-center gap-4"><div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden border dark:border-slate-700 shadow-inner shrink-0 group-hover:scale-105 transition-transform duration-500">{model?.imageUrl ? <img src={model.imageUrl} className="h-full w-full object-cover" /> : <ImageIcon className="text-slate-300" size={18}/>}</div><div><div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs truncate leading-none mb-1">{model?.name}</div><div className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{brand?.name}</div></div></div></td>
                      {visibleColumns.includes('assetTag') && (<td className="px-6 py-5 truncate"><div className="flex items-center gap-1.5 text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40 w-fit"><TagIcon size={12}/> {d.assetTag || '---'}</div></td>)}
                      {visibleColumns.includes('imei') && (<td className="px-6 py-5 font-mono text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">{d.imei || '---'}</td>)}
                      {visibleColumns.includes('serial') && (<td className="px-6 py-5 font-mono text-[10px] text-slate-500 truncate">{d.serialNumber || '---'}</td>)}
                      {visibleColumns.includes('pulsusId') && (<td className="px-6 py-5 truncate">
                        {d.pulsusId ? (
                            <a href={`https://app.pulsus.mobi/devices/${d.pulsusId}`} target="_blank" onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/40 w-fit text-[10px] font-black group/link">
                                <Shield size={10} className="fill-blue-500/20"/> {d.pulsusId}
                            </a>
                        ) : <span className="text-slate-200 dark:text-slate-700">-</span>}
                      </td>)}
                      {visibleColumns.includes('sectorName') && (<td className="px-6 py-5 truncate"><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border dark:border-slate-700">{sector?.name || 'Não Def.'}</span></td>)}
                      {visibleColumns.includes('linkedSim') && (<td className="px-6 py-5 truncate">{linkedSim ? (<span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5"><Cpu size={12}/> {linkedSim.phoneNumber}</span>) : <span className="text-slate-200 dark:text-slate-700">-</span>}</td>)}
                      <td className="px-6 py-5 truncate"><span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border shadow-sm ${d.status === DeviceStatus.AVAILABLE ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : d.status === DeviceStatus.MAINTENANCE ? 'bg-amber-50 text-amber-700 border-amber-100' : d.status === DeviceStatus.RETIRED ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{d.status}</span></td>
                      <td className="px-6 py-5 truncate">{user ? (<div className="flex flex-col"><span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">{user.fullName}</span><span className="text-[9px] text-slate-400 font-black uppercase">{user.internalCode || 'S/ Cód'}</span></div>) : <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase italic">Em Estoque</span>}</td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            {d.pulsusId && (
                                <a href={`https://app.pulsus.mobi/devices/${d.pulsusId}`} target="_blank" className="p-2 text-blue-400 hover:text-blue-600 transition-colors" title="Abrir no Pulsus MDM"><Shield size={18}/></a>
                            )}
                            {d.status !== DeviceStatus.RETIRED && (
                                <>
                                    <button onClick={() => handleOpenFlyout(d, false)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Editar"><Edit2 size={18}/></button>
                                    <button onClick={() => handleDeleteQuick(d.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Baixar / Descartar"><Trash2 size={18}/></button>
                                </>
                            )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors">
            <div className="flex items-center gap-6"><div className="flex items-center gap-2"><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Exibir:</span><select className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none" value={itemsPerPage} onChange={(e) => setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={40}>40</option><option value="ALL">Todos</option></select></div><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total: {totalItems} ativos</p></div>
            {totalPages > 1 && (<div className="flex items-center gap-3"><button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className={`p-2 rounded-xl transition-all ${currentPage === 1 ? 'text-slate-200' : 'bg-white dark:bg-slate-800 text-indigo-600 border dark:border-slate-700 shadow-sm'}`}><ChevronLeft size={18}/></button><span className="text-xs font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-4 py-2 rounded-xl shadow-inner">{currentPage} / {totalPages}</span><button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className={`p-2 rounded-xl transition-all ${currentPage === totalPages ? 'text-slate-200' : 'bg-white dark:bg-slate-800 text-indigo-600 border dark:border-slate-700 shadow-sm'}`}><ChevronRight size={18}/></button></div>)}
        </div>
      </div>

      {/* Flyout Drawer Moderno */}
      {isFlyoutOpen && (
        <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] animate-fade-in" onClick={() => setIsFlyoutOpen(false)}></div>
            <div ref={flyoutRef} className="fixed inset-y-0 right-0 w-full md:w-[650px] bg-white dark:bg-slate-900 z-[100] shadow-[-20px_0_40px_rgba(0,0,0,0.1)] flex flex-col transform transition-all duration-500 ease-out animate-slide-in border-l dark:border-slate-800">
                <div className="bg-slate-900 dark:bg-black px-8 py-8 shrink-0 relative overflow-hidden transition-all duration-500">
                    <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><Smartphone size={240}/></div>
                    
                    <div className="relative z-10 flex items-center gap-6">
                        {/* Foto do Dispositivo em Destaque */}
                        <div className="h-32 w-32 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl backdrop-blur-sm group/thumb">
                            {flyoutModel?.imageUrl ? (
                                <img src={flyoutModel.imageUrl} alt={flyoutModel.name} className="h-full w-full object-cover transition-transform duration-700 group-hover/thumb:scale-110" />
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-slate-500">
                                    <ImageIcon size={32} className="opacity-40" />
                                    <span className="text-[8px] font-black uppercase tracking-tighter opacity-30">S/ Foto</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full w-fit">
                                    <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                                        {editingId ? 'Ativo Registrado' : 'Novo Cadastro no Sistema'}
                                    </span>
                                </div>
                                {formData.pulsusId && (
                                    <a href={`https://app.pulsus.mobi/devices/${formData.pulsusId}`} target="_blank" className="flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 px-3 py-1 rounded-full text-blue-300 transition-all border border-blue-400/20">
                                        <Shield size={12} className="fill-blue-400/20"/>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{formData.pulsusId}</span>
                                    </a>
                                )}
                            </div>
                            
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-4 truncate">
                                {flyoutModel?.name || (editingId ? 'Equipamento Helios' : 'Novo Ativo')}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                {formData.assetTag && (
                                    <div className="flex items-center gap-2 text-slate-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                                        <TagIcon size={12} className="text-indigo-400"/>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{formData.assetTag}</span>
                                    </div>
                                )}
                                {formData.imei && (
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Fingerprint size={12} className="text-indigo-400"/>
                                        <span className="text-[10px] font-mono font-bold tracking-tight">IMEI: {formData.imei}</span>
                                    </div>
                                )}
                                {formData.serialNumber && (
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Hash size={12} className="text-indigo-400"/>
                                        <span className="text-[10px] font-mono font-bold tracking-tight">SN: {formData.serialNumber}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsFlyoutOpen(false); }} className="h-10 w-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-all cursor-pointer absolute top-0 right-0 z-50"><X size={20}/></button>
                    </div>
                </div>

                <div className="flex bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 overflow-x-auto shrink-0 px-6 pt-2 sticky top-0 z-20">
                    {[
                        { id: 'GENERAL', label: 'Geral', icon: Info },
                        { id: 'FINANCIAL', label: 'Financeiro', icon: DollarSign, alert: !isFinancialOk },
                        { id: 'MAINTENANCE', label: 'Reparos', icon: Wrench, count: deviceMaintenances.length },
                        { id: 'LICENSES', label: 'Cloud', icon: Globe, count: deviceAccounts.length },
                        { id: 'TIMELINE', label: 'Histórico de Uso', icon: History },
                        { id: 'HISTORY', label: 'Auditoria', icon: ShieldCheck }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`group relative px-5 py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}>
                            <tab.icon size={14}/> {tab.label}
                            {tab.count !== undefined && <span className="text-[9px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-md ml-1">{tab.count}</span>}
                            {tab.alert && <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span>}
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full shadow-[0_-4px_12px_rgba(79,70,229,0.5)]"></div>}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 transition-colors">
                  <form id="devForm" onSubmit={handleDeviceSubmit} className="p-10">
                    {activeTab === 'GENERAL' && (
                        <div className="space-y-10 animate-fade-in">
                            {isViewOnly && (<div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-4"><div className="h-10 w-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0"><Info size={24}/></div><p className="text-xs font-bold text-indigo-900 dark:text-indigo-100 leading-relaxed uppercase tracking-tighter">Modo de leitura ativo. Para modificar identificadores ou vínculos, habilite o modo de edição abaixo.</p></div>)}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="md:col-span-2 space-y-4">
                                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Catálogo Principal</label>
                                    <select required disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-black bg-slate-50 dark:bg-slate-950 focus:border-indigo-500 outline-none transition-all" value={formData.modelId || ''} onChange={e => setFormData({...formData, modelId: e.target.value})}>
                                        <option value="">Vincular Modelo...</option>
                                        {[...models].sort((a,b) => a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{brands.find(b => b.id === m.brandId)?.name} {m.name}</option>)}
                                    </select>
                                </div>

                                {/* IDENTIDADE PRIMÁRIA REESTRUTURADA v3.4.8 */}
                                <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 space-y-5">
                                    <label className="block text-[10px] font-black uppercase text-indigo-500 tracking-widest">Identidade Primária</label>
                                    <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl">
                                        <button type="button" onClick={() => setIdType('TAG')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${idType === 'TAG' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-400'}`}>Patrimônio</button>
                                        <button type="button" onClick={() => setIdType('IMEI')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${idType === 'IMEI' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-400'}`}>IMEI</button>
                                    </div>
                                    <input disabled={isViewOnly} className="w-full bg-transparent border-b-2 border-slate-200 dark:border-slate-800 py-3 text-2xl font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-200" value={idType === 'TAG' ? (formData.assetTag || '') : (formData.imei || '')} onChange={e => setFormData({...formData, [idType === 'TAG' ? 'assetTag' : 'imei']: e.target.value.toUpperCase()})} placeholder={idType === 'TAG' ? 'TI-XXXX' : '000.000...'}/>
                                    
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Serial do Fabricante (S/N)</label>
                                        <input required disabled={isViewOnly} className="w-full border-2 border-white dark:border-slate-800 rounded-xl p-3 text-sm font-mono focus:border-indigo-500 outline-none bg-white dark:bg-slate-900 dark:text-white shadow-sm" value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value.toUpperCase()})} placeholder="Ex: R5CR20..." />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Estado de Disponibilidade</label><select disabled={isViewOnly || formData.status === DeviceStatus.IN_USE} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold bg-slate-50 dark:bg-slate-950 focus:border-indigo-500 outline-none" value={formData.status || ''} onChange={e => setFormData({...formData, status: e.target.value as DeviceStatus})}>{Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/40"><label className="block text-[10px] font-black uppercase text-indigo-400 mb-3 tracking-widest flex items-center gap-2"><Cpu size={14}/> Chip / SIM Vinculado</label><SearchableDropdown disabled={isViewOnly} options={simOptions} value={formData.linkedSimId || ''} onChange={val => setFormData({...formData, linkedSimId: val || null})} placeholder="Pesquisar chip..." icon={<Cpu size={18}/>}/></div>
                                </div>
                            </div>

                            {/* IDENTIFICADORES DE SISTEMA REESTRUTURADOS v3.4.8 */}
                            <div className="bg-slate-900 dark:bg-black p-8 rounded-[2.5rem] shadow-2xl border-2 border-indigo-500/20 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5"><Database size={100}/></div>
                                <h4 className="text-[10px] font-black uppercase text-indigo-400 mb-6 tracking-[0.2em] flex items-center gap-2 relative z-10"><LayoutGrid size={14}/> Identificadores de Sistema</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-500 mb-1.5 tracking-widest">ID Pulsus (MDM)</label>
                                        <input disabled={isViewOnly} className="w-full bg-slate-800 border-none rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.pulsusId || ''} onChange={e => setFormData({...formData, pulsusId: e.target.value})} placeholder="00000"/>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-slate-500 mb-1.5 tracking-widest">Código Interno (ERP/Ref)</label>
                                        <input disabled={isViewOnly} className="w-full bg-slate-800 border-none rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.internalCode || ''} onChange={e => setFormData({...formData, internalCode: e.target.value.toUpperCase()})} placeholder="EX-100"/>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[9px] font-black uppercase text-indigo-400 mb-1.5 tracking-widest">Cargo / Função de Destino</label>
                                        <select disabled={isViewOnly} className="w-full bg-slate-800 border-none rounded-xl p-3 text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none" value={formData.sectorId || ''} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                                            <option value="">Nenhum / Geral...</option>
                                            {[...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {relevantFields.length > 0 && (<div className="grid grid-cols-2 gap-6 p-8 bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">{relevantFields.map(field => (<div key={field.id}><label className="block text-[10px] font-black uppercase text-slate-400 mb-1">{field.name}</label><input disabled={isViewOnly} className="w-full border-2 border-white dark:border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-white dark:bg-slate-900 shadow-sm" value={formData.customData?.[field.id] || ''} onChange={e => setFormData({...formData, customData: {...formData.customData, [field.id]: e.target.value}})}/></div>))}</div>)}
                        </div>
                    )}
                    {activeTab === 'FINANCIAL' && (
                        <div className="space-y-10 animate-fade-in">
                            <div className="bg-slate-900 dark:bg-black rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><Scale size={140} /></div>
                                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-4">Análise Financeira (TCO)</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                                <span className="text-xs font-bold opacity-60">Custo de Aquisição:</span>
                                                <span className="text-lg font-black">{formatCurrencyBR(purchaseCost)}</span>
                                            </div>
                                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                                <span className="text-xs font-bold opacity-60">Total em Reparos:</span>
                                                <span className="text-lg font-black text-amber-400">+{formatCurrencyBR(totalRepairCost)}</span>
                                            </div>
                                            <div className="flex justify-between items-end pt-2">
                                                <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Custo Total de Propriedade:</span>
                                                <span className="text-3xl font-black">{formatCurrencyBR(tcoValue)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`p-6 rounded-3xl border-2 flex flex-col justify-center gap-3 transition-all ${suggestion.color}`}>
                                        <div className="flex items-center gap-3">
                                            <suggestion.icon size={28} />
                                            <span className="text-sm font-black uppercase tracking-tighter">{suggestion.label}</span>
                                        </div>
                                        <p className="text-[10px] font-bold leading-relaxed">{suggestion.reason}</p>
                                        <div className="flex gap-2 items-center text-[9px] font-black uppercase tracking-widest opacity-80 mt-2">
                                            <Calendar size={12} /> Idade: {deviceAge} meses
                                            <span className="mx-2">•</span>
                                            <TrendingDown size={12} /> Reparos: {(repairRatio * 100).toFixed(0)}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div>
                                    <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter border-b-2 border-indigo-600 w-fit mb-8 pb-1">Aquisição e Origem</h4>
                                    <div className="space-y-6">
                                        <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Número da Nota Fiscal</label><input disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-black bg-slate-50 dark:bg-slate-950" value={formData.invoiceNumber || ''} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} placeholder="NF-XXXXXX"/></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Valor (R$)</label><input type="text" disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-black bg-slate-50 dark:bg-slate-950 text-emerald-600" value={formatCurrencyBR(formData.purchaseCost || 0)} onChange={e => setFormData({...formData, purchaseCost: parseCurrencyBR(e.target.value)})}/></div>
                                            <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Data Compra</label><input type="date" disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm bg-slate-50 dark:bg-slate-950" value={formData.purchaseDate ? formData.purchaseDate.substring(0, 10) : ''} onChange={e => setFormData({...formData, purchaseDate: e.target.value})}/></div>
                                        </div>
                                        <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Fornecedor</label><input disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm bg-slate-50 dark:bg-slate-950" value={formData.supplier || ''} onChange={e => setFormData({...formData, supplier: e.target.value})}/></div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center shadow-inner">
                                    {(formData.purchaseInvoiceUrl || formData.hasInvoice) ? (
                                        <div className="space-y-6 w-full">
                                            <div className="h-56 w-full bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-100 dark:border-slate-800 flex items-center justify-center shadow-2xl overflow-hidden group">
                                                {(formData.purchaseInvoiceUrl && formData.purchaseInvoiceUrl.startsWith('data:image')) ? (
                                                    <img src={formData.purchaseInvoiceUrl} className="h-full w-full object-contain" />
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 text-indigo-600"><FileCode size={64}/><span className="text-[10px] font-black uppercase">Documento Armazenado</span></div>
                                                )}
                                            </div>
                                            <div className="flex gap-4">
                                                <button type="button" disabled={loadingFiles[editingId!]} onClick={() => openBase64File('DEVICE', editingId!, formData.purchaseInvoiceUrl)} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-700 transition-all">{loadingFiles[editingId!] ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'Visualizar Nota Fiscal'}</button>
                                                {!isViewOnly && <button type="button" onClick={() => setFormData({...formData, purchaseInvoiceUrl: '', hasInvoice: false})} className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 hover:bg-red-100 transition-all cursor-pointer"><Trash2 size={20}/></button>}
                                            </div>
                                        </div>
                                    ) : (
                                        <><div className="h-20 w-20 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-200 dark:text-slate-800 mb-6 shadow-xl border-2 dark:border-slate-800"><Paperclip size={32}/></div><h5 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest mb-2">Importar Anexo</h5><p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">PDF ou Imagem da Nota</p>{!isViewOnly && (<label className="mt-8 cursor-pointer bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg hover:shadow-indigo-500/10 transition-all flex items-center gap-2 text-slate-600 dark:text-slate-300">{isUploadingNF ? <RefreshCw size={16} className="animate-spin"/> : <Plus size={16}/>} Selecionar<input type="file" className="hidden" onChange={handleNFFileChange} accept="application/pdf,image/*" /></label>)}</>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'MAINTENANCE' && (<div className="space-y-10 animate-fade-in">{!isViewOnly && (<div className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-[2.5rem] border border-amber-200 dark:border-amber-900/30 space-y-6 shadow-sm"><div className="flex items-center gap-3"><div className="h-10 w-10 bg-amber-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><Wrench size={20}/></div><h5 className="text-xl font-black text-amber-900 dark:text-amber-400 tracking-tighter">Registrar Reparo</h5></div><div className="grid grid-cols-3 gap-6"> <div className="col-span-3"><label className="block text-[10px] font-black text-amber-500 uppercase mb-1">Descrição do Problema / Solução</label><input className="w-full border-2 border-white dark:border-slate-800 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none focus:border-amber-500 bg-white dark:bg-slate-900 dark:text-white" value={newMaint.description || ''} onChange={e => setNewMaint({...newMaint, description: e.target.value})}/></div><div className="col-span-1"><label className="block text-[10px] font-black text-amber-500 uppercase mb-1">Custo (R$)</label><input type="text" className="w-full border-2 border-white dark:border-slate-800 rounded-2xl p-4 text-sm font-black bg-white dark:bg-slate-900 dark:text-white" value={formatCurrencyBR(newMaint.cost || 0)} onChange={e => setNewMaint({...newMaint, cost: parseCurrencyBR(e.target.value)})}/></div><div className="col-span-1"><label className="block text-[10px] font-black text-amber-500 uppercase mb-1">Data</label><input type="date" className="w-full border-2 border-white dark:border-slate-800 rounded-2xl p-4 text-sm bg-white dark:bg-slate-900 dark:text-white" value={newMaint.date || ''} onChange={e => setNewMaint({...newMaint, date: e.target.value})}/></div><div className="col-span-1"><label className="block text-[10px] font-black text-amber-500 uppercase mb-1">Nota / PDF</label><label className={`w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-900 border-2 border-dashed border-amber-200 dark:border-amber-900/40 p-3.5 rounded-2xl cursor-pointer hover:bg-amber-100/50 transition-all ${isUploadingMaint ? 'opacity-50' : ''}`}><span className="text-[10px] font-black text-amber-700 dark:text-amber-500 uppercase">{newMaint.invoiceUrl ? '✓ ANEXO CARREGADO' : 'CARREGAR ANEXO'}</span><input type="file" className="hidden" onChange={handleMaintFileChange} accept="application/pdf,image/*" /></label></div></div><div className="flex justify-end pt-4"><button type="button" onClick={saveMaintenance} disabled={!newMaint.description} className="bg-amber-600 text-white px-12 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-amber-700 shadow-xl transition-all active:scale-95 disabled:opacity-50">Confirmar Reparo</button></div></div>)}<div className="space-y-6"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Histórico de Reparos Estendidos</h4><div className="grid grid-cols-1 gap-4">{deviceMaintenances.length > 0 ? deviceMaintenances.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(m => (<div key={m.id} className="flex justify-between items-center p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-3xl group hover:border-amber-200 transition-all"><div className="flex items-center gap-5"><div className="h-12 w-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm"><Wrench size={24}/></div><div><p className="font-extrabold text-slate-900 dark:text-white text-sm">{m.description}</p><div className="flex items-center gap-3 mt-1"><span className="text-[10px] font-black text-slate-400 uppercase">{formatDateBR(m.date)}</span><span className="text-[10px] font-black text-emerald-600 uppercase">R$ {formatCurrencyBR(m.cost)}</span></div></div></div><div className="flex gap-2">{(m.invoiceUrl || m.hasInvoice) && (<button type="button" onClick={() => openBase64File('MAINTENANCE', m.id, m.invoiceUrl)} className="p-3 bg-white dark:bg-slate-900 text-indigo-600 rounded-xl shadow-sm hover:shadow-md transition-all"><ExternalLink size={18}/></button>)}{!isViewOnly && <button type="button" onClick={() => deleteMaintenance(m.id, adminName)} className="p-3 text-red-300 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>}</div></div>)) : (<div className="text-center py-20 bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800"><p className="text-slate-400 font-black text-xs uppercase tracking-widest italic">Nenhum reparo no histórico.</p></div>)}</div></div></div>)}
                    {activeTab === 'LICENSES' && (<div className="space-y-6 animate-fade-in"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Contas Vinculadas a este Hardware</h4><div className="grid grid-cols-1 gap-4">{deviceAccounts.length > 0 ? deviceAccounts.map(acc => (<div key={acc.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-between group hover:border-indigo-200 transition-all"><div className="flex items-center gap-5"><div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg ${acc.type === AccountType.EMAIL ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 text-indigo-600'}`}>{acc.type === AccountType.EMAIL ? <Mail size={28}/> : <Globe size={28}/>}</div><div><p className="font-extrabold text-slate-900 dark:text-white text-base leading-none mb-1">{acc.name}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{acc.login}</p></div></div><div className="flex items-center gap-3">{acc.accessUrl && (<button type="button" onClick={() => window.open(acc.accessUrl, '_blank')} className="p-3 bg-white dark:bg-slate-900 text-indigo-600 rounded-2xl shadow-sm"><ExternalLink size={18}/></button>)}<div className="bg-slate-900 dark:bg-black px-4 py-2 rounded-xl font-mono text-[11px] text-indigo-400 font-black min-w-[120px] text-center shadow-inner">{showPasswords[acc.id] ? (acc.password || '---') : '••••••••'}</div><button type="button" onClick={() => setShowPasswords(p => ({...p, [acc.id]: !p[acc.id]}))} className="p-3 text-slate-400 hover:text-indigo-600">{showPasswords[acc.id] ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>)) : (<div className="text-center py-20 bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800"><Globe size={48} className="mx-auto text-slate-200 mb-4"/><p className="text-xs text-slate-400 font-black uppercase tracking-widest italic">Hardware livre de licenças específicas.</p></div>)}</div></div>)}
                    {activeTab === 'TIMELINE' && (<PossessionTimeline deviceId={editingId || ''} />)}
                    {activeTab === 'HISTORY' && (
                        <div className="relative border-l-4 border-slate-100 dark:border-slate-800 ml-4 space-y-10 py-6 animate-fade-in">
                            {getHistory(editingId || '').map(log => (
                                <div key={log.id} className="relative pl-10">
                                    <div className="absolute -left-[12px] top-1 h-5 w-5 rounded-full border-4 border-white dark:border-slate-900 shadow-md bg-indigo-600"></div>
                                    <div className="text-[10px] text-slate-400 uppercase mb-1 font-black tracking-widest">{new Date(log.timestamp).toLocaleString()}</div>
                                    <div className="font-black text-slate-900 dark:text-white text-sm tracking-tighter uppercase mb-2 flex items-center gap-2">
                                        {log.action}
                                        <span className="text-[9px] font-black text-slate-300 normal-case">• Por: {log.adminUser}</span>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700 shadow-sm transition-colors">
                                        <LogNoteRenderer log={log} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                  </form>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 px-10 py-8 flex justify-between items-center border-t dark:border-slate-800 shrink-0 transition-colors">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setIsFlyoutOpen(false)} className="px-8 py-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-black text-[10px] uppercase text-slate-500 hover:bg-slate-100 transition-all tracking-[0.2em] shadow-sm cursor-pointer">Fechar</button>
                    {editingId && !isViewOnly && <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 hover:bg-red-100 transition-all cursor-pointer"><Trash2 size={22}/></button>}
                  </div>
                  {isViewOnly ? (
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsViewOnly(false); }} className="px-12 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all hover:scale-105 flex items-center gap-3 cursor-pointer"><Edit2 size={20}/> Habilitar Edição</button>
                  ) : (
                    <button type="submit" form="devForm" className="px-12 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 cursor-pointer">Salvar Alterações</button>
                  )}
                </div>
            </div>
        </>
      )}

      {/* Modais de Confirmação (Permanecem centrais para impacto) */}
      {isReasonModalOpen && (<div className="fixed inset-0 bg-slate-900/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in"><div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border border-indigo-100 dark:border-indigo-900/50"><div className="p-10"><div className="flex flex-col items-center text-center mb-8"><div className="h-20 w-20 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 mb-6 shadow-inner border-2 border-white dark:border-slate-800"><Save size={40} /></div><h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Salvar Mudanças?</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Justificativa obrigatória:</p></div><textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-6 text-sm focus:ring-4 focus:ring-indigo-100 outline-none mb-8 transition-all bg-slate-50 dark:bg-slate-950 dark:text-white shadow-inner" rows={3} placeholder="Descreva o motivo..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-100 dark:border-slate-700 cursor-pointer">Voltar</button><button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">Confirmar</button></div></div></div></div>)}
      {isDeleteModalOpen && (<div className="fixed inset-0 bg-slate-900/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in"><div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-sm overflow-hidden border border-red-100 dark:border-red-900/50"><div className="p-10"><div className="flex flex-col items-center text-center mb-8"><div className="h-20 w-20 bg-red-50 dark:bg-red-900/50 rounded-full flex items-center justify-center text-red-600 mb-6 shadow-inner border-2 border-white dark:border-slate-800"><AlertTriangle size={40} /></div><h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Baixar Ativo?</h3></div><textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-6 text-sm focus:ring-4 focus:ring-red-100 outline-none mb-8 transition-all bg-slate-50 dark:bg-slate-950 dark:text-white shadow-inner" rows={3} placeholder="Motivo da baixa..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest cursor-pointer">Cancelar</button><button onClick={() => { deleteDevice(deleteTargetId!, adminName, deleteReason); setIsDeleteModalOpen(false); setIsFlyoutOpen(false); }} disabled={!deleteReason.trim()} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-red-700 cursor-pointer">Confirmar</button></div></div></div></div>)}
      {isModelSettingsOpen && <ModelSettings onClose={() => setIsModelSettingsOpen(false)} />}
    </div>
  );
};

export default DeviceManager;