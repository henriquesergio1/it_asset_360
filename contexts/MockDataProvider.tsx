
import React, { useState } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, DeviceStatus, ActionType, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField, DeviceAccessory } from '../types';
import { mockDevices, mockSims, mockUsers, mockAuditLogs, mockSystemUsers, mockSystemSettings, mockModels, mockBrands, mockAssetTypes, mockMaintenanceRecords, mockSectors, mockAccessoryTypes } from '../services/mockService';

export const MockDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [sims, setSims] = useState<SimCard[]>(mockSims);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [logs, setLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(mockSystemUsers);
  
  const [settings, setSettings] = useState<SystemSettings>(() => {
      const stored = localStorage.getItem('mock_settings');
      return stored ? JSON.parse(stored) : mockSystemSettings;
  });
  
  const [models, setModels] = useState<DeviceModel[]>(mockModels);
  const [brands, setBrands] = useState<DeviceBrand[]>(mockBrands);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>(mockAssetTypes);
  const [maintenances, setMaintenances] = useState<MaintenanceRecord[]>(mockMaintenanceRecords);
  const [sectors, setSectors] = useState<UserSector[]>(mockSectors);
  const [accessoryTypes, setAccessoryTypes] = useState<AccessoryType[]>(mockAccessoryTypes || []);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const logAction = (
    action: ActionType, 
    assetType: 'Device' | 'Sim' | 'User' | 'System' | 'Model' | 'Brand' | 'Type' | 'Sector' | 'Accessory' | 'CustomField', 
    assetId: string, 
    targetName: string, 
    adminName: string, 
    notes?: string,
    backupData?: string
  ) => {
    const newLog: AuditLog = {
      id: Math.random().toString(36).substr(2, 9),
      assetId,
      assetType,
      targetName,
      action,
      timestamp: new Date().toISOString(),
      adminUser: adminName,
      notes,
      backupData
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const clearLogs = () => { setLogs([]); };

  const restoreItem = (logId: string, adminName: string) => {
      const log = logs.find(l => l.id === logId);
      if (!log || !log.backupData) {
          alert('Dados de backup não encontrados para este item.');
          return;
      }
      try {
          const data = JSON.parse(log.backupData);
          if (log.assetType === 'Device') { setDevices(prev => [...prev, data]); } 
          else if (log.assetType === 'Sim') { setSims(prev => [...prev, data]); } 
          else { alert('Restauração automática disponível apenas para Dispositivos e Chips no momento.'); return; }
          logAction(ActionType.RESTORE, log.assetType, log.assetId, log.targetName || 'Item Restaurado', adminName, `Restaurado a partir do log de ${new Date(log.timestamp).toLocaleDateString()}`);
          alert('Item restaurado com sucesso!');
      } catch (e) {
          console.error("Erro ao restaurar", e);
          alert('Erro ao processar dados de backup.');
      }
  };

  const addDevice = (device: Device, adminName: string) => {
    setDevices(prev => [...prev, device]);
    if (device.linkedSimId) {
        setSims(prev => prev.map(s => s.id === device.linkedSimId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: device.currentUserId } : s));
    }
    const model = models.find(m => m.id === device.modelId);
    logAction(ActionType.create, 'Device', device.id, model?.name || 'Unknown', adminName, `Tag: ${device.assetTag}`);
  };

  const updateDevice = (device: Device, adminName: string) => {
    const oldDevice = devices.find(d => d.id === device.id);
    let logNotes = '';
    if (oldDevice && oldDevice.linkedSimId !== device.linkedSimId) {
        if (oldDevice.linkedSimId) { setSims(prev => prev.map(s => s.id === oldDevice.linkedSimId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s)); logNotes += `Chip desvinculado. `; }
        if (device.linkedSimId) {
            const newSim = sims.find(s => s.id === device.linkedSimId);
            setSims(prev => prev.map(s => s.id === device.linkedSimId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: device.currentUserId } : s));
            logNotes += `Chip ${newSim?.phoneNumber} vinculado. `;
        }
    }
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
    const model = models.find(m => m.id === device.modelId);
    logAction(ActionType.UPDATE, 'Device', device.id, model?.name || 'Unknown', adminName, logNotes || 'Atualização de cadastro');
  };

  const deleteDevice = (id: string, adminName: string, reason: string) => {
    const dev = devices.find(d => d.id === id);
    if (dev?.linkedSimId) { setSims(prev => prev.map(s => s.id === dev.linkedSimId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s)); }
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: DeviceStatus.RETIRED, currentUserId: null } : d));
    if (dev) { const backup = JSON.stringify(dev); logAction(ActionType.DELETE, 'Device', id, dev.assetTag, adminName, `Motivo: ${reason}`, backup); }
  };

  const restoreDevice = (id: string, adminName: string, reason: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
    const dev = devices.find(d => d.id === id);
    if (dev) { logAction(ActionType.RESTORE, 'Device', id, dev.assetTag, adminName, `Motivo: ${reason}`); }
  };

  const addSim = (sim: SimCard, adminName: string) => { setSims(prev => [...prev, sim]); logAction(ActionType.create, 'Sim', sim.id, sim.phoneNumber, adminName); };
  const updateSim = (sim: SimCard, adminName: string) => { setSims(prev => prev.map(s => s.id === sim.id ? sim : s)); logAction(ActionType.UPDATE, 'Sim', sim.id, sim.phoneNumber, adminName); };
  const deleteSim = (id: string, adminName: string, reason: string) => {
    const sim = sims.find(s => s.id === id);
    setSims(prev => prev.filter(s => s.id !== id));
    if (sim) { const backup = JSON.stringify(sim); logAction(ActionType.DELETE, 'Sim', id, sim.phoneNumber, adminName, `Motivo: ${reason}`, backup); }
  };

  const addUser = (user: User, adminName: string) => { setUsers(prev => [...prev, user]); logAction(ActionType.create, 'User', user.id, user.fullName, adminName); };
  const updateUser = (user: User, adminName: string, notes?: string) => { setUsers(prev => prev.map(u => u.id === user.id ? user : u)); logAction(ActionType.UPDATE, 'User', user.id, user.fullName, adminName, notes || 'Edição de cadastro'); };
  const toggleUserActive = (user: User, adminName: string, reason?: string) => {
    const updatedUser = { ...user, active: !user.active };
    setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    const action = updatedUser.active ? ActionType.ACTIVATE : ActionType.INACTIVATE;
    let notes = action === ActionType.INACTIVATE ? `Motivo: ${reason || 'Não informado'}` : '';
    logAction(action, 'User', user.id, user.fullName, adminName, notes);
  };

  const updateTermFile = (termId: string, userId: string, fileUrl: string, adminName: string) => {
      setUsers(prev => prev.map(u => {
          if (u.id === userId) {
              const updatedTerms = (u.terms || []).map(t => t.id === termId ? { ...t, fileUrl } : t);
              return { ...u, terms: updatedTerms };
          }
          return u;
      }));
      logAction(ActionType.UPDATE, 'User', userId, 'Termo Assinado', adminName, `Termo ID ${termId} anexado.`);
  };

  const deleteTermFile = (termId: string, userId: string, reason: string, adminName: string) => {
      setUsers(prev => prev.map(u => {
          if (u.id === userId) {
              const updatedTerms = (u.terms || []).map(t => t.id === termId ? { ...t, fileUrl: '' } : t);
              return { ...u, terms: updatedTerms };
          }
          return u;
      }));
      logAction(ActionType.DELETE, 'User', userId, 'Termo Excluído', adminName, `Termo ID ${termId} limpo. Motivo: ${reason}`);
  };

  const addSector = (sector: UserSector, adminName: string) => { setSectors(prev => [...prev, sector]); logAction(ActionType.create, 'Sector', sector.id, sector.name, adminName); };
  const updateSector = (sector: UserSector, adminName: string) => { setSectors(prev => prev.map(s => s.id === sector.id ? sector : s)); logAction(ActionType.UPDATE, 'Sector', sector.id, sector.name, adminName); };
  const deleteSector = (id: string, adminName: string) => {
      const inUseByUsers = users.some(u => u.sectorId === id);
      const inUseByDevices = devices.some(d => d.sectorId === id);
      if (inUseByUsers || inUseByDevices) {
          alert('BLOQUEADO: Este cargo está em uso por colaboradores ou dispositivos. Altere os vínculos antes de excluir.');
          return;
      }
      setSectors(prev => prev.filter(s => s.id !== id));
      logAction(ActionType.DELETE, 'Sector', id, 'Setor', adminName);
  };

  const addSystemUser = (user: SystemUser, adminName: string) => { setSystemUsers(prev => [...prev, user]); logAction(ActionType.create, 'System', user.id, user.name, adminName); };
  const updateSystemUser = (user: SystemUser, adminName: string) => { setSystemUsers(prev => prev.map(u => u.id === user.id ? user : u)); logAction(ActionType.UPDATE, 'System', user.id, user.name, adminName); };
  const deleteSystemUser = (id: string, adminName: string) => {
    const user = systemUsers.find(u => u.id === id);
    setSystemUsers(prev => prev.filter(u => u.id !== id));
    if (user) logAction(ActionType.DELETE, 'System', id, user.name, adminName);
  };

  const updateSettings = (newSettings: SystemSettings, adminName: string) => { setSettings(newSettings); localStorage.setItem('mock_settings', JSON.stringify(newSettings)); logAction(ActionType.UPDATE, 'System', 'settings', 'Configurações', adminName); };

  const addAssetType = (type: AssetType, adminName: string) => { setAssetTypes(prev => [...prev, type]); logAction(ActionType.create, 'Type', type.id, type.name, adminName); };
  const updateAssetType = (type: AssetType, adminName: string) => { setAssetTypes(prev => prev.map(t => t.id === type.id ? type : t)); logAction(ActionType.UPDATE, 'Type', type.id, type.name, adminName); };
  const deleteAssetType = (id: string, adminName: string) => {
    if (models.some(m => m.typeId === id)) return alert('Não é possível excluir: existem modelos de equipamento vinculados a este tipo.');
    setAssetTypes(prev => prev.filter(t => t.id !== id));
    logAction(ActionType.DELETE, 'Type', id, 'Tipo', adminName);
  };

  const addBrand = (brand: DeviceBrand, adminName: string) => { setBrands(prev => [...prev, brand]); logAction(ActionType.create, 'Brand', brand.id, brand.name, adminName); };
  const updateBrand = (brand: DeviceBrand, adminName: string) => { setBrands(prev => prev.map(b => b.id === brand.id ? brand : b)); logAction(ActionType.UPDATE, 'Brand', brand.id, brand.name, adminName); };
  const deleteBrand = (id: string, adminName: string) => {
    if (models.some(m => m.brandId === id)) return alert('Não é possível excluir: existem modelos de equipamento vinculados a esta marca.');
    setBrands(prev => prev.filter(b => b.id !== id));
    logAction(ActionType.DELETE, 'Brand', id, 'Marca', adminName);
  };

  const addModel = (model: DeviceModel, adminName: string) => { setModels(prev => [...prev, model]); logAction(ActionType.create, 'Model', model.id, model.name, adminName); };
  const updateModel = (model: DeviceModel, adminName: string) => { setModels(prev => prev.map(m => m.id === model.id ? model : m)); logAction(ActionType.UPDATE, 'Model', model.id, model.name, adminName); };
  const deleteModel = (id: string, adminName: string) => {
    if (devices.some(d => d.modelId === id)) return alert('Não é possível excluir: existem dispositivos no inventário vinculados a este modelo.');
    setModels(prev => prev.filter(m => m.id !== id));
    logAction(ActionType.DELETE, 'Model', id, 'Modelo', adminName);
  };
  
  const addAccessoryType = (type: AccessoryType, adminName: string) => { setAccessoryTypes(prev => [...prev, type]); logAction(ActionType.create, 'Accessory', type.id, type.name, adminName); };
  const updateAccessoryType = (type: AccessoryType, adminName: string) => { setAccessoryTypes(prev => prev.map(t => t.id === type.id ? type : t)); logAction(ActionType.UPDATE, 'Accessory', type.id, type.name, adminName); };
  const deleteAccessoryType = (id: string, adminName: string) => {
      if (devices.some(d => d.accessories?.some(a => a.accessoryTypeId === id))) return alert('Não é possível excluir: este acessório está sendo utilizado por dispositivos no inventário.');
      setAccessoryTypes(prev => prev.filter(t => t.id !== id));
      logAction(ActionType.DELETE, 'Accessory', id, 'Tipo Acessório', adminName);
  };

  const addCustomField = (field: CustomField, adminName: string) => { setCustomFields(prev => [...prev, field]); logAction(ActionType.create, 'CustomField', field.id, field.name, adminName); };
  const updateCustomField = (field: CustomField, adminName: string) => { setCustomFields(prev => prev.map(f => f.id === field.id ? field : f)); logAction(ActionType.UPDATE, 'CustomField', field.id, field.name, adminName); };
  const deleteCustomField = (id: string, adminName: string) => {
      if (assetTypes.some(t => t.customFieldIds?.includes(id))) return alert('Não é possível excluir: este campo está habilitado em um tipo de ativo.');
      if (devices.some(d => d.customData && d.customData[id])) return alert('Não é possível excluir: este campo possui dados preenchidos em dispositivos do inventário.');
      setCustomFields(prev => prev.filter(f => f.id !== id));
      logAction(ActionType.DELETE, 'CustomField', id, 'Campo Personalizado', adminName);
  };

  const addMaintenance = (record: MaintenanceRecord, adminName: string) => { setMaintenances(prev => [...prev, record]); logAction(ActionType.MAINTENANCE_START, 'Device', record.deviceId, record.description, adminName, `Custo: ${record.cost}`); };
  const deleteMaintenance = (id: string, adminName: string) => { setMaintenances(prev => prev.filter(m => m.id !== id)); logAction(ActionType.DELETE, 'Device', id, 'Registro Manutenção', adminName); };

  const assignAsset = (assetType: 'Device' | 'Sim', assetId: string, userId: string, notes: string, adminName: string, accessories?: DeviceAccessory[]) => {
    let assetNameForTerm = '';
    const user = users.find(u => u.id === userId);

    if (assetType === 'Device') {
      const dev = devices.find(d => d.id === assetId); 
      const model = models.find(m => m.id === dev?.modelId);
      assetNameForTerm = `${model?.name} (${dev?.assetTag})`;
      
      // Atualiza o dispositivo incluindo os acessórios vinculados
      setDevices(prev => prev.map(d => d.id === assetId ? { 
          ...d, 
          status: DeviceStatus.IN_USE, 
          currentUserId: userId,
          accessories: accessories || [] 
      } : d));
      
      const accessoryNames = accessories?.map(a => a.name).join(', ');
      const accessoryNote = accessoryNames ? ` com acessórios: ${accessoryNames}` : '';
      
      if (dev) logAction(ActionType.CHECKOUT, 'Device', assetId, 'Ativo', adminName, `Entregue para: ${user?.fullName}. Obs: ${notes}${accessoryNote}`);
      
      if (dev?.linkedSimId) {
          const linkedSim = sims.find(s => s.id === dev.linkedSimId);
          if (linkedSim) {
              setSims(prev => prev.map(s => s.id === dev.linkedSimId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: userId } : s));
              assetNameForTerm += ` + Chip ${linkedSim.phoneNumber}`;
              logAction(ActionType.CHECKOUT, 'Sim', dev.linkedSimId, 'SIM Vinculado', adminName, `Entregue automaticamente com Ativo ${dev.assetTag} para: ${user?.fullName}`);
          }
      }
      
      if (user) logAction(ActionType.CHECKOUT, 'User', user.id, user.fullName, adminName, `Recebeu: ${assetNameForTerm}. Obs: ${notes}${accessoryNote}`);
    } else {
      const sim = sims.find(s => s.id === assetId);
      assetNameForTerm = `Chip ${sim?.phoneNumber} (${sim?.operator})`;
      setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: userId } : s));
      if (sim) logAction(ActionType.CHECKOUT, 'Sim', assetId, sim.phoneNumber, adminName, `Entregue para: ${user?.fullName}. Obs: ${notes}`);
      if (user) logAction(ActionType.CHECKOUT, 'User', user.id, user.fullName, adminName, `Recebeu: ${assetNameForTerm}. Obs: ${notes}`);
    }

    const newTerm: Term = { id: Math.random().toString(36).substr(2, 9), userId, type: 'ENTREGA', assetDetails: assetNameForTerm, date: new Date().toISOString(), fileUrl: '' };
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: [...(u.terms || []), newTerm] } : u));
  };

  const returnAsset = (assetType: 'Device' | 'Sim', assetId: string, notes: string, adminName: string, returnedChecklist?: Record<string, boolean>) => {
    let userId = ''; let assetNameForTerm = '';
    if (assetType === 'Device') {
      const dev = devices.find(d => d.id === assetId); userId = dev?.currentUserId || ''; 
      const model = models.find(m => m.id === dev?.modelId);
      assetNameForTerm = `${model?.name} (${dev?.assetTag})`; 
      const user = users.find(u => u.id === userId);
      
      // Limpa os acessórios ao retornar o dispositivo
      setDevices(prev => prev.map(d => d.id === assetId ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null, accessories: [] } : d));
      
      let checkStr = '';
      if (returnedChecklist) {
          const items = Object.entries(returnedChecklist).map(([k, v]) => `${k}: ${v ? 'OK' : 'PENDENTE'}`).join(', ');
          checkStr = ` | Conferência: ${items}`;
      }

      logAction(ActionType.CHECKIN, 'Device', assetId, 'Ativo', adminName, `Devolvido por: ${user?.fullName || 'Desconhecido'}. Obs: ${notes}${checkStr}`);
      
      if (dev?.linkedSimId) {
          const linkedSim = sims.find(s => s.id === dev.linkedSimId);
          if (linkedSim) {
              setSims(prev => prev.map(s => s.id === dev.linkedSimId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
              assetNameForTerm += ` + Chip ${linkedSim.phoneNumber}`;
              logAction(ActionType.CHECKIN, 'Sim', dev.linkedSimId, 'SIM Vinculado', adminName, `Devolvido automaticamente com Ativo ${dev.assetTag}`);
          }
      }

      if (user) logAction(ActionType.CHECKIN, 'User', user.id, user.fullName, adminName, `Devolveu: ${assetNameForTerm}. Obs: ${notes}${checkStr}`);
    } else {
      const sim = sims.find(s => s.id === assetId); userId = sim?.currentUserId || ''; assetNameForTerm = `Chip ${sim?.phoneNumber} (${sim?.operator})`;
      const user = users.find(u => u.id === userId); setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
      logAction(ActionType.CHECKIN, 'Sim', assetId, 'Sim', adminName, `Devolvido por: ${user?.fullName || 'Desconhecido'}. Obs: ${notes}`);
      if (user) logAction(ActionType.CHECKIN, 'User', user.id, user.fullName, adminName, `Devolveu: ${assetNameForTerm}. Obs: ${notes}`);
    }
    if (userId) {
        const newTerm: Term = { id: Math.random().toString(36).substr(2, 9), userId, type: 'DEVOLUCAO', assetDetails: assetNameForTerm, date: new Date().toISOString(), fileUrl: '' };
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: [...(u.terms || []), newTerm] } : u));
    }
  };

  const getHistory = (assetId: string) => { return logs.filter(l => l.assetId === assetId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); };

  const value: DataContextType = {
    devices, sims, users, logs, loading: false, error: null, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields,
    addDevice, updateDevice, deleteDevice, restoreDevice, 
    addSim, updateSim, deleteSim,
    addUser, updateUser, toggleUserActive,
    addSystemUser, updateSystemUser, deleteSystemUser,
    updateSettings,
    assignAsset, returnAsset, 
    updateTermFile, deleteTermFile, 
    getHistory,
    clearLogs,
    restoreItem,
    addAssetType, updateAssetType, deleteAssetType,
    addBrand, updateBrand, deleteBrand,
    addModel, updateModel, deleteModel,
    addMaintenance, deleteMaintenance,
    addSector, updateSector, deleteSector,
    addAccessoryType, updateAccessoryType, deleteAccessoryType,
    addCustomField, updateCustomField, deleteCustomField
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
