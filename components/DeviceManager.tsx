
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, DeviceStatus, MaintenanceRecord, MaintenanceType, ActionType, ReturnChecklist, DeviceAccessory, AssetType, CustomField, SimCard, User } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, Monitor, Settings, Image as ImageIcon, FileText, Wrench, DollarSign, Paperclip, Link, Unlink, History, ArrowRight, Tablet, Hash, ScanBarcode, ExternalLink, ArrowUpRight, ArrowDownLeft, CheckSquare, Printer, CheckCircle, Plug, X, Layers, Square, Copy, Box, Ban, LayoutGrid, Eye, AlertTriangle, HardDrive, SmartphoneNfc, Sliders, MapPin, Upload, Check, ChevronRight, RefreshCw, User as UserIcon, Mail, Fingerprint, CreditCard, ExternalLink as OutLink } from 'lucide-react';
import ModelSettings from './ModelSettings';
import { generateAndPrintTerm } from '../utils/termGenerator';

const DeviceManager = () => {
  const { 
    devices, addDevice, updateDevice, deleteDevice, 
    users, models, brands, assetTypes, sims, sectors, accessoryTypes, customFields,
    maintenances, addMaintenance, deleteMaintenance,
    getHistory, settings,
    assignAsset, returnAsset 
  } = useData();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [viewStatus, setViewStatus] = useState<DeviceStatus | 'ALL'>('ALL'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'FINANCIAL' | 'MAINTENANCE' | 'HISTORY'>('GENERAL');
  
  // Quick View User
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  // Operation Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [selectedOpAsset, setSelectedOpAsset] = useState<Device | null>(null);
  const [opUserId, setOpUserId] = useState('');
  const [opNotes, setOpNotes] = useState('');
  const [opChecklist, setOpChecklist] = useState<ReturnChecklist>({ device: true, charger: true, cable: true, case: true });
  const [syncData, setSyncData] = useState(true);

  const [formData, setFormData] = useState<Partial<Device>>({ status: DeviceStatus.AVAILABLE, accessories: [], customData: {} });
  const [idType, setIdType] = useState<'TAG' | 'IMEI'>('TAG');
  const [newMaint, setNewMaint] = useState<Partial<MaintenanceRecord>>({ type: MaintenanceType.CORRECTIVE, cost: 0, invoiceUrl: '' });

  // --- LOGICA DE ABERTURA VIA URL (DEEP LINKING) ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const deviceId = params.get('deviceId');
    if (deviceId) {
        const device = devices.find(d => d.id === deviceId);
        if (device) {
            handleOpenModal(device, true);
            navigate('/devices', { replace: true });
        }
    }
  }, [location, devices]);

  const adminName = currentUser?.name || 'Sistema';

  const getModelDetails = (modelId?: string) => {
    const model = models.find(m => m.id === modelId);
    const brand = brands.find(b => b.id === model?.brandId);
    const type = assetTypes.find(t => t.id === model?.typeId);
    return { model, brand, type };
  };

  const getRelevantFields = () => {
    const { model: selectedModel } = getModelDetails(formData.modelId);
    const selectedAssetType = assetTypes.find(t => t.id === selectedModel?.typeId);
    return customFields.filter(cf => selectedAssetType?.customFieldIds?.includes(cf.id));
  };

  const relevantFields = getRelevantFields();

  const updateCustomData = (fieldId: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      customData: { ...(prev.customData || {}), [fieldId]: value }
    }));
  };

  const filteredDevices = devices.filter(d => {
    if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;
    const { model, brand } = getModelDetails(d.modelId);
    const searchString = `${model?.name} ${brand?.name} ${d.assetTag} ${d.imei || ''} ${d.pulsusId || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const handleOpenModal = (device?: Device, viewOnly: boolean = false) => {
    setActiveTab('GENERAL');
    const forcedViewOnly = viewOnly || device?.status === DeviceStatus.RETIRED;
    setIsViewOnly(forcedViewOnly);
    if (device) {
      setEditingId(device.id);
      setFormData({ ...device, accessories: device.accessories || [], customData: device.customData || {} });
      setIdType(device.imei ? 'IMEI' : 'TAG');
    } else {
      setEditingId(null);
      setFormData({ status: DeviceStatus.AVAILABLE, purchaseDate: new Date().toISOString().split('T')[0], purchaseCost: 0, accessories: [], customData: {} });
      setIdType('TAG');
    }
    setIsModalOpen(true);
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;
    if (editingId && formData.id) updateDevice(formData as Device, adminName);
    else addDevice({ ...formData, id: Math.random().toString(36).substr(2, 9), currentUserId: null } as Device, adminName);
    setIsModalOpen(false);
  };

  const handleOpenAssign = (device: Device) => {
      setSelectedOpAsset(device);
      setOpUserId('');
      setOpNotes('');
      setSyncData(true);
      setIsSuccessState(false);
      setIsAssignModalOpen(true);
  };

  const handleOpenReturn = (device: Device) => {
      setSelectedOpAsset(device);
      setOpNotes('');
      setOpChecklist({ device: true, charger: true, cable: true, case: true, sim: !!device.linkedSimId });
      setIsSuccessState(false);
      setIsReturnModalOpen(true);
  };

  const closeOpModal = () => {
    setIsAssignModalOpen(false);
    setIsReturnModalOpen(false);
    setSelectedOpAsset(null);
    setIsSuccessState(false);
  };

  const executeAssign = async () => {
      if (!selectedOpAsset || !opUserId) return;
      if (syncData) {
          const user = users.find(u => u.id === opUserId);
          if (user) await updateDevice({ ...selectedOpAsset, sectorId: user.sectorId, costCenter: user.jobTitle }, adminName);
      }
      await assignAsset('Device', selectedOpAsset.id, opUserId, opNotes, adminName);
      setIsSuccessState(true);
  };

  const executeReturn = async () => {
      if (!selectedOpAsset) return;
      await returnAsset('Device', selectedOpAsset.id, opNotes, adminName);
      setIsSuccessState(true);
  };

  const printAfterOp = () => {
      if (!selectedOpAsset) return;
      const targetUserId = opUserId || selectedOpAsset.currentUserId;
      const user = users.find(u => u.id === targetUserId);
      const { model, brand, type } = getModelDetails(selectedOpAsset.modelId);
      const linkedSim = sims.find(s => s.id === selectedOpAsset.linkedSimId);
      const sectorName = sectors.find(s => s.id === user?.sectorId)?.name;
      if (user) {
          generateAndPrintTerm({
              user, asset: selectedOpAsset, settings, model, brand, type,
              actionType: opUserId ? 'ENTREGA' : 'DEVOLUCAO', linkedSim, sectorName, notes: opNotes,
              checklist: !opUserId ? opChecklist : undefined
          });
      }
  };

  const deviceMaintenances = maintenances.filter(m => m.deviceId === editingId);

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventário de Dispositivos</h1>
          <p className="text-gray-500 text-sm">Gerencie computadores, celulares e outros ativos.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsModelSettingsOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50"><Settings size={18} /> Configurar Modelos</button>
            <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"><Plus size={18} /> Novo Dispositivo</button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
          {(['ALL', DeviceStatus.AVAILABLE, DeviceStatus.IN_USE, DeviceStatus.MAINTENANCE, DeviceStatus.RETIRED] as (DeviceStatus | 'ALL')[]).map(status => (
              <button key={status} onClick={() => setViewStatus(status)} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${viewStatus === status ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {status === 'ALL' ? 'Todos' : status}
                  <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{status === 'ALL' ? devices.length : devices.filter(d => d.status === status).length}</span>
              </button>
          ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
        <input type="text" placeholder="Tag, modelo, serial ou pulsus..." className="pl-10 w-full border rounded-lg py-2 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-700">
            <tr>
              <th className="px-6 py-3">Foto</th>
              <th className="px-6 py-3">Modelo</th>
              <th className="px-6 py-3">Identificação</th>
              <th className="px-6 py-3">Localização</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Usuário</th>
              <th className="px-6 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(d => {
              const { model, brand } = getModelDetails(d.modelId);
              const user = users.find(u => u.id === d.currentUserId);
              const sec = sectors.find(s => s.id === d.sectorId);
              const isRet = d.status === DeviceStatus.RETIRED;

              return (
                <tr key={d.id} className={`border-b transition-colors hover:bg-gray-50 ${isRet ? 'opacity-60 bg-gray-50/50' : 'bg-white'}`}>
                  <td className="px-6 py-4">
                      <div onClick={() => handleOpenModal(d, true)} className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shadow-inner group cursor-pointer hover:border-blue-500 transition-all">
                          {model?.imageUrl ? <img src={model.imageUrl} className="h-full w-full object-cover transition-transform group-hover:scale-125" /> : <ImageIcon className="text-slate-300" size={20}/>}
                      </div>
                  </td>
                  <td className="px-6 py-4">
                    <div onClick={() => handleOpenModal(d, true)} className="font-bold text-gray-900 cursor-pointer hover:text-blue-600 hover:underline">{model?.name}</div>
                    <div className="text-xs text-gray-500">{brand?.name}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    <div className="font-bold">{d.assetTag}</div>
                    {d.serialNumber && <div className="text-[10px] text-gray-400 font-mono">SN: {d.serialNumber}</div>}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="font-bold text-slate-700">{sec?.name || '-'}</div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{d.costCenter || 'SEM CC'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${d.status === DeviceStatus.AVAILABLE ? 'bg-green-100 text-green-700' : d.status === DeviceStatus.MAINTENANCE ? 'bg-orange-100 text-orange-700' : d.status === DeviceStatus.RETIRED ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'}`}>{d.status}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium">
                    {user ? <div onClick={() => setViewingUser(user)} className="text-emerald-600 hover:text-emerald-800 hover:underline font-bold cursor-pointer flex items-center gap-1"><UserIcon size={12}/> {user.fullName}</div> : <span className="text-gray-300 italic">Disponível</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                        {!isRet && (
                            <>
                                {d.status === DeviceStatus.AVAILABLE ? <button onClick={() => handleOpenAssign(d)} className="text-green-600 hover:bg-green-50 p-1.5 rounded transition-colors" title="Entregar Ativo"><ArrowUpRight size={18}/></button> : d.status === DeviceStatus.IN_USE ? <button onClick={() => handleOpenReturn(d)} className="text-orange-600 hover:bg-orange-50 p-1.5 rounded transition-colors" title="Devolver Ativo"><ArrowDownLeft size={18}/></button> : null}
                            </>
                        )}
                        {d.pulsusId && <a href={`https://app.pulsus.mobi/devices/${d.pulsusId}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 p-1.5 rounded hover:bg-blue-50 transition-colors" title="Ver no MDM"><SmartphoneNfc size={16}/></a>}
                        {isRet ? <button onClick={() => handleOpenModal(d, true)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded transition-colors"><Eye size={16}/></button> : <><button onClick={() => handleOpenModal(d)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors" title="Editar"><Edit2 size={16}/></button><button onClick={() => { setDeleteTargetId(d.id); setDeleteReason(''); setIsDeleteModalOpen(true); }} className="text-red-400 hover:text-red-600 p-1.5 rounded transition-colors" title="Descartar"><Trash2 size={16}/></button></>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL PRINCIPAL DE DISPOSITIVO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white">{editingId ? (isViewOnly ? 'Visualização de Ativo' : 'Edição de Dispositivo') : 'Novo Dispositivo'}</h3>
                {isViewOnly && <button onClick={() => setIsViewOnly(false)} className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase flex items-center gap-1 shadow-lg hover:scale-105 active:scale-95 transition-all"><Edit2 size={10}/> Editar Ativo</button>}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="flex border-b bg-gray-50 overflow-x-auto shrink-0">
                <button onClick={() => setActiveTab('GENERAL')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'GENERAL' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Geral</button>
                <button onClick={() => setActiveTab('FINANCIAL')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'FINANCIAL' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Financeiro</button>
                <button onClick={() => setActiveTab('MAINTENANCE')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'MAINTENANCE' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Manutenção ({deviceMaintenances.length})</button>
                <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Histórico</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'GENERAL' && (
                  <form id="devForm" onSubmit={handleDeviceSubmit} className="grid grid-cols-2 gap-4">
                     <div className="col-span-2">
                         <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Modelo do Equipamento</label>
                         <select required disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.modelId} onChange={e => setFormData({...formData, modelId: e.target.value})}>
                             <option value="">Selecione...</option>
                             {models.map(m => <option key={m.id} value={m.id}>{m.name} ({brands.find(b => b.id === m.brandId)?.name})</option>)}
                         </select>
                     </div>
                     <div>
                         <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Status Operacional</label>
                         <select disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm bg-blue-50 font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as DeviceStatus})}>
                             <option value={DeviceStatus.AVAILABLE}>{DeviceStatus.AVAILABLE}</option>
                             <option value={DeviceStatus.IN_USE} disabled>{DeviceStatus.IN_USE}</option>
                             <option value={DeviceStatus.MAINTENANCE}>{DeviceStatus.MAINTENANCE}</option>
                             <option value={DeviceStatus.RETIRED}>{DeviceStatus.RETIRED}</option>
                         </select>
                     </div>
                     <div className="col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                         <div className="flex gap-4">
                             <label className="flex items-center gap-2 text-sm font-bold cursor-pointer"><input type="radio" disabled={isViewOnly} checked={idType === 'TAG'} onChange={() => setIdType('TAG')}/> Patrimônio</label>
                             <label className="flex items-center gap-2 text-sm font-bold cursor-pointer"><input type="radio" disabled={isViewOnly} checked={idType === 'IMEI'} onChange={() => setIdType('IMEI')}/> IMEI</label>
                         </div>
                         <input required disabled={isViewOnly} className="w-full border rounded-lg p-2.5 font-mono text-sm shadow-inner" placeholder={idType === 'TAG' ? 'TAG-000' : 'IMEI (15 dígitos)'} value={formData.assetTag || ''} onChange={e => setFormData({...formData, assetTag: e.target.value, imei: idType === 'IMEI' ? e.target.value : undefined})} />
                     </div>
                     {relevantFields.map(field => (
                        <div key={field.id}>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">{field.name}</label>
                            <input disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm" value={formData.customData?.[field.id] || ''} onChange={e => updateCustomData(field.id, e.target.value)} />
                        </div>
                     ))}
                     <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Número de Série (SN)</label><input required disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm font-mono" value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value})}/></div>
                     <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">ID MDM Pulsus</label><input disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm" value={formData.pulsusId || ''} onChange={e => setFormData({...formData, pulsusId: e.target.value})}/></div>
                  </form>
                )}

                {activeTab === 'FINANCIAL' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Aquisição</label>
                             <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-bold text-gray-400">Data</label><input type="date" disabled={isViewOnly} className="w-full border rounded p-2 text-sm" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})}/></div>
                                <div><label className="text-[10px] font-bold text-gray-400">Custo (R$)</label><input type="number" disabled={isViewOnly} className="w-full border rounded p-2 text-sm" value={formData.purchaseCost} onChange={e => setFormData({...formData, purchaseCost: Number(e.target.value)})}/></div>
                             </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Fornecedor / Loja</label>
                            <input disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm" value={formData.supplier || ''} onChange={e => setFormData({...formData, supplier: e.target.value})} />
                        </div>
                    </div>
                )}

                {activeTab === 'MAINTENANCE' && (
                    <div className="space-y-4">
                        {!isViewOnly && (
                             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-3">
                                <h5 className="text-xs font-bold text-orange-700 uppercase">Lançar Reparo Interno/Externo</h5>
                                <div className="grid grid-cols-2 gap-2">
                                    <input placeholder="Descrição do reparo..." className="col-span-2 border rounded p-2.5 text-sm shadow-inner" value={newMaint.description || ''} onChange={e => setNewMaint({...newMaint, description: e.target.value})}/>
                                    <input type="number" placeholder="Custo (R$)" className="border rounded p-2.5 text-sm shadow-inner" value={newMaint.cost || ''} onChange={e => setNewMaint({...newMaint, cost: Number(e.target.value)})}/>
                                    <button onClick={() => { if(newMaint.description && newMaint.cost) { addMaintenance({...newMaint, id: Math.random().toString(36).substr(2,9), deviceId: editingId!, date: new Date().toISOString(), type: MaintenanceType.CORRECTIVE, provider: 'Interno'} as MaintenanceRecord, adminName); setNewMaint({cost: 0, description: ''}); } }} className="bg-orange-600 text-white rounded font-bold text-xs uppercase tracking-widest hover:bg-orange-700 transition-colors">Salvar Registro</button>
                                </div>
                             </div>
                        )}
                        <div className="space-y-2">
                            {deviceMaintenances.map(m => (
                                <div key={m.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm border-l-4 border-l-orange-400">
                                    <div><p className="font-bold text-sm text-gray-800">{m.description}</p><p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(m.date).toLocaleDateString()} • {m.provider}</p></div>
                                    <div className="text-right">
                                        <p className="font-black text-sm text-red-600">R$ {m.cost.toFixed(2)}</p>
                                        {!isViewOnly && <button onClick={() => deleteMaintenance(m.id, adminName)} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'HISTORY' && (
                    <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 py-2">
                        {getHistory(editingId || '').map(log => (
                            <div key={log.id} className="relative pl-8 animate-fade-in">
                                <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-sm ${log.notes?.includes('Descarte') ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{new Date(log.timestamp).toLocaleString()}</div>
                                <div className="font-bold text-gray-800 text-sm">{log.action}</div>
                                <div className="text-xs text-gray-600 italic">"{log.notes}"</div>
                                <div className="text-[9px] font-black text-gray-400 uppercase mt-1 tracking-widest">Admin: {log.adminUser}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 shrink-0 border-t">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl bg-gray-200 font-bold text-gray-600 hover:bg-gray-300 transition-colors">Fechar</button>
                {!isViewOnly && ['GENERAL', 'FINANCIAL'].includes(activeTab) && (
                    <button type="submit" form="devForm" className="px-8 py-2 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">Salvar Alterações</button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DO USUÁRIO EXPANDIDO */}
      {viewingUser && (
          <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in flex flex-col">
                  <div className="bg-emerald-600 px-6 py-4 flex justify-between items-center shrink-0">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><UserIcon size={20}/> Perfil do Colaborador</h3>
                      <button onClick={() => setViewingUser(null)} className="text-emerald-100 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6 flex-1 overflow-y-auto">
                      <div className="flex items-center gap-5">
                          <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl font-black border-4 border-emerald-50 shadow-inner">
                              {viewingUser.fullName.charAt(0)}
                          </div>
                          <div className="flex-1">
                              <h4 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">{viewingUser.fullName}</h4>
                              <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest mt-1">
                                  {sectors.find(s => s.id === viewingUser.sectorId)?.name || 'Sem Função'} • {viewingUser.jobTitle}
                              </p>
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4">
                              <Mail size={18} className="text-slate-400"/>
                              <div className="min-w-0"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">E-mail Corporativo</p><p className="text-sm font-bold text-slate-700 truncate">{viewingUser.email}</p></div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4">
                                  <Fingerprint size={18} className="text-slate-400"/>
                                  <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">CPF</p><p className="text-sm font-bold text-slate-700">{viewingUser.cpf}</p></div>
                              </div>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4">
                                  <CreditCard size={18} className="text-slate-400"/>
                                  <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">RG</p><p className="text-sm font-bold text-slate-700">{viewingUser.rg || 'Não informado'}</p></div>
                              </div>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4">
                              <Hash size={18} className="text-slate-400"/>
                              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Número PIS</p><p className="text-sm font-bold text-slate-700">{viewingUser.pis || 'Não informado'}</p></div>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4">
                              <MapPin size={18} className="text-slate-400 shrink-0"/>
                              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Endereço de Residência</p><p className="text-xs font-bold text-slate-700 leading-relaxed">{viewingUser.address || 'Não cadastrado'}</p></div>
                          </div>
                      </div>
                  </div>
                  <div className="bg-slate-50 px-8 py-5 border-t flex justify-end gap-3 shrink-0">
                      <button onClick={() => setViewingUser(null)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all">Fechar</button>
                      <button 
                          onClick={() => { navigate(`/users?userId=${viewingUser.id}`); setViewingUser(null); }} 
                          className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg hover:bg-emerald-700 hover:scale-105 transition-all"
                      >
                          <OutLink size={14}/> Ir para Cadastro Completo
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Operação de Descarte Individual */}
      {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-[150] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                  <div className="p-6">
                      <div className="flex flex-col items-center text-center mb-4">
                          <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-3"><AlertTriangle size={24} /></div>
                          <h3 className="text-lg font-bold text-gray-900">Mover para Descarte?</h3>
                          <p className="text-sm text-gray-500 mt-1">O ativo será removido do estoque e movido para o histórico de descartados.</p>
                      </div>
                      <textarea className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none mb-4" rows={3} placeholder="Motivo do descarte (ex: quebrado, sucata)..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea>
                      <div className="flex gap-2">
                          <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold">Cancelar</button>
                          <button onClick={() => { 
                              const dev = devices.find(x => x.id === deleteTargetId);
                              if(dev) updateDevice({...dev, status: DeviceStatus.RETIRED}, `${adminName} (Descarte: ${deleteReason})`);
                              setIsDeleteModalOpen(false);
                          }} disabled={!deleteReason.trim()} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold disabled:opacity-50">Confirmar</button>
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
