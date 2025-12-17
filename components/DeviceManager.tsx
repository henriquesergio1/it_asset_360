
// ... existing imports
import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, DeviceStatus, MaintenanceRecord, MaintenanceType, ActionType, ReturnChecklist, DeviceAccessory } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, Monitor, Settings, Image as ImageIcon, FileText, Wrench, DollarSign, Paperclip, Link, Unlink, History, ArrowRight, Tablet, Hash, ScanBarcode, ExternalLink, ArrowUpRight, ArrowDownLeft, CheckSquare, Printer, CheckCircle, Plug, X, Layers, Square, Copy, Box, Ban, LayoutGrid, Eye, AlertTriangle, HardDrive, SmartphoneNfc, Sliders } from 'lucide-react';
import ModelSettings from './ModelSettings';
import { generateAndPrintTerm } from '../utils/termGenerator';

const DeviceManager = () => {
  const { 
    devices, addDevice, updateDevice, deleteDevice, 
    users, models, brands, assetTypes, sims, sectors, accessoryTypes, customFields,
    maintenances, addMaintenance, deleteMaintenance,
    getHistory, settings,
    assignAsset, returnAsset // Import operations
  } = useData();
  const { user: currentUser } = useAuth();
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [viewStatus, setViewStatus] = useState<DeviceStatus | 'ALL'>('ALL'); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const [isQuickOpOpen, setIsQuickOpOpen] = useState(false); 
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false); 
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // NEW
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null); // NEW
  const [deleteReason, setDeleteReason] = useState(''); // NEW
  
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'ACCESSORIES' | 'FINANCIAL' | 'MAINTENANCE' | 'HISTORY'>('GENERAL');
  
  // Form State
  const [formData, setFormData] = useState<Partial<Device>>({
    status: DeviceStatus.AVAILABLE,
    accessories: [],
    customData: {}
  });

  // Bulk Form State
  const [bulkForm, setBulkForm] = useState<{
      modelId: string;
      sectorId: string;
      status: string;
      costCenter: string;
      accessories: string[]; 
      applyAccessories: boolean; 
  }>({
      modelId: '',
      sectorId: '',
      status: '',
      costCenter: '',
      accessories: [],
      applyAccessories: false
  });
  
  // Quick Operation State
  const [quickOpDevice, setQuickOpDevice] = useState<Device | null>(null);
  const [quickOpType, setQuickOpType] = useState<'CHECKOUT' | 'CHECKIN'>('CHECKOUT');
  const [quickOpUser, setQuickOpUser] = useState('');
  const [quickOpNotes, setQuickOpNotes] = useState('');
  // Checkin Checklist State
  const [checklist, setChecklist] = useState<ReturnChecklist>({});
  const [lastOpSuccess, setLastOpSuccess] = useState(false);

  // ID Type State
  const [idType, setIdType] = useState<'TAG' | 'IMEI'>('TAG');

  // Maintenance Form State
  const [newMaint, setNewMaint] = useState<Partial<MaintenanceRecord>>({ type: MaintenanceType.CORRECTIVE, cost: 0 });

  // Accessory Mgmt
  const [selectedAccType, setSelectedAccType] = useState('');

  const adminName = currentUser?.name || 'Unknown User';

  // --- Helpers ---
  const getModelDetails = (modelId?: string) => {
    const model = models.find(m => m.id === modelId);
    const brand = brands.find(b => b.id === model?.brandId);
    const type = assetTypes.find(t => t.id === model?.typeId);
    return { model, brand, type };
  };

  // --- FILTER LOGIC ---
  const filteredDevices = devices.filter(d => {
    // 1. Status Filter (Tabs)
    if (viewStatus !== 'ALL' && d.status !== viewStatus) return false;

    // 2. Search Filter
    const { model, brand } = getModelDetails(d.modelId);
    const searchString = `${model?.name} ${brand?.name} ${d.assetTag} ${d.imei || ''} ${d.pulsusId || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const countStatus = (status: DeviceStatus) => devices.filter(d => d.status === status).length;

  // --- HANDLERS ---

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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          setSelectedIds(filteredDevices.map(d => d.id));
      } else {
          setSelectedIds([]);
      }
  };

  const handleSelectOne = (id: string) => {
      if (selectedIds.includes(id)) {
          setSelectedIds(prev => prev.filter(item => item !== id));
      } else {
          setSelectedIds(prev => [...prev, id]);
      }
  };

  const handleBulkSubmit = async () => {
      if (!window.confirm(`Tem certeza que deseja alterar ${selectedIds.length} dispositivos? Essa ação não pode ser desfeita.`)) return;

      let skippedStatusCount = 0;

      for (const id of selectedIds) {
          const originalDevice = devices.find(d => d.id === id);
          if (!originalDevice) continue;

          const updatedDevice = { ...originalDevice };

          // Apply changes only if selected/filled
          if (bulkForm.modelId) updatedDevice.modelId = bulkForm.modelId;
          if (bulkForm.sectorId) updatedDevice.sectorId = bulkForm.sectorId;
          if (bulkForm.costCenter) updatedDevice.costCenter = bulkForm.costCenter;
          
          // STATUS LOGIC: Only apply if device is NOT currently assigned to a user
          if (bulkForm.status) {
              if (originalDevice.currentUserId) {
                  // Device is allocated, ignore status change to prevent inconsistency
                  skippedStatusCount++;
              } else {
                  updatedDevice.status = bulkForm.status as DeviceStatus;
              }
          }

          // Handle Accessories (Overwrite mode)
          if (bulkForm.applyAccessories) {
              const newAccessories: DeviceAccessory[] = bulkForm.accessories.map(typeId => {
                  const type = accessoryTypes.find(t => t.id === typeId);
                  return {
                      id: Math.random().toString(36).substr(2, 9),
                      deviceId: id,
                      accessoryTypeId: typeId,
                      name: type?.name || 'Acessório'
                  };
              });
              updatedDevice.accessories = newAccessories;
          }

          await updateDevice(updatedDevice, adminName);
      }

      setIsBulkEditOpen(false);
      setSelectedIds([]);
      
      if (skippedStatusCount > 0) {
          alert(`Alteração em massa concluída!\n\nNota: O status NÃO foi alterado para ${skippedStatusCount} dispositivo(s) pois eles estão atualmente alocados (em uso) por colaboradores.`);
      } else {
          alert('Alteração em massa concluída!');
      }
  };

  const toggleBulkAccessory = (typeId: string) => {
      setBulkForm(prev => {
          const exists = prev.accessories.includes(typeId);
          if (exists) return { ...prev, accessories: prev.accessories.filter(id => id !== typeId) };
          return { ...prev, accessories: [...prev.accessories, typeId] };
      });
  };

  // --- Standard Handlers ---

  const handleOpenModal = (device?: Device, viewOnly: boolean = false) => {
    setActiveTab('GENERAL');
    setIsViewOnly(viewOnly);
    
    if (device) {
      setEditingId(device.id);
      setFormData({ 
          ...device, 
          accessories: device.accessories || [],
          customData: device.customData || {} 
      });
      if (device.imei) {
          setIdType('IMEI');
      } else {
          setIdType('TAG');
      }
    } else {
      setEditingId(null);
      setFormData({ 
        status: DeviceStatus.AVAILABLE, 
        purchaseDate: new Date().toISOString().split('T')[0],
        purchaseCost: 0,
        accessories: [],
        customData: {}
      });
      setIdType('TAG');
    }
    setIsModalOpen(true);
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return; 
    
    if (!formData.modelId) {
        alert('Por favor, selecione o "Modelo do Equipamento" na aba Geral.');
        return;
    }
    if (!formData.assetTag && !formData.imei) {
        alert('Por favor, preencha a "Identificação" (Patrimônio ou IMEI) na aba Geral.');
        return;
    }

    if (idType === 'IMEI') {
        const currentVal = formData.assetTag || '';
        const numericVal = currentVal.replace(/\D/g, '');
        
        if (numericVal.length !== 15) {
            alert('ERRO: Para o tipo IMEI, o campo deve conter exatamente 15 dígitos numéricos.');
            return;
        }

        formData.imei = numericVal;
        formData.assetTag = numericVal; 
    } else {
        formData.imei = undefined;
    }

    if (editingId && formData.id) {
      updateDevice(formData as Device, adminName);
    } else {
      addDevice({ 
        ...formData, 
        id: Math.random().toString(36).substr(2, 9), 
        currentUserId: null 
      } as Device, adminName);
    }
    setIsModalOpen(false);
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;
      if (idType === 'IMEI') {
          val = val.replace(/\D/g, '');
          if (val.length > 15) return;
      }
      setFormData({ ...formData, assetTag: val });
  };

  const handleAddAccessory = () => {
      if (isViewOnly) return;
      if (!selectedAccType) return;
      const accType = accessoryTypes.find(t => t.id === selectedAccType);
      if (!accType) return;

      const newAcc: DeviceAccessory = {
          id: Math.random().toString(36).substr(2,9),
          deviceId: formData.id || '',
          accessoryTypeId: accType.id,
          name: accType.name 
      };

      setFormData(prev => ({
          ...prev,
          accessories: [...(prev.accessories || []), newAcc]
      }));
      setSelectedAccType('');
  };

  const handleRemoveAccessory = (accId: string) => {
      if (isViewOnly) return;
      setFormData(prev => ({
          ...prev,
          accessories: prev.accessories?.filter(a => a.id !== accId)
      }));
  };

  const handleAddMaintenance = () => {
    if (isViewOnly) return;
    if (!newMaint.description || !newMaint.cost) return;
    const record: MaintenanceRecord = {
        id: Math.random().toString(36).substr(2, 9),
        deviceId: editingId!,
        date: new Date().toISOString(),
        description: newMaint.description!,
        cost: Number(newMaint.cost),
        type: newMaint.type || MaintenanceType.CORRECTIVE,
        provider: newMaint.provider || 'Interno'
    };
    addMaintenance(record, adminName);
    setNewMaint({ type: MaintenanceType.CORRECTIVE, cost: 0, description: '', provider: '' });
  };

  const handleOpenQuickOp = (device: Device, type: 'CHECKOUT' | 'CHECKIN') => {
      setQuickOpDevice(device);
      setQuickOpType(type);
      setQuickOpUser('');
      setQuickOpNotes('');
      setLastOpSuccess(false);
      
      if (type === 'CHECKIN') {
          const initialChecklist: ReturnChecklist = {
              'Equipamento Principal': true
          };
          if (device.accessories) {
              device.accessories.forEach(acc => {
                  initialChecklist[acc.name] = true;
              });
          }
          if (device.linkedSimId) {
              initialChecklist['Chip SIM Vinculado'] = true;
          }
          setChecklist(initialChecklist);
      }
      
      setIsQuickOpOpen(true);
  };

  const submitQuickOp = () => {
      if (!quickOpDevice) return;

      if (quickOpType === 'CHECKOUT') {
          if (!quickOpUser) {
              alert('Selecione um usuário.');
              return;
          }
          assignAsset('Device', quickOpDevice.id, quickOpUser, quickOpNotes, adminName);
      } else {
          returnAsset('Device', quickOpDevice.id, quickOpNotes, adminName, undefined, checklist);
      }
      
      setLastOpSuccess(true);
  };

  const handlePrintTerm = () => {
      if (!quickOpDevice) return;

      const user = users.find(u => u.id === (quickOpType === 'CHECKOUT' ? quickOpUser : quickOpDevice.currentUserId));
      const model = models.find(m => m.id === quickOpDevice.modelId);
      const brand = brands.find(b => b.id === model?.brandId);
      const type = assetTypes.find(t => t.id === model?.typeId);
      const linkedSim = sims.find(s => s.id === quickOpDevice.linkedSimId);
      const sectorName = sectors.find(s => s.id === user?.sectorId)?.name;

      if (user) {
          generateAndPrintTerm({
              user,
              asset: quickOpDevice,
              settings,
              model,
              brand,
              type,
              actionType: quickOpType === 'CHECKOUT' ? 'ENTREGA' : 'DEVOLUCAO',
              linkedSim,
              sectorName,
              checklist: quickOpType === 'CHECKIN' ? checklist : undefined,
              notes: quickOpNotes
          });
      }
  };


  const availableSims = sims.filter(s => s.status === DeviceStatus.AVAILABLE || s.id === formData.linkedSimId);
  const deviceMaintenances = maintenances.filter(m => m.deviceId === editingId);
  const totalMaintenanceCost = deviceMaintenances.reduce((acc, curr) => acc + curr.cost, 0);
  const deviceHistory = editingId ? getHistory(editingId) : [];

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

      {/* --- STATUS TABS --- */}
      <div className="flex border-b border-gray-200 overflow-x-auto gap-4 md:gap-0">
          <button 
            onClick={() => { setViewStatus('ALL'); setSelectedIds([]); }} 
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors whitespace-nowrap font-medium text-sm
                ${viewStatus === 'ALL' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <LayoutGrid size={18} /> Todos <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full ml-1">{devices.length}</span>
          </button>
          
          <button 
            onClick={() => { setViewStatus(DeviceStatus.AVAILABLE); setSelectedIds([]); }} 
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors whitespace-nowrap font-medium text-sm
                ${viewStatus === DeviceStatus.AVAILABLE ? 'border-green-500 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <CheckCircle size={18} className={viewStatus === DeviceStatus.AVAILABLE ? 'text-green-500' : ''}/> Disponíveis 
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full ml-1">{countStatus(DeviceStatus.AVAILABLE)}</span>
          </button>

          <button 
            onClick={() => { setViewStatus(DeviceStatus.IN_USE); setSelectedIds([]); }} 
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors whitespace-nowrap font-medium text-sm
                ${viewStatus === DeviceStatus.IN_USE ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <Smartphone size={18} className={viewStatus === DeviceStatus.IN_USE ? 'text-blue-500' : ''}/> Em Uso 
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full ml-1">{countStatus(DeviceStatus.IN_USE)}</span>
          </button>

          <button 
            onClick={() => { setViewStatus(DeviceStatus.MAINTENANCE); setSelectedIds([]); }} 
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors whitespace-nowrap font-medium text-sm
                ${viewStatus === DeviceStatus.MAINTENANCE ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <Wrench size={18} className={viewStatus === DeviceStatus.MAINTENANCE ? 'text-amber-500' : ''}/> Manutenção 
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full ml-1">{countStatus(DeviceStatus.MAINTENANCE)}</span>
          </button>

          <button 
            onClick={() => { setViewStatus(DeviceStatus.RETIRED); setSelectedIds([]); }} 
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors whitespace-nowrap font-medium text-sm
                ${viewStatus === DeviceStatus.RETIRED ? 'border-gray-500 text-gray-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <Ban size={18} className={viewStatus === DeviceStatus.RETIRED ? 'text-gray-500' : ''}/> Descartados 
              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full ml-1">{countStatus(DeviceStatus.RETIRED)}</span>
          </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input 
          type="text" 
          placeholder="Buscar por modelo, marca, patrimônio, IMEI ou Pulsus ID..." 
          className="pl-10 w-full sm:w-96 border border-gray-300 rounded-lg py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-40 flex items-center gap-6 animate-fade-in-up">
              <span className="font-bold">{selectedIds.length} selecionado(s)</span>
              <div className="h-4 w-px bg-slate-600"></div>
              <button onClick={() => { setBulkForm({
                  modelId: '', sectorId: '', status: '', costCenter: '', accessories: [], applyAccessories: false
              }); setIsBulkEditOpen(true); }} className="flex items-center gap-2 hover:text-blue-300 font-medium">
                  <Edit2 size={18} /> Alterar em Massa
              </button>
              <button onClick={() => setSelectedIds([])} className="hover:text-gray-300">
                  <X size={18} />
              </button>
          </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3 w-4">
                    <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        onChange={handleSelectAll}
                        checked={filteredDevices.length > 0 && selectedIds.length === filteredDevices.length}
                    />
                </th>
                <th className="px-6 py-3">Modelo / Imagem</th>
                <th className="px-6 py-3">Identificação</th>
                <th className="px-6 py-3">Localização</th>
                {viewStatus === 'ALL' && <th className="px-6 py-3">Status</th>}
                <th className="px-6 py-3">Usuário Atual</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((device) => {
                const assignedUser = users.find(u => u.id === device.currentUserId);
                const { model, brand, type } = getModelDetails(device.modelId);
                const sectorName = sectors.find(s => s.id === device.sectorId)?.name;
                const isSelected = selectedIds.includes(device.id);

                return (
                  <tr key={device.id} className={`border-b transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50 bg-white'}`}>
                    <td className="px-6 py-4">
                        <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            checked={isSelected}
                            onChange={() => handleSelectOne(device.id)}
                        />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-gray-100 border flex items-center justify-center overflow-hidden shrink-0">
                           {model?.imageUrl ? <img src={model.imageUrl} alt="" className="h-full w-full object-cover"/> : <ImageIcon size={20} className="text-gray-400"/>}
                        </div>
                        <div>
                            <span 
                                onClick={() => handleOpenModal(device, true)}
                                className="font-medium text-gray-900 block cursor-pointer hover:text-blue-600 hover:underline"
                                title="Ver Detalhes do Dispositivo"
                            >
                                {model?.name || 'Modelo Desconhecido'}
                            </span>
                            <span className="text-xs text-gray-400 block">{brand?.name} • {type?.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-1">
                          {device.imei ? (
                              <div className="text-gray-700 flex items-center gap-1">
                                  <Hash size={12}/> <span className="font-mono">{device.imei}</span> (IMEI)
                              </div>
                          ) : (
                              <div className="font-mono text-gray-600 flex items-center gap-1">
                                  <ScanBarcode size={12}/> <span className="font-bold">{device.assetTag}</span>
                              </div>
                          )}
                          <div className="text-gray-500">SN: {device.serialNumber}</div>
                          {device.pulsusId && <div className="text-blue-600 font-medium">ID Pulsus: {device.pulsusId}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="text-xs text-gray-600">
                            {sectorName ? <div className="font-semibold">{sectorName}</div> : '-'}
                            {device.costCenter && <div>Cód: {device.costCenter}</div>}
                        </div>
                    </td>
                    
                    {viewStatus === 'ALL' && (
                        <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold 
                            ${device.status === DeviceStatus.AVAILABLE ? 'bg-green-100 text-green-800' : 
                            device.status === DeviceStatus.IN_USE ? 'bg-blue-100 text-blue-800' : 
                            device.status === DeviceStatus.MAINTENANCE ? 'bg-amber-100 text-amber-800' :
                            'bg-gray-200 text-gray-800'}`}>
                            {device.status}
                        </span>
                        </td>
                    )}

                    <td className="px-6 py-4">
                      {assignedUser ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                            {assignedUser.fullName.charAt(0)}
                          </div>
                          <span className="truncate max-w-[100px]">{assignedUser.fullName}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Shortcut Buttons */}
                        {device.status === DeviceStatus.AVAILABLE && (
                            <button 
                                onClick={() => handleOpenQuickOp(device, 'CHECKOUT')}
                                className="text-green-600 hover:bg-green-50 p-1.5 rounded transition-colors"
                                title="Realizar Entrega"
                            >
                                <ArrowUpRight size={18} />
                            </button>
                        )}
                        {device.status === DeviceStatus.IN_USE && (
                            <button 
                                onClick={() => handleOpenQuickOp(device, 'CHECKIN')}
                                className="text-orange-600 hover:bg-orange-50 p-1.5 rounded transition-colors"
                                title="Realizar Devolução"
                            >
                                <ArrowDownLeft size={18} />
                            </button>
                        )}
                        
                        <div className="w-px h-4 bg-gray-300 mx-1"></div>

                        {device.pulsusId && (
                            <a 
                                href={`https://app.pulsus.mobi/devices/${device.pulsusId}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-purple-600 hover:bg-purple-50 p-1 rounded transition-colors"
                                title="Abrir no MDM Pulsus"
                            >
                                <ExternalLink size={16} />
                            </a>
                        )}
                        <button onClick={() => handleOpenModal(device)} className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors" title="Editar"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteClick(device.id)} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors" title="Excluir"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredDevices.length === 0 && (
            <div className="p-8 text-center text-gray-400">Nenhum dispositivo encontrado.</div>
          )}
        </div>
      </div>

      {/* === DELETE CONFIRMATION MODAL === */}
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
                              className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" 
                              rows={3} 
                              placeholder="Ex: Quebra total, venda, furto..."
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

      {/* === BULK EDIT MODAL === */}
      {isBulkEditOpen && (
          // ... (Existing Bulk Edit Modal Code - No changes needed)
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
                  <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Layers size={20}/> Edição em Massa ({selectedIds.length})
                      </h3>
                      <button onClick={() => setIsBulkEditOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                  </div>
                  
                  <div className="p-6 max-h-[80vh] overflow-y-auto">
                      <p className="text-sm text-gray-500 mb-4 bg-blue-50 p-3 rounded border border-blue-100">
                          <strong>Atenção:</strong> Os campos deixados em branco (ou não selecionados) <u>não serão alterados</u> nos dispositivos. Apenas os valores preenchidos serão aplicados.
                      </p>

                      <div className="space-y-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo (Aplica a todos)</label>
                              <select className="w-full border rounded-lg p-2" value={bulkForm.modelId} onChange={e => setBulkForm({...bulkForm, modelId: e.target.value})}>
                                  <option value="">(Não alterar modelo)</option>
                                  {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
                                  <select className="w-full border rounded-lg p-2" value={bulkForm.sectorId} onChange={e => setBulkForm({...bulkForm, sectorId: e.target.value})}>
                                      <option value="">(Não alterar)</option>
                                      {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Custo</label>
                                  <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2" 
                                    placeholder="(Não alterar)"
                                    value={bulkForm.costCenter}
                                    onChange={e => setBulkForm({...bulkForm, costCenter: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                              <select className="w-full border rounded-lg p-2" value={bulkForm.status} onChange={e => setBulkForm({...bulkForm, status: e.target.value})}>
                                  <option value="">(Não alterar status)</option>
                                  {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <p className="text-xs text-orange-600 mt-1">Nota: O status não será alterado para dispositivos que já estejam alocados a usuários.</p>
                          </div>

                          <div className="pt-2 border-t">
                              <div className="flex justify-between items-center mb-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={bulkForm.applyAccessories} 
                                        onChange={e => setBulkForm({...bulkForm, applyAccessories: e.target.checked})} 
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm font-bold text-gray-700">Sobrescrever Acessórios</span>
                                  </label>
                              </div>
                              
                              {bulkForm.applyAccessories && (
                                  <div className="bg-gray-50 p-3 rounded-lg border max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
                                      {accessoryTypes.map(type => (
                                          <label key={type.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded">
                                              <input 
                                                type="checkbox" 
                                                checked={bulkForm.accessories.includes(type.id)}
                                                onChange={() => toggleBulkAccessory(type.id)}
                                                className="rounded text-blue-600"
                                              />
                                              <span className="text-sm text-gray-700">{type.name}</span>
                                          </label>
                                      ))}
                                      {accessoryTypes.length === 0 && <span className="text-xs text-gray-400">Nenhum tipo cadastrado.</span>}
                                  </div>
                              )}
                              {bulkForm.applyAccessories && (
                                  <p className="text-xs text-red-500 mt-1">Atenção: Os acessórios atuais serão removidos e substituídos pela seleção acima.</p>
                              )}
                          </div>
                      </div>

                      <div className="mt-6 flex gap-3">
                          <button onClick={() => setIsBulkEditOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
                          <button onClick={handleBulkSubmit} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">Aplicar Alterações</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* === QUICK OPERATION MODAL === */}
      {isQuickOpOpen && quickOpDevice && (
          // ... (Existing Quick Op Modal Code - No changes needed)
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
                  <div className={`px-6 py-4 flex justify-between items-center ${quickOpType === 'CHECKOUT' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          {quickOpType === 'CHECKOUT' ? <ArrowUpRight size={20}/> : <ArrowDownLeft size={20}/>}
                          {quickOpType === 'CHECKOUT' ? 'Entrega de Equipamento' : 'Devolução de Equipamento'}
                      </h3>
                      <button onClick={() => setIsQuickOpOpen(false)} className="text-white/80 hover:text-white"><X size={20}/></button>
                  </div>

                  {!lastOpSuccess ? (
                      <div className="p-6 space-y-4">
                          <div className="bg-gray-50 p-3 rounded-lg border text-sm">
                              <p className="font-bold text-gray-800">{models.find(m => m.id === quickOpDevice.modelId)?.name}</p>
                              <p className="text-gray-500">Tag: {quickOpDevice.assetTag} | SN: {quickOpDevice.serialNumber}</p>
                              {/* Show Accessories */}
                              {quickOpDevice.accessories && quickOpDevice.accessories.length > 0 && (
                                  <div className="mt-2 pt-2 border-t text-xs text-gray-600">
                                      <strong>Acessórios:</strong> {quickOpDevice.accessories.map(a => a.name).join(', ')}
                                  </div>
                              )}
                          </div>

                          {/* CHECKOUT FORM */}
                          {quickOpType === 'CHECKOUT' && (
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Selecione o Usuário</label>
                                  <select 
                                      className="w-full border rounded-lg p-2.5 bg-white"
                                      value={quickOpUser}
                                      onChange={(e) => setQuickOpUser(e.target.value)}
                                  >
                                      <option value="">Selecione...</option>
                                      {users.filter(u => u.active).map(u => (
                                          <option key={u.id} value={u.id}>{u.fullName} - {sectors.find(s => s.id === u.sectorId)?.name}</option>
                                      ))}
                                  </select>
                              </div>
                          )}

                          {/* CHECKIN CHECKLIST */}
                          {quickOpType === 'CHECKIN' && (
                              <div className="space-y-3">
                                  <label className="block text-sm font-bold text-gray-800 flex items-center gap-2">
                                      <CheckSquare size={16}/> Checklist de Devolução
                                  </label>
                                  <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                                      {/* Dynamic Checklist Items */}
                                      {Object.keys(checklist).map(itemKey => (
                                          <label key={itemKey} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                              <input 
                                                type="checkbox" 
                                                checked={checklist[itemKey]} 
                                                onChange={e => setChecklist(prev => ({...prev, [itemKey]: e.target.checked}))} 
                                                className="rounded text-blue-600"
                                              />
                                              <span className="text-sm truncate" title={itemKey}>{itemKey}</span>
                                          </label>
                                      ))}
                                  </div>
                                  {!checklist['Equipamento Principal'] && (
                                      <p className="text-xs text-red-600 font-bold mt-2">Atenção: O aparelho principal não foi marcado. O termo indicará pendência.</p>
                                  )}
                              </div>
                          )}

                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                              <textarea 
                                  className="w-full border rounded-lg p-2" 
                                  rows={2} 
                                  placeholder="Detalhes adicionais..."
                                  value={quickOpNotes}
                                  onChange={e => setQuickOpNotes(e.target.value)}
                              />
                          </div>

                          <div className="pt-2">
                              <button 
                                  onClick={submitQuickOp} 
                                  className={`w-full py-3 rounded-lg text-white font-bold shadow-md transition-colors ${quickOpType === 'CHECKOUT' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                              >
                                  Confirmar {quickOpType === 'CHECKOUT' ? 'Entrega' : 'Devolução'}
                              </button>
                          </div>
                      </div>
                  ) : (
                      // SUCCESS STATE WITH PRINT BUTTON
                      <div className="p-8 flex flex-col items-center text-center space-y-6">
                          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                              <CheckCircle size={40} />
                          </div>
                          <div>
                              <h3 className="text-xl font-bold text-gray-800">Operação Realizada!</h3>
                              <p className="text-gray-500 mt-1">O status do dispositivo foi atualizado.</p>
                          </div>
                          
                          <button 
                              onClick={handlePrintTerm}
                              className="w-full flex items-center justify-center gap-3 bg-slate-800 text-white py-4 rounded-xl hover:bg-slate-700 transition-all shadow-lg group"
                          >
                              <Printer size={24} className="group-hover:scale-110 transition-transform"/>
                              <div className="text-left">
                                  <span className="block text-xs text-gray-400 uppercase font-bold">Documentação</span>
                                  <span className="block font-bold text-lg">Imprimir Termo de {quickOpType === 'CHECKOUT' ? 'Entrega' : 'Devolução'}</span>
                              </div>
                          </button>

                          <button onClick={() => setIsQuickOpOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm underline">
                              Fechar Janela
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* === MAIN DEVICE MODAL (EXISTING) === */}
      {isModalOpen && (
        // ... (Existing Main Modal Code - No changes needed)
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-white">
                  {editingId ? (isViewOnly ? 'Detalhes do Dispositivo' : 'Editar Dispositivo') : 'Novo Dispositivo'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>

            {/* Tabs Header */}
            <div className="flex border-b shrink-0 overflow-x-auto">
                <button onClick={() => setActiveTab('GENERAL')} className={`flex-1 min-w-[100px] py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'GENERAL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Geral</button>
                <button onClick={() => setActiveTab('ACCESSORIES')} className={`flex-1 min-w-[100px] py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'ACCESSORIES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Acessórios ({formData.accessories?.length || 0})</button>
                <button onClick={() => setActiveTab('FINANCIAL')} className={`flex-1 min-w-[100px] py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'FINANCIAL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Financeiro</button>
                {editingId && (
                    <>
                        <button onClick={() => setActiveTab('MAINTENANCE')} className={`flex-1 min-w-[100px] py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'MAINTENANCE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Manutenções ({deviceMaintenances.length})</button>
                        <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 min-w-[100px] py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Histórico</button>
                    </>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
                {/* ... (Existing Tabs Content) ... */}
                {/* --- TAB: GENERAL --- */}
                {activeTab === 'GENERAL' && (
                    <form id="deviceForm" onSubmit={handleDeviceSubmit} className="space-y-4">
                        <div className="flex items-start gap-4 mb-4 p-4 bg-gray-50 rounded-lg border">
                           {formData.modelId && (
                               <div className="h-24 w-24 bg-white rounded border flex items-center justify-center overflow-hidden shrink-0">
                                   {models.find(m => m.id === formData.modelId)?.imageUrl ? 
                                     <img src={models.find(m => m.id === formData.modelId)?.imageUrl} className="h-full w-full object-cover" /> :
                                     <ImageIcon className="text-gray-300" />
                                   }
                               </div>
                           )}
                           <div className="flex-1">
                               <label className="block text-sm font-medium text-gray-700 mb-1">Modelo do Equipamento</label>
                               <select required disabled={isViewOnly} className="w-full border rounded-lg p-2" value={formData.modelId || ''} onChange={e => setFormData({...formData,modelId: e.target.value})}>
                                   <option value="">Selecione o Modelo...</option>
                                   {models.map(m => (
                                       <option key={m.id} value={m.id}>{m.name} ({brands.find(b => b.id === m.brandId)?.name})</option>
                                   ))}
                               </select>
                               {!isViewOnly && <p className="text-xs text-gray-500 mt-1">Configure novos modelos no menu "Configurar Modelos".</p>}
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* CAMPO DE IDENTIFICAÇÃO UNIFICADO */}
                            <div className="col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tipo de Identificação</label>
                                <div className="flex gap-4 mb-3">
                                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded border hover:border-blue-400 transition-colors">
                                        <input type="radio" name="idType" disabled={isViewOnly} checked={idType === 'TAG'} onChange={() => setIdType('TAG')} className="text-blue-600 focus:ring-blue-500" />
                                        <span className="text-sm font-medium text-gray-700">Hostname / Tag (Patrimônio)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded border hover:border-blue-400 transition-colors">
                                        <input type="radio" name="idType" disabled={isViewOnly} checked={idType === 'IMEI'} onChange={() => setIdType('IMEI')} className="text-blue-600 focus:ring-blue-500" />
                                        <span className="text-sm font-medium text-gray-700">IMEI (Dispositivo Móvel)</span>
                                    </label>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-800 mb-1">
                                        {idType === 'IMEI' ? 'Número do IMEI (15 dígitos)' : 'Código do Patrimônio / Hostname'}
                                    </label>
                                    <input 
                                        required 
                                        disabled={isViewOnly}
                                        type="text" 
                                        className="w-full border rounded-lg p-2 font-mono text-gray-800" 
                                        value={formData.assetTag || ''} 
                                        onChange={handleIdChange}
                                        maxLength={idType === 'IMEI' ? 15 : undefined}
                                        placeholder={idType === 'IMEI' ? 'Ex: 356988012345678' : 'Ex: NOTE-TI-001'}
                                    />
                                    {idType === 'IMEI' && !isViewOnly && (
                                        <p className="text-xs text-blue-600 mt-1">O campo aceita apenas números.</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Série (SN)</label>
                                <input required disabled={isViewOnly} type="text" className="w-full border rounded-lg p-2" value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value})} />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                    <Tablet size={14}/> ID Pulsus (MDM)
                                </label>
                                <input type="text" disabled={isViewOnly} className="w-full border rounded-lg p-2" value={formData.pulsusId || ''} onChange={e => setFormData({...formData, pulsusId: e.target.value})} placeholder="Ex: 10293" />
                            </div>

                            {/* --- CONDITIONAL FIELDS BLOCK (DYNAMIC) --- */}
                            {formData.modelId && (() => {
                                const m = models.find(x => x.id === formData.modelId);
                                const t = assetTypes.find(x => x.id === m?.typeId);
                                
                                // Se o AssetType tem campos personalizados configurados
                                if (t?.customFieldIds && t.customFieldIds.length > 0) {
                                    return (
                                        <div className="col-span-2 grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2">
                                            <div className="col-span-2">
                                                <h5 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Sliders size={12}/> Campos Personalizados ({t.name})</h5>
                                            </div>
                                            {t.customFieldIds.map(fid => {
                                                const fieldDef = customFields.find(f => f.id === fid);
                                                if (!fieldDef) return null;
                                                return (
                                                    <div key={fid}>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{fieldDef.name}</label>
                                                        <input 
                                                            disabled={isViewOnly}
                                                            type="text" 
                                                            className="w-full border rounded-lg p-2"
                                                            value={formData.customData?.[fid] || ''} 
                                                            onChange={e => setFormData({
                                                                ...formData, 
                                                                customData: {
                                                                    ...formData.customData,
                                                                    [fid]: e.target.value
                                                                }
                                                            })} 
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            {/* --- END CONDITIONAL BLOCK --- */}

                            <div className="col-span-2 border-t pt-2 mt-2">
                                <h4 className="text-sm font-bold text-gray-700 mb-2">Localização & Setor do Ativo</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Setor do Equipamento</label>
                                        <select disabled={isViewOnly} className="w-full border rounded-lg p-2" value={formData.sectorId || ''} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                                            <option value="">Selecione o setor...</option>
                                            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Código do Setor (Centro de Custo)</label>
                                        <input type="text" disabled={isViewOnly} className="w-full border rounded-lg p-2" value={formData.costCenter || ''} onChange={e => setFormData({...formData, costCenter: e.target.value})} placeholder="Ex: CC-1020" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select disabled={isViewOnly} className="w-full border rounded-lg p-2" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as DeviceStatus})}>
                                    {Object.values(DeviceStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            
                            {/* SIM Link Logic */}
                            {formData.modelId && (() => {
                                const m = models.find(x => x.id === formData.modelId);
                                const t = assetTypes.find(x => x.id === m?.typeId);
                                // Simples verificação por nome para manter retrocompatibilidade visual rápida, 
                                // mas idealmente poderia ser um campo personalizado do tipo "Suporta SIM"
                                const isMobile = t?.name.toLowerCase().includes('phone') || t?.name.toLowerCase().includes('celular') || t?.name.toLowerCase().includes('tablet');
                                
                                if (isMobile) {
                                    return (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                                <Link size={14}/> Vincular Chip (SIM)
                                            </label>
                                            <select 
                                                disabled={isViewOnly}
                                                className="w-full border rounded-lg p-2"
                                                value={formData.linkedSimId || ''}
                                                onChange={e => setFormData({...formData, linkedSimId: e.target.value || null})}
                                            >
                                                <option value="">Sem chip vinculado</option>
                                                {availableSims.map(s => (
                                                    <option key={s.id} value={s.id}>{s.phoneNumber} ({s.operator})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )
                                }
                                return null;
                            })()}
                        </div>
                    </form>
                )}

                {/* --- TAB: ACCESSORIES (NEW) --- */}
                {activeTab === 'ACCESSORIES' && (
                    <div className="space-y-6">
                        {!isViewOnly && (
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                                <h4 className="font-bold text-blue-900 mb-2">Adicionar Acessório</h4>
                                <div className="flex gap-2">
                                    <select className="flex-1 border rounded-lg p-2" value={selectedAccType} onChange={e => setSelectedAccType(e.target.value)}>
                                        <option value="">Selecione o tipo...</option>
                                        {accessoryTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    <button type="button" onClick={handleAddAccessory} className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700"><Plus/></button>
                                </div>
                                <p className="text-xs text-blue-600 mt-2">Use o menu "Configurar Modelos" para cadastrar novos tipos de acessórios.</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            {formData.accessories && formData.accessories.length > 0 ? (
                                formData.accessories.map((acc, index) => (
                                    <div key={index} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <Plug size={18} className="text-gray-400"/>
                                            <span className="font-medium text-gray-800">{acc.name}</span>
                                        </div>
                                        {!isViewOnly && <button type="button" onClick={() => handleRemoveAccessory(acc.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>}
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 text-center py-4">Nenhum acessório vinculado a este dispositivo.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* --- TAB: FINANCIAL --- */}
                {activeTab === 'FINANCIAL' && (
                     <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data da Compra</label>
                                <input disabled={isViewOnly} type="date" className="w-full border rounded-lg p-2" value={formData.purchaseDate || ''} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Valor Pago (R$)</label>
                                <input disabled={isViewOnly} type="number" step="0.01" className="w-full border rounded-lg p-2" value={formData.purchaseCost || 0} onChange={e => setFormData({...formData, purchaseCost: parseFloat(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                                <input disabled={isViewOnly} type="text" className="w-full border rounded-lg p-2" value={formData.supplier || ''} onChange={e => setFormData({...formData, supplier: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nota Fiscal (Nº)</label>
                                <input disabled={isViewOnly} type="text" className="w-full border rounded-lg p-2" value={formData.invoiceNumber || ''} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} />
                            </div>
                        </div>
                        
                        {!isViewOnly && (
                            <div className="border-t pt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Anexo da Nota Fiscal</label>
                                <div className="flex items-center gap-3">
                                    <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
                                        <Paperclip size={16}/> Anexar Arquivo
                                        <input type="file" className="hidden" onChange={() => alert('Em breve')} />
                                    </label>
                                    <span className="text-xs text-gray-400">PDF ou Imagem (Máx 5MB)</span>
                                </div>
                            </div>
                        )}
                     </div>
                )}

                {/* --- TAB: MAINTENANCE --- */}
                {activeTab === 'MAINTENANCE' && (
                    <div className="space-y-6">
                        {/* New Maintenance Form */}
                        {!isViewOnly && (
                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                                <h4 className="font-bold text-orange-900 mb-3 text-sm">Registrar Nova Manutenção</h4>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-orange-800 mb-1">Tipo</label>
                                        <select className="w-full border rounded p-2 text-sm" value={newMaint.type} onChange={e => setNewMaint({...newMaint, type: e.target.value as MaintenanceType})}>
                                            <option value={MaintenanceType.CORRECTIVE}>Corretiva</option>
                                            <option value={MaintenanceType.PREVENTIVE}>Preventiva</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-orange-800 mb-1">Custo (R$)</label>
                                        <input type="number" step="0.01" className="w-full border rounded p-2 text-sm" value={newMaint.cost} onChange={e => setNewMaint({...newMaint, cost: parseFloat(e.target.value)})}/>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-orange-800 mb-1">Descrição do Serviço</label>
                                        <input type="text" className="w-full border rounded p-2 text-sm" placeholder="Ex: Troca de Tela" value={newMaint.description || ''} onChange={e => setNewMaint({...newMaint, description: e.target.value})}/>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-orange-800 mb-1">Prestador de Serviço</label>
                                        <input type="text" className="w-full border rounded p-2 text-sm" placeholder="Nome da Assistência" value={newMaint.provider || ''} onChange={e => setNewMaint({...newMaint, provider: e.target.value})}/>
                                    </div>
                                </div>
                                <button type="button" onClick={handleAddMaintenance} className="w-full bg-orange-600 text-white py-2 rounded text-sm font-bold hover:bg-orange-700">Adicionar Registro</button>
                            </div>
                        )}

                        {/* List */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-gray-700 text-sm">Histórico de Manutenções</h4>
                            {deviceMaintenances.length === 0 && <p className="text-gray-400 text-sm">Nenhum registro encontrado.</p>}
                            {deviceMaintenances.map(m => (
                                <div key={m.id} className="bg-white border p-3 rounded-lg text-sm flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-gray-800">{m.description}</div>
                                        <div className="text-gray-500 text-xs">{new Date(m.date).toLocaleDateString()} • {m.provider}</div>
                                        <div className="mt-1 inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{m.type}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-gray-900">R$ {m.cost.toFixed(2)}</div>
                                        {!isViewOnly && <button type="button" onClick={() => deleteMaintenance(m.id, adminName)} className="text-red-500 text-xs hover:underline mt-2">Excluir</button>}
                                    </div>
                                </div>
                            ))}
                            {deviceMaintenances.length > 0 && (
                                <div className="pt-2 border-t flex justify-between items-center">
                                    <span className="font-bold text-gray-700">Custo Total:</span>
                                    <span className="font-bold text-xl text-gray-900">R$ {totalMaintenanceCost.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- TAB: HISTORY --- */}
                {activeTab === 'HISTORY' && (
                    <div className="space-y-4">
                        <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                            {deviceHistory.map((log) => (
                                <div key={log.id} className="relative pl-6">
                                    <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white
                                        ${log.action === ActionType.CHECKOUT ? 'bg-blue-500' : 
                                          log.action === ActionType.CHECKIN ? 'bg-green-500' :
                                          log.action === ActionType.MAINTENANCE_START ? 'bg-orange-500' :
                                          'bg-gray-400'
                                        }`}></div>
                                    
                                    <div>
                                        <span className="text-xs font-semibold text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                                        <h5 className="font-bold text-gray-900 text-sm">{log.action}</h5>
                                        <p className="text-sm text-gray-600">{log.notes || 'Sem detalhes.'}</p>
                                        <div className="text-xs text-gray-400 mt-1">Admin: {log.adminUser}</div>
                                    </div>
                                </div>
                            ))}
                            {deviceHistory.length === 0 && <p className="text-gray-400 pl-6">Sem histórico registrado.</p>}
                        </div>
                    </div>
                )}

            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">Fechar</button>
                {!isViewOnly && ['GENERAL', 'ACCESSORIES', 'FINANCIAL'].includes(activeTab) && (
                    <button 
                        type={activeTab === 'GENERAL' ? "submit" : "button"} 
                        form={activeTab === 'GENERAL' ? "deviceForm" : undefined}
                        onClick={activeTab === 'GENERAL' ? undefined : handleDeviceSubmit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        {editingId ? 'Salvar Alterações' : 'Cadastrar Dispositivo'}
                    </button>
                )}
            </div>
          </div>
        </div>
      )}
      
      {/* Model Settings Modal */}
      {isModelSettingsOpen && <ModelSettings onClose={() => setIsModelSettingsOpen(false)} />}
    </div>
  );
};

export default DeviceManager;
