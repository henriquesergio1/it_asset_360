import { ZabbixMonitorTab } from './ZabbixMonitorTab';
import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Device, DeviceStatus, MaintenanceRecord, MaintenanceType, ActionType, AssetType, CustomField, User, SimCard, AccountType, AuditLog, DeviceAudit } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, Settings, Image as ImageIcon, Wrench, DollarSign, Paperclip, ExternalLink, X, RotateCcw, AlertTriangle, RefreshCw, FileText, Calendar, Box, Hash, Tag as TagIcon, FileCode, Briefcase, Cpu, History, SlidersHorizontal, Check, Info, ShieldCheck, ChevronDown, Save, Globe, Lock, Eye, EyeOff, Mail, Key, UserCheck, UserX, FileWarning, SlidersHorizontal as Sliders, ChevronLeft, ChevronRight, Users, CheckCircle, Loader2, ArrowRight, Download, FileSpreadsheet, FileJson, Monitor } from 'lucide-react';
import { SortableResizableHeader } from './SortableResizableHeader';
import { DataTable, Column } from './DataTable';
import ModelSettings from './ModelSettings';
import FilePreviewModal from './FilePreviewModal';
import { normalizeString } from '../utils/stringUtils';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import { APP_VERSION, UI_LABEL_SMALL, UI_ICON_SIZE_SMALL, UI_ICON_SIZE_BASE, UI_BUTTON_PRIMARY, UI_BUTTON_SECONDARY, UI_BUTTON_SUCCESS, UI_BUTTON_DANGER, UI_BUTTON_WARNING } from '../constants';

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
 <div className="relative"ref={wrapperRef}>
 <div 
 onClick={() => !disabled && setIsOpen(!isOpen)}
 className={`w-full p-3 border-2 rounded-xl flex items-center justify-between transition-all
 ${disabled ? 'bg-white dark:bg-slate-800 cursor-not-allowed border-slate-200 dark:border-slate-700 opacity-70' : 'bg-slate-100 dark:bg-slate-800 cursor-pointer hover:border-blue-400 border-slate-300 dark:border-slate-600'}
 ${isOpen ? 'ring-4 ring-blue-900/20 border-blue-500' : ''}
`}
 >
 <div className="flex items-center gap-3 overflow-hidden">
 {icon && <span className="shrink-0">{icon}</span>}
 <div className="flex flex-col truncate">
 {selectedOption ? (
 <>
 <span className={`font-bold text-sm truncate ${disabled ? '' : 'text-slate-900 dark:text-white'}`}>{selectedOption.label}</span>
 {selectedOption.subLabel && <span className={`text-[11px] truncate font-mono uppercase ${disabled ? '' : ''}`}>{selectedOption.subLabel}</span>}
 </>
 ) : (
 <span className="text-sm">{placeholder}</span>
 )}
 </div>
 </div>
 <ChevronDown size={16} className={`text-blue-600 dark:text-sky-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
 </div>

 {isOpen && !disabled && (
 <div className="absolute z-[120] mt-1 w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl max-h-60 overflow-hidden flex flex-col animate-fade-in">
 <div className="p-2 border-b border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center gap-2 sticky top-0">
 <Search size={14} className="ml-2"/>
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
 className="px-4 py-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/50 border-b border-slate-300 dark:border-slate-600 font-bold text-xs uppercase"
 >
 Nenhum Chip Vinculado
 </div>
 {filteredOptions.length > 0 ? filteredOptions.map(opt => (
 <div 
   key={opt.value}
   onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }}
   className={`px-4 py-3 cursor-pointer border-b border-slate-200 dark:border-slate-700/60 last:border-0 transition-colors ${
     value === opt.value 
       ? 'bg-blue-100 dark:bg-slate-700 font-bold border-l-4 border-l-blue-600 dark:border-l-sky-400' 
       : 'hover:bg-blue-50 dark:hover:bg-slate-700/60 bg-white dark:bg-slate-800'
   }`}
 >
   <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{opt.label}</div>
   {opt.subLabel && <div className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 mt-0.5">{opt.subLabel}</div>}
 </div>
 )) : (
 <div className="px-4 py-8 text-center text-xs italic">Nenhum resultado.</div>
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
 return`${fieldName}: ${fieldVal || 'vazio'}`;
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
 const oldResolved = resolveValue(rawKey, cleanOld);
 const newResolved = resolveValue(rawKey, cleanNew);
 const isOldVoid = !cleanOld || cleanOld === '---' || cleanOld === 'Nenhum' || cleanOld === '[]' || oldResolved === 'Nenhum' || oldResolved === '[Sem data / Não definida]' || oldResolved.includes('1900-01-01');

 return (
   <div key={i} className="flex flex-wrap items-center gap-1.5 text-[11px] p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
     <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">{fieldLabel}:</span>
     {!isOldVoid && (
       <>
         <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-500/20 line-through max-w-[200px] truncate" title={oldResolved}>
           {oldResolved}
         </span>
         <ArrowRight size={12} className="text-slate-400"/>
       </>
     )}
     <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 font-bold max-w-[250px] truncate" title={newResolved}>
       {newResolved}
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
 <span className="uppercase text-[10px]">{label}:</span>
 {foundUser ? (
 <span onClick={() => navigate(`/users?userId=${foundUser.id}`)} className="text-blue-600 dark:text-sky-400 hover:underline cursor-pointer bg-blue-100 dark:bg-sky-500/20 px-2.5 py-1 rounded-full flex items-center gap-1 text-[10px] font-bold">
 <Users size={UI_ICON_SIZE_SMALL}/> {trimmedName}
 </span>
 ) : <span className="text-slate-700 dark:text-slate-200">{trimmedName}</span>}
 </div>
 );
 }

 return <div key={i} className="text-slate-700 dark:text-slate-300 font-medium">{line}</div>;
 })}
 </div>
 );
};

const PossessionHistory = ({ deviceId }: { deviceId: string }) => {
 const { users } = useData();
 const navigate = useNavigate();
 
 const { data: history = [], isLoading } = useQuery({
 queryKey: ['asset-history', deviceId],
 queryFn: async () => {
 const res = await fetch(`/api/logs/asset/${deviceId}`);
 if (!res.ok) throw new Error('Failed to fetch history');
 return res.json();
 },
 enabled: !!deviceId
 });

 const chain = history
 .filter((l: AuditLog) => l.action === ActionType.CHECKOUT || l.action === ActionType.CHECKIN)
 .sort((a: AuditLog, b: AuditLog) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

 if (isLoading) {
 return (
 <div className="text-center py-16 bg-white dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
 <Loader2 size={48} className="mx-auto text-slate-700 dark:text-slate-300 mb-4 opacity-50 animate-spin"/>
 <p className="font-bold text-xs uppercase tracking-widest italic">Carregando histórico...</p>
 </div>
 );
 }

 if (chain.length === 0) {
 return (
 <div className="text-center py-16 bg-white dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
 <History size={48} className="mx-auto text-slate-700 dark:text-slate-300 mb-4 opacity-50"/>
 <p className="font-bold text-xs uppercase tracking-widest italic">Nenhum registro de posse encontrado para este dispositivo.</p>
 </div>
 );
 }

 return (
 <div className="space-y-6 animate-fade-in">
 <h4 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 mb-4">
 <ShieldCheck size={14}/> Cadeia de Custódia (Rastreabilidade Total)
 </h4>
 
 <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-6 space-y-10 py-2">
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
 <div className={`absolute -left-[11px] top-0 h-5 w-5 rounded-full border-4 border-white border-slate-950 flex items-center justify-center 
 ${log.action === ActionType.CHECKOUT ? '' : ''}`}>
 {log.action === ActionType.CHECKOUT ? <UserCheck size={UI_ICON_SIZE_SMALL} className="text-slate-900 dark:text-white"/> : <UserX size={UI_ICON_SIZE_SMALL} className=""/>}
 </div>
 <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-200 hover:border-blue-800 transition-all">
 <div className="flex justify-between items-start mb-2">
 <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${log.action === ActionType.CHECKOUT ? ' bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400' : ' bg-orange-900/30 text-orange-400'}`}>
 {log.action === ActionType.CHECKOUT ? 'RECEBEU' : 'DEVOLVEU'}
 </span>
 <span className="text-[11px] font-mono font-bold">{new Date(log.timestamp).toLocaleString()}</span>
 </div>
 <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
 <Users size={14} className=""/> 
 {foundUser ? (
 <span onClick={() => navigate(`/users?userId=${foundUser.id}`)} className="text-blue-600 dark:text-sky-400 hover:underline cursor-pointer">
 {userName}
 </span>
 ) : <span>{userName}</span>}
 </p>
 <div className="mt-2 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg border-l-2 border-slate-300 dark:border-slate-600">
 <LogNoteRenderer log={log} />
 </div>
 <div className="mt-3 text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">Registrado por: {log.adminUser}</div>
 </div>
 </div>
 );
 })}
 </div>
 
 <div className="bg-blue-50 dark:bg-sky-500/20 p-4 rounded-xl border border-blue-300 dark:border-sky-700/40 flex items-start gap-3">
 <Info size={18} className="shrink-0"/>
 <p className="text-[11px] text-blue-300 font-medium leading-relaxed uppercase">
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
 return`${day}/${month}/${year}`;
};

const Resizer = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
 <div 
 onMouseDown={onMouseDown}
 className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50 transition-colors z-10 bg-slate-200/50 bg-slate-700/50"
 />
);

const DeviceManager = () => {
 const { 
 devices, addDevice, updateDevice, deleteDevice, restoreDevice,
 users, models, brands, assetTypes, sims, customFields, sectors,
 maintenances, addMaintenance, deleteMaintenance, accounts,
   getDeviceInvoice, getMaintenanceInvoice, isReadOnly, audits, addAudit, deleteAudit
 } = useData();
 const { user: currentUser } = useAuth();
 const { showToast } = useToast();
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
 const [activeTab, setActiveTab] = useState<'GENERAL' | 'FINANCIAL' | 'MAINTENANCE' | 'LICENSES' | 'CUSTODY' | 'HISTORY' | 'MONITOR'>('GENERAL');
 const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

 const requestSort = (key: string) => {
 let direction: 'asc' | 'desc' = 'asc';
 if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
 direction = 'desc';
 }
 setSortConfig({ key, direction });
 };
 
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
 const [filterAssetType, setFilterAssetType] = useState<string>('');
 const [filterSector, setFilterSector] = useState<string>('');
 const [isPreviewOpen, setIsPreviewOpen] = useState(false);
 const [previewData, setPreviewData] = useState({ url: '', name: '' });


  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const deviceColumns: Column<Device>[] = [
    { key: 'modelId', label: 'Foto/Dispositivo', minWidth: '200px', sortable: true },
    ...(visibleColumns.includes('assetTag') ? [{ key: 'assetTag', label: 'Patrimônio', minWidth: '120px', sortable: true } as Column<Device>] : []),
    ...(visibleColumns.includes('imei') ? [{ key: 'imei', label: 'IMEI', minWidth: '150px', sortable: true } as Column<Device>] : []),
    ...(visibleColumns.includes('serial') ? [{ key: 'serialNumber', label: 'S/N', minWidth: '120px', sortable: true } as Column<Device>] : []),
    ...(visibleColumns.includes('sectorCode') ? [{ key: 'sectorCode', label: 'Cód. Setor', minWidth: '100px', sortable: true } as Column<Device>] : []),
    ...(visibleColumns.includes('sectorName') ? [{ key: 'sectorName', label: 'Cargo / Função', minWidth: '150px', sortable: true } as Column<Device>] : []),
    ...(visibleColumns.includes('pulsusId') ? [{ key: 'pulsusId', label: 'Pulsus ID', minWidth: '100px', sortable: true } as Column<Device>] : []),
    ...(visibleColumns.includes('linkedSim') ? [{ key: 'linkedSimId', label: 'Chip', minWidth: '150px', sortable: true } as Column<Device>] : []),
    ...(visibleColumns.includes('purchaseInfo') ? [{ key: 'purchaseDate', label: 'Aquisição', minWidth: '120px', sortable: true } as Column<Device>] : []),
    { key: 'status', label: 'Status', minWidth: '120px', sortable: true },
    { key: 'currentUserId', label: 'Usuário', minWidth: '180px', sortable: true },
    { key: 'actions', label: 'Ações', minWidth: '150px', sortable: false }
  ];

  const handleSelectAllToggle = () => {
    if (selectedIds.length === paginatedDevices.length && paginatedDevices.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedDevices.map(d => d.id));
    }
  };
 const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
 const [bulkActionType, setBulkActionType] = useState<'STATUS' | 'RESPONSIBLE' | 'SECTOR' | null>(null);
 const [bulkValue, setBulkValue] = useState<string>('');

 const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.checked) {
 setSelectedIds(paginatedDevices.map(d => d.id));
 } else {
 setSelectedIds([]);
 }
 };

 const handleSelectOne = (id: string) => {
 setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
 };

 const handleBulkUpdate = () => {
 if (!bulkActionType || !bulkValue) return;
 
 try {
 selectedIds.forEach(id => {
 const device = devices.find(d => d.id === id);
 if (device) {
 const updatedDevice = { ...device };
 if (bulkActionType === 'STATUS') updatedDevice.status = bulkValue as DeviceStatus;
 if (bulkActionType === 'RESPONSIBLE') updatedDevice.currentUserId = bulkValue || null;
 if (bulkActionType === 'SECTOR') updatedDevice.sectorId = bulkValue || null;
 updateDevice(updatedDevice, adminName);
 }
 });
 showToast(`${selectedIds.length} ativos atualizados com sucesso!`, 'success');
 setSelectedIds([]);
 setIsBulkModalOpen(false);
 } catch (error) {
 showToast('Erro ao realizar ação em massa.', 'error');
 }
 };

 const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
 const exportData = filteredDevices.map(d => {
 const { model, brand } = getModelDetails(d.modelId);
 const user = users.find(u => u.id === d.currentUserId);
 const sector = sectors.find(s => s.id === d.sectorId);
 return {
 'Patrimônio': d.assetTag || '---',
 'Modelo': model?.name || '---',
 'Marca': brand?.name || '---',
 'IMEI': d.imei || '---',
 'S/N': d.serialNumber || '---',
 'Status': d.status,
 'Responsável': user?.fullName || 'Livre',
 'Setor': sector?.name || '---',
 'Custo': d.purchaseCost || 0,
 'Data Compra': d.purchaseDate ? formatDateBR(d.purchaseDate) : '---'
 };
 });

 const fileName =`inventario_ativos_${new Date().toISOString().split('T')[0]}`;

 if (format === 'csv') exportToCSV(exportData, fileName);
 if (format === 'excel') exportToExcel(exportData, fileName);
 if (format === 'pdf') {
 const headers = ['Patrimônio', 'Modelo', 'Status', 'Responsável', 'Setor'];
 const rows = exportData.map(d => [d.Patrimônio, d.Modelo, d.Status, d.Responsável, d.Setor]);
 exportToPDF(headers, rows, fileName, 'Relatório de Inventário de Ativos');
 }
 };

 const clearFilters = () => {
 setSearchTerm('');
 setViewStatus('ALL');
 setFilterNoPulsusId(false);
 setFilterNoInvoice(false);
 setFilterAssetType('');
 setFilterSector('');
 };

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
 showToast('Nota Fiscal carregada com sucesso!', 'success');
 };
 reader.onerror = () => {
 setIsUploadingNF(false);
 showToast('Erro ao carregar Nota Fiscal.', 'error');
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
 showToast('Comprovante de manutenção carregado!', 'success');
 };
 reader.onerror = () => {
 setIsUploadingMaint(false);
 showToast('Erro ao carregar comprovante.', 'error');
 };
 reader.readAsDataURL(file);
 }
 };

 const openBase64File = async (type: 'DEVICE' | 'MAINTENANCE', id?: string, url?: string, fileName?: string) => {
  if (!url && id) {
  setLoadingFiles(prev => ({ ...prev, [id]: true }));
  try {
  const fileUrl = type === 'DEVICE' ? await getDeviceInvoice(id) : await getMaintenanceInvoice(id);
  if (fileUrl) {
    let detectedExt = 'pdf';
    if (fileUrl.startsWith('data:')) {
      const mime = fileUrl.split(',')[0].split(':')[1].split(';')[0];
      detectedExt = mime.includes('pdf') ? 'pdf' : (mime.includes('png') ? 'png' : 'jpg');
    }
    const defaultName = type === 'DEVICE' ? `Nota_Fiscal_${id}.${detectedExt}` : `Manutencao_${id}.${detectedExt}`;
    setPreviewData({ url: fileUrl, name: fileName || defaultName });
    setIsPreviewOpen(true);
  }
  else alert("Documento não encontrado no servidor.");
  } catch (e) {
  alert("Erro ao baixar documento.");
  } finally {
  setLoadingFiles(prev => ({ ...prev, [id]: false }));
  }
  return;
  }
  if (url) {
    let detectedExt = 'pdf';
    if (url.startsWith('data:')) {
      const mime = url.split(',')[0].split(':')[1].split(';')[0];
      detectedExt = mime.includes('pdf') ? 'pdf' : (mime.includes('png') ? 'png' : 'jpg');
    }
    setPreviewData({ url, name: fileName || `Documento.${detectedExt}` });
    setIsPreviewOpen(true);
  }
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

  const [newAudit, setNewAudit] = useState<Partial<DeviceAudit>>({ 
    date: new Date().toISOString().split('T')[0],
    type: 'Outros',
    status: 'Aprovado'
  });
  const [maintenanceSubTab, setMaintenanceSubTab] = useState<'EXTERNAL' | 'AUDIT'>('EXTERNAL');

  const handleMaintenanceTabChange = (tab: 'EXTERNAL' | 'AUDIT') => {
    setMaintenanceSubTab(tab);
  };

  const saveAudit = () => {
    if (!newAudit.description || !editingId || isReadOnly) {
      showToast('Preencha a descrição da auditoria', 'error');
      return;
    }
    
    const auditRecord: DeviceAudit = {
      id: Math.random().toString(36).substr(2, 9),
      deviceId: editingId,
      date: newAudit.date || new Date().toISOString(),
      technician: adminName,
      type: 'Outros',
      description: newAudit.description,
      observations: newAudit.observations || '',
      status: newAudit.status || 'Aprovado'
    };

    addAudit(auditRecord, adminName);
    setNewAudit({ 
      date: new Date().toISOString().split('T')[0],
      type: 'Verificação de Software',
      status: 'Aprovado'
    });
    showToast('Auditoria técnica registrada', 'success');
  };

 const saveMaintenance = () => {
 if (!editingId || !newMaint.description) return;
 try {
 const isoDate = newMaint.date ?`${newMaint.date}T12:00:00.000Z`: new Date().toISOString();
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
 showToast('Registro de manutenção salvo!', 'success');

 // Após salvar, pergunta se deseja concluir a manutenção
 if (window.confirm('Registro salvo. Deseja concluir a manutenção e retornar o ativo ao status anterior?')) {
 const device = devices.find(d => d.id === editingId);
 if (device) {
 let statusToRestore = device.previousStatus || DeviceStatus.AVAILABLE;
 if (device.currentUserId && statusToRestore === DeviceStatus.AVAILABLE) {
 statusToRestore = DeviceStatus.IN_USE;
 }
 updateDevice({ ...device, status: statusToRestore, previousStatus: undefined }, adminName);
 setIsModalOpen(false); // Fecha o modal após a ação
 showToast('Manutenção concluída e ativo liberado!', 'success');
 }
 }
 } catch (error) {
 showToast('Erro ao salvar manutenção.', 'error');
 }
 };

 useEffect(() => {
 const params = new URLSearchParams(location.search);
 const deviceId = params.get('deviceId');
 const tabParam = params.get('tab') as any;
 if (deviceId) {
 const device = devices.find(d => d.id === deviceId);
 if (device) handleOpenModal(device, true, tabParam);
 }

 const statusParam = params.get('status');
 if (statusParam) {
 const normalized = statusParam.toLowerCase();
 if (normalized === 'em manutenção' || normalized === 'manutenção' || normalized === 'maintenance') {
 setViewStatus(DeviceStatus.MAINTENANCE);
 } else if (normalized === 'disponível' || normalized === 'disponivel' || normalized === 'available') {
 setViewStatus(DeviceStatus.AVAILABLE);
 } else if (normalized === 'em uso' || normalized === 'in_use') {
 setViewStatus(DeviceStatus.IN_USE);
 } else if (normalized === 'descartado' || normalized === 'retired') {
 setViewStatus(DeviceStatus.RETIRED);
 }
 }
 }, [location, devices]);

 const adminName = currentUser?.name || 'Sistema';

 const modelOptions: Option[] = [...models].sort((a,b) => a.name.localeCompare(b.name)).map(m => {
 const brand = brands.find(b => b.id === m.brandId);
 return {
 value: m.id,
 label:`${brand?.name || ''} ${m.name}`,
 subLabel: assetTypes.find(t => t.id === m.typeId)?.name
 };
 });

 const sectorOptions: Option[] = [...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => ({
 value: s.id,
 label: s.name
 }));

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
 const { type: selectedAssetType } = getModelDetails(formData.modelId);

 const { data: deviceHistory = [], isLoading: historyLoading } = useQuery({
 queryKey: ['asset-history', editingId],
 queryFn: async () => {
 const res = await fetch(`/api/logs/asset/${editingId}`);
 if (!res.ok) throw new Error('Failed to fetch history');
 return res.json();
 },
 enabled: activeTab === 'HISTORY' && !!editingId
 });

 const filteredDevices = devices.filter(d => {
 if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;

 // Lógica dos novos filtros
 if (filterNoPulsusId && (d.pulsusId && d.pulsusId.trim() !== '')) return false;
 if (filterNoInvoice && d.hasInvoice) return false;

 const { model, brand } = getModelDetails(d.modelId);
 
 // Filtro por tipo de dispositivo
 if (filterAssetType && model?.typeId !== filterAssetType) return false;
 
 // Filtro por cargo / função (setor)
 if (filterSector && d.sectorId !== filterSector) return false;
 
 const sectorName = sectors.find(s => s.id === d.sectorId)?.name || '';
 const user = users.find(u => u.id === d.currentUserId);
 const userName = user?.fullName || '';
 const userEmail = user?.email || '';
 const chipNumber = sims.find(s => s.id === d.linkedSimId)?.phoneNumber || '';
 const searchString = normalizeString(`${model?.name} ${brand?.name} ${d.assetTag || ''} ${d.internalCode || ''} ${d.imei || ''} ${d.serialNumber || ''} ${sectorName} ${userName} ${userEmail} ${chipNumber}`);
 return searchString.includes(normalizeString(searchTerm));
 }).sort((a, b) => {
 if (sortConfig) {
 let aValue: any = a[sortConfig.key as keyof Device] || '';
 let bValue: any = b[sortConfig.key as keyof Device] || '';

 if (sortConfig.key === 'modelId') {
 aValue = models.find(m => m.id === a.modelId)?.name || '';
 bValue = models.find(m => m.id === b.modelId)?.name || '';
 } else if (sortConfig.key === 'sectorCode') {
 aValue = a.internalCode || '';
 bValue = b.internalCode || '';
 } else if (sortConfig.key === 'sectorName') {
 aValue = sectors.find(s => s.id === a.sectorId)?.name || '';
 bValue = sectors.find(s => s.id === b.sectorId)?.name || '';
 } else if (sortConfig.key === 'currentUserId') {
 aValue = users.find(u => u.id === a.currentUserId)?.fullName || '';
 bValue = users.find(u => u.id === b.currentUserId)?.fullName || '';
 } else if (sortConfig.key === 'linkedSimId') {
 aValue = sims.find(s => s.id === a.linkedSimId)?.phoneNumber || '';
 bValue = sims.find(s => s.id === b.linkedSimId)?.phoneNumber || '';
 }

 if (typeof aValue === 'string' && typeof bValue === 'string') {
 return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
 }

 if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
 if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
 return 0;
 }
 const modelA = models.find(m => m.id === a.modelId)?.name || '';
 const modelB = models.find(m => m.id === b.modelId)?.name || '';
 return modelA.localeCompare(modelB);
 });

 const totalItems = filteredDevices.length;
 const currentItemsPerPage = itemsPerPage === 'ALL' ? totalItems : itemsPerPage;
 const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(totalItems / currentItemsPerPage);
 const startIndex = (currentPage - 1) * (itemsPerPage === 'ALL' ? 0 : itemsPerPage as number);
 const paginatedDevices = itemsPerPage === 'ALL' ? filteredDevices : filteredDevices.slice(startIndex, startIndex + (itemsPerPage as number));

 const handleOpenModal = (device?: Device, viewOnly: boolean = false, initialTab?: 'GENERAL' | 'FINANCIAL' | 'MAINTENANCE' | 'LICENSES' | 'CUSTODY' | 'HISTORY') => {
 setActiveTab(initialTab || 'GENERAL');
 const isRetired = device?.status === DeviceStatus.RETIRED;
 setIsViewOnly(isRetired || viewOnly);
 if (device) { setEditingId(device.id); const { modelName, brandName, typeName, sectorName, currentUserName, linkedSimNumber, ...validData } = device as any;
      setFormData({ ...validData, customData: device.customData || {} }); 
      setIdType(device.imei && !device.assetTag ? 'IMEI' : 'TAG'); } 
 else { setEditingId(null); setFormData({ status: DeviceStatus.AVAILABLE, purchaseDate: new Date().toISOString().split('T')[0], purchaseCost: 0, customData: {}, linkedSimId: null }); setIdType('TAG'); }
 setIsModalOpen(true);
 };

 const handleDeviceSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.modelId) { alert('Modelo do Ativo é obrigatório.'); return; }
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
 else { 
 try {
 addDevice({ ...formData, id: Math.random().toString(36).substr(2, 9), currentUserId: null } as Device, adminName); 
 setIsModalOpen(false); 
 showToast('Ativo cadastrado com sucesso!', 'success');
 } catch (error) {
 showToast('Erro ao cadastrar ativo.', 'error');
 }
 }
 };

 const confirmEdit = () => {
 if (!editReason.trim()) { alert('Informe o motivo da alteração.'); return; }
 try {
 updateDevice(formData as Device, adminName);
 setIsReasonModalOpen(false);
 setIsModalOpen(false);
 showToast('Dados do ativo atualizados!', 'success');
 } catch (error) {
 showToast('Erro ao atualizar ativo.', 'error');
 }
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

 const deviceAccounts = editingId ? accounts.filter(a => a.deviceIds?.includes(editingId)) : [];

 // v2.12.39 - Lógica para o indicador visual financeiro
 const isFinancialOk = formData.invoiceNumber && (formData.purchaseInvoiceUrl || formData.hasInvoice);

 return (
    <div className="space-y-6 relative pb-20 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shadow-2xl relative z-30">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2 truncate">
            <Smartphone className="text-blue-500 shrink-0" size={24} />
            Inventário de Dispositivos / Ativos
          </h2>
          <p className="text-[10px] sm:text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-1 sm:mt-1.5 opacity-80 truncate">Relação completa de máquinas, coletores e celulares</p>
        </div>
        <div className="flex flex-nowrap items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner shrink-0">
            <button 
              onClick={() => handleExport('csv')} 
              className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700 transition-all text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400"
              title="Exportar CSV"
            >
              <FileText size={18}/>
            </button>
            <button 
              onClick={() => handleExport('excel')} 
              className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700 transition-all text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400"
              title="Exportar Excel"
            >
              <FileSpreadsheet size={18}/>
            </button>
            <button 
              onClick={() => handleExport('pdf')} 
              className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400"
              title="Exportar PDF"
            >
              <Download size={18}/>
            </button>
          </div>

          <div className={`relative shrink-0 ${isColumnSelectorOpen ? 'z-[9999]' : 'z-[10]'}`} ref={columnRef}>
            <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 font-extrabold text-[10px] sm:text-[11px] uppercase tracking-widest transition-all shadow-inner border-b-4 border-b-slate-800 active:border-b-0 active:translate-y-[2px] whitespace-nowrap">
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

          <button onClick={() => setIsModelSettingsOpen(true)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 font-extrabold text-[10px] sm:text-[11px] uppercase tracking-widest transition-all shadow-inner border-b-4 border-b-slate-800 active:border-b-0 active:translate-y-[2px] whitespace-nowrap shrink-0">
            <Settings size={18} /> Catálogo
          </button>

          <button 
            disabled={isReadOnly}
            onClick={() => handleOpenModal()} 
            className={`bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl flex items-center gap-2 font-extrabold text-[10px] sm:text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-900/40 border-b-4 border-b-blue-800 active:border-b-0 active:translate-y-[2px] whitespace-nowrap shrink-0 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Plus size={18} /> Novo Ativo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-blue-500/30 group shadow-lg">
          <div>
            <span className="text-[11px] font-black text-blue-600 dark:text-sky-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Total Ativos</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{devices.length}</p>
          </div>
          <div className="h-12 w-12 bg-blue-50 dark:bg-sky-500/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-sky-400 border border-blue-800/30 group-hover:scale-110 transition-transform"><Box size={24}/></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-emerald-500/30 group shadow-lg">
          <div>
            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Disponíveis</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{devices.filter(d => d.status === DeviceStatus.AVAILABLE).length}</p>
          </div>
          <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-800/30 group-hover:scale-110 transition-transform"><CheckCircle size={24}/></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-indigo-500/30 group shadow-lg">
          <div>
            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Em Uso</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{devices.filter(d => d.status === DeviceStatus.IN_USE).length}</p>
          </div>
          <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-800/30 group-hover:scale-110 transition-transform"><Users size={24}/></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-amber-500/30 group shadow-lg">
          <div>
            <span className="text-[11px] font-black text-amber-600 dark:text-amber-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Manutenção</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{devices.filter(d => d.status === DeviceStatus.MAINTENANCE).length}</p>
          </div>
          <div className="h-12 w-12 bg-amber-50 dark:bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-800/30 group-hover:scale-110 transition-transform"><Wrench size={24}/></div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-800 px-4 pt-2 rounded-t-xl transition-colors shadow-inner">
 {(['ALL', DeviceStatus.AVAILABLE, DeviceStatus.IN_USE, DeviceStatus.MAINTENANCE, DeviceStatus.RETIRED] as (DeviceStatus | 'ALL')[]).map(status => (
 <button key={status} onClick={() => setViewStatus(status)} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${viewStatus === status ? 'border-blue-600 ' : 'border-transparent hover:text-slate-700 dark:text-slate-300'}`}>{status === 'ALL' ? 'Todos' : status}<span className="ml-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[11px]">{status === 'ALL' ? devices.length : devices.filter(d => d.status === status).length}</span></button>
 ))}
 </div>

 <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center w-full">
 <div className="relative flex-1 w-full">
 <Search className="absolute left-4 top-3.5"size={20} />
 <input type="text"placeholder="Pesquisar por modelo, patrimônio, IMEI, S/N, e-mail, colaborador..."className="pl-12 w-full border-none rounded-xl py-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 transition-colors"value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
 </div>
 <div className="flex flex-wrap items-center justify-end gap-3 xl:gap-4 bg-white dark:bg-slate-800 p-2 rounded-xl">
 <span className="text-[11px] font-black uppercase tracking-widest hidden lg:inline">Filtros:</span>
 
 <select 
 value={filterSector} 
 onChange={(e) => setFilterSector(e.target.value)}
 className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-1.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
 >
 <option value="">Todos Cargos / Funções</option>
 {sectors.map(sector => (
 <option key={sector.id} value={sector.id}>{sector.name}</option>
 ))}
 </select>

 <select 
 value={filterAssetType} 
 onChange={(e) => setFilterAssetType(e.target.value)}
 className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-1.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
 >
 <option value="">Todos os Tipos</option>
 {assetTypes.map(type => (
 <option key={type.id} value={type.id}>{type.name}</option>
 ))}
 </select>
 
 <label className="flex items-center gap-2 cursor-pointer">
 <input type="checkbox"checked={filterNoPulsusId} onChange={() => setFilterNoPulsusId(!filterNoPulsusId)} className="h-4 w-4 rounded focus:ring-blue-500 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"/>
 <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Sem ID Pulsus</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input type="checkbox"checked={filterNoInvoice} onChange={() => setFilterNoInvoice(!filterNoInvoice)} className="h-4 w-4 rounded focus:ring-blue-500 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"/>
 <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Sem Nota Fiscal</span>
 </label>
 <button 
 onClick={clearFilters}
 className="ml-2 p-2 hover:text-red-500 hover:bg-red-900/20 rounded-lg transition-all"
 title="Limpar todos os filtros"
 >
 <RotateCcw size={18} />
 </button>
 </div>
 </div>

  <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl ring-1 ring-white/5">
    <DataTable
      columns={deviceColumns}
      data={paginatedDevices}
      sortConfig={sortConfig}
      requestSort={requestSort}
      columnWidths={columnWidths}
      onResize={handleResize}
      onSelectAll={handleSelectAllToggle}
      selectedIds={selectedIds}
      renderRow={(d) => {
        const { model, brand, type } = getModelDetails(d.modelId);
        const user = users.find(u => u.id === d.currentUserId);
        const additionalUsers = (d.additionalUserIds || []).map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
        const isRet = d.status === DeviceStatus.RETIRED;
        const linkedSim = sims.find(s => s.id === d.linkedSimId);
        const sector = sectors.find(s => s.id === d.sectorId);
        return (
          <tr 
            key={d.id} 
            onClick={() => handleOpenModal(d, true)} 
            className={`border-b border-slate-200 dark:border-slate-700/50 border-l-4 border-l-transparent transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:border-l-blue-500 bg-white dark:bg-slate-800 ${isRet ? 'opacity-60 grayscale' : ''} ${selectedIds.includes(d.id) ? 'bg-blue-50 dark:bg-sky-500/20 border-l-blue-500 text-blue-100' : ''}`}
          >
            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
              <input 
                type="checkbox"
                checked={selectedIds.includes(d.id)}
                onChange={() => handleSelectOne(d.id)}
                className="h-4 w-4 rounded focus:ring-indigo-500 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800"
              />
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-600 shadow-inner shrink-0 ring-1 ring-white/5">
                  {model?.imageUrl ? <img src={model.imageUrl} className="h-full w-full object-cover" alt="Ativo" referrerPolicy="no-referrer" /> : <ImageIcon className="text-slate-700 dark:text-slate-300" size={16}/>}
                </div>
                <div className="min-w-0 flex flex-col gap-0.5">
                  <div className="text-xs group-hover:text-blue-600 dark:text-sky-400 transition-colors uppercase tracking-tight flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-amber-600 dark:text-amber-400">{brand?.name || '---'}</span>
                    <span className="text-slate-600 dark:text-slate-400">-</span>
                    <span className="font-bold text-slate-150 text-slate-900 dark:text-white">{model?.name || '---'}</span>
                    {type?.allowMultipleUsers && (
                      <span className="bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[8px] px-1.5 py-0.5 rounded border border-amber-800/50 flex items-center gap-1 shrink-0" title="Dispositivo Compartilhado">
                        <Users size={8}/> COMPARTILHADO
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    {type?.name || '---'}
                  </div>
                  <div className="text-[11px] font-mono font-bold text-blue-600 dark:text-sky-400/95 tracking-wide uppercase">
                    {d.imei || d.assetTag || '---'}
                  </div>
                </div>
              </div>
            </td>
            {visibleColumns.includes('assetTag') && (<td className="px-6 py-4 truncate"><div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"><TagIcon size={12} className="text-slate-500 dark:text-slate-400"/> {d.assetTag || '---'}</div></td>)}
            {visibleColumns.includes('imei') && (<td className="px-6 py-4 font-mono text-[11px] truncate text-slate-600 dark:text-slate-400">{d.imei || '---'}</td>)}
            {visibleColumns.includes('serial') && (<td className="px-6 py-4 font-mono text-[11px] truncate text-slate-600 dark:text-slate-400">{d.serialNumber || '---'}</td>)}
            {visibleColumns.includes('sectorCode') && (<td className="px-6 py-4 truncate"><span className="text-[11px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-600/50">{d.internalCode || '---'}</span></td>)}
            {visibleColumns.includes('sectorName') && (<td className="px-6 py-4 truncate"><span className="text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-600/50">{sector?.name || '---'}</span></td>)}
            {visibleColumns.includes('pulsusId') && (<td className="px-6 py-4 text-center truncate">{d.pulsusId ? (<span className="text-[11px] font-mono font-bold text-blue-600 dark:text-sky-400 bg-blue-100 dark:bg-sky-500/20 px-2.5 py-1 rounded-full border border-blue-800/30">{d.pulsusId}</span>) : <span className="text-[11px] text-slate-500 dark:text-slate-400">-</span>}</td>)}
            {visibleColumns.includes('linkedSim') && (<td className="px-6 py-4 truncate">{linkedSim ? (<span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-100 dark:bg-indigo-500/20 px-2.5 py-1 rounded-full flex items-center gap-1 w-fit border border-indigo-800/30"><Cpu size={12}/> {linkedSim.phoneNumber}</span>) : <span className="text-[11px] text-slate-500 dark:text-slate-400">-</span>}</td>)}
            {visibleColumns.includes('purchaseInfo') && (<td className="px-6 py-4 truncate"><div className="flex flex-col"><span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">R$ {formatCurrencyBR(d.purchaseCost || 0)}</span><span className="text-[11px] text-slate-500 dark:text-slate-400">{d.purchaseDate ? formatDateBR(d.purchaseDate) : '---'}</span></div></td>)}
            <td className="px-6 py-4 truncate"><span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${d.status === DeviceStatus.AVAILABLE ? ' bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-800/50' : d.status === DeviceStatus.MAINTENANCE ? ' bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-800/50' : d.status === DeviceStatus.RETIRED ? ' bg-rose-50 dark:bg-red-500/20 text-rose-600 dark:text-red-400 border-rose-800/50' : ' bg-blue-50 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400 border-blue-800/50'}`}>{d.status}</span></td>
            <td className="px-6 py-4">
              {user ? (
                <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 dark:text-sky-400 underline cursor-pointer hover:text-blue-300 transition-colors" onClick={() => navigate(`/users?userId=${user.id}`)}>{user.fullName}</span>
                    <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-tighter whitespace-nowrap">({user.internalCode || d.internalCode || 'S/ Cód'})</span>
                  </div>
                  
                  {additionalUsers.length > 0 && (
                    <div className="flex flex-col gap-0.5 border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                      {additionalUsers.map(au => (
                        <div key={au.id} className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 underline cursor-pointer hover:text-blue-300 transition-colors" onClick={() => navigate(`/users?userId=${au.id}`)}>{au.fullName}</span>
                          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tighter">(ADICIONAL)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter italic">Livre no Estoque</span>}
            </td>
            <td className="px-6 py-4 text-right truncate">
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {(d.status === DeviceStatus.AVAILABLE || d.status === DeviceStatus.IN_USE) && (<button onClick={() => toggleMaintenanceStatus(d)} className="p-1.5 text-orange-400 hover:bg-orange-900/30 rounded-xl transition-all" title="Enviar para Manutenção"><Wrench size={16}/></button>)}
                {d.status === DeviceStatus.MAINTENANCE && (<button onClick={() => toggleMaintenanceStatus(d)} className="p-1.5 text-green-400 hover:bg-green-900/30 rounded-xl transition-all" title="Concluir Manutenção"><CheckCircle size={16}/></button>)}
                {d.pulsusId && (<a href={`https://app.pulsus.mobi/devices/${d.pulsusId}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:bg-indigo-500/20 rounded-xl transition-all" title="Abrir MDM Pulsus"><ShieldCheck size={16}/></a>)}
                {isRet ? (
                  <button onClick={() => { setRestoreTargetId(d.id); setRestoreReason(''); setIsRestoreModalOpen(true); }} className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:bg-indigo-500/20 rounded-xl transition-all" title="Restaurar Ativo"><RotateCcw size={16}/></button>
                ) : (
                  <>
                    <button onClick={() => handleOpenModal(d, false)} className="p-1.5 text-blue-600 dark:text-sky-400 hover:bg-blue-100 dark:bg-sky-500/20 rounded-xl transition-all" title="Editar"><Edit2 size={16}/></button>
                    <button onClick={() => handleDeleteAttempt(d)} className="p-1.5 text-red-400 hover:text-red-400 hover:bg-red-900/30 rounded-xl transition-all" title="Descartar"><Trash2 size={16}/></button>
                  </>
                )}
              </div>
            </td>
          </tr>
        );
      }}
    />
 <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors">
 <div className="flex items-center gap-4"><div className="flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-widest">Exibir:</span><select className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500 transition-all"value={itemsPerPage} onChange={(e) => setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={40}>40</option><option value="ALL">Todos</option></select></div><p className="text-xs font-bold uppercase tracking-widest">Total: {totalItems} ativos</p></div>
 {totalPages > 1 && (<div className="flex items-center gap-2"><button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className={`p-2 rounded-lg transition-all ${currentPage === 1 ? 'text-slate-700 dark:text-slate-300 cursor-not-allowed' : ' text-blue-600 dark:text-sky-400 hover:bg-blue-100 dark:bg-sky-500/20'}`}><ChevronLeft size={18}/></button><div className="flex items-center gap-1"><span className="text-xs font-black text-blue-300 bg-blue-900/40 px-3 py-1.5 rounded-lg">{currentPage}</span><span className="text-xs font-bold uppercase mx-1">de</span><span className="text-xs font-black text-slate-700 dark:text-slate-300">{totalPages}</span></div><button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className={`p-2 rounded-lg transition-all ${currentPage === totalPages ? 'text-slate-700 dark:text-slate-300 cursor-not-allowed' : ' text-blue-600 dark:text-sky-400 hover:bg-blue-100 dark:bg-sky-500/20'}`}><ChevronRight size={18}/></button></div>)}
 </div>
 </div>

 {isModalOpen && (
 <div className="fixed inset-0 bg-white dark:bg-slate-800/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
 <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up border border-slate-200 dark:border-slate-700"><div className="bg-white dark:bg-slate-800 bg-black px-8 py-5 flex justify-between items-center shrink-0 border-b border-white/10"><div className="flex flex-col"><div className="flex items-center gap-3"><span className="text-[11px] font-black uppercase tracking-widest leading-tight">{editingId ? (isViewOnly ? 'Detalhes do Ativo' : 'Editar Ativo') : 'Novo Ativo'}</span></div>{editingId && <span className="text-[11px] font-bold uppercase tracking-widest">ID: {editingId}</span>}</div><button onClick={() => setIsModalOpen(false)} className="h-10 w-10 flex items-center justify-center bg-white/5 hover:text-slate-900 dark:text-white rounded-full hover:bg-white/10 transition-all"><X size={20}/></button></div><div className="flex bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 overflow-x-auto shrink-0 px-4 pt-2">
 <button type="button"onClick={() => setActiveTab('GENERAL')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'GENERAL' ? 'border-blue-600 text-blue-600 dark:text-sky-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-600 hover:text-slate-700 dark:text-slate-300'}`}>Geral</button>
 <button type="button"onClick={() => setActiveTab('FINANCIAL')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'FINANCIAL' ? 'border-blue-600 text-blue-600 dark:text-sky-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-600 hover:text-slate-700 dark:text-slate-300'}`}>
 Financeiro 
 <span className={`w-2.5 h-2.5 rounded-full ${isFinancialOk ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'}`}></span>
 </button>
 <button type="button"onClick={() => setActiveTab('MAINTENANCE')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'MAINTENANCE' ? 'border-blue-600 text-blue-600 dark:text-sky-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-600 hover:text-slate-700 dark:text-slate-300'}`}>Manutenções ({deviceMaintenances.length})</button>
 <button type="button"onClick={() => setActiveTab('LICENSES')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all whitespace-nowrap ${activeTab === 'LICENSES' ? 'border-blue-600 text-blue-600 dark:text-sky-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-600 hover:text-slate-700 dark:text-slate-300'}`}>Licenças ({deviceAccounts.length})</button>
 <button type="button"onClick={() => setActiveTab('CUSTODY')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all whitespace-nowrap ${activeTab === 'CUSTODY' ? 'border-blue-600 text-blue-600 dark:text-sky-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-600 hover:text-slate-700 dark:text-slate-300'}`}>Cadeia de Custódia</button>
 {selectedAssetType?.showZabbix && formData.zabbixHostId && <button type="button" onClick={() => setActiveTab('MONITOR')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'MONITOR' ? 'border-blue-600 text-blue-600 dark:text-sky-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-600 hover:text-slate-700 dark:text-slate-300'}`}><Monitor size={16}/> Monitor</button>}
<button type="button"onClick={() => setActiveTab('HISTORY')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all whitespace-nowrap ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-600 dark:text-sky-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-600 hover:text-slate-700 dark:text-slate-300'}`}>Auditoria</button>
 </div>
 <form id="devForm"onSubmit={handleDeviceSubmit} className="flex-1 flex flex-col overflow-hidden"><div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-800">{activeTab === 'GENERAL' && (<div className="grid grid-cols-1 md:grid-cols-2 gap-8">{isViewOnly && (<div className="md:col-span-2 bg-blue-50 dark:bg-sky-500/20 p-4 rounded-xl border border-blue-300 dark:border-sky-700/40 flex items-center gap-3"><Info className="text-blue-600 dark:text-sky-400"size={20}/><p className="text-xs font-bold text-blue-200">Modo de visualização. Clique no botão azul"Habilitar Edição"abaixo para editar os dados.</p></div>)}{editingId && (() => {
                  const primaryUser = formData.currentUserId ? users.find(u => u.id === formData.currentUserId) : null;
                  const additionalUsersList = (formData.additionalUserIds || [])
                    .map(id => users.find(u => u.id === id))
                    .filter(Boolean) as User[];
                  
                  return (
                    <div className="md:col-span-2 bg-slate-100 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                      {/* Primary User Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-blue-50 border border-slate-200 dark:border-slate-700 shrink-0">
                            <Users size={24}/>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Responsável Atual (Principal)</span>
                              {additionalUsersList.length > 0 && (
                                <span className="bg-blue-900/40 border border-blue-800/50 text-blue-600 dark:text-sky-400 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                  Uso Compartilhado
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-black text-slate-900 dark:text-white">
                              {primaryUser ? primaryUser.fullName : 'LIVRE NO ESTOQUE'}
                            </p>
                          </div>
                        </div>
                        {primaryUser && (
                          <button 
                            type="button"
                            onClick={() => navigate(`/users?userId=${primaryUser.id}`)} 
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-[11px] font-black uppercase text-blue-600 dark:text-sky-400 hover:bg-blue-100 dark:bg-sky-500/20 transition-all flex items-center gap-2 self-start sm:self-center cursor-pointer"
                          >
                            Ver Perfil <ChevronRight size={14}/>
                          </button>
                        )}
                      </div>

                      {/* Additional Users Row(s) */}
                      {additionalUsersList.length > 0 && (
                        <div className="border-t border-slate-200 dark:border-slate-700/80 pt-4 mt-2">
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2.5 block">
                            Compartilhado com {additionalUsersList.length} colaborador{additionalUsersList.length > 1 ? 'es' : ''} adicional{additionalUsersList.length > 1 ? 'is' : ''}:
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {additionalUsersList.map(au => (
                              <div 
                                key={au.id} 
                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/60"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="h-7 w-7 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                                    <Users size={12}/>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{au.fullName}</p>
                                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                      ({au.internalCode || 'S/ Cód'})
                                    </span>
                                  </div>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => navigate(`/users?userId=${au.id}`)} 
                                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:bg-sky-500/20 hover:text-blue-600 dark:text-sky-400 hover:border-blue-300 dark:border-sky-700/30 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                >
                                  Perfil <ChevronRight size={10}/>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}<div className="md:col-span-2 space-y-4">
 <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner transition-colors">
 <label className={UI_LABEL_SMALL}>Catálogo de Modelos (A-Z)</label>
 <SearchableDropdown 
 disabled={isViewOnly} 
 options={modelOptions} 
 value={formData.modelId || ''} 
 onChange={val => setFormData({...formData, modelId: val})} 
 placeholder="Vincular a um modelo..."
 icon={<Smartphone size={18}/>}
 />
 </div>
</div><div className="space-y-4"><div className="bg-blue-50 dark:bg-sky-500/20 p-6 rounded-2xl border border-blue-300 dark:border-sky-700/40 relative transition-colors"><label className="block text-[11px] font-black uppercase text-blue-600 dark:text-sky-400 mb-3 tracking-widest">Identificação Principal</label><div className="flex bg-blue-100/50 bg-blue-900/40 p-1 rounded-lg mb-4"><button type="button"onClick={() => setIdType('TAG')} className={`flex-1 py-2 text-[11px] font-black uppercase rounded-md transition-all ${idType === 'TAG' ? ' bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-sky-400 ' : 'text-blue-600 dark:text-sky-400 hover:text-blue-50 hover:text-blue-600 dark:text-sky-400'}`}>Patrimônio</button><button type="button"onClick={() => setIdType('IMEI')} className={`flex-1 py-2 text-[11px] font-black uppercase rounded-md transition-all ${idType === 'IMEI' ? ' bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-sky-400 ' : 'text-blue-600 dark:text-sky-400 hover:text-blue-50 hover:text-blue-600 dark:text-sky-400'}`}>IMEI</button></div>{idType === 'TAG' ? (<input disabled={isViewOnly} className="w-full border-2 border-blue-800/60 rounded-xl p-3 text-lg font-black text-blue-100 bg-slate-100 dark:bg-slate-800 focus:ring-4 focus:ring-blue-100 focus:ring-blue-900/20 outline-none transition-all placeholder:text-blue-200 placeholder:text-blue-900/50"value={formData.assetTag || ''} onChange={e => setFormData({...formData, assetTag: e.target.value.toUpperCase().trim()})} placeholder="TI-XXXX"/>) : (<input disabled={isViewOnly} className="w-full border-2 border-blue-800/60 rounded-xl p-3 text-lg font-black text-blue-100 bg-slate-100 dark:bg-slate-800 focus:ring-4 focus:ring-blue-100 focus:ring-blue-900/20 outline-none transition-all placeholder:text-blue-200 placeholder:text-blue-900/50"value={formData.imei || ''} onChange={e => setFormData({...formData, imei: e.target.value.trim()})} placeholder="000.000..."/>)}</div><div className="bg-indigo-50 dark:bg-indigo-500/20 p-4 rounded-2xl border border-indigo-900/40 transition-colors"><label className="block text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 mb-2 ml-1 tracking-widest">Chip / SIM Card Vinculado</label><SearchableDropdown disabled={isViewOnly} options={simOptions} value={formData.linkedSimId || ''} onChange={val => setFormData({...formData, linkedSimId: val || null})} placeholder="Pesquisar chip..."icon={<Cpu size={18}/>}/><p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-2 font-bold px-1 italic">* Ao entregar o dispositivo, este chip será entregue automaticamente.</p></div></div><div className="space-y-4"><div><label className="block text-[11px] font-black uppercase mb-1 ml-1 tracking-widest">Estado Global</label><select disabled={isViewOnly || formData.status === DeviceStatus.IN_USE} className={`w-full border-2 rounded-xl p-3 text-sm font-black focus:border-blue-500 outline-none transition-colors ${formData.status === DeviceStatus.IN_USE ? ' bg-blue-50 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400' : ' bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'}`} value={formData.status || ''} onChange={e => setFormData({...formData, status: e.target.value as DeviceStatus})}>{Object.values(DeviceStatus).map(s => (<option key={s} value={s} disabled={s === DeviceStatus.IN_USE && formData.status !== DeviceStatus.IN_USE}>{s}</option>))}</select></div><div><label className="block text-[11px] font-black uppercase mb-1 ml-1 tracking-widest">Serial Number</label><input required disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-mono focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white transition-colors"value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value.toUpperCase().trim()})} placeholder="S/N"/></div><div><label className="block text-[11px] font-black uppercase mb-1 ml-1 tracking-widest">Código Setor</label><input disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white transition-colors"value={formData.internalCode || ''} onChange={e => setFormData({...formData, internalCode: e.target.value.trim()})} placeholder="S-001..."/></div><div>
 <label className="block text-[11px] font-black uppercase mb-1 ml-1 tracking-widest">Cargo / Função</label>
 <SearchableDropdown 
 disabled={isViewOnly} 
 options={sectorOptions} 
 value={formData.sectorId || ''} 
 onChange={handleSectorChange} 
 placeholder="Destinar..."
 icon={<Briefcase size={18}/>}
 />
</div><div><label className="block text-[10px] font-black uppercase mb-1 ml-1 tracking-widest">ID Pulsus</label><div className="flex gap-2"><input disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white transition-colors flex-1"value={formData.pulsusId || ''} onChange={e => setFormData({...formData, pulsusId: e.target.value.trim()})} placeholder="ID MDM"/>{formData.pulsusId && (<a href={`https://app.pulsus.mobi/devices/${formData.pulsusId}`} target="_blank"rel="noopener noreferrer"className="p-3 bg-blue-900/40 text-blue-600 dark:text-sky-400 rounded-xl hover:bg-blue-900/60 transition-all flex items-center justify-center"title="Abrir MDM Pulsus"><ShieldCheck size={20}/></a>)}</div></div>{selectedAssetType?.showZabbix && (<div><label className="block text-[10px] font-black uppercase mb-1 ml-1 tracking-widest">Zabbix Host ID</label><div className="flex gap-2"><input disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white transition-colors flex-1"value={formData.zabbixHostId || ''} onChange={e => setFormData({...formData, zabbixHostId: e.target.value.trim()})} placeholder="Zabbix Host ID"/></div></div>)}</div>{relevantFields.length > 0 && (<div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-6 p-6 bg-slate-100 dark:bg-slate-800/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 transition-colors">{relevantFields.map(field => (<div key={field.id}><label className="block text-[10px] font-black uppercase mb-1 ml-1">{field.name}</label><input disabled={isViewOnly} className="w-full border-2 border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-sm focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"value={formData.customData?.[field.id] || ''} onChange={e => setFormData({...formData, customData: {...formData.customData, [field.id]: e.target.value}})}/></div>))}</div>)}</div>)}
 {activeTab === 'FINANCIAL' && (
 <div className="space-y-8 animate-fade-in">
 {/* LCC Dashboard Section */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-white dark:bg-slate-800 bg-black p-5 rounded-2xl border border-white/10">
 <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70">LCC (Custo Ciclo Vida)</span>
 <div className="flex items-baseline gap-2 mt-1">
 <span className="text-2xl font-black text-slate-900 dark:text-white">R$ {formatCurrencyBR(lccValue)}</span>
 </div>
 <div className="mt-3 space-y-1 border-t border-white/5 pt-3">
 <div className="flex justify-between text-[11px] font-bold">
 <span className="uppercase tracking-tighter opacity-50">Aquisição:</span>
 <span className="text-slate-700 dark:text-slate-300">R$ {formatCurrencyBR(purchaseCost)}</span>
 </div>
 <div className="flex justify-between text-[11px] font-bold">
 <span className="uppercase tracking-tighter opacity-50">Manutenção:</span>
 <span className="text-slate-900 dark:text-white">R$ {formatCurrencyBR(totalMaintenanceCost)}</span>
 </div>
 </div>
 </div>
 <div className={`p-5 rounded-2xl border transition-all ${maintenanceRatio >= 0.6 ? ' bg-red-900/20 border-red-900/40' : ' bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
 <div className="flex justify-between items-start">
 <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${maintenanceRatio >= 0.6 ? ' text-red-500' : ' text-slate-500 dark:text-slate-400'}`}>Índice de Manutenção</span>
 {maintenanceRatio >= 0.6 && <AlertTriangle size={16} className="animate-pulse"/>}
 </div>
 <div className="flex items-baseline gap-2 mt-1">
 <span className={`text-2xl font-black ${maintenanceRatio >= 0.6 ? ' text-red-400' : ' text-slate-900 dark:text-white'}`}>{(maintenanceRatio * 100).toFixed(1)}%</span>
 </div>
 <div className="w-full bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
 <div className={`h-full transition-all duration-1000 ${maintenanceRatio >= 0.6 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width:`${Math.min(maintenanceRatio * 100, 100)}%`}}></div>
 </div>
 {maintenanceRatio >= 0.6 && <p className="text-[11px] text-red-400 mt-2 font-black uppercase tracking-tighter">ALERTA: Gastos excedem 60% do valor do ativo!</p>}
 </div>
 <div className={`p-5 rounded-2xl border transition-all ${deviceAgeYears >= 5 ? ' bg-orange-900/20 border-orange-900/40' : ' bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
 <div className="flex justify-between items-start">
 <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${deviceAgeYears >= 5 ? ' text-orange-500' : ' text-slate-500 dark:text-slate-400'}`}>Tempo de Uso</span>
 {deviceAgeYears >= 5 && <RefreshCw size={16} className="animate-spin-slow"/>}
 </div>
 <div className="flex items-baseline gap-2 mt-1">
 <span className={`text-2xl font-black ${deviceAgeYears >= 5 ? ' text-orange-400' : ' text-slate-900 dark:text-white'}`}>{deviceAgeYears.toFixed(1)} Anos</span>
 </div>
 <p className="text-[10px] mt-2 font-medium italic">Ciclo de vida recomendado: 5 anos.</p>
 {deviceAgeYears >= 5 && <p className="text-[11px] text-orange-400 mt-2 font-black uppercase tracking-tighter">ALERTA: Ativo atingiu fim do ciclo de vida!</p>}
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-10"><div className="space-y-5"><h4 className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider border-l-4 border-emerald-500 pl-3">Dados de Aquisição</h4><div><label className="block text-[11px] font-bold uppercase mb-1 flex items-center gap-2 tracking-wider"><FileText size={12}/> Número da Nota Fiscal</label><input disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white transition-colors"value={formData.invoiceNumber || ''} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} placeholder="NF-XXXXXX"/></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[11px] font-bold uppercase mb-1 flex items-center gap-2 tracking-wider"><DollarSign size={12}/> Valor Pago (R$)</label><div className="relative"><span className="absolute left-3 top-3 text-xs font-bold">R$</span><input type="text"disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-9 text-sm focus:border-emerald-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold transition-colors"value={formatCurrencyBR(formData.purchaseCost || 0)} onChange={e => setFormData({...formData, purchaseCost: parseCurrencyBR(e.target.value)})} placeholder="0,00"/></div></div><div><label className="block text-[11px] font-bold uppercase mb-1 flex items-center gap-2 tracking-wider"><Calendar size={12}/> Data Compra</label><input type="date"disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white transition-colors"value={formData.purchaseDate ? formData.purchaseDate.substring(0, 10) : ''} onChange={e => setFormData({...formData, purchaseDate: e.target.value})}/></div></div><div><label className={UI_LABEL_SMALL}>Fornecedor (A-Z)</label><input disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white transition-colors"value={formData.supplier || ''} onChange={e => setFormData({...formData, supplier: e.target.value})} placeholder="Nome da Loja"/></div></div><div className="bg-slate-100 dark:bg-slate-800/50 p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center shadow-inner transition-colors">{(formData.purchaseInvoiceUrl || formData.hasInvoice) ? (<div className="space-y-4 w-full"><div className="h-48 w-full bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden group relative">{(formData.purchaseInvoiceUrl && formData.purchaseInvoiceUrl.startsWith('data:image')) ? (<img src={formData.purchaseInvoiceUrl} className="h-full w-full object-contain"alt="NF"/>) : (<div className="flex flex-col items-center gap-2 text-blue-600 dark:text-sky-400"><FileCode size={64}/><span className="text-[11px] font-bold uppercase">Nota Fiscal Anexada</span></div>)}</div><div className="flex gap-3"><button type="button"disabled={loadingFiles[editingId!]} onClick={() => openBase64File('DEVICE', editingId!, formData.purchaseInvoiceUrl)} className="flex-1 bg-slate-100 dark:bg-slate-800 border-2 border-emerald-900/40 text-emerald-600 dark:text-emerald-400 py-3 rounded-xl text-[11px] font-bold uppercase hover:bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center gap-2 transition-all">{loadingFiles[editingId!] ? <Loader2 size={14} className="animate-spin"/> : <ExternalLink size={14}/>} Abrir Documento</button>{!isViewOnly && <button type="button"onClick={() => setFormData({...formData, purchaseInvoiceUrl: '', hasInvoice: false})} className="p-3 bg-red-900/30 text-red-400 rounded-xl border-2 border-red-900/40 hover:bg-red-900/50 transition-all"><Trash2 size={18}/></button>}</div></div>) : (<><div className="h-20 w-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 mb-4 border-2 border-slate-200 dark:border-slate-700"><Paperclip size={32}/></div><h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">Anexo da Nota Fiscal</h5><p className="text-[11px] mt-2 font-medium">Importe a imagem ou PDF.</p>{!isViewOnly && (<label className="mt-6 cursor-pointer bg-emerald-600 text-white px-8 py-3 rounded-2xl text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">{isUploadingNF ? <RefreshCw size={14} className="animate-spin"/> : <Plus size={14}/>} Escolher Arquivo
                    <input type="file" className="hidden" onChange={handleNFFileChange} accept="application/pdf,image/*"/>
                  </label>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )}

    {activeTab === 'MAINTENANCE' && (
      <div className="space-y-6 animate-fade-in">
        {/* Sub-tabs selection */}
        <div className="flex p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 self-start inline-flex">
          <button 
            type="button"
            onClick={() => handleMaintenanceTabChange('EXTERNAL')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${maintenanceSubTab === 'EXTERNAL' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            Manutenções Externas (Custo/NF)
          </button>
          <button 
            type="button"
            onClick={() => handleMaintenanceTabChange('AUDIT')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${maintenanceSubTab === 'AUDIT' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            Auditoria Técnica (Local)
          </button>
        </div>

        {maintenanceSubTab === 'EXTERNAL' ? (
          <>
            {!isViewOnly && (
              <div className="bg-orange-900/20 p-6 rounded-2xl border border-orange-900/40 space-y-4 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-orange-900/40 rounded-full flex items-center justify-center text-orange-400">
                    <Wrench size={16}/>
                  </div>
                  <h5 className="text-[11px] font-black text-orange-200 uppercase tracking-widest">Nova Manutenção</h5>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-orange-400 mb-1">Descrição</label>
                    <input 
                      placeholder="Ex: Troca de tela..."
                      className="w-full border-2 border-orange-900/30 rounded-xl p-3 text-sm focus:border-orange-400 outline-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner"
                      value={newMaint.description || ''} 
                      onChange={e => setNewMaint({...newMaint, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-orange-400 mb-1">Custo (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-orange-400 text-xs font-bold">R$</span>
                      <input 
                        type="text"
                        className="w-full border-2 border-orange-900/30 rounded-xl p-3 pl-10 text-sm focus:border-orange-400 outline-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                        value={formatCurrencyBR(newMaint.cost || 0)} 
                        onChange={e => setNewMaint({...newMaint, cost: parseCurrencyBR(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-orange-400 mb-1">Data</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-orange-300" size={16}/>
                      <input 
                        type="date"
                        className="w-full border-2 border-orange-900/30 rounded-xl p-3 pl-10 text-sm focus:border-orange-400 outline-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                        value={newMaint.date || ''} 
                        onChange={e => setNewMaint({...newMaint, date: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-orange-400 mb-1">Anexo</label>
                    <label className={`w-full flex items-center gap-3 bg-slate-100 dark:bg-slate-800 border-2 border-dashed p-2.5 rounded-xl cursor-pointer hover:bg-orange-100/50 transition-all ${isUploadingMaint ? 'opacity-50' : ''}`}>
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center text-orange-400">
                        {isUploadingMaint ? <RefreshCw size={16} className="animate-spin"/> : <Paperclip size={16}/>}
                      </div>
                      <span className="text-[11px] font-bold uppercase truncate">{newMaint.invoiceUrl ? 'Carregado' : 'Importar Nota'}</span>
                      <input type="file" className="hidden" onChange={handleMaintFileChange} accept="application/pdf,image/*"/>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button 
                    type="button" 
                    onClick={saveMaintenance} 
                    disabled={!newMaint.description || isUploadingMaint || isReadOnly} 
                    className="bg-orange-600 text-white px-8 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-orange-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Lançar
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 text-orange-400"><History size={12}/> Histórico de Manutenções</h4>
              <div className="grid grid-cols-1 gap-3">
                {deviceMaintenances.length > 0 ? deviceMaintenances.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(m => (
                  <div key={m.id} className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:border-orange-200 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-orange-900/40 rounded-xl flex items-center justify-center text-orange-400">
                        <Wrench size={20}/>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{m.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">{formatDateBR(m.date)}</span>
                          <span className="text-[10px] font-bold uppercase text-orange-400">R$ {formatCurrencyBR(m.cost)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(m.invoiceUrl || m.hasInvoice) && (
                        <button disabled={loadingFiles[m.id]} type="button" onClick={() => openBase64File('MAINTENANCE', m.id, m.invoiceUrl)} className="p-2.5 bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400 rounded-xl transition-all flex items-center justify-center">
                          {loadingFiles[m.id] ? <Loader2 size={16} className="animate-spin"/> : <ExternalLink size={16}/>}
                        </button>
                      )}
                      {!isViewOnly && (
                        <button 
                          type="button" 
                          onClick={() => { if(!isReadOnly && window.confirm('Excluir?')) deleteMaintenance(m.id, adminName) }} 
                          disabled={isReadOnly} 
                          className="p-2.5 text-red-400 hover:text-red-400 hover:bg-red-900/30 rounded-xl transition-all disabled:opacity-50"
                        >
                          <Trash2 size={16}/>
                        </button>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-16 bg-white dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <p className="font-bold text-xs uppercase tracking-widest italic text-slate-500 dark:text-slate-400">Nenhuma manutenção externa registrada.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Secção de Auditoria Técnica */}
            {!isViewOnly && (
              <div className="bg-indigo-50 dark:bg-indigo-500/20 p-6 rounded-2xl border border-indigo-900/40 space-y-4 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-indigo-900/40 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <ShieldCheck size={16}/>
                  </div>
                  <h5 className="text-[11px] font-black text-indigo-100 uppercase tracking-widest">Nova Auditoria/Verificação Técnica</h5>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1 uppercase tracking-wider">Status Geral da Auditoria</label>
                    <select 
                      className="w-full border-2 border-indigo-900/30 rounded-xl p-3 text-sm focus:border-indigo-400 outline-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                      value={newAudit.status || ''} 
                      onChange={e => setNewAudit({...newAudit, status: e.target.value as any})}
                    >
                      <option value="Aprovado" className="text-emerald-600 dark:text-emerald-400">✅ Aprovado (Integridade OK)</option>
                      <option value="Observação" className="text-orange-400">⚠️ Observações (Requer atenção)</option>
                      <option value="Reprovado" className="text-red-400">❌ Reprovado (Necessita reparo)</option>
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1 uppercase tracking-wider">Descrição das Ações / Verificações Realizadas</label>
                    <select 
                      className="w-full border-2 border-indigo-900/30 rounded-xl p-3 text-sm focus:border-indigo-400 outline-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner"
                      value={newAudit.description || ''} 
                      onChange={e => setNewAudit({...newAudit, description: e.target.value})}
                    >
                      <option value="" disabled>Selecione uma ação...</option>
                      <option value="Verificação Geral">Verificação Geral</option>
                      <option value="Atualização de Software / Sistema">Atualização de Software / Sistema</option>
                      <option value="Limpeza / Troca de pelicula e/ou capa">Limpeza / Troca de pelicula e/ou capa</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1 uppercase tracking-wider">Observações Adicionais</label>
                    <textarea 
                      placeholder="Detalhes técnicos ou pendências encontradas..."
                      className="w-full border-2 border-indigo-900/30 rounded-xl p-3 text-sm focus:border-indigo-400 outline-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-inner h-20 resize-none"
                      value={newAudit.observations || ''} 
                      onChange={e => setNewAudit({...newAudit, observations: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1 uppercase tracking-wider">Data do Registro</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-indigo-300" size={16}/>
                      <input 
                        type="date"
                        className="w-full border-2 border-indigo-900/30 rounded-xl p-3 pl-10 text-sm focus:border-indigo-400 outline-none bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                        value={newAudit.date || ''} 
                        onChange={e => setNewAudit({...newAudit, date: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex items-end justify-end">
                    <button 
                      type="button" 
                      onClick={saveAudit} 
                      disabled={!newAudit.description || isReadOnly} 
                      className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg"
                    >
                      <Save size={14}/> Registrar Auditoria
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><ShieldCheck size={12}/> Histórico de Verificações Locais</h4>
              <div className="grid grid-cols-1 gap-3">
                {audits?.filter(a => a.deviceId === editingId).length > 0 ? (
                  audits.filter(a => a.deviceId === editingId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(a => (
                    <div key={a.id} className="p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:border-indigo-900 transition-all group relative overflow-hidden">
                      <div className={`absolute top-0 left-0 w-1 h-full ${a.status === 'Aprovado' ? 'bg-emerald-500' : a.status === 'Observação' ? 'bg-orange-500' : 'bg-red-500'}`} />
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${a.status === 'Aprovado' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : a.status === 'Observação' ? 'bg-orange-900/20 text-orange-400' : 'bg-red-900/20 text-red-400'}`}>
                            <ShieldCheck size={20}/>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 dark:text-white text-sm">{a.description}</p>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${a.status === 'Aprovado' ? 'bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : a.status === 'Observação' ? 'bg-orange-900/40 text-orange-400 border border-orange-500/30' : 'bg-red-900/40 text-red-400 border border-red-500/30'}`}>
                                {a.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1"><Calendar size={10}/> {formatDateBR(a.date)}</span>
                              <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1"><Settings size={10}/> {a.type}</span>
                              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono tracking-tighter">Por: {a.technician}</span>
                            </div>
                            {a.observations && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 italic bg-slate-100 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-300 dark:border-slate-600/50 line-clamp-2">{a.observations}</p>
                            )}
                          </div>
                        </div>
                        {!isViewOnly && (
                          <button 
                            type="button" 
                            onClick={() => { if(!isReadOnly && window.confirm('Excluir registro de auditoria?')) deleteAudit(a.id, adminName) }} 
                            disabled={isReadOnly} 
                            className="p-2.5 text-red-400/50 hover:text-red-400 hover:bg-red-900/30 rounded-xl transition-all disabled:opacity-50"
                          >
                            <Trash2 size={16}/>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 bg-white dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <p className="font-bold text-xs uppercase tracking-widest italic text-slate-500 dark:text-slate-400">Nenhuma auditoria ou verificação técnica realizada.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )}
    {activeTab === 'LICENSES' && (
      <div className="space-y-4 animate-fade-in">
        <h4 className="text-[11px] font-bold uppercase tracking-wider mb-4 flex items-center gap-2"><Globe size={14}/> Licenças Vinculadas</h4>
        <div className="grid grid-cols-1 gap-3">
          {deviceAccounts.length > 0 ? deviceAccounts.map(acc => (
            <div key={acc.id} className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between group hover:border-indigo-200 transition-all">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-inner ${acc.type === AccountType.EMAIL ? 'bg-blue-50 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400' : acc.type === AccountType.OFFICE ? 'bg-orange-900/20 text-orange-400' : acc.type === AccountType.ERP ? 'bg-purple-900/20 text-purple-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  {acc.type === AccountType.EMAIL ? <Mail size={24}/> : acc.type === AccountType.OFFICE ? <FileText size={24}/> : acc.type === AccountType.ERP ? <Lock size={24}/> : <Key size={24}/>}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{acc.name}</p>
                  <p className="text-[11px] font-bold uppercase tracking-tight">{acc.login}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {acc.accessUrl && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleOpenUrl(acc.accessUrl); }} className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors">
                    <ExternalLink size={16}/>
                  </button>
                )}
                <div className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-mono text-[11px] font-bold min-w-[80px] text-center text-slate-700 dark:text-slate-300">
                  {showPasswords[acc.id] ? (acc.password || '---') : '••••••••'}
                </div>
                <button type="button" onClick={() => setShowPasswords(p => ({...p, [acc.id]: !p[acc.id]}))} className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white">
                  {showPasswords[acc.id] ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
          )) : (
            <div className="text-center py-16 bg-white dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
              <Globe size={32} className="mx-auto text-slate-700 dark:text-slate-200 mb-2"/>
              <p className="text-xs font-bold uppercase tracking-widest italic">Nenhuma licença vinculada.</p>
            </div>
          )}
        </div>
      </div>
    )}
 {activeTab === 'CUSTODY' && (<PossessionHistory deviceId={editingId || ''} />)}
 
{activeTab === 'MONITOR' && formData.zabbixHostId && (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8">
        <ZabbixMonitorTab zabbixHostId={formData.zabbixHostId} deviceId={editingId || ''} />
    </div>
)}
{activeTab === 'HISTORY' && (
 <div className="relative border-l-4 border-slate-200 dark:border-slate-700 ml-4 space-y-8 py-4 animate-fade-in">
 {historyLoading ? (
 <div className="text-center py-8"><Loader2 className="animate-spin inline-block mr-2"size={20}/> Carregando histórico...</div>
 ) : deviceHistory.length === 0 ? (
 <div className="text-center py-8">Nenhum histórico encontrado.</div>
 ) : deviceHistory.map((log: AuditLog) => (
 <div key={log.id} className="relative pl-8">
 <div className={`absolute -left-[10px] top-1 h-4 w-4 rounded-full border-4 border-white border-slate-950 ${log.action === ActionType.RESTORE ? 'bg-indigo-500' : 'bg-blue-500'}`}></div>
 <div className="text-[10px] uppercase mb-1 tracking-wider">{new Date(log.timestamp).toLocaleString()}</div>
 <div className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-tight">{log.action}</div>
 <div className="text-xs bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl mt-2 border border-slate-300 dark:border-slate-600 transition-colors"><LogNoteRenderer log={log} /></div>
 <div className="text-[9px] font-bold text-slate-700 dark:text-slate-300 uppercase mt-2 tracking-tight">Realizado por: {log.adminUser}</div>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="bg-slate-50 dark:bg-slate-900 px-8 py-5 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 shrink-0 transition-colors">
 <button type="button" onClick={() => setIsModalOpen(false)} className={`px-8 py-3 rounded-2xl ${UI_BUTTON_SECONDARY}`}>Fechar</button>
 {isViewOnly ? (
 <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setIsViewOnly(false); }} disabled={isReadOnly} className={`px-10 py-3 rounded-2xl flex items-center gap-2 ${isReadOnly ? 'bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed opacity-50' : UI_BUTTON_PRIMARY}`}><Edit2 size={16}/> Habilitar Edição</button>
 ) : (
 <button type="submit" form="devForm" disabled={isReadOnly} className={`px-10 py-3 rounded-2xl flex items-center gap-2 ${isReadOnly ? 'bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed opacity-50' : UI_BUTTON_SUCCESS}`}>Salvar Alterações</button>
 )}
 </div>
 </form>
 </div>
 </div>
 )}

 {isReasonModalOpen && (<div className="fixed inset-0 bg-white dark:bg-slate-800/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm overflow-hidden border border-blue-300 dark:border-sky-700/40"><div className="p-8"><div className="flex flex-col items-center text-center mb-6"><div className="h-16 w-16 bg-blue-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center mb-4 shadow-inner border border-blue-800"><Save size={32} /></div><h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Confirmar Alterações?</h3><p className="text-xs mt-2">Informe o motivo da alteração para auditoria:</p></div><textarea className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-blue-100 focus:ring-blue-900/20 outline-none mb-6 transition-all bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"rows={3} placeholder="Descreva o que foi alterado..."value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsReasonModalOpen(false)} className={`flex-1 py-3 rounded-2xl ${UI_BUTTON_SECONDARY}`}>Voltar</button><button onClick={confirmEdit} disabled={!editReason.trim()} className={`flex-1 py-3 rounded-2xl ${UI_BUTTON_PRIMARY}`}>Salvar</button></div></div></div></div>)}
 {isDeleteModalOpen && (<div className="fixed inset-0 bg-white dark:bg-slate-800/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-sm overflow-hidden border border-red-900/40"><div className="p-8"><div className="flex flex-col items-center text-center mb-6"><div className="h-16 w-16 bg-red-900/30 rounded-full flex items-center justify-center mb-4 shadow-inner border border-red-800"><AlertTriangle size={32} /></div><h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Confirma o Descarte?</h3></div><textarea className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-red-100 focus:ring-red-900/20 outline-none mb-6 transition-all bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"rows={3} placeholder="Motivo..."value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsDeleteModalOpen(false)} className={`flex-1 py-3 rounded-2xl ${UI_BUTTON_SECONDARY}`}>Manter</button><button onClick={() => { deleteDevice(deleteTargetId!, adminName, deleteReason); setIsDeleteModalOpen(false); }} disabled={!deleteReason.trim()} className={`flex-1 py-3 rounded-2xl ${UI_BUTTON_DANGER}`}>Confirmar</button></div></div></div></div>)}
 {isRestoreModalOpen && (<div className="fixed inset-0 bg-white dark:bg-slate-800/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm overflow-hidden border border-indigo-900/40"><div className="p-8"><div className="flex flex-col items-center text-center mb-6"><div className="h-16 w-16 bg-indigo-100 dark:bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 shadow-inner border border-indigo-800"><RotateCcw size={32} /></div><h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Restaurar?</h3></div><textarea className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-indigo-100 focus:ring-indigo-900/20 outline-none mb-6 transition-all bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"rows={3} placeholder="Motivo..."value={restoreReason} onChange={(e) => setRestoreReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsRestoreModalOpen(false)} className={`flex-1 py-3 rounded-2xl ${UI_BUTTON_SECONDARY}`}>Cancelar</button><button onClick={() => { restoreDevice(restoreTargetId!, adminName, restoreReason); setIsRestoreModalOpen(false); }} disabled={!restoreReason.trim()} className={`flex-1 py-3 rounded-2xl ${UI_BUTTON_SUCCESS}`}>Restaurar</button></div></div></div></div>)}

 {isBulkModalOpen && (
 <div className="fixed inset-0 bg-white dark:bg-slate-800/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
 <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm overflow-hidden border border-indigo-900/40">
 <div className="p-8">
 <div className="flex flex-col items-center text-center mb-6">
 <div className="h-16 w-16 bg-indigo-100 dark:bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 shadow-inner border border-indigo-800">
 <Sliders size={32} />
 </div>
 <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Ação em Massa</h3>
 <p className="text-xs mt-2">Alterando {selectedIds.length} ativos selecionados.</p>
 </div>
 
 <div className="space-y-4 mb-6">
 {bulkActionType === 'STATUS' && (
 <div>
 <label className="block text-[11px] font-bold uppercase mb-1 ml-1 tracking-wider">Novo Status</label>
 <select 
 className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all"
 value={bulkValue}
 onChange={(e) => setBulkValue(e.target.value)}
 >
 <option value="">Selecionar...</option>
 {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s}</option>)}
 </select>
 </div>
 )}
 {bulkActionType === 'RESPONSIBLE' && (
 <div>
 <label className="block text-[11px] font-bold uppercase mb-1 ml-1 tracking-wider">Novo Responsável</label>
 <SearchableDropdown 
 options={users.map(u => ({ value: u.id, label: u.fullName, subLabel: u.internalCode }))}
 value={bulkValue}
 onChange={setBulkValue}
 placeholder="Selecionar colaborador..."
 icon={<Users size={18}/>}
 />
 </div>
 )}
 {bulkActionType === 'SECTOR' && (
 <div>
 <label className="block text-[11px] font-bold uppercase mb-1 ml-1 tracking-wider">Novo Setor/Cargo</label>
 <SearchableDropdown 
 options={sectorOptions}
 value={bulkValue}
 onChange={setBulkValue}
 placeholder="Selecionar setor..."
 icon={<Briefcase size={18}/>}
 />
 </div>
 )}
 </div>

 <div className="flex gap-4">
 <button onClick={() => setIsBulkModalOpen(false)} className={`flex-1 py-3 rounded-2xl ${UI_BUTTON_SECONDARY}`}>Cancelar</button>
 <button onClick={handleBulkUpdate} disabled={!bulkValue} className={`flex-1 py-3 rounded-2xl ${UI_BUTTON_PRIMARY}`}>Aplicar</button>
 </div>
 </div>
 </div>
 </div>
 )}
 {isModelSettingsOpen && <ModelSettings onClose={() => setIsModelSettingsOpen(false)} />}
 <FilePreviewModal 
   isOpen={isPreviewOpen}
   onClose={() => setIsPreviewOpen(false)}
   fileUrl={previewData.url}
   fileName={previewData.name}
 />

 </div>
 );
};

export default DeviceManager;