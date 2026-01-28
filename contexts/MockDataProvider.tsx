
import React, { useState, useEffect } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, DeviceStatus, ActionType, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField } from '../types';
import { mockDevices, mockSims, mockUsers, mockAuditLogs, mockSystemUsers, mockSystemSettings, mockModels, mockBrands, mockAssetTypes, mockMaintenanceRecords, mockSectors, mockAccessoryTypes, mockCustomFields } from '../services/mockService';

const STORAGE_KEY_PREFIX = 'it_asset_360_';

export const MockDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Helper to load from localStorage
  const load = <T,>(key: string, defaultValue: T): T => {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (!stored) return defaultValue;
    try {
      return JSON.parse(stored);
    } catch (e) {
      return defaultValue;
    }
  };

  const [devices, setDevices] = useState<Device[]>(() => load('devices', mockDevices));
  const [sims, setSims] = useState<SimCard[]>(() => load('sims', mockSims));
  const [users, setUsers] = useState<User[]>(() => load('users', mockUsers));
  const [logs, setLogs] = useState<AuditLog[]>(() => load('logs', mockAuditLogs));
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(() => load('systemUsers', mockSystemUsers));
  const [settings, setSettings] = useState<SystemSettings>(() => load('settings', mockSystemSettings));
  
  const [models, setModels] = useState<DeviceModel[]>(() => load('models', mockModels));
  const [brands, setBrands] = useState<DeviceBrand[]>(() => load('brands', mockBrands));
  const [assetTypes, setAssetTypes] = useState<AssetType[]>(() => load('assetTypes', mockAssetTypes));
  const [maintenances, setMaintenances] = useState<MaintenanceRecord[]>(() => load('maintenances', mockMaintenanceRecords));
  const [sectors, setSectors] = useState<UserSector[]>(() => load('sectors', mockSectors));
  const [accessoryTypes, setAccessoryTypes] = useState<AccessoryType[]>(() => load('accessoryTypes', mockAccessoryTypes || []));
  const [customFields, setCustomFields] = useState<CustomField[]>(() => load('customFields', mockCustomFields));

  // Sync state to localStorage whenever it changes
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'devices', JSON.stringify(devices)); }, [devices]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'sims', JSON.stringify(sims)); }, [sims]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'logs', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'systemUsers', JSON.stringify(systemUsers)); }, [systemUsers]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'models', JSON.stringify(models)); }, [models]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'brands', JSON.stringify(brands)); }, [brands]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'assetTypes', JSON.stringify(assetTypes)); }, [assetTypes]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'maintenances', JSON.stringify(maintenances)); }, [maintenances]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'sectors', JSON.stringify(sectors)); }, [sectors]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'accessoryTypes', JSON.stringify(accessoryTypes)); }, [accessoryTypes]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'customFields', JSON.stringify(customFields)); }, [customFields]);

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
      if (!log || !log.backupData) return;
      try {
          const data = JSON.parse(log.backupData);
          if (log.assetType === 'Device') setDevices(prev => [...prev, data]);
          else if (log.assetType === 'Sim') setSims(prev => [...prev, data]);
          logAction(ActionType.RESTORE, log.assetType, log.assetId, log.targetName || 'Item Restaurado', adminName, `Restaurado via log`);
      } catch (e) { console.error(e); }
  };

  // --- CRUD Implementations ---
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
    if (oldDevice && oldDevice.linkedSimId !== device.linkedSimId) {
        if (oldDevice.linkedSimId) setSims(prev => prev.map(s => s.id === oldDevice.linkedSimId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
        if (device.linkedSimId) setSims(prev => prev.map(s => s.id === device.linkedSimId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: device.currentUserId } : s));
    }
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
    const model = models.find(m => m.id === device.modelId);
    logAction(ActionType.UPDATE, 'Device', device.id, model?.name || 'Unknown', adminName, 'Atualização de cadastro');
  };

  const deleteDevice = (id: string, adminName: string, reason: string) => {
    const dev = devices.find(d => d.id === id);
    if (dev?.linkedSimId) setSims(prev => prev.map(s => s.id === dev.linkedSimId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: DeviceStatus.RETIRED, currentUserId: null } : d));
    if (dev) logAction(ActionType.DELETE, 'Device', id, dev.assetTag, adminName, `Motivo: ${reason}`, JSON.stringify(dev));
  };

  const restoreDevice = (id: string, adminName: string, reason: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
    const dev = devices.find(d => d.id === id);
    if (dev) logAction(ActionType.RESTORE, 'Device', id, dev.assetTag, adminName, `Motivo: ${reason}`);
  };

  const addSim = (sim: SimCard, adminName: string) => { setSims(prev => [...prev, sim]); logAction(ActionType.create, 'Sim', sim.id, sim.phoneNumber, adminName); };
  const updateSim = (sim: SimCard, adminName: string) => { setSims(prev => prev.map(s => s.id === sim.id ? sim : s)); logAction(ActionType.UPDATE, 'Sim', sim.id, sim.phoneNumber, adminName); };
  const deleteSim = (id: string, adminName: string, reason: string) => {
    const sim = sims.find(s => s.id === id);
    setSims(prev => prev.filter(s => s.id !== id));
    if (sim) logAction(ActionType.DELETE, 'Sim', id, sim.phoneNumber, adminName, `Motivo: ${reason}`, JSON.stringify(sim));
  };

  const addUser = (user: User, adminName: string) => { setUsers(prev => [...prev, user]); logAction(ActionType.create, 'User', user.id, user.fullName, adminName); };
  const updateUser = (user: User, adminName: string, notes?: string) => { setUsers(prev => prev.map(u => u.id === user.id ? user : u)); logAction(ActionType.UPDATE, 'User', user.id, user.fullName, adminName, notes || 'Edição de cadastro'); };
  const toggleUserActive = (user: User, adminName: string, reason?: string) => {
    const updatedUser = { ...user, active: !user.active };
    setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    logAction(updatedUser.active ? ActionType.ACTIVATE : ActionType.INACTIVATE, 'User', user.id, user.fullName, adminName, reason);
  };

  const updateTermFile = (termId: string, userId: string, fileUrl: string, adminName: string) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: (u.terms || []).map(t => t.id === termId ? { ...t, fileUrl } : t) } : u));
      logAction(ActionType.UPDATE, 'User', userId, 'Termo Assinado', adminName);
  };

  const deleteTermFile = (termId: string, userId: string, reason: string, adminName: string) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: (u.terms || []).map(t => t.id === termId ? { ...t, fileUrl: '' } : t) } : u));
      logAction(ActionType.DELETE, 'User', userId, 'Termo Excluído', adminName, reason);
  };

  const addSector = (sector: UserSector, adminName: string) => { setSectors(prev => [...prev, sector]); logAction(ActionType.create, 'Sector', sector.id, sector.name, adminName); };
  const deleteSector = (id: string, adminName: string) => { setSectors(prev => prev.filter(s => s.id !== id)); logAction(ActionType.DELETE, 'Sector', id, 'Setor', adminName); };
  const addSystemUser = (user: SystemUser, adminName: string) => { setSystemUsers(prev => [...prev, user]); logAction(ActionType.create, 'System', user.id, user.name, adminName); };
  const updateSystemUser = (user: SystemUser, adminName: string) => { setSystemUsers(prev => prev.map(u => u.id === user.id ? user : u)); logAction(ActionType.UPDATE, 'System', user.id, user.name, adminName); };
  const deleteSystemUser = (id: string, adminName: string) => { setSystemUsers(prev => prev.filter(u => u.id !== id)); logAction(ActionType.DELETE, 'System', id, 'Admin User', adminName); };
  const updateSettings = (newSettings: SystemSettings, adminName: string) => { setSettings(newSettings); logAction(ActionType.UPDATE, 'System', 'settings', 'Configurações', adminName); };

  const addAssetType = (type: AssetType, adminName: string) => { setAssetTypes(prev => [...prev, type]); logAction(ActionType.create, 'Type', type.id, type.name, adminName); };
  const updateAssetType = (type: AssetType, adminName: string) => { setAssetTypes(prev => prev.map(t => t.id === type.id ? type : t)); logAction(ActionType.UPDATE, 'Type', type.id, type.name, adminName); };
  const deleteAssetType = (id: string, adminName: string) => { setAssetTypes(prev => prev.filter(t => t.id !== id)); logAction(ActionType.DELETE, 'Type', id, 'Tipo', adminName); };
  const addBrand = (brand: DeviceBrand, adminName: string) => { setBrands(prev => [...prev, brand]); logAction(ActionType.create, 'Brand', brand.id, brand.name, adminName); };
  const updateBrand = (brand: DeviceBrand, adminName: string) => { setBrands(prev => prev.map(b => b.id === brand.id ? brand : b)); logAction(ActionType.UPDATE, 'Brand', brand.id, brand.name, adminName); };
  const deleteBrand = (id: string, adminName: string) => { setBrands(prev => prev.filter(b => b.id !== id)); logAction(ActionType.DELETE, 'Brand', id, 'Marca', adminName); };
  const addModel = (model: DeviceModel, adminName: string) => { setModels(prev => [...prev, model]); logAction(ActionType.create, 'Model', model.id, model.name, adminName); };
  const updateModel = (model: DeviceModel, adminName: string) => { setModels(prev => prev.map(m => m.id === model.id ? model : m)); logAction(ActionType.UPDATE, 'Model', model.id, model.name, adminName); };
  const deleteModel = (id: string, adminName: string) => { setModels(prev => prev.filter(m => m.id !== id)); logAction(ActionType.DELETE, 'Model', id, 'Modelo', adminName); };
  const addAccessoryType = (type: AccessoryType, adminName: string) => { setAccessoryTypes(prev => [...prev, type]); logAction(ActionType.create, 'Accessory', type.id, type.name, adminName); };
  const updateAccessoryType = (type: AccessoryType, adminName: string) => { setAccessoryTypes(prev => prev.map(t => t.id === type.id ? type : t)); logAction(ActionType.UPDATE, 'Accessory', type.id, type.name, adminName); };
  const deleteAccessoryType = (id: string, adminName: string) => { setAccessoryTypes(prev => prev.filter(t => t.id !== id)); logAction(ActionType.DELETE, 'Accessory', id, 'Tipo Acessório', adminName); };
  const addCustomField = (field: CustomField, adminName: string) => { setCustomFields(prev => [...prev, field]); logAction(ActionType.create, 'CustomField', field.id, field.name, adminName); };
  const deleteCustomField = (id: string, adminName: string) => { setCustomFields(prev => prev.filter(f => f.id !== id)); logAction(ActionType.DELETE, 'CustomField', id, 'Campo Personalizado', adminName); };
  const addMaintenance = (record: MaintenanceRecord, adminName: string) => { setMaintenances(prev => [...prev, record]); logAction(ActionType.MAINTENANCE_START, 'Device', record.deviceId, record.description, adminName); };
  const deleteMaintenance = (id: string, adminName: string) => { setMaintenances(prev => prev.filter(m => m.id !== id)); logAction(ActionType.DELETE, 'Device', id, 'Registro Manutenção', adminName); };

  const assignAsset = (assetType: 'Device' | 'Sim', assetId: string, userId: string, notes: string, adminName: string, termFile?: File) => {
    let assetNameForTerm = '';
    if (assetType === 'Device') {
      const dev = devices.find(d => d.id === assetId);
      const user = users.find(u => u.id === userId);
      const model = models.find(m => m.id === dev?.modelId);
      assetNameForTerm = `${model?.name} (${dev?.assetTag})`;
      setDevices(prev => prev.map(d => d.id === assetId ? { ...d, status: DeviceStatus.IN_USE, currentUserId: userId } : d));
      logAction(ActionType.CHECKOUT, 'Device', assetId, 'Ativo', adminName, `Entregue para: ${user?.fullName}`);
    } else {
      const sim = sims.find(s => s.id === assetId);
      const user = users.find(u => u.id === userId);
      assetNameForTerm = `Chip ${sim?.phoneNumber}`;
      setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: userId } : s));
      logAction(ActionType.CHECKOUT, 'Sim', assetId, sim?.phoneNumber || '', adminName, `Entregue para: ${user?.fullName}`);
    }
    const newTerm: Term = { id: Math.random().toString(36).substr(2, 9), userId, type: 'ENTREGA', assetDetails: assetNameForTerm, date: new Date().toISOString(), fileUrl: '' };
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: [...(u.terms || []), newTerm] } : u));
  };

  const returnAsset = (assetType: 'Device' | 'Sim', assetId: string, notes: string, adminName: string) => {
    let userId = '';
    let assetNameForTerm = '';
    if (assetType === 'Device') {
      const dev = devices.find(d => d.id === assetId);
      userId = dev?.currentUserId || '';
      const model = models.find(m => m.id === dev?.modelId);
      assetNameForTerm = `${model?.name} (${dev?.assetTag})`;
      setDevices(prev => prev.map(d => d.id === assetId ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
    } else {
      const sim = sims.find(s => s.id === assetId);
      userId = sim?.currentUserId || '';
      assetNameForTerm = `Chip ${sim?.phoneNumber}`;
      setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
    }
    if (userId) {
        const newTerm: Term = { id: Math.random().toString(36).substr(2, 9), userId, type: 'DEVOLUCAO', assetDetails: assetNameForTerm, date: new Date().toISOString(), fileUrl: '' };
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: [...(u.terms || []), newTerm] } : u));
    }
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
    assignAsset, returnAsset, 
    updateTermFile, deleteTermFile,
    getHistory,
    clearLogs,
    restoreItem,
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
