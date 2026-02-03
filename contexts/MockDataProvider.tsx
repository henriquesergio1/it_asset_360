
import React, { useState } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, DeviceStatus, ActionType, SystemUser, SystemRole, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField, DeviceAccessory, SoftwareAccount, AccountType } from '../types';
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
  const [accounts, setAccounts] = useState<SoftwareAccount[]>([]);

  const logAction = (
    action: ActionType, 
    assetType: 'Device' | 'Sim' | 'User' | 'System' | 'Model' | 'Brand' | 'Type' | 'Sector' | 'Accessory' | 'CustomField' | 'Account', 
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
          else { alert('Restauração disponível apenas para Dispositivos e Chips no momento.'); return; }
          logAction(ActionType.RESTORE, log.assetType, log.assetId, log.targetName || 'Item Restaurado', adminName, `Restaurado a partir do log.`);
          alert('Item restaurado com sucesso!');
      } catch (e) {
          alert('Erro ao processar dados de backup.');
      }
  };

  const addDevice = (device: Device, adminName: string) => {
    setDevices(prev => [...prev, device]);
    const model = models.find(m => m.id === device.modelId);
    logAction(ActionType.create, 'Device', device.id, model?.name || 'Unknown', adminName, `Tag: ${device.assetTag}`);
  };

  const updateDevice = (device: Device, adminName: string) => {
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
    const model = models.find(m => m.id === device.modelId);
    logAction(ActionType.UPDATE, 'Device', device.id, model?.name || 'Unknown', adminName);
  };

  const deleteDevice = (id: string, adminName: string, reason: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: DeviceStatus.RETIRED, currentUserId: null } : d));
    const dev = devices.find(d => d.id === id);
    if (dev) logAction(ActionType.DELETE, 'Device', id, dev.assetTag, adminName, `Motivo: ${reason}`);
  };

  const restoreDevice = (id: string, adminName: string, reason: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
    const dev = devices.find(d => d.id === id);
    if (dev) logAction(ActionType.RESTORE, 'Device', id, dev.assetTag, adminName, `Motivo: ${reason}`);
  };

  const addSim = (sim: SimCard, adminName: string) => { setSims(prev => [...prev, sim]); logAction(ActionType.create, 'Sim', sim.id, sim.phoneNumber, adminName); };
  const updateSim = (sim: SimCard, adminName: string) => { setSims(prev => prev.map(s => s.id === sim.id ? sim : s)); logAction(ActionType.UPDATE, 'Sim', sim.id, sim.phoneNumber, adminName); };
  const deleteSim = (id: string, adminName: string, reason: string) => { setSims(prev => prev.filter(s => s.id !== id)); const sim = sims.find(s => s.id === id); if (sim) logAction(ActionType.DELETE, 'Sim', id, sim.phoneNumber, adminName, `Motivo: ${reason}`); };

  const addUser = (user: User, adminName: string) => { setUsers(prev => [...prev, user]); logAction(ActionType.create, 'User', user.id, user.fullName, adminName); };
  const updateUser = (user: User, adminName: string, notes?: string) => { setUsers(prev => prev.map(u => u.id === user.id ? user : u)); logAction(ActionType.UPDATE, 'User', user.id, user.fullName, adminName, notes); };
  const toggleUserActive = (user: User, adminName: string, reason?: string) => {
    const updatedUser = { ...user, active: !user.active };
    setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    logAction(updatedUser.active ? ActionType.ACTIVATE : ActionType.INACTIVATE, 'User', user.id, user.fullName, adminName, reason);
  };

  const addAccount = (acc: SoftwareAccount, adminName: string) => { setAccounts(prev => [...prev, acc]); logAction(ActionType.create, 'Account', acc.id, acc.login, adminName, acc.name); };
  const updateAccount = (acc: SoftwareAccount, adminName: string) => { setAccounts(prev => prev.map(a => a.id === acc.id ? acc : a)); logAction(ActionType.UPDATE, 'Account', acc.id, acc.login, adminName, acc.name); };
  const deleteAccount = (id: string, adminName: string) => { const acc = accounts.find(a => a.id === id); setAccounts(prev => prev.filter(a => a.id !== id)); if (acc) logAction(ActionType.DELETE, 'Account', id, acc.login, adminName); };

  const addSector = (sector: UserSector, adminName: string) => { setSectors(prev => [...prev, sector]); logAction(ActionType.create, 'Sector', sector.id, sector.name, adminName); };
  const updateSector = (sector: UserSector, adminName: string) => { setSectors(prev => prev.map(s => s.id === sector.id ? sector : s)); logAction(ActionType.UPDATE, 'Sector', sector.id, sector.name, adminName); };
  const deleteSector = (id: string, adminName: string) => { setSectors(prev => prev.filter(s => s.id !== id)); logAction(ActionType.DELETE, 'Sector', id, 'Setor', adminName); };

  const updateSettings = (newSettings: SystemSettings, adminName: string) => { setSettings(newSettings); localStorage.setItem('mock_settings', JSON.stringify(newSettings)); logAction(ActionType.UPDATE, 'System', 'settings', 'Configurações', adminName); };

  const value: DataContextType = {
    devices, sims, users, logs, loading: false, error: null, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields, accounts,
    addDevice, updateDevice, deleteDevice, restoreDevice, 
    addSim, updateSim, deleteSim,
    addUser, updateUser, toggleUserActive,
    // Fix: add missing sector CRUD functions
    addSector, updateSector, deleteSector,
    addAccount, updateAccount, deleteAccount,
    addSystemUser: (u, adm) => { setSystemUsers(p => [...p, u]); },
    updateSystemUser: (u, adm) => { setSystemUsers(p => p.map(x => x.id === u.id ? u : x)); },
    deleteSystemUser: (id, adm) => { setSystemUsers(p => p.filter(x => x.id !== id)); },
    updateSettings,
    assignAsset: (at, aid, uid, n, adm) => { /* logic */ },
    returnAsset: (at, aid, n, adm) => { /* logic */ },
    updateTermFile: (tid, uid, furl, adm) => { /* logic */ },
    deleteTermFile: (tid, uid, r, adm) => { /* logic */ },
    getHistory: (id) => logs.filter(l => l.assetId === id),
    clearLogs,
    restoreItem,
    addAssetType: (t, adm) => setAssetTypes(p => [...p, t]),
    updateAssetType: (t, adm) => setAssetTypes(p => p.map(x => x.id === t.id ? t : x)),
    deleteAssetType: (id, adm) => setAssetTypes(p => p.filter(x => x.id !== id)),
    addBrand: (b, adm) => setBrands(p => [...p, b]),
    updateBrand: (b, adm) => setBrands(p => p.map(x => x.id === b.id ? b : x)),
    deleteBrand: (id, adm) => setBrands(p => p.filter(x => x.id !== id)),
    addModel: (m, adm) => setModels(p => [...p, m]),
    updateModel: (m, adm) => setModels(p => p.map(x => x.id === m.id ? m : x)),
    deleteModel: (id, adm) => setModels(p => p.filter(x => x.id !== id)),
    addAccessoryType: (t, adm) => setAccessoryTypes(p => [...p, t]),
    updateAccessoryType: (t, adm) => setAccessoryTypes(p => p.map(x => x.id === t.id ? t : x)),
    deleteAccessoryType: (id, adm) => setAccessoryTypes(p => p.filter(x => x.id !== id)),
    addCustomField: (f, adm) => setCustomFields(p => [...p, f]),
    updateCustomField: (f, adm) => setCustomFields(p => p.map(x => x.id === f.id ? f : x)),
    deleteCustomField: (id, adm) => setCustomFields(p => p.filter(x => x.id !== id)),
    addMaintenance: (r, adm) => setMaintenances(p => [...p, r]),
    deleteMaintenance: (id, adm) => setMaintenances(p => p.filter(x => x.id !== id))
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
