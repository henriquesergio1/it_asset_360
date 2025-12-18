
import React, { useState } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, DeviceStatus, ActionType, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField } from '../types';
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
  const [customFields, setCustomFields] = useState<CustomField[]>([
      { id: 'cf1', name: 'Memória RAM' },
      { id: 'cf2', name: 'Armazenamento' },
      { id: 'cf3', name: 'ID FlexxGPS' },
      { id: 'cf4', name: 'ID Connect Sales' }
  ]);

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

  const clearLogs = () => setLogs([]);

  const restoreItem = (logId: string, adminName: string) => {
      const log = logs.find(l => l.id === logId);
      if (!log || !log.backupData) {
          alert('Dados de backup não encontrados.');
          return;
      }
      try {
          const data = JSON.parse(log.backupData);
          if (log.assetType === 'Device') setDevices(prev => [...prev, data]);
          else if (log.assetType === 'Sim') setSims(prev => [...prev, data]);
          logAction(ActionType.RESTORE, log.assetType, log.assetId, log.targetName || 'Item Restaurado', adminName, `Restaurado via log de auditoria`);
      } catch (e) { console.error(e); }
  };

  const addDevice = (device: Device, adminName: string) => {
    setDevices(prev => [...prev, device]);
    const model = models.find(m => m.id === device.modelId);
    logAction(ActionType.create, 'Device', device.id, model?.name || 'Ativo', adminName, `Tag: ${device.assetTag}`);
  };

  const updateDevice = (device: Device, adminName: string) => {
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
    const model = models.find(m => m.id === device.modelId);
    logAction(ActionType.UPDATE, 'Device', device.id, model?.name || 'Ativo', adminName, 'Atualização de cadastro');
  };

  const deleteDevice = (id: string, adminName: string, reason: string) => {
    const dev = devices.find(d => d.id === id);
    setDevices(prev => prev.filter(d => d.id !== id));
    if (dev) {
        logAction(ActionType.DELETE, 'Device', id, dev.assetTag, adminName, `Motivo Exclusão: ${reason}`, JSON.stringify(dev));
    }
  };

  const restoreDevice = (id: string, adminName: string, reason: string) => {
      setDevices(prev => prev.map(d => d.id === id ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
      const dev = devices.find(d => d.id === id);
      logAction(ActionType.RESTORE, 'Device', id, dev?.assetTag || 'Ativo', adminName, `Restaurado. Motivo: ${reason}`);
  };

  // --- Outros CRUDs (Sugeridos ou Mantidos) ---
  const addSim = (sim: SimCard, adminName: string) => { setSims(prev => [...prev, sim]); logAction(ActionType.create, 'Sim', sim.id, sim.phoneNumber, adminName); };
  const updateSim = (sim: SimCard, adminName: string) => { setSims(prev => prev.map(s => s.id === sim.id ? sim : s)); logAction(ActionType.UPDATE, 'Sim', sim.id, sim.phoneNumber, adminName); };
  const deleteSim = (id: string, adminName: string, reason: string) => { const sim = sims.find(s => s.id === id); setSims(prev => prev.filter(s => s.id !== id)); if (sim) logAction(ActionType.DELETE, 'Sim', id, sim.phoneNumber, adminName, reason, JSON.stringify(sim)); };

  const addUser = (user: User, adminName: string) => { setUsers(prev => [...prev, user]); logAction(ActionType.create, 'User', user.id, user.fullName, adminName); };
  const updateUser = (user: User, adminName: string) => { setUsers(prev => prev.map(u => u.id === user.id ? user : u)); logAction(ActionType.UPDATE, 'User', user.id, user.fullName, adminName); };
  const toggleUserActive = (user: User, adminName: string, reason?: string) => {
    const updatedUser = { ...user, active: !user.active };
    setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    logAction(updatedUser.active ? ActionType.ACTIVATE : ActionType.INACTIVATE, 'User', user.id, user.fullName, adminName, reason);
  };

  const updateSettings = (newSettings: SystemSettings, adminName: string) => { setSettings(newSettings); localStorage.setItem('mock_settings', JSON.stringify(newSettings)); logAction(ActionType.UPDATE, 'System', 'settings', 'Configurações', adminName); };

  const addAssetType = (type: AssetType, adminName: string) => { setAssetTypes(prev => [...prev, type]); logAction(ActionType.create, 'Type', type.id, type.name, adminName); };
  const updateAssetType = (type: AssetType, adminName: string) => { setAssetTypes(prev => prev.map(t => t.id === type.id ? type : t)); };
  const deleteAssetType = (id: string, adminName: string) => { setAssetTypes(prev => prev.filter(t => t.id !== id)); };

  const addBrand = (brand: DeviceBrand, adminName: string) => { setBrands(prev => [...prev, brand]); logAction(ActionType.create, 'Brand', brand.id, brand.name, adminName); };
  const updateBrand = (brand: DeviceBrand, adminName: string) => { setBrands(prev => prev.map(b => b.id === brand.id ? brand : b)); };
  const deleteBrand = (id: string, adminName: string) => { setBrands(prev => prev.filter(b => b.id !== id)); };

  const addModel = (model: DeviceModel, adminName: string) => { setModels(prev => [...prev, model]); logAction(ActionType.create, 'Model', model.id, model.name, adminName); };
  const updateModel = (model: DeviceModel, adminName: string) => { setModels(prev => prev.map(m => m.id === model.id ? model : m)); };
  const deleteModel = (id: string, adminName: string) => { setModels(prev => prev.filter(m => m.id !== id)); };

  const addMaintenance = (record: MaintenanceRecord, adminName: string) => {
    setMaintenances(prev => [...prev, record]);
    logAction(ActionType.MAINTENANCE_START, 'Device', record.deviceId, record.description, adminName, `Custo: R$ ${record.cost}`);
  };
  const deleteMaintenance = (id: string, adminName: string) => { setMaintenances(prev => prev.filter(m => m.id !== id)); };

  const addSector = (sector: UserSector, adminName: string) => { setSectors(prev => [...prev, sector]); };
  const deleteSector = (id: string, adminName: string) => { setSectors(prev => prev.filter(s => s.id !== id)); };

  const addAccessoryType = (type: AccessoryType, adminName: string) => { setAccessoryTypes(prev => [...prev, type]); };
  const updateAccessoryType = (type: AccessoryType, adminName: string) => { setAccessoryTypes(prev => prev.map(t => t.id === type.id ? type : t)); };
  const deleteAccessoryType = (id: string, adminName: string) => { setAccessoryTypes(prev => prev.filter(t => t.id !== id)); };

  const addCustomField = (field: CustomField, adminName: string) => { setCustomFields(prev => [...prev, field]); };
  const deleteCustomField = (id: string, adminName: string) => { setCustomFields(prev => prev.filter(f => f.id !== id)); };

  const addSystemUser = (user: SystemUser, adminName: string) => { setSystemUsers(prev => [...prev, user]); };
  const updateSystemUser = (user: SystemUser, adminName: string) => { setSystemUsers(prev => prev.map(u => u.id === user.id ? user : u)); };
  const deleteSystemUser = (id: string, adminName: string) => { setSystemUsers(prev => prev.filter(u => u.id !== id)); };

  const assignAsset = (assetType: 'Device' | 'Sim', assetId: string, userId: string, notes: string, adminName: string) => {
    if (assetType === 'Device') setDevices(prev => prev.map(d => d.id === assetId ? { ...d, status: DeviceStatus.IN_USE, currentUserId: userId } : d));
    else setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: userId } : s));
    logAction(ActionType.CHECKOUT, assetType, assetId, 'Ativo', adminName, notes);
  };

  const returnAsset = (assetType: 'Device' | 'Sim', assetId: string, notes: string, adminName: string) => {
    if (assetType === 'Device') setDevices(prev => prev.map(d => d.id === assetId ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
    else setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
    logAction(ActionType.CHECKIN, assetType, assetId, 'Ativo', adminName, notes);
  };

  const getHistory = (assetId: string) => logs.filter(l => l.assetId === assetId);

  const value: DataContextType = {
    devices, sims, users, logs, loading: false, error: null, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields,
    addDevice, updateDevice, deleteDevice, restoreDevice,
    addSim, updateSim, deleteSim,
    addUser, updateUser, toggleUserActive,
    addSystemUser, updateSystemUser, deleteSystemUser,
    updateSettings,
    assignAsset, returnAsset, getHistory,
    clearLogs, restoreItem,
    addAssetType, updateAssetType, deleteAssetType,
    addBrand, updateBrand, deleteBrand,
    addModel, updateModel, deleteModel,
    addMaintenance, deleteMaintenance,
    addSector, deleteSector,
    addAccessoryType, updateAccessoryType, deleteAccessoryType,
    addCustomField, deleteCustomField
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
