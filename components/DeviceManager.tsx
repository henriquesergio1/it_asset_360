
import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, DeviceStatus, MaintenanceRecord, MaintenanceType, ActionType, ReturnChecklist, DeviceAccessory, AssetType, CustomField, SimCard } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, Monitor, Settings, Image as ImageIcon, FileText, Wrench, DollarSign, Paperclip, Link, Unlink, History, ArrowRight, Tablet, Hash, ScanBarcode, ExternalLink, ArrowUpRight, ArrowDownLeft, CheckSquare, Printer, CheckCircle, Plug, X, Layers, Square, Copy, Box, Ban, LayoutGrid, Eye, AlertTriangle, HardDrive, SmartphoneNfc, Sliders, MapPin, Upload, Check, ChevronRight, RefreshCw, User as UserIcon } from 'lucide-react';
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
  
  // Operation Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [selectedOpAsset, setSelectedOpAsset] = useState<Device | null>(null);
  const [opUserId, setOpUserId] = useState('');
  const [opNotes, setOpNotes] = useState('');
  const [opChecklist, setOpChecklist] = useState<ReturnChecklist>({ device: true, charger: true, cable: true, case: true });
  const [syncData, setSyncData] = useState(true);

  // Selection & Bulk Actions
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkField, setBulkField] = useState<'STATUS' | 'MODEL' | 'SECTOR' | 'COST_CENTER' | 'DELETE'>('STATUS');
  const [bulkValue, setBulkValue] = useState<string>('');

  const [formData, setFormData] = useState<Partial<Device>>({ status: DeviceStatus.AVAILABLE, accessories: [], customData: {} });
  const [idType, setIdType] = useState<'TAG' | 'IMEI'>('TAG');
  const [newMaint, setNewMaint] = useState<Partial<MaintenanceRecord>>({ type: MaintenanceType.CORRECTIVE, cost: 0, invoiceUrl: '' });

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
      customData: {
        ...(prev.customData || {}),
        [fieldId]: value
      }
    }));
  };

  const filteredDevices = devices.filter(d => {
    if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;
    const { model, brand } = getModelDetails(d.modelId);
    const searchString = `${model?.name} ${brand?.name} ${d.assetTag} ${d.imei || ''} ${d.pulsusId || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  // --- OPERAÇÃO HANDLERS ---
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

  const executeAssign = async () => {
      if (!selectedOpAsset || !opUserId) return;
      if (syncData) {
          const user = users.find(u => u.id === opUserId);
          if (user) {
              await updateDevice({ ...selectedOpAsset, sectorId: user.sectorId, costCenter: user.jobTitle }, adminName);
          }
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

  const closeOpModal = () => {
      setIsAssignModalOpen(false);
      setIsReturnModalOpen(false);
      setSelectedOpAsset(null);
      setIsSuccessState(false);
  };

  // --- SELECTION & BULK ---
  const toggleSelectAll = () => {
    if (selectedDevices.size === filteredDevices.length) setSelectedDevices(new Set());
    else setSelectedDevices(new Set(filteredDevices.map(d => d.id)));
  };

  const toggleSelect = (id: string) => {
    const newSelection = new Set(selectedDevices);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedDevices(newSelection);
  };

  const handleExecuteBulkAction = () => {
    const ids = Array.from(selectedDevices);
    if (bulkField === 'DELETE') {
      if (!deleteReason.trim()) return alert('Motivo obrigatório.');
      ids.forEach(id => {
          const dev = devices.find(d => d.id === id);
          if (dev) updateDevice({ ...dev, status: DeviceStatus.RETIRED }, `${adminName} (Massa: ${deleteReason})`);
      });
    } else {
      if (!bulkValue && bulkField !== 'COST_CENTER') return alert('Valor obrigatório.');
      ids.forEach(id => {
        const dev = devices.find(d => d.id === id);
        if (dev) {
            const up = { ...dev };
            if (bulkField === 'STATUS') up.status = bulkValue as DeviceStatus;
            if (bulkField === 'MODEL') up.modelId = bulkValue;
            if (bulkField === 'SECTOR') up.sectorId = bulkValue;
            if (bulkField === 'COST_CENTER') up.costCenter = bulkValue;
            updateDevice(up, adminName);
        }
      });
    }
    setSelectedDevices(new Set());
    setIsBulkModalOpen(false);
  };

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

  const handleDeleteClick = (id: string) => {
      if (devices.find(d => d.id === id)?.status === DeviceStatus.IN_USE) return alert('Devolva o ativo antes de descartar.');
      setDeleteTargetId(id);
      setDeleteReason('');
      setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
      const dev = devices.find(d => d.id === deleteTargetId);
      if (dev && deleteReason.trim()) {
          updateDevice({ ...dev, status: DeviceStatus.RETIRED }, `${adminName} (Descarte: ${deleteReason})`);
          setIsDeleteModalOpen(false);
      }
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;
    if (editingId && formData.id) updateDevice(formData as Device, adminName);
    else addDevice({ ...formData, id: Math.random().toString(36).substr(2, 9), currentUserId: null } as Device, adminName);
    setIsModalOpen(false);
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
              <button key={status} onClick={() => { setViewStatus(status); setSelectedDevices(new Set()); }} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${viewStatus === status ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {status === 'ALL' ? 'Todos' : status}
                  <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{status === 'ALL' ? devices.length : devices.filter(d => d.status === status).length}</span>
              </button>
          ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
        <input type="text" placeholder="Tag, modelo, serial ou pulsus..." className="pl-10 w-full border rounded-lg py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-700">
            <tr>
              <th className="px-6 py-3 w-10"><input type="checkbox" checked={selectedDevices.size === filteredDevices.length && filteredDevices.length > 0} onChange={toggleSelectAll}/></th>
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
                  <td className="px-6 py-4"><input type="checkbox" checked={selectedDevices.has(d.id)} onChange={() => toggleSelect(d.id)}/></td>
                  <td className="px-6 py-4">
                      <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shadow-inner group">
                          {model?.imageUrl ? (
                              <img src={model.imageUrl} className="h-full w-full object-cover transition-transform group-hover:scale-125" />
                          ) : (
                              <ImageIcon className="text-slate-300" size={20}/>
                          )}
                      </div>
                  </td>
                  <td className="px-6 py-4">
                    <div 
                        onClick={() => handleOpenModal(d, true)}
                        className="font-bold text-gray-900 cursor-pointer hover:text-blue-600 hover:underline"
                    >
                        {model?.name}
                    </div>
                    <div className="text-xs text-gray-500">{brand?.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono text-xs font-bold">{d.assetTag}</div>
                    {d.serialNumber && <div className="text-[10px] text-gray-400">SN: {d.serialNumber}</div>}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="font-bold">{sec?.name || '-'}</div>
                    <div className="text-gray-500">{d.costCenter || 'S/ CC'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${d.status === DeviceStatus.AVAILABLE ? 'bg-green-100 text-green-700' : d.status === DeviceStatus.MAINTENANCE ? 'bg-orange-100 text-orange-700' : d.status === DeviceStatus.RETIRED ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'}`}>{d.status}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium">{user?.fullName || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                        {!isRet && (
                            <>
                                {d.status === DeviceStatus.AVAILABLE ? <button onClick={() => handleOpenAssign(d)} className="text-green-600 hover:bg-green-50 p-1.5 rounded transition-colors" title="Entregar"><ArrowUpRight size={18}/></button> : d.status === DeviceStatus.IN_USE ? <button onClick={() => handleOpenReturn(d)} className="text-orange-600 hover:bg-orange-50 p-1.5 rounded transition-colors" title="Devolver"><ArrowDownLeft size={18}/></button> : null}
                            </>
                        )}
                        {d.pulsusId && <a href={`https://app.pulsus.mobi/devices/${d.pulsusId}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 p-1.5 rounded hover:bg-blue-50 transition-colors" title="MDM"><SmartphoneNfc size={16}/></a>}
                        {isRet ? <button onClick={() => handleOpenModal(d, true)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded transition-colors"><Eye size={16}/></button> : <><button onClick={() => handleOpenModal(d)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors" title="Editar"><Edit2 size={16}/></button><button onClick={() => handleDeleteClick(d.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="Descartar"><Trash2 size={16}/></button></>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL PRINCIPAL DE DISPOSITIVO (EDIÇÃO/VISUALIZAÇÃO) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{isViewOnly ? 'Visualizar Ativo' : editingId ? 'Editar Dispositivo' : 'Novo Dispositivo'}</h3>
                {isViewOnly && <span className="bg-red-600 text-[10px] px-2 rounded-full font-black uppercase text-white">Bloqueado</span>}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="flex border-b bg-gray-50 overflow-x-auto shrink-0">
                <button onClick={() => setActiveTab('GENERAL')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'GENERAL' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Geral</button>
                <button onClick={() => setActiveTab('FINANCIAL')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'FINANCIAL' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Financeiro</button>
                <button onClick={() => setActiveTab('MAINTENANCE')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'MAINTENANCE' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Manutenção ({deviceMaintenances.length})</button>
                <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Histórico</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'GENERAL' && (
                  <form id="devForm" onSubmit={handleDeviceSubmit} className="grid grid-cols-2 gap-4">
                     <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modelo</label>
                        <select required disabled={isViewOnly} className="w-full border rounded-lg p-2.5 bg-gray-50 focus:bg-white transition-colors" value={formData.modelId} onChange={e => setFormData({...formData, modelId: e.target.value})}>
                          <option value="">Selecione o modelo...</option>
                          {models.map(m => <option key={m.id} value={m.id}>{m.name} ({brands.find(b => b.id === m.brandId)?.name})</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Status Operacional</label>
                        <select disabled={isViewOnly} className="w-full border rounded-lg p-2 text-sm bg-blue-50 font-bold text-blue-800" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as DeviceStatus})}>
                            <option value={DeviceStatus.AVAILABLE}>{DeviceStatus.AVAILABLE}</option>
                            <option value={DeviceStatus.IN_USE} disabled>{DeviceStatus.IN_USE}</option>
                            <option value={DeviceStatus.MAINTENANCE}>{DeviceStatus.MAINTENANCE}</option>
                            <option value={DeviceStatus.RETIRED}>{DeviceStatus.RETIRED}</option>
                        </select>
                     </div>
                     <div className="col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                         <div className="flex gap-4">
                             <label className={`flex items-center gap-2 text-sm font-bold cursor-pointer ${isViewOnly ? 'opacity-50' : ''}`}><input type="radio" disabled={isViewOnly} checked={idType === 'TAG'} onChange={() => setIdType('TAG')}/> Patrimônio</label>
                             <label className={`flex items-center gap-2 text-sm font-bold cursor-pointer ${isViewOnly ? 'opacity-50' : ''}`}><input type="radio" disabled={isViewOnly} checked={idType === 'IMEI'} onChange={() => setIdType('IMEI')}/> IMEI</label>
                         </div>
                         <input required disabled={isViewOnly} className="w-full border rounded-lg p-2.5 font-mono text-sm shadow-inner" placeholder={idType === 'TAG' ? 'TAG-000' : 'IMEI (15 dígitos)'} value={formData.assetTag || ''} onChange={e => setFormData({...formData, assetTag: e.target.value, imei: idType === 'IMEI' ? e.target.value : undefined})} />
                     </div>
                     {relevantFields.map(field => (
                        <div key={field.id}>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{field.name}</label>
                            <input disabled={isViewOnly} className="w-full border rounded-lg p-2 text-sm" value={formData.customData?.[field.id] || ''} onChange={e => updateCustomData(field.id, e.target.value)} />
                        </div>
                     ))}
                     <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Serial Number</label><input required disabled={isViewOnly} className="w-full border rounded-lg p-2 text-sm" value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value})}/></div>
                     <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ID MDM Pulsus</label><input disabled={isViewOnly} className="w-full border rounded-lg p-2 text-sm" value={formData.pulsusId || ''} onChange={e => setFormData({...formData, pulsusId: e.target.value})}/></div>
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
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fornecedor / Loja</label>
                            <input disabled={isViewOnly} className="w-full border rounded-lg p-2 text-sm" value={formData.supplier || ''} onChange={e => setFormData({...formData, supplier: e.target.value})} />
                        </div>
                    </div>
                )}

                {activeTab === 'MAINTENANCE' && (
                    <div className="space-y-4">
                        {!isViewOnly && (
                             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-3">
                                <h5 className="text-xs font-bold text-orange-700 uppercase">Novo Registro de Manutenção</h5>
                                <div className="grid grid-cols-2 gap-2">
                                    <input placeholder="Descrição do problema/reparo" className="col-span-2 border rounded p-2 text-sm" value={newMaint.description || ''} onChange={e => setNewMaint({...newMaint, description: e.target.value})}/>
                                    <input type="number" placeholder="Custo (R$)" className="border rounded p-2 text-sm" value={newMaint.cost || ''} onChange={e => setNewMaint({...newMaint, cost: Number(e.target.value)})}/>
                                    <button onClick={() => { if(newMaint.description && newMaint.cost) { addMaintenance({...newMaint, id: Math.random().toString(36).substr(2,9), deviceId: editingId!, date: new Date().toISOString(), type: MaintenanceType.CORRECTIVE, provider: 'Interno'} as MaintenanceRecord, adminName); setNewMaint({cost: 0, description: ''}); } }} className="bg-orange-600 text-white rounded font-bold text-xs uppercase tracking-wider">Lançar Reparo</button>
                                </div>
                             </div>
                        )}
                        <div className="space-y-2">
                            {deviceMaintenances.map(m => (
                                <div key={m.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                    <div><p className="font-bold text-sm text-gray-800">{m.description}</p><p className="text-[10px] text-gray-400">{new Date(m.date).toLocaleDateString()} • {m.provider}</p></div>
                                    <div className="text-right">
                                        <p className="font-bold text-sm text-red-600">R$ {m.cost.toFixed(2)}</p>
                                        {!isViewOnly && <button onClick={() => deleteMaintenance(m.id, adminName)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'HISTORY' && (
                    <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                        {getHistory(editingId || '').map(log => (
                            <div key={log.id} className="relative pl-6">
                                <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-sm ${log.notes?.includes('Descarte') ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                <div className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</div>
                                <div className="font-bold text-gray-800 text-sm">{log.action}</div>
                                <div className="text-xs text-gray-600">{log.notes}</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase mt-1">Por: {log.adminUser}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 shrink-0 border-t">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-lg bg-gray-200 font-bold text-gray-700 hover:bg-gray-300 transition-colors">Fechar</button>
                {!isViewOnly && ['GENERAL', 'FINANCIAL'].includes(activeTab) && (
                    <button type="submit" form="devForm" className="px-6 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md transition-all active:scale-95">Salvar Alterações</button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE AÇÕES EM MASSA */}
      {selectedDevices.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-8 border border-slate-700">
              <div className="flex items-center gap-3 pr-8 border-r border-slate-700"><div className="bg-blue-600 h-8 w-8 rounded-full flex items-center justify-center font-bold">{selectedDevices.size}</div><span className="text-sm font-bold uppercase tracking-widest text-[10px]">Selecionados</span></div>
              <div className="flex items-center gap-2">
                  <button onClick={() => { setBulkField('STATUS'); setIsBulkModalOpen(true); }} className="px-3 py-2 hover:bg-slate-800 rounded-lg text-xs font-bold text-blue-400 flex items-center gap-2"><RefreshCw size={14}/> Alterar</button>
                  <button onClick={() => { setBulkField('DELETE'); setIsBulkModalOpen(true); }} className="px-3 py-2 hover:bg-red-900/30 rounded-lg text-xs font-bold text-red-400 flex items-center gap-2"><Trash2 size={14}/> Descartar</button>
              </div>
              <button onClick={() => setSelectedDevices(new Set())} className="text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
          </div>
      )}

      {/* MODAL DE AÇÃO EM MASSA */}
      {isBulkModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-[150] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                  <div className="bg-slate-900 p-4 text-white flex justify-between items-center"><h3 className="font-bold">{bulkField === 'DELETE' ? 'Descartar Lote' : 'Atualização'}</h3><button onClick={() => setIsBulkModalOpen(false)}><X size={20}/></button></div>
                  <div className="p-6 space-y-4">
                      {bulkField !== 'DELETE' ? (
                          <>
                              <select className="w-full border rounded-lg p-2.5 text-sm font-bold bg-gray-50" value={bulkField} onChange={e => setBulkField(e.target.value as any)}><option value="STATUS">Status Operacional</option><option value="MODEL">Modelo</option><option value="SECTOR">Setor de Alocação</option><option value="COST_CENTER">Centro de Custo</option></select>
                              {bulkField === 'STATUS' ? (
                                  <select className="w-full border rounded-lg p-2.5 text-sm" value={bulkValue} onChange={e => setBulkValue(e.target.value)}><option value="">Selecione...</option><option value={DeviceStatus.AVAILABLE}>{DeviceStatus.AVAILABLE}</option><option value={DeviceStatus.MAINTENANCE}>{DeviceStatus.MAINTENANCE}</option><option value={DeviceStatus.RETIRED}>{DeviceStatus.RETIRED}</option></select>
                              ) : <input className="w-full border rounded-lg p-2.5 text-sm" value={bulkValue} onChange={e => setBulkValue(e.target.value)}/>}
                          </>
                      ) : (
                        <div className="space-y-4">
                            <div className="bg-red-50 text-red-700 p-3 rounded border border-red-100 text-xs flex gap-2 font-bold"><AlertTriangle size={14}/> Atenção: Esta ação move os ativos para descarte.</div>
                            <textarea className="w-full border rounded-lg p-2 text-sm" placeholder="Motivo do descarte em lote..." value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3}/>
                        </div>
                      )}
                      <button onClick={handleExecuteBulkAction} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all">Aplicar em {selectedDevices.size} itens</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE DEVOLUÇÃO (OPERACIONAL) */}
      {isReturnModalOpen && selectedOpAsset && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                  <div className="bg-orange-600 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2"><ArrowDownLeft size={20}/> {isSuccessState ? 'Retorno Concluído' : 'Devolução de Equipamento'}</h3>
                      <button onClick={closeOpModal}><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      {isSuccessState ? (
                          <div className="flex flex-col items-center py-4 space-y-6 animate-fade-in text-center">
                              <div className="h-16 w-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center shadow-inner"><CheckCircle size={40}/></div>
                              <div>
                                <p className="font-bold text-slate-800 text-lg">Ativo Recebido!</p>
                                <p className="text-sm text-slate-500">O registro de retorno foi processado.</p>
                              </div>
                              <div className="flex flex-col gap-2 w-full">
                                <button onClick={printAfterOp} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 transition-all"><Printer size={18}/> Imprimir Termo de Devolução</button>
                                <button onClick={closeOpModal} className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all">Concluir</button>
                              </div>
                          </div>
                      ) : (
                          <>
                              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-sm">
                                  <p className="text-xs text-orange-600 font-bold uppercase mb-1">Recebendo de:</p>
                                  <p className="font-bold text-gray-800 text-base">{users.find(u => u.id === selectedOpAsset.currentUserId)?.fullName || 'Doador Desconhecido'}</p>
                                  <div className="mt-2 flex items-center gap-2">
                                      <div className="h-8 w-8 rounded border bg-white flex items-center justify-center shrink-0">
                                          {getModelDetails(selectedOpAsset.modelId).model?.imageUrl ? <img src={getModelDetails(selectedOpAsset.modelId).model?.imageUrl} className="h-full w-full object-cover" /> : <ImageIcon className="text-gray-300" size={12}/>}
                                      </div>
                                      <span className="text-xs text-orange-700 font-medium">{getModelDetails(selectedOpAsset.modelId).model?.name} ({selectedOpAsset.assetTag})</span>
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                  {Object.keys(opChecklist).map(key => (
                                      <label key={key} className="flex items-center gap-2 text-xs border p-3 rounded-lg cursor-pointer bg-white hover:bg-gray-50 transition-colors shadow-sm"><input type="checkbox" className="rounded text-orange-600" checked={(opChecklist as any)[key]} onChange={e => setOpChecklist({...opChecklist, [key]: e.target.checked})}/><span className="capitalize font-medium">{key === 'device' ? 'Aparelho' : key === 'charger' ? 'Carregador' : key === 'cable' ? 'Cabo USB' : key === 'case' ? 'Capa Protetora' : key}</span></label>
                                  ))}
                              </div>
                              <textarea className="w-full border rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white transition-colors" rows={2} value={opNotes} onChange={e => setOpNotes(e.target.value)} placeholder="Estado do ativo (ex: tela riscada, ok)..."></textarea>
                              <div className="flex gap-3 pt-2">
                                  <button onClick={closeOpModal} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
                                  <button onClick={executeReturn} className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl font-bold shadow-md hover:bg-orange-700 transition-all active:scale-95">Confirmar Recebimento</button>
                              </div>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE ENTREGA (OPERACIONAL) */}
      {isAssignModalOpen && selectedOpAsset && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                  <div className="bg-green-600 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2"><ArrowUpRight size={20}/> {isSuccessState ? 'Entrega Realizada' : 'Entrega de Equipamento'}</h3>
                      <button onClick={closeOpModal}><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      {isSuccessState ? (
                          <div className="flex flex-col items-center py-4 space-y-6 animate-fade-in text-center">
                              <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner"><CheckCircle size={40}/></div>
                              <div>
                                <p className="font-bold text-slate-800 text-lg">Sucesso!</p>
                                <p className="text-sm text-slate-500">O dispositivo foi vinculado corretamente.</p>
                              </div>
                              <div className="flex flex-col gap-2 w-full">
                                <button onClick={printAfterOp} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 transition-all"><Printer size={18}/> Imprimir Termo Agora</button>
                                <button onClick={closeOpModal} className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all">Fechar Janela</button>
                              </div>
                          </div>
                      ) : (
                          <>
                              <div className="bg-gray-50 p-3 rounded-lg border text-sm flex items-center gap-3">
                                  <div className="h-10 w-10 rounded border overflow-hidden bg-white shrink-0">
                                      {getModelDetails(selectedOpAsset.modelId).model?.imageUrl ? <img src={getModelDetails(selectedOpAsset.modelId).model?.imageUrl} className="h-full w-full object-cover" /> : <ImageIcon className="text-gray-300 m-2" size={16}/>}
                                  </div>
                                  <p className="font-bold text-gray-800 truncate">{getModelDetails(selectedOpAsset.modelId).model?.name} - {selectedOpAsset.assetTag}</p>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Colaborador Destino</label>
                                  <select className="w-full border rounded-lg p-2.5 bg-white shadow-sm" value={opUserId} onChange={e => setOpUserId(e.target.value)}>
                                      <option value="">Selecione...</option>
                                      {users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                                  </select>
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer bg-blue-50 p-3 rounded-lg border border-blue-100"><input type="checkbox" className="rounded text-blue-600" checked={syncData} onChange={e => setSyncData(e.target.checked)}/><span className="text-xs font-bold text-blue-800">Sincronizar Setor/CC do Ativo com Colaborador</span></label>
                              <textarea className="w-full border rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white transition-colors" rows={2} value={opNotes} onChange={e => setOpNotes(e.target.value)} placeholder="Observações da entrega..."></textarea>
                              <div className="flex gap-3 pt-2">
                                  <button onClick={closeOpModal} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
                                  <button onClick={executeAssign} disabled={!opUserId} className={`flex-1 py-2.5 rounded-xl text-white font-bold shadow-md transition-all active:scale-95 ${!opUserId ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>Confirmar Entrega</button>
                              </div>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE DESCARTE INDIVIDUAL */}
      {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-[150] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                  <div className="p-6">
                      <div className="flex flex-col items-center text-center mb-4">
                          <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-3"><AlertTriangle size={24} /></div>
                          <h3 className="text-lg font-bold text-gray-900">Mover para Descarte?</h3>
                          <p className="text-sm text-gray-500 mt-1">O ativo será removido do estoque e movido para a aba Descartado.</p>
                      </div>
                      <div className="mb-4">
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Motivo</label>
                          <textarea className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 outline-none" rows={3} placeholder="Ex: Sucata, Roubo, Defeito físico..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Cancelar</button>
                          <button onClick={handleConfirmDelete} disabled={!deleteReason.trim()} className={`flex-1 py-2 rounded-lg text-white font-bold transition-colors ${!deleteReason.trim() ? 'bg-gray-300' : 'bg-red-600 hover:bg-red-700'}`}>Confirmar</button>
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
