
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
    backupData?: string,
    previousData?: any,
    newData?: any
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
      backupData,
      previousData: previousData ? (typeof previousData === 'string' ? previousData : JSON.stringify(previousData)) : undefined,
      newData: newData ? (typeof newData === 'string' ? newData : JSON.stringify(newData)) : undefined
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
    const old = devices.find(d => d.id === device.id);
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
    const model = models.find(m => m.id === device.modelId);
    logAction(ActionType.UPDATE, 'Device', device.id, model?.name || 'Unknown', adminName, '', undefined, old, device);
  };

  const deleteDevice = (id: string, adminName: string, reason: string) => {
    const dev = devices.find(d => d.id === id);
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: DeviceStatus.RETIRED, currentUserId: null } : d));
    if (dev) logAction(ActionType.DELETE, 'Device', id, dev.assetTag, adminName, `Motivo: ${reason}`, JSON.stringify(dev));
  };

  const restoreDevice = (id: string, adminName: string, reason: string) => {
    const dev = devices.find(d => d.id === id);
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
    if (dev) logAction(ActionType.RESTORE, 'Device', id, dev.assetTag, adminName, `Motivo: ${reason}`);
  };

  const addSim = (sim: SimCard, adminName: string) => { setSims(prev => [...prev, sim]); logAction(ActionType.create, 'Sim', sim.id, sim.phoneNumber, adminName); };
  const updateSim = (sim: SimCard, adminName: string) => { 
    const old = sims.find(s => s.id === sim.id);
    setSims(prev => prev.map(s => s.id === sim.id ? sim : s)); 
    logAction(ActionType.UPDATE, 'Sim', sim.id, sim.phoneNumber, adminName, '', undefined, old, sim); 
  };
  const deleteSim = (id: string, adminName: string, reason: string) => { setSims(prev => prev.filter(s => s.id !== id)); const sim = sims.find(s => s.id === id); if (sim) logAction(ActionType.DELETE, 'Sim', id, sim.phoneNumber, adminName, `Motivo: ${reason}`); };

  const addUser = (user: User, adminName: string) => { setUsers(prev => [...prev, user]); logAction(ActionType.create, 'User', user.id, user.fullName, adminName); };
  const updateUser = (user: User, adminName: string, notes?: string) => { 
    const old = users.find(u => u.id === user.id);
    setUsers(prev => prev.map(u => u.id === user.id ? user : u)); 
    logAction(ActionType.UPDATE, 'User', user.id, user.fullName, adminName, notes, undefined, old, user); 
  };
  const toggleUserActive = (user: User, adminName: string, reason?: string) => {
    const old = { ...user };
    const updatedUser = { ...user, active: !user.active };
    setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    logAction(updatedUser.active ? ActionType.ACTIVATE : ActionType.INACTIVATE, 'User', user.id, user.fullName, adminName, reason, undefined, old, updatedUser);
  };

  const addAccount = (acc: SoftwareAccount, adminName: string) => { setAccounts(prev => [...prev, acc]); logAction(ActionType.create, 'Account', acc.id, acc.login, adminName, acc.name); };
  const updateAccount = (acc: SoftwareAccount, adminName: string) => { 
    const old = accounts.find(a => a.id === acc.id);
    setAccounts(prev => prev.map(a => a.id === acc.id ? acc : a)); 
    logAction(ActionType.UPDATE, 'Account', acc.id, acc.login, adminName, acc.name, undefined, old, acc); 
  };
  const deleteAccount = (id: string, adminName: string) => { const acc = accounts.find(a => a.id === id); setAccounts(prev => prev.filter(a => a.id !== id)); if (acc) logAction(ActionType.DELETE, 'Account', id, acc.login, adminName); };

  const addSector = (sector: UserSector, adminName: string) => { setSectors(prev => [...prev, sector]); logAction(ActionType.create, 'Sector', sector.id, sector.name, adminName); };
  const updateSector = (sector: UserSector, adminName: string) => { 
    const old = sectors.find(s => s.id === sector.id);
    setSectors(prev => prev.map(s => s.id === sector.id ? sector : s)); 
    logAction(ActionType.UPDATE, 'Sector', sector.id, sector.name, adminName, '', undefined, old, sector); 
  };
  const deleteSector = (id: string, adminName: string) => { setSectors(prev => prev.filter(s => s.id !== id)); logAction(ActionType.DELETE, 'Sector', id, 'Setor', adminName); };

  const updateSettings = (newSettings: SystemSettings, adminName: string) => { 
    const old = { ...settings };
    setSettings(newSettings); 
    localStorage.setItem('mock_settings', JSON.stringify(newSettings)); 
    logAction(ActionType.UPDATE, 'System', 'settings', 'Configurações', adminName, '', undefined, old, newSettings); 
  };

  const value: DataContextType = {
    devices, sims, users, logs, loading: false, error: null, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields, accounts,
    fetchData: async (silent?: boolean) => { console.log("[Mock] Sync skipped."); },
    refreshData: async () => { console.log("[Mock] Data refreshed."); },
    getTermFile: async (id: string) => "",
    getDeviceInvoice: async (id: string) => "",
    getMaintenanceInvoice: async (id: string) => "",
    // Fix: implemented getLogDetail to satisfy DataContextType
    getLogDetail: async (id: string) => {
      const log = logs.find(l => l.id === id);
      if (!log) throw new Error("Log não encontrado");
      return log;
    },
    addDevice, updateDevice, deleteDevice, restoreDevice, 
    addSim, updateSim, deleteSim,
    addUser, updateUser, toggleUserActive,
    addSector, updateSector, deleteSector,
    addAccount, updateAccount, deleteAccount,
    addSystemUser: (u, adm) => { setSystemUsers(p => [...p, u]); },
    updateSystemUser: (u, adm) => { 
        const old = systemUsers.find(x => x.id === u.id);
        setSystemUsers(p => p.map(x => x.id === u.id ? u : x)); 
        logAction(ActionType.UPDATE, 'System', u.id, u.name, adm, '', undefined, old, u);
    },
    deleteSystemUser: (id, adm) => { setSystemUsers(p => p.filter(x => x.id !== id)); },
    updateSettings,
    assignAsset: (assetType, assetId, userId, notes, adminName, accessories) => {
        const user = users.find(u => u.id === userId);
        if (assetType === 'Device') {
            const old = devices.find(d => d.id === assetId);
            setDevices(prev => prev.map(d => d.id === assetId ? { 
                ...d, 
                status: DeviceStatus.IN_USE, 
                currentUserId: userId,
                accessories: accessories
            } : d));
            
            const termId = Math.random().toString(36).substr(2, 9);
            const modelName = models.find(m => m.id === old?.modelId)?.name || 'Dispositivo';
            const newTerm: Term = {
                id: termId,
                userId: userId,
                type: 'ENTREGA',
                assetDetails: `[TAG: ${old?.assetTag}] ${modelName}`,
                date: new Date().toISOString(),
                fileUrl: ''
            };
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: [...(u.terms || []), newTerm] } : u));
            logAction(ActionType.CHECKOUT, 'Device', assetId, old?.assetTag || 'Ativo', adminName, notes, undefined, old, { 
                status: DeviceStatus.IN_USE, 
                currentUserId: userId,
                userName: user?.fullName || 'Desconhecido'
            });
        } else {
            const old = sims.find(s => s.id === assetId);
            setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: userId } : s));
            
            const termId = Math.random().toString(36).substr(2, 9);
            const newTerm: Term = {
                id: termId,
                userId: userId,
                type: 'ENTREGA',
                assetDetails: `[CHIP: ${old?.phoneNumber}]`,
                date: new Date().toISOString(),
                fileUrl: ''
            };
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: [...(u.terms || []), newTerm] } : u));
            
            logAction(ActionType.CHECKOUT, 'Sim', assetId, old?.phoneNumber || 'Chip', adminName, notes, undefined, old, { 
                status: DeviceStatus.IN_USE, 
                currentUserId: userId,
                userName: user?.fullName || 'Desconhecido'
            });
        }
    },
    returnAsset: (assetType, assetId, notes, adminName, checklist, inactivateUser) => {
        if (assetType === 'Device') {
            const old = devices.find(d => d.id === assetId);
            const oldUserId = old?.currentUserId;
            const oldUser = users.find(u => u.id === oldUserId);
            
            if (old && old.linkedSimId) {
                setSims(prev => prev.map(s => s.id === old.linkedSimId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
            }

            setDevices(prev => prev.map(d => d.id === assetId ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
            
            if (oldUserId) {
                const termId = Math.random().toString(36).substr(2, 9);
                const modelName = models.find(m => m.id === old?.modelId)?.name || 'Dispositivo';
                const newTerm: Term = {
                    id: termId,
                    userId: oldUserId,
                    type: 'DEVOLUCAO',
                    assetDetails: `[TAG: ${old?.assetTag}] ${modelName}`,
                    date: new Date().toISOString(),
                    fileUrl: ''
                };
                
                setUsers(prev => prev.map(u => u.id === oldUserId ? { 
                    ...u, 
                    active: inactivateUser ? false : u.active,
                    terms: [...(u.terms || []), newTerm] 
                } : u));

                if (inactivateUser) {
                    logAction(ActionType.INACTIVATE, 'User', oldUserId, oldUser?.fullName || 'Desconhecido', adminName, 'Inativado automaticamente durante a devolução (Desligamento)');
                }
            }
            logAction(ActionType.CHECKIN, 'Device', assetId, old?.assetTag || 'Ativo', adminName, notes, undefined, {
                status: DeviceStatus.IN_USE,
                currentUserId: oldUserId,
                userName: oldUser?.fullName || 'Desconhecido'
            }, { status: DeviceStatus.AVAILABLE, currentUserId: null });
        } else {
            const old = sims.find(s => s.id === assetId);
            const oldUserId = old?.currentUserId;
            const oldUser = users.find(u => u.id === oldUserId);

            setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
            
            if (oldUserId) {
                const termId = Math.random().toString(36).substr(2, 9);
                const newTerm: Term = {
                    id: termId,
                    userId: oldUserId,
                    type: 'DEVOLUCAO',
                    assetDetails: `[CHIP: ${old?.phoneNumber}]`,
                    date: new Date().toISOString(),
                    fileUrl: ''
                };

                setUsers(prev => prev.map(u => u.id === oldUserId ? { 
                    ...u, 
                    active: inactivateUser ? false : u.active,
                    terms: [...(u.terms || []), newTerm] 
                } : u));

                if (inactivateUser) {
                    logAction(ActionType.INACTIVATE, 'User', oldUserId, oldUser?.fullName || 'Desconhecido', adminName, 'Inativado automaticamente durante a devolução (Desligamento)');
                }
            }

            logAction(ActionType.CHECKIN, 'Sim', assetId, old?.phoneNumber || 'Chip', adminName, notes, undefined, {
                status: DeviceStatus.IN_USE,
                currentUserId: oldUserId,
                userName: oldUser?.fullName || 'Desconhecido'
            }, { status: DeviceStatus.AVAILABLE, currentUserId: null });
        }
    },
    updateTermFile: (tid, uid, furl, adm) => { 
        setUsers(prev => prev.map(u => u.id === uid ? {
            ...u,
            terms: (u.terms || []).map(t => t.id === tid ? { ...t, fileUrl: furl } : t)
        } : u));
    },
    deleteTermFile: (tid, uid, r, adm) => {
        setUsers(prev => prev.map(u => u.id === uid ? {
            ...u,
            terms: (u.terms || []).map(t => t.id === tid ? { ...t, fileUrl: '' } : t)
        } : u));
    },
    getHistory: (id) => logs.filter(l => l.assetId === id),
    clearLogs,
    restoreItem,
    addAssetType: (t, adm) => { setAssetTypes(p => [...p, t]); logAction(ActionType.create, 'Type', t.id, t.name, adm); },
    updateAssetType: (t, adm) => { 
        const old = assetTypes.find(x => x.id === t.id);
        setAssetTypes(p => p.map(x => x.id === t.id ? t : x)); 
        logAction(ActionType.UPDATE, 'Type', t.id, t.name, adm, '', undefined, old, t);
    },
    deleteAssetType: (id, adm) => setAssetTypes(p => p.filter(x => x.id !== id)),
    addBrand: (b, adm) => { setBrands(p => [...p, b]); logAction(ActionType.create, 'Brand', b.id, b.name, adm); },
    updateBrand: (b, adm) => { 
        const old = brands.find(x => x.id === b.id);
        setBrands(p => p.map(x => x.id === b.id ? b : x)); 
        logAction(ActionType.UPDATE, 'Brand', b.id, b.name, adm, '', undefined, old, b);
    },
    deleteBrand: (id, adm) => setBrands(p => p.filter(x => x.id !== id)),
    addModel: (m, adm) => { setModels(p => [...p, m]); logAction(ActionType.create, 'Model', m.id, m.name, adm); },
    updateModel: (m, adm) => { 
        const old = models.find(x => x.id === m.id);
        setModels(p => p.map(x => x.id === m.id ? m : x)); 
        logAction(ActionType.UPDATE, 'Model', m.id, m.name, adm, '', undefined, old, m);
    },
    deleteModel: (id, adm) => setModels(p => p.filter(x => x.id !== id)),
    addAccessoryType: (t, adm) => { setAccessoryTypes(p => [...p, t]); logAction(ActionType.create, 'Accessory', t.id, t.name, adm); },
    updateAccessoryType: (t, adm) => { 
        const old = accessoryTypes.find(x => x.id === t.id);
        setAccessoryTypes(p => p.map(x => x.id === t.id ? t : x)); 
        logAction(ActionType.UPDATE, 'Accessory', t.id, t.name, adm, '', undefined, old, t);
    },
    deleteAccessoryType: (id, adm) => setAccessoryTypes(p => p.filter(x => x.id !== id)),
    addCustomField: (f, adm) => { setCustomFields(p => [...p, f]); logAction(ActionType.create, 'CustomField', f.id, f.name, adm); },
    updateCustomField: (f, adm) => { 
        const old = customFields.find(x => x.id === f.id);
        setCustomFields(p => p.map(x => x.id === f.id ? f : x)); 
        logAction(ActionType.UPDATE, 'CustomField', f.id, f.name, adm, '', undefined, old, f);
    },
    deleteCustomField: (id, adm) => setCustomFields(p => p.filter(x => x.id !== id)),
    addMaintenance: (r, adm) => { setMaintenances(p => [...p, r]); logAction(ActionType.create, 'Device', r.deviceId, 'Manutenção', adm, r.description); },
    deleteMaintenance: (id, adm) => setMaintenances(p => p.filter(x => x.id !== id))
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
