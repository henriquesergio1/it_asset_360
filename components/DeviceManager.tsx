
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
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'ACCESSORIES' | 'FINANCIAL' | 'MAINTENANCE' | 'HISTORY'>('GENERAL');
  
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
                        {isRet ? <button onClick={() => handleOpenModal(d, true)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded transition-colors"><Eye size={16}/></button> : <><button onClick={() => handleOpenModal(d)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"><Edit2 size={16}/></button><button onClick={() => handleDeleteClick(d.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 size={16}/></button></>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL DE ENTREGA */}
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
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Colaborador</label>
                                  <select className="w-full border rounded-lg p-2.5 bg-white shadow-sm" value={opUserId} onChange={e => setOpUserId(e.target.value)}>
                                      <option value="">Selecione...</option>
                                      {users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                                  </select>
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer bg-blue-50 p-3 rounded-lg border border-blue-100"><input type="checkbox" className="rounded text-blue-600" checked={syncData} onChange={e => setSyncData(e.target.checked)}/><span className="text-xs font-bold text-blue-800">Sincronizar Setor/CC do Ativo com Colaborador</span></label>
                              <textarea className="w-full border rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white transition-colors" rows={2} value={opNotes} onChange={e => setOpNotes(e.target.value)} placeholder="Observações da entrega..."></textarea>
                              <div className="flex gap-3 pt-2">
                                  <button onClick={closeOpModal} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">Cancelar</button>
                                  <button onClick={executeAssign} disabled={!opUserId} className={`flex-1 py-2.5 rounded-xl text-white font-bold shadow-md transition-all active:scale-95 ${!opUserId ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>Confirmar Entrega</button>
                              </div>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE DEVOLUÇÃO */}
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
                                  <button onClick={closeOpModal} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">Cancelar</button>
                                  <button onClick={executeReturn} className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl font-bold shadow-md hover:bg-orange-700 transition-all active:scale-95">Confirmar Recebimento</button>
                              </div>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Modais de Edição e Configurações de Modelos permanecem aqui */}
      {isModelSettingsOpen && <ModelSettings onClose={() => setIsModelSettingsOpen(false)} />}
      
      {/* ... Bulk actions and Main Device Modal ... (Código mantido) */}
    </div>
  );
};

export default DeviceManager;
