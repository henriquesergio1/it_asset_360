
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, DeviceStatus, MaintenanceRecord, MaintenanceType, ActionType, AssetType, CustomField, User, SimCard, AccountType } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, Settings, Image as ImageIcon, Wrench, DollarSign, Paperclip, ExternalLink, X, RotateCcw, AlertTriangle, RefreshCw, FileText, Calendar, Box, Tag as TagIcon, FileCode, Briefcase, Cpu, History, SlidersHorizontal, Check, Info, ShieldCheck, ChevronDown, Lock, Key, Eye, EyeOff, Globe } from 'lucide-react';
import ModelSettings from './ModelSettings';

interface Option { value: string; label: string; subLabel?: string; }

const SearchableDropdown: React.FC<{ options: Option[]; value: string; onChange: (val: string) => void; placeholder: string; icon?: React.ReactNode; disabled?: boolean; }> = ({ options, value, onChange, placeholder, icon, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase())));
    const selectedOption = options.find(o => o.value === value);
    return (
        <div className="relative" ref={wrapperRef}>
            <div onClick={() => !disabled && setIsOpen(!isOpen)} className={`w-full p-3 border-2 rounded-xl flex items-center justify-between cursor-pointer bg-white transition-all ${disabled ? 'bg-slate-100 cursor-not-allowed text-gray-400 border-slate-200' : 'hover:border-indigo-400 border-indigo-200/50'} ${isOpen ? 'ring-4 ring-indigo-100 border-indigo-500' : ''}`}>
                <div className="flex items-center gap-3 overflow-hidden">
                    {icon && <span className="text-indigo-300 shrink-0">{icon}</span>}
                    <div className="flex flex-col truncate">
                         {selectedOption ? (
                             <>
                                <span className="text-gray-900 font-bold text-sm truncate">{selectedOption.label}</span>
                                {selectedOption.subLabel && <span className="text-[10px] text-gray-500 truncate font-mono uppercase">{selectedOption.subLabel}</span>}
                             </>
                         ) : <span className="text-gray-400 text-sm">{placeholder}</span>}
                    </div>
                </div>
                <ChevronDown size={16} className={`text-indigo-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && !disabled && (
                <div className="absolute z-[120] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-hidden flex flex-col animate-fade-in">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2 sticky top-0">
                        <Search size={14} className="text-slate-400 ml-2" />
                        <input type="text" className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400 py-1" placeholder="Buscar..." autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        <div onClick={() => { onChange(''); setIsOpen(false); setSearchTerm(''); }} className="px-4 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 text-red-500 font-bold text-xs uppercase">Nenhum Vínculo</div>
                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                            <div key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }} className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 border-b border-slate-50 last:border-0 ${value === opt.value ? 'bg-indigo-50' : ''}`}>
                                <div className="font-bold text-slate-800 text-sm">{opt.label}</div>
                                {opt.subLabel && <div className="text-[10px] text-gray-500 font-mono uppercase">{opt.subLabel}</div>}
                            </div>
                        )) : <div className="px-4 py-8 text-center text-slate-400 text-xs italic">Nenhum resultado.</div>}
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
    return (<span>{action}: {foundUser ? (<span onClick={() => navigate(`/users?userId=${foundUser.id}`)} className="text-blue-600 hover:underline font-bold cursor-pointer hover:bg-blue-50 px-1 rounded">{nameString}</span>) : (<span className="font-bold">{nameString}</span>)}</span>);
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
  const { devices, addDevice, updateDevice, deleteDevice, restoreDevice, users, models, brands, assetTypes, sims, customFields, sectors, maintenances, addMaintenance, deleteMaintenance, getHistory, accounts } = useData();
  const { user: currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewStatus, setViewStatus] = useState<DeviceStatus | 'ALL'>('ALL'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'FINANCIAL' | 'MAINTENANCE' | 'SOFTWARE' | 'HISTORY'>('GENERAL');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  // MOTIVO MODAL STATES
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [reasonActionType, setReasonActionType] = useState<'UPDATE' | 'DELETE' | 'RESTORE'>('UPDATE');
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
      const saved = localStorage.getItem('device_manager_columns');
      return saved ? JSON.parse(saved) : ['assetTag', 'linkedSim'];
  });
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  const [idType, setIdType] = useState<'TAG' | 'IMEI'>('TAG');
  const [formData, setFormData] = useState<Partial<Device>>({ status: DeviceStatus.AVAILABLE, customData: {} });
  const [isUploadingNF, setIsUploadingNF] = useState(false);
  const [newMaint, setNewMaint] = useState<Partial<MaintenanceRecord>>({ description: '', cost: 0, invoiceUrl: '', type: MaintenanceType.CORRECTIVE });

  const adminName = currentUser?.name || 'Sistema';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (columnRef.current && !columnRef.current.contains(e.target as Node)) setIsColumnSelectorOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (id: string) => setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handleOpenModal = (device?: Device, viewOnly: boolean = false) => {
    setActiveTab('GENERAL');
    setIsViewOnly(device?.status === DeviceStatus.RETIRED || viewOnly);
    if (device) {
      setEditingId(device.id);
      setFormData({ ...device, customData: device.customData || {} });
      setIdType(device.imei && !device.assetTag ? 'IMEI' : 'TAG');
    } else {
      setEditingId(null);
      setFormData({ status: DeviceStatus.AVAILABLE, purchaseDate: new Date().toISOString().split('T')[0], purchaseCost: 0, customData: {}, linkedSimId: null });
      setIdType('TAG');
    }
    setIsModalOpen(true);
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetTag && !formData.imei) return alert('Identificação obrigatória.');
    if (editingId) {
        setReasonText('');
        setReasonActionType('UPDATE');
        setIsReasonModalOpen(true);
    } else {
        addDevice({ ...formData, id: Math.random().toString(36).substr(2, 9), currentUserId: null } as Device, adminName);
        setIsModalOpen(false);
    }
  };

  const handleConfirmReason = () => {
      if (!reasonText.trim()) return alert('Informe o motivo.');
      if (reasonActionType === 'UPDATE') {
          updateDevice(formData as Device, adminName, reasonText);
          setIsModalOpen(false);
      } else if (reasonActionType === 'DELETE') {
          deleteDevice(pendingTargetId!, adminName, reasonText);
      } else if (reasonActionType === 'RESTORE') {
          restoreDevice(pendingTargetId!, adminName, reasonText);
      }
      setIsReasonModalOpen(false);
  };

  const handleDeleteAttempt = (device: Device) => {
      if (device.status === DeviceStatus.IN_USE) return alert('Devolva o ativo antes de descartar.');
      setPendingTargetId(device.id);
      setReasonText('');
      setReasonActionType('DELETE');
      setIsReasonModalOpen(true);
  };

  const filteredDevices = devices.filter(d => {
    if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;
    const model = models.find(m => m.id === d.modelId);
    return `${model?.name} ${d.assetTag || ''} ${d.imei || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a,b) => (a.assetTag || '').localeCompare(b.assetTag || ''));

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventário de Ativos</h1>
          <p className="text-gray-500 text-sm">Gestão robusta de hardware.</p>
        </div>
        <div className="flex gap-2">
            <div className="relative" ref={columnRef}>
                <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-semibold hover:bg-gray-50"><SlidersHorizontal size={18} /> Colunas</button>
                {isColumnSelectorOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border rounded-xl shadow-2xl z-[80] overflow-hidden animate-fade-in">
                        <div className="p-2 space-y-1">
                            {COLUMN_OPTIONS.map(col => (
                                <button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold ${visibleColumns.includes(col.id) ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    {col.label} {visibleColumns.includes(col.id) && <Check size={14}/>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <button onClick={() => setIsModelSettingsOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-semibold"><Settings size={18} /> Catálogo</button>
            <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold"><Plus size={18} /> Novo Ativo</button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 overflow-x-auto bg-white px-4 pt-2 rounded-t-xl">
          {(['ALL', DeviceStatus.AVAILABLE, DeviceStatus.IN_USE, DeviceStatus.MAINTENANCE, DeviceStatus.RETIRED] as (DeviceStatus | 'ALL')[]).map(status => (
              <button key={status} onClick={() => setViewStatus(status)} className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${viewStatus === status ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{status === 'ALL' ? 'Todos' : status}</button>
          ))}
      </div>

      <div className="relative"><Search className="absolute left-4 top-3 text-gray-400" size={20} /><input type="text" placeholder="Pesquisar..." className="pl-12 w-full border-none rounded-xl py-3 shadow-lg focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 tracking-widest border-b">
            <tr>
              <th className="px-6 py-4">Foto/Modelo</th>
              {visibleColumns.includes('assetTag') && <th className="px-6 py-4">Patrimônio</th>}
              {visibleColumns.includes('imei') && <th className="px-6 py-4">IMEI</th>}
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(d => {
              const model = models.find(m => m.id === d.modelId);
              const isRet = d.status === DeviceStatus.RETIRED;
              return (
                <tr key={d.id} onClick={() => handleOpenModal(d, true)} className={`border-b hover:bg-blue-50/30 cursor-pointer ${isRet ? 'opacity-60 grayscale' : ''}`}>
                  <td className="px-6 py-4 font-bold text-slate-700">{model?.name || '---'}</td>
                  {visibleColumns.includes('assetTag') && <td className="px-6 py-4 font-bold">{d.assetTag || '---'}</td>}
                  {visibleColumns.includes('imei') && <td className="px-6 py-4 font-mono">{d.imei || '---'}</td>}
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black border ${d.status === DeviceStatus.AVAILABLE ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{d.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                        {isRet ? (
                            <button onClick={() => { setPendingTargetId(d.id); setReasonActionType('RESTORE'); setReasonText(''); setIsReasonModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><RotateCcw size={18}/></button>
                        ) : (
                            <>
                                <button onClick={() => handleOpenModal(d, false)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={18}/></button>
                                <button onClick={() => handleDeleteAttempt(d)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
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
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">{editingId ? (isViewOnly ? 'Visualização' : 'Editar Ativo') : 'Novo Ativo'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="flex bg-slate-50 border-b overflow-x-auto shrink-0 px-4 pt-2">
                <button type="button" onClick={() => setActiveTab('GENERAL')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'GENERAL' ? 'border-blue-600 text-blue-700 bg-white shadow-sm' : 'border-transparent text-slate-400'}`}>Geral</button>
                <button type="button" onClick={() => setActiveTab('FINANCIAL')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'FINANCIAL' ? 'border-blue-600 text-blue-700 bg-white shadow-sm' : 'border-transparent text-slate-400'}`}>Financeiro</button>
                <button type="button" onClick={() => setActiveTab('MAINTENANCE')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'MAINTENANCE' ? 'border-blue-600 text-blue-700 bg-white shadow-sm' : 'border-transparent text-slate-400'}`}>Manutenções</button>
                <button type="button" onClick={() => setActiveTab('HISTORY')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-700 bg-white shadow-sm' : 'border-transparent text-slate-400'}`}>Auditoria</button>
            </div>
            <form id="devForm" onSubmit={handleDeviceSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 bg-white">
                    {activeTab === 'GENERAL' && (
                        <div className="space-y-6">
                            <select required disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-slate-50 outline-none" value={formData.modelId} onChange={e => setFormData({...formData, modelId: e.target.value})}>
                                <option value="">Vincular a um modelo...</option>
                                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                                <label className="block text-[10px] font-black uppercase text-blue-400 mb-2 tracking-widest">Identificação Principal</label>
                                <input disabled={isViewOnly} className="w-full border-2 border-blue-200 rounded-xl p-3 text-lg font-black text-blue-900 outline-none" value={formData.assetTag || ''} onChange={e => setFormData({...formData, assetTag: e.target.value.toUpperCase()})} placeholder="Patrimônio TI-XXXX"/>
                            </div>
                        </div>
                    )}
                    {activeTab === 'FINANCIAL' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">NF-e</label><input disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm bg-slate-50 outline-none" value={formData.invoiceNumber || ''} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})}/></div>
                             <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Valor</label><input type="number" disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-slate-50 outline-none" value={formData.purchaseCost || 0} onChange={e => setFormData({...formData, purchaseCost: Number(e.target.value)})}/></div>
                        </div>
                    )}
                    {activeTab === 'HISTORY' && (
                        <div className="relative border-l-4 border-slate-100 ml-4 space-y-8 py-4 animate-fade-in">
                            {getHistory(editingId || '').map(log => (
                                <div key={log.id} className="relative pl-8">
                                    <div className="absolute -left-[10px] top-1 h-4 w-4 rounded-full border-4 border-white shadow-md bg-blue-500"></div>
                                    <div className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">{new Date(log.timestamp).toLocaleString()}</div>
                                    <div className="font-black text-slate-800 text-sm uppercase tracking-tight">{log.action}</div>
                                    <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg mt-1 border-l-2 border-slate-200">{log.notes || '---'}</div>
                                    <div className="text-[9px] font-black text-slate-300 uppercase mt-2">Realizado por: {log.adminUser}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t shrink-0">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl bg-white border-2 font-black text-[10px] uppercase text-slate-500 hover:bg-slate-100 border-slate-200">Fechar</button>
                    {!isViewOnly && <button type="submit" form="devForm" className="px-10 py-3 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase shadow-xl hover:bg-blue-700 transition-all">Salvar Registro</button>}
                </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE MOTIVO OBRIGATÓRIO (GENERALIZADO) */}
      {isReasonModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up border border-slate-100">
                  <div className="p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className={`h-16 w-16 ${reasonActionType === 'DELETE' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-blue-50 text-blue-500 border-blue-100'} rounded-full flex items-center justify-center mb-4 shadow-inner border`}>{reasonActionType === 'DELETE' ? <AlertTriangle size={32} /> : <FileText size={32} />}</div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{reasonActionType === 'DELETE' ? 'Confirma Descarte?' : reasonActionType === 'RESTORE' ? 'Restaurar Ativo?' : 'Confirma Alteração?'}</h3>
                          <p className="text-xs text-slate-400 mt-2 font-medium">Justifique esta ação para o log de auditoria.</p>
                      </div>
                      <textarea className={`w-full border-2 ${reasonActionType === 'DELETE' ? 'border-red-100 focus:ring-red-100' : 'border-blue-100 focus:ring-blue-100'} rounded-2xl p-4 text-sm outline-none mb-6 transition-all shadow-inner`} rows={3} placeholder="Descreva aqui o motivo..." value={reasonText} onChange={(e) => setReasonText(e.target.value)} autoFocus></textarea>
                      <div className="flex gap-4">
                          <button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Manter</button>
                          <button onClick={handleConfirmReason} disabled={!reasonText.trim()} className={`flex-1 py-3 ${reasonActionType === 'DELETE' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all`}>Confirmar</button>
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
