
import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, DeviceStatus, MaintenanceRecord, MaintenanceType, ActionType, ReturnChecklist, DeviceAccessory, AssetType, CustomField } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, Monitor, Settings, Image as ImageIcon, FileText, Wrench, DollarSign, Paperclip, Link, Unlink, History, ArrowRight, Tablet, Hash, ScanBarcode, ExternalLink, ArrowUpRight, ArrowDownLeft, CheckSquare, Printer, CheckCircle, Plug, X, Layers, Square, Copy, Box, Ban, LayoutGrid, Eye, AlertTriangle, HardDrive, SmartphoneNfc, Sliders, MapPin, Upload } from 'lucide-react';
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

  const filteredDevices = devices.filter(d => {
    if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;
    const { model, brand } = getModelDetails(d.modelId);
    const searchString = `${model?.name} ${brand?.name} ${d.assetTag} ${d.imei || ''} ${d.pulsusId || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const handleAddMaintenance = () => {
    if (!newMaint.description || !newMaint.cost) return;
    const record: MaintenanceRecord = {
        id: Math.random().toString(36).substr(2, 9),
        deviceId: editingId!,
        date: new Date().toISOString(),
        description: newMaint.description!,
        cost: Number(newMaint.cost),
        type: newMaint.type || MaintenanceType.CORRECTIVE,
        provider: newMaint.provider || 'Interno',
        invoiceUrl: newMaint.invoiceUrl
    };
    addMaintenance(record, adminName);
    setNewMaint({ type: MaintenanceType.CORRECTIVE, cost: 0, description: '', provider: '', invoiceUrl: '' });
  };

  const handleOpenModal = (device?: Device, viewOnly: boolean = false) => {
    setActiveTab('GENERAL');
    setIsViewOnly(viewOnly);
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
      setDeleteTargetId(id);
      setDeleteReason('');
      setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
      if (deleteTargetId && deleteReason.trim()) {
          deleteDevice(deleteTargetId, adminName, deleteReason);
          setIsDeleteModalOpen(false);
          setDeleteTargetId(null);
          setDeleteReason('');
      } else {
          alert('Por favor, informe o motivo da exclusão.');
      }
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && formData.id) {
      updateDevice(formData as Device, adminName);
    } else {
      addDevice({ ...formData, id: Math.random().toString(36).substr(2, 9), currentUserId: null } as Device, adminName);
    }
    setIsModalOpen(false);
  };

  const deviceMaintenances = maintenances.filter(m => m.deviceId === editingId);

  const currentModel = models.find(m => m.id === formData.modelId);
  const currentAssetType = assetTypes.find(t => t.id === currentModel?.typeId);
  const relevantFields = currentAssetType?.customFieldIds 
    ? customFields.filter(f => currentAssetType.customFieldIds?.includes(f.id))
    : [];

  const updateCustomData = (fieldId: string, value: string) => {
      setFormData(prev => ({
          ...prev,
          customData: {
              ...(prev.customData || {}),
              [fieldId]: value
          }
      }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventário de Dispositivos</h1>
          <p className="text-gray-500 text-sm">Gerencie computadores, celulares e outros ativos.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsModelSettingsOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50 transition-colors">
            <Settings size={18} /> Configurar Modelos
            </button>
            <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors">
            <Plus size={18} /> Novo Dispositivo
            </button>
        </div>
      </div>

      {/* --- ABAS DE STATUS --- */}
      <div className="flex gap-4 border-b border-gray-200">
          {(['ALL', DeviceStatus.AVAILABLE, DeviceStatus.IN_USE, DeviceStatus.MAINTENANCE] as (DeviceStatus | 'ALL')[]).map(status => (
              <button 
                  key={status}
                  onClick={() => setViewStatus(status)}
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${viewStatus === status ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                  {status === 'ALL' ? 'Todos' : status}
                  <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                      {status === 'ALL' ? devices.length : devices.filter(d => d.status === status).length}
                  </span>
              </button>
          ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
        <input type="text" placeholder="Buscar por tag, imei, modelo ou pulsus..." className="pl-10 w-full border rounded-lg py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-700">
            <tr>
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
              return (
                <tr key={d.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{model?.name}</div>
                    <div className="text-xs text-gray-500">{brand?.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono text-xs font-bold">{d.assetTag}</div>
                    {d.imei && <div className="text-[10px] text-gray-400">IMEI: {d.imei}</div>}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="font-bold">{sec?.name || '-'}</div>
                    <div className="text-gray-500">{d.costCenter || 'S/ Cód'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${d.status === DeviceStatus.AVAILABLE ? 'bg-green-100 text-green-700' : d.status === DeviceStatus.MAINTENANCE ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-800'}`}>{d.status}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-gray-700">{user?.fullName || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                        {d.pulsusId && (
                            <a 
                                href={`https://hub.pulsus.mobi/devices/${d.pulsusId}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-orange-600 hover:bg-orange-50 p-1.5 rounded transition-colors"
                                title="Ver no MDM Pulsus"
                            >
                                <SmartphoneNfc size={16}/>
                            </a>
                        )}
                        <button onClick={() => handleOpenModal(d)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteClick(d.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* --- MODAL DE EXCLUSÃO COM MOTIVO --- */}
      {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                  <div className="p-6">
                      <div className="flex flex-col items-center text-center mb-4">
                          <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-3">
                              <AlertTriangle size={24} />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">Excluir Dispositivo?</h3>
                          <p className="text-sm text-gray-500 mt-1">
                              Esta ação removerá o item do inventário. É obrigatório informar o motivo.
                          </p>
                      </div>
                      
                      <div className="mb-4">
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Motivo da Exclusão</label>
                          <textarea 
                              className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 outline-none" 
                              rows={3} 
                              placeholder="Ex: Sucata, Roubo, Extravio..."
                              value={deleteReason}
                              onChange={(e) => setDeleteReason(e.target.value)}
                          ></textarea>
                      </div>

                      <div className="flex gap-3">
                          <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Cancelar</button>
                          <button 
                              onClick={handleConfirmDelete} 
                              disabled={!deleteReason.trim()}
                              className={`flex-1 py-2 rounded-lg text-white font-bold transition-colors ${!deleteReason.trim() ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                          >
                              Confirmar Exclusão
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-white">{editingId ? 'Editar Dispositivo' : 'Novo Dispositivo'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20}/></button>
            </div>
            
            <div className="flex border-b shrink-0 bg-gray-50">
                {['GENERAL', 'ACCESSORIES', 'FINANCIAL', 'MAINTENANCE', 'HISTORY'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
                        {tab === 'GENERAL' ? 'Geral' : tab === 'ACCESSORIES' ? 'Acessórios' : tab === 'FINANCIAL' ? 'Financeiro' : tab === 'MAINTENANCE' ? 'Manutenção' : 'Histórico'}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'GENERAL' && (
                  <form id="devForm" onSubmit={handleDeviceSubmit} className="grid grid-cols-2 gap-4">
                     <div className="col-span-2">
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modelo do Equipamento</label>
                         <select required className="w-full border rounded-lg p-2.5 bg-gray-50 focus:bg-white transition-colors" value={formData.modelId} onChange={e => setFormData({...formData, modelId: e.target.value})}>
                            <option value="">Selecione o modelo...</option>
                            {models.map(m => <option key={m.id} value={m.id}>{m.name} ({brands.find(b => b.id === m.brandId)?.name})</option>)}
                         </select>
                     </div>

                     <div className="col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                         <div className="flex gap-4">
                             <label className="flex items-center gap-2 text-sm font-bold cursor-pointer"><input type="radio" checked={idType === 'TAG'} onChange={() => setIdType('TAG')} className="text-blue-600"/> Patrimônio</label>
                             <label className="flex items-center gap-2 text-sm font-bold cursor-pointer"><input type="radio" checked={idType === 'IMEI'} onChange={() => setIdType('IMEI')} className="text-blue-600"/> IMEI (Móvel)</label>
                         </div>
                         <input required className="w-full border rounded-lg p-2.5 font-mono text-sm bg-white shadow-sm" placeholder={idType === 'TAG' ? 'TAG-001' : 'IMEI (15 dígitos)'} value={formData.assetTag || ''} onChange={e => setFormData({...formData, assetTag: e.target.value, imei: idType === 'IMEI' ? e.target.value : undefined})} />
                     </div>

                     {relevantFields.length > 0 && (
                         <div className="col-span-2 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-fade-in">
                            <h4 className="col-span-2 text-[10px] font-black uppercase text-gray-400 mb-1 flex items-center gap-2">
                                <Sliders size={12}/> Especificações Técnicas ({currentAssetType?.name})
                            </h4>
                            {relevantFields.map(field => (
                                <div key={field.id}>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{field.name}</label>
                                    <input 
                                        className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={formData.customData?.[field.id] || ''} 
                                        onChange={e => updateCustomData(field.id, e.target.value)}
                                        placeholder={`Informe ${field.name}...`}
                                    />
                                </div>
                            ))}
                         </div>
                     )}

                     <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Número de Série</label><input required className="w-full border rounded-lg p-2 text-sm" value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value})}/></div>
                     <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ID Pulsus (MDM)</label><input className="w-full border rounded-lg p-2 text-sm" value={formData.pulsusId || ''} onChange={e => setFormData({...formData, pulsusId: e.target.value})}/></div>
                     <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Setor Atual do Ativo</label>
                        <select className="w-full border rounded-lg p-2 text-sm" value={formData.sectorId} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                            <option value="">Selecione o setor...</option>
                            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                     </div>
                     <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Centro de Custo / Cód Setor</label><input className="w-full border rounded-lg p-2 text-sm" value={formData.costCenter || ''} onChange={e => setFormData({...formData, costCenter: e.target.value})}/></div>
                  </form>
                )}

                {activeTab === 'FINANCIAL' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data da Compra</label><input type="date" className="w-full border rounded-lg p-2 text-sm" value={formData.purchaseDate || ''} onChange={e => setFormData({...formData, purchaseDate: e.target.value})}/></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Pago (R$)</label><input type="number" step="0.01" className="w-full border rounded-lg p-2 text-sm" value={formData.purchaseCost || 0} onChange={e => setFormData({...formData, purchaseCost: parseFloat(e.target.value)})}/></div>
                        <div className="col-span-2"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fornecedor</label><input className="w-full border rounded-lg p-2 text-sm" value={formData.supplier || ''} onChange={e => setFormData({...formData, supplier: e.target.value})}/></div>
                        <div className="col-span-2"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nota Fiscal (Número)</label><input className="w-full border rounded-lg p-2 text-sm" value={formData.invoiceNumber || ''} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})}/></div>
                    </div>
                )}

                {activeTab === 'MAINTENANCE' && (
                    <div className="space-y-6">
                        <div className="bg-orange-50 p-5 rounded-xl border border-orange-100">
                            <h4 className="font-bold text-orange-900 mb-4 flex items-center gap-2"><Wrench size={18}/> Novo Registro de Manutenção</h4>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold uppercase text-orange-700 mb-1">Descrição do Serviço</label>
                                    <input className="w-full border rounded-lg p-2 text-sm" placeholder="Ex: Troca de Bateria, Manutenção Preventiva..." value={newMaint.description || ''} onChange={e => setNewMaint({...newMaint, description: e.target.value})}/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-orange-700 mb-1">Custo (R$)</label>
                                    <input type="number" className="w-full border rounded-lg p-2 text-sm" value={newMaint.cost} onChange={e => setNewMaint({...newMaint, cost: parseFloat(e.target.value)})}/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-orange-700 mb-1">Prestador</label>
                                    <input className="w-full border rounded-lg p-2 text-sm" placeholder="Assistência XYZ" value={newMaint.provider || ''} onChange={e => setNewMaint({...newMaint, provider: e.target.value})}/>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold uppercase text-orange-700 mb-1">Anexar Nota de Serviço / Comprovante (Opcional)</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <Paperclip className="absolute left-2.5 top-2.5 text-gray-400" size={16}/>
                                            <input className="w-full border rounded-lg pl-9 p-2 text-sm" placeholder="URL da Nota ou Nome do arquivo" value={newMaint.invoiceUrl || ''} onChange={e => setNewMaint({...newMaint, invoiceUrl: e.target.value})}/>
                                        </div>
                                        <label className="bg-white border rounded-lg px-3 flex items-center cursor-pointer hover:bg-orange-100 transition-colors shadow-sm"><Upload size={16} className="text-orange-600"/><input type="file" className="hidden" onChange={e => setNewMaint({...newMaint, invoiceUrl: e.target.files?.[0]?.name})}/></label>
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleAddMaintenance} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 shadow-lg transition-all">Salvar Manutenção</button>
                        </div>
                        <div className="space-y-3">
                            <h5 className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1"><History size={14}/> Histórico de Manutenções</h5>
                            {deviceMaintenances.length === 0 && <p className="text-sm text-gray-400 text-center py-4 italic">Nenhuma manutenção registrada.</p>}
                            {deviceMaintenances.map(m => (
                                <div key={m.id} className="bg-white border p-3 rounded-lg flex justify-between items-center text-sm shadow-sm">
                                    <div className="flex-1">
                                        <div className="font-bold text-gray-800">{m.description}</div>
                                        <div className="text-[10px] text-gray-400 uppercase flex items-center gap-2">
                                            {new Date(m.date).toLocaleDateString()} <span className="h-1 w-1 bg-gray-300 rounded-full"></span> {m.provider}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                        {m.invoiceUrl && (
                                            <button onClick={() => alert('Abrindo anexo: ' + m.invoiceUrl)} className="text-blue-600 flex items-center gap-1 hover:underline" title="Ver Comprovante">
                                                <Paperclip size={14}/> <span className="text-[10px] font-bold">Nota</span>
                                            </button>
                                        )}
                                        <div className="font-bold text-gray-700">R$ {m.cost.toFixed(2)}</div>
                                        <button onClick={() => deleteMaintenance(m.id, adminName)} className="text-red-300 hover:text-red-500"><Trash2 size={16}/></button>
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
                                <div className="absolute -left-[9px] top-1 h-4 w-4 bg-blue-500 rounded-full border-2 border-white shadow-sm"></div>
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
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-lg bg-gray-200 font-bold text-gray-700 hover:bg-gray-300">Fechar</button>
                {['GENERAL', 'FINANCIAL'].includes(activeTab) && <button type="submit" form="devForm" className="px-6 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md">Salvar Alterações</button>}
            </div>
          </div>
        </div>
      )}

      {isModelSettingsOpen && <ModelSettings onClose={() => setIsModelSettingsOpen(false)} />}
    </div>
  );
};

export default DeviceManager;
