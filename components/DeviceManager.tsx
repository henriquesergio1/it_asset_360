
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, DeviceStatus, MaintenanceRecord, MaintenanceType, ActionType, ReturnChecklist, DeviceAccessory, AssetType, CustomField, SimCard, User } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, Monitor, Settings, Image as ImageIcon, FileText, Wrench, DollarSign, Paperclip, Link, Unlink, History, ArrowRight, Tablet, Hash, ScanBarcode, ExternalLink, ArrowUpRight, ArrowDownLeft, CheckSquare, Printer, CheckCircle, Plug, X, Layers, Square, Copy, Box, Ban, LayoutGrid, Eye, AlertTriangle, HardDrive, SmartphoneNfc, Sliders, MapPin, Upload, Check, ChevronRight, RefreshCw, User as UserIcon, Mail, Fingerprint, CreditCard, ExternalLink as OutLink, RotateCcw } from 'lucide-react';
import ModelSettings from './ModelSettings';
import { generateAndPrintTerm } from '../utils/termGenerator';

const DeviceManager = () => {
  const { 
    devices, addDevice, updateDevice, deleteDevice, restoreDevice,
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
  
  // Modais de exclusão e restauração
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);
  const [restoreReason, setRestoreReason] = useState('');

  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'FINANCIAL' | 'MAINTENANCE' | 'HISTORY'>('GENERAL');
  
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState<Partial<Device>>({ status: DeviceStatus.AVAILABLE, accessories: [], customData: {} });
  const [idType, setIdType] = useState<'TAG' | 'IMEI'>('TAG');
  
  // Manutenção state
  const [newMaint, setNewMaint] = useState<Partial<MaintenanceRecord>>({ type: MaintenanceType.CORRECTIVE, cost: 0, invoiceUrl: '' });
  const [isUploadingMaint, setIsUploadingMaint] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const deviceId = params.get('deviceId');
    if (deviceId) {
        const device = devices.find(d => d.id === deviceId);
        if (device) handleOpenModal(device, true);
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

  const filteredDevices = devices.filter(d => {
    if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;
    const { model, brand } = getModelDetails(d.modelId);
    const searchString = `${model?.name} ${brand?.name} ${d.assetTag} ${d.imei || ''} ${d.pulsusId || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const handleOpenModal = (device?: Device, viewOnly: boolean = false) => {
    setActiveTab('GENERAL');
    setIsViewOnly(viewOnly || device?.status === DeviceStatus.RETIRED);
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

  const handleMaintFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setIsUploadingMaint(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewMaint(prev => ({ ...prev, invoiceUrl: reader.result as string }));
            setIsUploadingMaint(false);
        };
        reader.readAsDataURL(file);
    }
  };

  const saveMaintenance = () => {
      if(newMaint.description && newMaint.cost !== undefined) { 
          addMaintenance({
              ...newMaint, 
              id: Math.random().toString(36).substr(2,9), 
              deviceId: editingId!, 
              date: new Date().toISOString(), 
              type: MaintenanceType.CORRECTIVE, 
              provider: 'Interno/Externo'
          } as MaintenanceRecord, adminName); 
          setNewMaint({cost: 0, description: '', invoiceUrl: ''}); 
      }
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

      <div className="flex gap-4 border-b border-gray-200 overflow-x-auto">
          {(['ALL', DeviceStatus.AVAILABLE, DeviceStatus.IN_USE, DeviceStatus.MAINTENANCE, DeviceStatus.RETIRED] as (DeviceStatus | 'ALL')[]).map(status => (
              <button key={status} onClick={() => setViewStatus(status)} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${viewStatus === status ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
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
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Usuário</th>
              <th className="px-6 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(d => {
              const { model, brand } = getModelDetails(d.modelId);
              const user = users.find(u => u.id === d.currentUserId);
              const isRet = d.status === DeviceStatus.RETIRED;

              return (
                <tr key={d.id} className={`border-b transition-colors hover:bg-gray-50 ${isRet ? 'opacity-70 bg-gray-50/50' : 'bg-white'}`}>
                  <td className="px-6 py-4">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                          {model?.imageUrl ? <img src={model.imageUrl} className="h-full w-full object-cover" /> : <ImageIcon className="text-slate-300" size={16}/>}
                      </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{model?.name}</div>
                    <div className="text-[10px] text-gray-500 uppercase">{brand?.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-xs">{d.assetTag}</div>
                    <div className="text-[10px] text-gray-400 font-mono">SN: {d.serialNumber}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${d.status === DeviceStatus.AVAILABLE ? 'bg-green-100 text-green-700' : d.status === DeviceStatus.MAINTENANCE ? 'bg-orange-100 text-orange-700' : d.status === DeviceStatus.RETIRED ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'}`}>{d.status}</span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {user ? <div onClick={() => setViewingUser(user)} className="text-emerald-600 hover:underline font-bold cursor-pointer">{user.fullName}</div> : <span className="text-gray-300 italic">Disponível</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                        {isRet ? (
                            <button onClick={() => { setRestoreTargetId(d.id); setRestoreReason(''); setIsRestoreModalOpen(true); }} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors" title="Restaurar Ativo"><RotateCcw size={18}/></button>
                        ) : (
                            <>
                                <button onClick={() => handleOpenModal(d)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors" title="Editar"><Edit2 size={16}/></button>
                                <button onClick={() => { setDeleteTargetId(d.id); setDeleteReason(''); setIsDeleteModalOpen(true); }} className="text-red-400 hover:text-red-600 p-1.5 rounded transition-colors" title="Mover para Descarte"><Trash2 size={16}/></button>
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

      {/* MODAL PRINCIPAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-white">{editingId ? 'Ficha do Ativo' : 'Novo Dispositivo'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="flex border-b bg-gray-50 overflow-x-auto shrink-0">
                <button onClick={() => setActiveTab('GENERAL')} className={`flex-1 py-3 text-xs font-bold uppercase border-b-2 transition-colors ${activeTab === 'GENERAL' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Geral</button>
                <button onClick={() => setActiveTab('FINANCIAL')} className={`flex-1 py-3 text-xs font-bold uppercase border-b-2 transition-colors ${activeTab === 'FINANCIAL' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Financeiro</button>
                <button onClick={() => setActiveTab('MAINTENANCE')} className={`flex-1 py-3 text-xs font-bold uppercase border-b-2 transition-colors ${activeTab === 'MAINTENANCE' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Manutenção</button>
                <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 text-xs font-bold uppercase border-b-2 transition-colors ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Histórico</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'GENERAL' && (
                  <form id="devForm" onSubmit={handleDeviceSubmit} className="grid grid-cols-2 gap-4">
                     <div className="col-span-2">
                         <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Modelo do Equipamento</label>
                         <select required disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm" value={formData.modelId} onChange={e => setFormData({...formData, modelId: e.target.value})}>
                             <option value="">Selecione...</option>
                             {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                         </select>
                     </div>
                     <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Patrimônio / TAG</label><input required disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm" value={formData.assetTag || ''} onChange={e => setFormData({...formData, assetTag: e.target.value})}/></div>
                     <div><label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Serial Number</label><input required disabled={isViewOnly} className="w-full border rounded-lg p-2.5 text-sm" value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value})}/></div>
                  </form>
                )}

                {activeTab === 'MAINTENANCE' && (
                    <div className="space-y-4">
                        {!isViewOnly && (
                             <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 space-y-3">
                                <h5 className="text-xs font-bold text-orange-800 uppercase">Registrar Novo Reparo</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input placeholder="O que foi feito?" className="w-full border rounded p-2 text-sm" value={newMaint.description || ''} onChange={e => setNewMaint({...newMaint, description: e.target.value})}/>
                                    <input type="number" placeholder="Custo (R$)" className="w-full border rounded p-2 text-sm" value={newMaint.cost || ''} onChange={e => setNewMaint({...newMaint, cost: Number(e.target.value)})}/>
                                    <div className="col-span-1 md:col-span-2 flex items-center gap-3">
                                        <label className="flex-1 flex items-center gap-2 bg-white border border-dashed border-gray-300 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                            {isUploadingMaint ? <RefreshCw size={14} className="animate-spin text-orange-500"/> : <Paperclip size={14} className="text-gray-400"/>}
                                            <span className="text-xs font-bold text-gray-500 truncate">{newMaint.invoiceUrl ? 'Nota de Serviço Anexada' : 'Anexar Nota/Arquivo'}</span>
                                            <input type="file" className="hidden" onChange={handleMaintFileChange} />
                                        </label>
                                        <button onClick={saveMaintenance} className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase hover:bg-orange-700 transition-colors">Salvar Registro</button>
                                    </div>
                                </div>
                             </div>
                        )}
                        <div className="space-y-2">
                            {deviceMaintenances.map(m => (
                                <div key={m.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm border-l-4 border-l-orange-400">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-50 rounded text-orange-600"><Wrench size={16}/></div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-800">{m.description}</p>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">{new Date(m.date).toLocaleDateString()} • R$ {m.cost.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {m.invoiceUrl && <a href={m.invoiceUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Ver Anexo"><ExternalLink size={14}/></a>}
                                        {!isViewOnly && <button onClick={() => deleteMaintenance(m.id, adminName)} className="p-2 text-red-300 hover:text-red-600"><Trash2 size={14}/></button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'HISTORY' && (
                    <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 py-2">
                        {getHistory(editingId || '').map(log => (
                            <div key={log.id} className="relative pl-8">
                                <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-sm ${log.action === ActionType.RESTORE ? 'bg-indigo-500' : 'bg-blue-500'}`}></div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">{new Date(log.timestamp).toLocaleString()}</div>
                                <div className="font-bold text-gray-800 text-sm">{log.action}</div>
                                <div className="text-xs text-gray-600 italic">"{log.notes}"</div>
                                <div className="text-[9px] font-black text-gray-400 uppercase mt-1">Admin: {log.adminUser}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t shrink-0">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl bg-gray-200 font-bold text-gray-600 hover:bg-gray-300 transition-colors">Fechar</button>
                {!isViewOnly && activeTab === 'GENERAL' && <button type="submit" form="devForm" className="px-8 py-2 rounded-xl bg-blue-600 text-white font-black uppercase shadow-lg hover:bg-blue-700 transition-all">Salvar</button>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DESCARTE */}
      {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                  <div className="p-6">
                      <div className="flex flex-col items-center text-center mb-4">
                          <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-3"><AlertTriangle size={24} /></div>
                          <h3 className="text-lg font-bold text-gray-900">Mover para Descarte?</h3>
                          <p className="text-sm text-gray-500 mt-1">O ativo será marcado como inativo no inventário.</p>
                      </div>
                      <textarea className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none mb-4" rows={3} placeholder="Motivo do descarte (obrigatório)..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea>
                      <div className="flex gap-3">
                          <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold">Cancelar</button>
                          <button onClick={() => { 
                              deleteDevice(deleteTargetId!, adminName, deleteReason);
                              setIsDeleteModalOpen(false);
                          }} disabled={!deleteReason.trim()} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold disabled:opacity-50">Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE RESTAURAÇÃO */}
      {isRestoreModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                  <div className="p-6">
                      <div className="flex flex-col items-center text-center mb-4">
                          <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-3"><RotateCcw size={24} /></div>
                          <h3 className="text-lg font-bold text-gray-900">Restaurar Ativo?</h3>
                          <p className="text-sm text-gray-500 mt-1">O ativo voltará ao status "Disponível" no estoque.</p>
                      </div>
                      <textarea className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-4" rows={3} placeholder="Por que este ativo está sendo restaurado? (obrigatório)..." value={restoreReason} onChange={(e) => setRestoreReason(e.target.value)}></textarea>
                      <div className="flex gap-3">
                          <button onClick={() => setIsRestoreModalOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold">Cancelar</button>
                          <button onClick={() => { 
                              restoreDevice(restoreTargetId!, adminName, restoreReason);
                              setIsRestoreModalOpen(false);
                          }} disabled={!restoreReason.trim()} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold disabled:opacity-50">Confirmar Restauração</button>
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
