
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, DeviceStatus, MaintenanceRecord, MaintenanceType, ActionType, AssetType, CustomField, User, SimCard, AccountType } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, Settings, Image as ImageIcon, Wrench, DollarSign, Paperclip, ExternalLink, X, RotateCcw, AlertTriangle, RefreshCw, FileText, Calendar, Box, Hash, Tag as TagIcon, FileCode, Briefcase, Cpu, History, SlidersHorizontal, Check, Info, ShieldCheck, ChevronDown, Save, Globe, Lock, Eye, EyeOff, Mail, Key } from 'lucide-react';
import ModelSettings from './ModelSettings';

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
                className={`w-full p-3 border-2 rounded-xl flex items-center justify-between cursor-pointer bg-white transition-all
                    ${disabled ? 'bg-slate-100 cursor-not-allowed text-gray-400 border-slate-200' : 'hover:border-indigo-400 border-indigo-200/50'}
                    ${isOpen ? 'ring-4 ring-indigo-100 border-indigo-500' : ''}
                `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {icon && <span className="text-indigo-300 shrink-0">{icon}</span>}
                    <div className="flex flex-col truncate">
                         {selectedOption ? (
                             <>
                                <span className="text-gray-900 font-bold text-sm truncate">{selectedOption.label}</span>
                                {selectedOption.subLabel && <span className="text-[10px] text-gray-500 truncate font-mono uppercase">{selectedOption.subLabel}</span>}
                             </>
                         ) : (
                             <span className="text-gray-400 text-sm">{placeholder}</span>
                         )}
                    </div>
                </div>
                <ChevronDown size={16} className={`text-indigo-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-[120] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-hidden flex flex-col animate-fade-in">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2 sticky top-0">
                        <Search size={14} className="text-slate-400 ml-2" />
                        <input 
                            type="text" 
                            className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400 py-1"
                            placeholder="Buscar..."
                            autoFocus
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="overflow-y-auto flex-1">
                        <div 
                            onClick={() => { onChange(''); setIsOpen(false); setSearchTerm(''); }}
                            className="px-4 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 text-red-500 font-bold text-xs uppercase"
                        >
                            Nenhum Chip Vinculado
                        </div>
                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                            <div 
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }}
                                className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 border-b border-slate-50 last:border-0 ${value === opt.value ? 'bg-indigo-50' : ''}`}
                            >
                                <div className="font-bold text-slate-800 text-sm">{opt.label}</div>
                                {opt.subLabel && <div className="text-[10px] text-gray-500 font-mono uppercase">{opt.subLabel}</div>}
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

const LogNoteRenderer = ({ note }: { note: string }) => {
    const { users } = useData();
    const navigate = useNavigate();

    const userPattern = new RegExp('(Entregue para|Devolvido por):\\s+([^.]+)', 'i');
    const match = note.match(userPattern);

    if (!match) return <span>{note}</span>;

    const action = match[1];
    const nameString = match[2].trim();

    const foundUser = users.find(u => u.fullName.toLowerCase() === nameString.toLowerCase());

    return (
        <span>
            {action}: {foundUser ? (
                <span 
                    onClick={() => navigate(`/users?userId=${foundUser.id}`)} 
                    className="text-blue-600 hover:underline font-bold cursor-pointer hover:bg-blue-50 px-1 rounded"
                >
                    {nameString}
                </span>
            ) : (
                <span className="font-bold">{nameString}</span>
            )}
        </span>
    );
};

const COLUMN_OPTIONS = [
    { id: 'assetTag', label: 'Patrimônio' },
    { id: 'imei', label: 'IMEI' },
    { id: 'serial', label: 'S/N Fabricante' },
    { id: 'sectorCode', label: 'Cód. Setor' },
    { id: 'pulsusId', label: 'Pulsus ID' },
    { id: 'linkedSim', label: 'Chip Vinculado' },
    { id: 'purchaseInfo', label: 'Valor/Data Compra' }
];

const DeviceManager = () => {
  const { 
    devices, addDevice, updateDevice, deleteDevice, restoreDevice,
    users, models, brands, assetTypes, sims, customFields, sectors,
    maintenances, addMaintenance, deleteMaintenance, accounts,
    getHistory
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

  // Novo modal de motivo para alteração
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [editReason, setEditReason] = useState('');

  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'FINANCIAL' | 'MAINTENANCE' | 'SOFTWARE' | 'HISTORY'>('GENERAL');
  
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
      const saved = localStorage.getItem('device_manager_columns');
      return saved ? JSON.parse(saved) : ['assetTag', 'linkedSim'];
  });
  
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const [idType, setIdType] = useState<'TAG' | 'IMEI'>('TAG');
  const [formData, setFormData] = useState<Partial<Device>>({ status: DeviceStatus.AVAILABLE, customData: {} });
  
  const [isUploadingNF, setIsUploadingNF] = useState(false);
  const [isUploadingMaint, setIsUploadingMaint] = useState(false);
  const [newMaint, setNewMaint] = useState<Partial<MaintenanceRecord>>({ 
      description: '', 
      cost: 0, 
      invoiceUrl: '',
      type: MaintenanceType.CORRECTIVE 
  });

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

  const toggleColumn = (id: string) => {
      setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
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

  const openBase64File = (url: string) => {
      if (!url) return;
      if (url.startsWith('data:')) {
          const parts = url.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const binary = atob(parts[1]);
          const array = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
          const blob = new Blob([array], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, '_blank');
      } else {
          window.open(url, '_blank');
      }
  };

  const saveMaintenance = () => {
    if (!editingId || !newMaint.description) return;
    const record: MaintenanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      deviceId: editingId,
      type: newMaint.type || MaintenanceType.CORRECTIVE,
      date: new Date().toISOString(),
      description: newMaint.description,
      cost: newMaint.cost || 0,
      provider: 'Interno',
      invoiceUrl: newMaint.invoiceUrl
    };
    addMaintenance(record, adminName);
    setNewMaint({ description: '', cost: 0, invoiceUrl: '', type: MaintenanceType.CORRECTIVE });
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
      return selectedAssetType.customFieldIds.map(id => 
          customFields.find(cf => cf.id === id)
      ).filter(Boolean) as CustomField[];
  };

  const relevantFields = getRelevantFields();

  const filteredDevices = devices.filter(d => {
    if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;
    const { model, brand } = getModelDetails(d.modelId);
    const searchString = `${model?.name} ${brand?.name} ${d.assetTag || ''} ${d.internalCode || ''} ${d.imei || ''} ${d.serialNumber || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  }).sort((a, b) => {
      const modelA = models.find(m => m.id === a.modelId)?.name || '';
      const modelB = models.find(m => m.id === b.modelId)?.name || '';
      return modelA.localeCompare(modelB);
  });

  const handleOpenModal = (device?: Device, viewOnly: boolean = false) => {
    setActiveTab('GENERAL');
    const isRetired = device?.status === DeviceStatus.RETIRED;
    setIsViewOnly(isRetired || viewOnly);
    
    if (device) {
      setEditingId(device.id);
      setFormData({ ...device, customData: device.customData || {} });
      setIdType(device.imei && !device.assetTag ? 'IMEI' : 'TAG');
    } else {
      setEditingId(null);
      setFormData({ 
        status: DeviceStatus.AVAILABLE, 
        purchaseDate: new Date().toISOString().split('T')[0], 
        purchaseCost: 0, 
        customData: {},
        linkedSimId: null
      });
      setIdType('TAG');
    }
    setIsModalOpen(true);
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetTag && !formData.imei) {
        alert('É obrigatório informar ao menos uma identificação (Patrimônio ou IMEI).');
        return;
    }

    if (editingId) {
        setEditReason('');
        setIsReasonModalOpen(true);
    } else {
        addDevice({ ...formData, id: Math.random().toString(36).substr(2, 9), currentUserId: null } as Device, adminName);
        setIsModalOpen(false);
    }
  };

  const confirmEdit = () => {
    if (!editReason.trim()) {
        alert('Por favor, informe o motivo da alteração.');
        return;
    }
    updateDevice(formData as Device, `${adminName} (Motivo: ${editReason})`);
    setIsReasonModalOpen(false);
    setIsModalOpen(false);
  };

  const handleSectorChange = (val: string) => {
      setFormData({
          ...formData,
          sectorId: val || null
      });
  };

  const handleDeleteAttempt = (device: Device) => {
      if (device.status === DeviceStatus.IN_USE || device.currentUserId) {
          alert('AÇÃO BLOQUEADA: Não é possível descartar um dispositivo que está em uso.\n\nPor favor, realize a devolução do ativo no menu "Entrega/Devolução" antes de prosseguir com o descarte.');
          return;
      }
      setDeleteTargetId(device.id);
      setDeleteReason('');
      setIsDeleteModalOpen(true);
  };

  const deviceMaintenances = maintenances.filter(m => m.deviceId === editingId);
  const deviceAccounts = accounts.filter(a => a.deviceId === editingId);

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventário de Dispositivos</h1>
          <p className="text-gray-500 text-sm">Gestão centralizada de ativos (Ordem A-Z por Modelo).</p>
        </div>
        <div className="flex gap-2">
            <div className="relative" ref={columnRef}>
                <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50 font-semibold">
                    <SlidersHorizontal size={18} /> Colunas
                </button>
                {isColumnSelectorOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-[80] overflow-hidden animate-fade-in">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-500">Exibir Colunas</span>
                            <button onClick={() => setIsColumnSelectorOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                        </div>
                        <div className="p-2 space-y-1">
                            {COLUMN_OPTIONS.map(col => (
                                <button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${visibleColumns.includes(col.id) ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    {col.label}
                                    {visibleColumns.includes(col.id) && <Check size={14}/>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <button onClick={() => setIsModelSettingsOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50 font-semibold"><Settings size={18} /> Catálogo</button>
            <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold"><Plus size={18} /> Novo Ativo</button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 overflow-x-auto bg-white px-4 pt-2 rounded-t-xl">
          {(['ALL', DeviceStatus.AVAILABLE, DeviceStatus.IN_USE, DeviceStatus.MAINTENANCE, DeviceStatus.RETIRED] as (DeviceStatus | 'ALL')[]).map(status => (
              <button key={status} onClick={() => setViewStatus(status)} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${viewStatus === status ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {status === 'ALL' ? 'Todos' : status}
                  <span className="ml-2 bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px]">{status === 'ALL' ? devices.length : devices.filter(d => d.status === status).length}</span>
              </button>
          ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3 text-gray-400" size={20} />
        <input type="text" placeholder="Pesquisar por Tag, IMEI, S/N, Código de Setor ou Modelo..." className="pl-12 w-full border-none rounded-xl py-3 shadow-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 tracking-widest">
            <tr>
              <th className="px-6 py-4">Foto/Modelo</th>
              {visibleColumns.includes('assetTag') && <th className="px-6 py-4">Patrimônio</th>}
              {visibleColumns.includes('imei') && <th className="px-6 py-4">IMEI</th>}
              {visibleColumns.includes('serial') && <th className="px-6 py-4">S/N</th>}
              {visibleColumns.includes('sectorCode') && <th className="px-6 py-4">Setor</th>}
              {visibleColumns.includes('pulsusId') && <th className="px-6 py-4 text-center">Pulsus ID</th>}
              {visibleColumns.includes('linkedSim') && <th className="px-6 py-4">Chip</th>}
              {visibleColumns.includes('purchaseInfo') && <th className="px-6 py-4">Aquisição</th>}
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Responsável Atual</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(d => {
              const { model, brand } = getModelDetails(d.modelId);
              const user = users.find(u => u.id === d.currentUserId);
              const isRet = d.status === DeviceStatus.RETIRED;
              const linkedSim = sims.find(s => s.id === d.linkedSimId);

              return (
                <tr 
                    key={d.id} 
                    onClick={() => handleOpenModal(d, true)}
                    className={`border-b transition-colors cursor-pointer ${isRet ? 'opacity-60 grayscale hover:bg-slate-50' : 'hover:bg-blue-50/30 bg-white'}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100 shadow-inner shrink-0">
                            {model?.imageUrl ? <img src={model.imageUrl} className="h-full w-full object-cover" alt="Ativo" /> : <ImageIcon className="text-slate-300" size={20}/>}
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-gray-900 truncate">{model?.name}</div>
                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{brand?.name}</div>
                        </div>
                    </div>
                  </td>
                  {visibleColumns.includes('assetTag') && (
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><TagIcon size={12} className="text-blue-500"/> {d.assetTag || '---'}</div>
                    </td>
                  )}
                  {visibleColumns.includes('imei') && (
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{d.imei || '---'}</td>
                  )}
                  {visibleColumns.includes('serial') && (
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{d.serialNumber || '---'}</td>
                  )}
                  {visibleColumns.includes('sectorCode') && (
                    <td className="px-6 py-4">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded border border-gray-100 w-fit">{d.internalCode || '---'}</span>
                    </td>
                  )}
                  {visibleColumns.includes('pulsusId') && (
                    <td className="px-6 py-4 text-center">
                        {d.pulsusId ? (
                            <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">{d.pulsusId}</span>
                        ) : <span className="text-[10px] text-slate-200">-</span>}
                    </td>
                  )}
                  {visibleColumns.includes('linkedSim') && (
                    <td className="px-6 py-4">
                        {linkedSim ? (
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 w-fit flex items-center gap-1">
                                <Cpu size={10}/> {linkedSim.phoneNumber}
                            </span>
                        ) : <span className="text-[10px] text-slate-200">-</span>}
                    </td>
                  )}
                  {visibleColumns.includes('purchaseInfo') && (
                    <td className="px-6 py-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-emerald-600">R$ {d.purchaseCost?.toFixed(2) || '0.00'}</span>
                            <span className="text-[9px] text-slate-400">{d.purchaseDate ? new Date(d.purchaseDate).toLocaleDateString() : '---'}</span>
                        </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${d.status === DeviceStatus.AVAILABLE ? 'bg-green-50 text-green-700 border-green-100' : d.status === DeviceStatus.MAINTENANCE ? 'bg-orange-50 text-orange-700 border-orange-100' : d.status === DeviceStatus.RETIRED ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{d.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    {user ? (
                        <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs font-bold text-blue-600 underline cursor-pointer" onClick={() => navigate(`/users?userId=${user.id}`)}>{user.fullName}</span>
                            <span className="text-[9px] text-slate-400 font-black uppercase">{user.internalCode || 'S/ Cód'}</span>
                        </div>
                    ) : <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter italic">Livre no Estoque</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {d.pulsusId && (
                             <a 
                                href={`https://app.pulsus.mobi/devices/${d.pulsusId}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                title="Abrir MDM Pulsus"
                             >
                                <ShieldCheck size={18}/>
                             </a>
                        )}
                        {isRet ? (
                            <button onClick={() => { setRestoreTargetId(d.id); setRestoreReason(''); setIsRestoreModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Restaurar Ativo"><RotateCcw size={18}/></button>
                        ) : (
                            <>
                                <button onClick={() => handleOpenModal(d, false)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Editar"><Edit2 size={18}/></button>
                                <button onClick={() => handleDeleteAttempt(d)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Descartar"><Trash2 size={18}/></button>
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center shrink-0 border-b border-white/10">
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-tight">
                        {editingId ? (isViewOnly ? 'Detalhes do Ativo' : 'Editar Ativo') : 'Novo Ativo'}
                    </h3>
                </div>
                {editingId && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {editingId}</span>}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="h-10 w-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-all"><X size={20}/></button>
            </div>
            
            <div className="flex bg-slate-50 border-b overflow-x-auto shrink-0 px-4 pt-2">
                <button type="button" onClick={() => setActiveTab('GENERAL')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'GENERAL' ? 'border-blue-600 text-blue-700 bg-white shadow-sm' : 'border-transparent text-gray-400 hover:text-slate-600'}`}>Geral</button>
                <button type="button" onClick={() => setActiveTab('FINANCIAL')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'FINANCIAL' ? 'border-blue-600 text-blue-700 bg-white shadow-sm' : 'border-transparent text-gray-400 hover:text-slate-600'}`}>Financeiro</button>
                <button type="button" onClick={() => setActiveTab('MAINTENANCE')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'MAINTENANCE' ? 'border-blue-600 text-blue-700 bg-white shadow-sm' : 'border-transparent text-gray-400 hover:text-slate-600'}`}>Manutenções</button>
                <button type="button" onClick={() => setActiveTab('SOFTWARE')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'SOFTWARE' ? 'border-blue-600 text-blue-700 bg-white shadow-sm' : 'border-transparent text-gray-400 hover:text-slate-600'}`}>Software/Acessos</button>
                <button type="button" onClick={() => setActiveTab('HISTORY')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-700 bg-white shadow-sm' : 'border-transparent text-gray-400 hover:text-slate-600'}`}>Auditoria</button>
            </div>

            <form id="devForm" onSubmit={handleDeviceSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 bg-white">
                    {activeTab === 'GENERAL' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {isViewOnly && (
                            <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                                <Info className="text-blue-600" size={20}/>
                                <p className="text-xs font-bold text-blue-800">Modo de visualização. Clique no botão azul "Habilitar Edição" abaixo para editar os dados.</p>
                            </div>
                        )}
                        <div className="md:col-span-2 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-[0.2em] ml-1">Catálogo de Modelos (A-Z)</label>
                                <select required disabled={isViewOnly} className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold bg-white focus:border-blue-500 outline-none transition-all" value={formData.modelId} onChange={e => setFormData({...formData, modelId: e.target.value})}>
                                    <option value="">Vincular a um modelo do catálogo...</option>
                                    {[...models].sort((a,b) => a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{brands.find(b => b.id === m.brandId)?.name} {m.name}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm relative">
                                <label className="block text-[10px] font-black uppercase text-blue-400 mb-3 tracking-widest">Identificação Principal</label>
                                <div className="flex bg-blue-100/50 p-1 rounded-lg mb-4">
                                    <button type="button" onClick={() => setIdType('TAG')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all ${idType === 'TAG' ? 'bg-white text-blue-600 shadow-sm' : 'text-blue-400 hover:text-blue-50'}`}>Patrimônio</button>
                                    <button type="button" onClick={() => setIdType('IMEI')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all ${idType === 'IMEI' ? 'bg-white text-blue-600 shadow-sm' : 'text-blue-400 hover:text-blue-50'}`}>IMEI</button>
                                </div>
                                {idType === 'TAG' ? (
                                    <input disabled={isViewOnly} className="w-full border-2 border-blue-200 rounded-xl p-3 text-lg font-black text-blue-900 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-blue-200" value={formData.assetTag || ''} onChange={e => setFormData({...formData, assetTag: e.target.value.toUpperCase()})} placeholder="TI-XXXX"/>
                                ) : (
                                    <input disabled={isViewOnly} className="w-full border-2 border-blue-200 rounded-xl p-3 text-lg font-black text-blue-900 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-blue-200" value={formData.imei || ''} onChange={e => setFormData({...formData, imei: e.target.value})} placeholder="000.000..."/>
                                )}
                            </div>
                            
                            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                                <label className="block text-[10px] font-black uppercase text-indigo-400 mb-2 ml-1 tracking-widest">Chip / SIM Card Vinculado</label>
                                <SearchableDropdown 
                                    disabled={isViewOnly}
                                    options={simOptions}
                                    value={formData.linkedSimId || ''}
                                    onChange={val => setFormData({...formData, linkedSimId: val || null})}
                                    placeholder="Pesquisar chip por número ou operadora..."
                                    icon={<Cpu size={18}/>}
                                />
                                <p className="text-[9px] text-indigo-400 mt-2 font-bold px-1 italic">* Ao entregar o dispositivo, este chip será entregue automaticamente.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Serial Number (Fabricante)</label>
                                <input required disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-mono focus:border-blue-500 outline-none bg-slate-50" value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value.toUpperCase()})} placeholder="S/N"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Código de Setor</label>
                                <input disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-blue-50 font-black text-blue-900" value={formData.internalCode || ''} onChange={e => setFormData({...formData, internalCode: e.target.value})} placeholder="Ex: S-001, V-055..."/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Cargo / Função Destinada</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-3.5 text-slate-300" size={16}/>
                                    <select disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 pl-10 text-sm focus:border-blue-500 outline-none bg-slate-50 font-bold" value={formData.sectorId || ''} onChange={e => handleSectorChange(e.target.value)}>
                                        <option value="">Destinar a um Cargo...</option>
                                        {[...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">ID MDM / Pulsus</label>
                                <div className="flex gap-2">
                                    <input disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-50 flex-1" value={formData.pulsusId || ''} onChange={e => setFormData({...formData, pulsusId: e.target.value})} placeholder="Vínculo de software"/>
                                    {formData.pulsusId && (
                                        <a href={`https://app.pulsus.mobi/devices/${formData.pulsusId}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-all flex items-center justify-center shadow-sm" title="Abrir MDM Pulsus">
                                            <ShieldCheck size={20}/>
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        {relevantFields.length > 0 && (
                            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-6 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                {relevantFields.map(field => (
                                    <div key={field.id}>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">{field.name}</label>
                                        <input disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-2.5 text-sm focus:border-blue-500 outline-none bg-white shadow-sm" value={formData.customData?.[field.id] || ''} onChange={e => setFormData({...formData, customData: {...formData.customData, [field.id]: e.target.value}})}/>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    )}
                    {activeTab === 'FINANCIAL' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-5">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-l-4 border-emerald-500 pl-3">Dados de Aquisição</h4>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-2 tracking-widest"><FileText size={12}/> Número da Nota Fiscal</label>
                                    <input disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50" value={formData.invoiceNumber || ''} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} placeholder="NF-XXXXXX"/>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-2 tracking-widest"><DollarSign size={12}/> Valor Pago</label>
                                        <input type="number" disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50 font-bold" value={formData.purchaseCost || 0} onChange={e => setFormData({...formData, purchaseCost: Number(e.target.value)})} step="0.01"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-2 tracking-widest"><Calendar size={12}/> Data Compra</label>
                                        <input type="date" disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50" value={formData.purchaseDate || ''} onChange={e => setFormData({...formData, purchaseDate: e.target.value})}/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-2 tracking-widest"><Box size={12}/> Fornecedor (A-Z)</label>
                                    <input disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50" value={formData.supplier || ''} onChange={e => setFormData({...formData, supplier: e.target.value})} placeholder="Nome da Loja ou Fabricante"/>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-8 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center shadow-inner">
                                {formData.purchaseInvoiceUrl ? (
                                    <div className="space-y-4 w-full">
                                        <div className="h-48 w-full bg-white rounded-2xl border-2 border-slate-100 flex items-center justify-center shadow-xl overflow-hidden group relative">
                                            {formData.purchaseInvoiceUrl.startsWith('data:image') ? (
                                                <img src={formData.purchaseInvoiceUrl} className="h-full w-full object-contain" alt="NF" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-blue-600">
                                                    <FileCode size={64}/>
                                                    <span className="text-[10px] font-black uppercase">Documento NF-e Anexado</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-3">
                                            <button type="button" onClick={() => openBase64File(formData.purchaseInvoiceUrl!)} className="flex-1 bg-white border-2 border-emerald-100 text-emerald-600 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-50 flex items-center justify-center gap-2 shadow-sm transition-all"><ExternalLink size={14}/> Abrir Documento</button>
                                            {!isViewOnly && <button type="button" onClick={() => setFormData({...formData, purchaseInvoiceUrl: ''})} className="p-3 bg-red-50 text-red-600 rounded-xl border-2 border-red-100 hover:bg-red-100 transition-all"><Trash2 size={18}/></button>}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center text-slate-200 mb-4 shadow-lg border-2 border-slate-100"><Paperclip size={32}/></div>
                                        <h5 className="font-black text-slate-800 uppercase tracking-tighter">Anexo da Nota Fiscal</h5>
                                        <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">Importe a imagem ou PDF.</p>
                                        {!isViewOnly && (
                                            <label className="mt-6 cursor-pointer bg-emerald-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                                                {isUploadingNF ? <RefreshCw size={14} className="animate-spin"/> : <Plus size={14}/>}
                                                Escolher Arquivo
                                                <input type="file" className="hidden" onChange={handleNFFileChange} accept="application/pdf,image/*" />
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
                            {!isViewOnly && (
                                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 space-y-4 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 bg-orange-200 rounded-full flex items-center justify-center text-orange-700"><Wrench size={16}/></div>
                                        <h5 className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Registrar Nova Manutenção</h5>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-orange-400 uppercase mb-1">Descrição</label>
                                            <input placeholder="Ex: Troca de tela..." className="w-full border-2 border-orange-100 rounded-xl p-3 text-sm focus:border-orange-400 outline-none bg-white shadow-inner" value={newMaint.description || ''} onChange={e => setNewMaint({...newMaint, description: e.target.value})}/>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-orange-400 uppercase mb-1">Custo (R$)</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-3 text-orange-300" size={16}/>
                                                <input type="number" className="w-full border-2 border-orange-100 rounded-xl p-3 pl-10 text-sm focus:border-orange-400 outline-none bg-white" value={newMaint.cost || 0} onChange={e => setNewMaint({...newMaint, cost: Number(e.target.value)})} step="0.01"/>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-orange-400 uppercase mb-1">Anexo</label>
                                            <label className={`w-full flex items-center gap-3 bg-white border-2 border-dashed border-orange-200 p-2.5 rounded-xl cursor-pointer hover:bg-orange-100/50 transition-all ${isUploadingMaint ? 'opacity-50' : ''}`}>
                                                <div className="h-8 w-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-400">
                                                    {isUploadingMaint ? <RefreshCw size={16} className="animate-spin"/> : <Paperclip size={16}/>}
                                                </div>
                                                <span className="text-[10px] font-bold text-orange-700 uppercase truncate">
                                                    {newMaint.invoiceUrl ? 'Carregado' : 'Importar Nota'}
                                                </span>
                                                <input type="file" className="hidden" onChange={handleMaintFileChange} accept="application/pdf,image/*" />
                                            </label>
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <button type="button" onClick={saveMaintenance} disabled={!newMaint.description || isUploadingMaint} className="bg-orange-600 text-white px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 shadow-lg transition-all active:scale-95 disabled:opacity-50">Lançar</button>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><History size={12}/> Histórico</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    {deviceMaintenances.length > 0 ? deviceMaintenances.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(m => (
                                        <div key={m.id} className="flex justify-between items-center p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm hover:border-orange-200 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600"><Wrench size={20}/></div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm">{m.description}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(m.date).toLocaleDateString()}</span>
                                                        <span className="text-[10px] font-black text-emerald-600 uppercase">R$ {m.cost.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {m.invoiceUrl && <button type="button" onClick={() => openBase64File(m.invoiceUrl!)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"><ExternalLink size={16}/></button>}
                                                {!isViewOnly && <button type="button" onClick={() => { if(window.confirm('Excluir?')) deleteMaintenance(m.id, adminName) }} className="p-2.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest italic">Nenhuma manutenção registrada.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'SOFTWARE' && (
                        <div className="space-y-4 animate-fade-in">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Globe size={14}/> Licenças e Contas Vinculadas</h4>
                            <div className="grid grid-cols-1 gap-3">
                                {deviceAccounts.length > 0 ? deviceAccounts.map(acc => (
                                    <div key={acc.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-inner 
                                                ${acc.type === AccountType.EMAIL ? 'bg-blue-50 text-blue-600' : 
                                                acc.type === AccountType.OFFICE ? 'bg-orange-50 text-orange-600' :
                                                acc.type === AccountType.ERP ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                {acc.type === AccountType.EMAIL ? <Mail size={24}/> : 
                                                 acc.type === AccountType.OFFICE ? <FileText size={24}/> :
                                                 acc.type === AccountType.ERP ? <Lock size={24}/> : <Key size={24}/>}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{acc.name}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{acc.login}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="bg-slate-100 px-2 py-1 rounded font-mono text-[10px] text-slate-700 min-w-[80px] text-center">
                                                {showPasswords[acc.id] ? (acc.password || acc.licenseKey || '---') : '••••••••'}
                                            </div>
                                            <button type="button" onClick={() => setShowPasswords(p => ({...p, [acc.id]: !p[acc.id]}))} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                                {showPasswords[acc.id] ? <EyeOff size={16}/> : <Eye size={16}/>}
                                            </button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                        <Globe size={32} className="mx-auto text-slate-200 mb-2"/>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Nenhum software vinculado a este dispositivo.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'HISTORY' && (
                        <div className="relative border-l-4 border-slate-100 ml-4 space-y-8 py-4 animate-fade-in">
                            {getHistory(editingId || '').map(log => (
                                <div key={log.id} className="relative pl-8">
                                    <div className={`absolute -left-[10px] top-1 h-4 w-4 rounded-full border-4 border-white shadow-md ${log.action === ActionType.RESTORE ? 'bg-indigo-500' : 'bg-blue-500'}`}></div>
                                    <div className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">{new Date(log.timestamp).toLocaleString()}</div>
                                    <div className="font-black text-slate-800 text-sm uppercase tracking-tight">{log.action}</div>
                                    <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg mt-1 border-l-2 border-slate-200">
                                        <LogNoteRenderer note={log.notes || ''} />
                                    </div>
                                    <div className="text-[9px] font-black text-slate-300 uppercase mt-2 tracking-tighter">Realizado por: {log.adminUser}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t shrink-0">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 rounded-2xl bg-white border-2 border-slate-200 font-black text-[10px] uppercase text-slate-500 hover:bg-slate-100 transition-all tracking-widest shadow-sm">Fechar</button>
                    {isViewOnly ? (
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsViewOnly(false); }} className="px-10 py-3 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all hover:scale-105 flex items-center gap-2">
                           <Edit2 size={16}/> Habilitar Edição
                        </button>
                    ) : (
                        <button type="submit" form="devForm" className="px-10 py-3 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">Salvar</button>
                    )}
                </div>
            </form>
          </div>
        </div>
      )}

      {/* NOVO MODAL: Motivo da Alteração */}
      {isReasonModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-blue-100">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-4 shadow-inner border border-blue-100"><Save size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Confirmar Alterações?</h3>
                          <p className="text-xs text-slate-400 mt-2">Informe o motivo da alteração para auditoria:</p>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-blue-100 focus:border-blue-300 outline-none mb-6 transition-all" rows={3} placeholder="Descreva o que foi alterado..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Voltar</button>
                          <button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-700 disabled:opacity-50">Salvar Alterações</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-red-100">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-inner border border-red-100"><AlertTriangle size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Confirma o Descarte?</h3>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-red-100 focus:border-red-300 outline-none mb-6 transition-all" rows={3} placeholder="Motivo..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Manter</button>
                          <button onClick={() => { deleteDevice(deleteTargetId!, adminName, deleteReason); setIsDeleteModalOpen(false); }} disabled={!deleteReason.trim()} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 disabled:opacity-50">Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isRestoreModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-indigo-100">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="h-16 w-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-4 shadow-inner border border-indigo-100"><RotateCcw size={32} /></div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Restaurar?</h3>
                      </div>
                      <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 outline-none mb-6 transition-all" rows={3} placeholder="Motivo..." value={restoreReason} onChange={(e) => setRestoreReason(e.target.value)}></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsRestoreModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                          <button onClick={() => { restoreDevice(restoreTargetId!, adminName, restoreReason); setIsRestoreModalOpen(false); }} disabled={!restoreReason.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Restaurar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isModelSettingsOpen && <ModelSettings onClose={() => setIsModelSettingsOpen(false)} />}
    </div>
  );
};

export default DeviceManager;
