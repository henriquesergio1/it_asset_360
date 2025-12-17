import React, { useState } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, DeviceStatus, ActionType, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType } from '../types';
import { mockDevices, mockSims, mockUsers, mockAuditLogs, mockSystemUsers, mockSystemSettings, mockModels, mockBrands, mockAssetTypes, mockMaintenanceRecords, mockSectors, mockAccessoryTypes } from '../services/mockService';

export const MockDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [sims, setSims] = useState<SimCard[]>(mockSims);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [logs, setLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(mockSystemUsers);
  
  // Persist Settings in LocalStorage for better Demo Experience
  const [settings, setSettings] = useState<SystemSettings>(() => {
      const stored = localStorage.getItem('mock_settings');
      return stored ? JSON.parse(stored) : mockSystemSettings;
  });
  
  // Novos States
  const [models, setModels] = useState<DeviceModel[]>(mockModels);
  const [brands, setBrands] = useState<DeviceBrand[]>(mockBrands);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>(mockAssetTypes);
  const [maintenances, setMaintenances] = useState<MaintenanceRecord[]>(mockMaintenanceRecords);
  const [sectors, setSectors] = useState<UserSector[]>(mockSectors);
  const [accessoryTypes, setAccessoryTypes] = useState<AccessoryType[]>(mockAccessoryTypes || []);

  const logAction = (
    action: ActionType, 
    assetType: 'Device' | 'Sim' | 'User' | 'System' | 'Model' | 'Brand' | 'Type' | 'Sector' | 'Accessory', 
    assetId: string, 
    targetName: string, 
    adminName: string, 
    notes?: string
  ) => {
    const newLog: AuditLog = {
      id: Math.random().toString(36).substr(2, 9),
      assetId,
      assetType,
      targetName,
      action,
      timestamp: new Date().toISOString(),
      adminUser: adminName,
      notes
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // --- Devices ---
  const addDevice = (device: Device, adminName: string) => {
    setDevices(prev => [...prev, device]);
    // Handle SIM Linking on Create
    if (device.linkedSimId) {
        setSims(prev => prev.map(s => s.id === device.linkedSimId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: device.currentUserId } : s));
    }
    const model = models.find(m => m.id === device.modelId);
    logAction(ActionType.create, 'Device', device.id, model?.name || 'Unknown', adminName, `Tag: ${device.assetTag}`);
  };

  const updateDevice = (device: Device, adminName: string) => {
    // Check if SIM link changed
    const oldDevice = devices.find(d => d.id === device.id);
    let logNotes = '';

    if (oldDevice && oldDevice.linkedSimId !== device.linkedSimId) {
        // Unlink old
        if (oldDevice.linkedSimId) {
            setSims(prev => prev.map(s => s.id === oldDevice.linkedSimId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
            logNotes += `Chip desvinculado. `;
        }
        // Link new
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

  const deleteDevice = (id: string, adminName: string) => {
    const dev = devices.find(d => d.id === id);
    if (dev?.linkedSimId) {
         setSims(prev => prev.map(s => s.id === dev.linkedSimId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
    }
    setDevices(prev => prev.filter(d => d.id !== id));
    if (dev) logAction(ActionType.DELETE, 'Device', id, 'Dispositivo', adminName);
  };

  // --- Sims ---
  const addSim = (sim: SimCard, adminName: string) => {
    setSims(prev => [...prev, sim]);
    logAction(ActionType.create, 'Sim', sim.id, sim.phoneNumber, adminName);
  };
  const updateSim = (sim: SimCard, adminName: string) => {
    setSims(prev => prev.map(s => s.id === sim.id ? sim : s));
    logAction(ActionType.UPDATE, 'Sim', sim.id, sim.phoneNumber, adminName);
  };
  const deleteSim = (id: string, adminName: string) => {
    const sim = sims.find(s => s.id === id);
    setSims(prev => prev.filter(s => s.id !== id));
    if (sim) logAction(ActionType.DELETE, 'Sim', id, sim.phoneNumber, adminName);
  };

  // --- Users ---
  const addUser = (user: User, adminName: string) => {
    setUsers(prev => [...prev, user]);
    logAction(ActionType.create, 'User', user.id, user.fullName, adminName);
  };
  const updateUser = (user: User, adminName: string) => {
    setUsers(prev => prev.map(u => u.id === user.id ? user : u));
    logAction(ActionType.UPDATE, 'User', user.id, user.fullName, adminName);
  };
  const toggleUserActive = (user: User, adminName: string) => {
    const updatedUser = { ...user, active: !user.active };
    setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    logAction(updatedUser.active ? ActionType.ACTIVATE : ActionType.INACTIVATE, 'User', user.id, user.fullName, adminName);
  };

  // --- Sectors ---
  const addSector = (sector: UserSector, adminName: string) => {
      setSectors(prev => [...prev, sector]);
      logAction(ActionType.create, 'Sector', sector.id, sector.name, adminName);
  };
  const deleteSector = (id: string, adminName: string) => {
      setSectors(prev => prev.filter(s => s.id !== id));
      logAction(ActionType.DELETE, 'Sector', id, 'Setor', adminName);
  };

  // --- System Users ---
  const addSystemUser = (user: SystemUser, adminName: string) => {
    setSystemUsers(prev => [...prev, user]);
    logAction(ActionType.create, 'System', user.id, user.name, adminName);
  };
  const updateSystemUser = (user: SystemUser, adminName: string) => {
    setSystemUsers(prev => prev.map(u => u.id === user.id ? user : u));
    logAction(ActionType.UPDATE, 'System', user.id, user.name, adminName);
  };
  const deleteSystemUser = (id: string, adminName: string) => {
    const user = systemUsers.find(u => u.id === id);
    setSystemUsers(prev => prev.filter(u => u.id !== id));
    if (user) logAction(ActionType.DELETE, 'System', id, user.name, adminName);
  };

  // --- Settings (Updated to Persist in LocalStorage for Mock) ---
  const updateSettings = (newSettings: SystemSettings, adminName: string) => {
    setSettings(newSettings);
    localStorage.setItem('mock_settings', JSON.stringify(newSettings));
    logAction(ActionType.UPDATE, 'System', 'settings', 'Configurações', adminName);
  };

  // --- Configuration CRUDs ---
  const addAssetType = (type: AssetType, adminName: string) => {
    setAssetTypes(prev => [...prev, type]);
    logAction(ActionType.create, 'Type', type.id, type.name, adminName);
  };
  const deleteAssetType = (id: string, adminName: string) => {
    setAssetTypes(prev => prev.filter(t => t.id !== id));
    logAction(ActionType.DELETE, 'Type', id, 'Tipo', adminName);
  };

  const addBrand = (brand: DeviceBrand, adminName: string) => {
    setBrands(prev => [...prev, brand]);
    logAction(ActionType.create, 'Brand', brand.id, brand.name, adminName);
  };
  const deleteBrand = (id: string, adminName: string) => {
    setBrands(prev => prev.filter(b => b.id !== id));
    logAction(ActionType.DELETE, 'Brand', id, 'Marca', adminName);
  };

  const addModel = (model: DeviceModel, adminName: string) => {
    setModels(prev => [...prev, model]);
    logAction(ActionType.create, 'Model', model.id, model.name, adminName);
  };
  const updateModel = (model: DeviceModel, adminName: string) => {
    setModels(prev => prev.map(m => m.id === model.id ? model : m));
    logAction(ActionType.UPDATE, 'Model', model.id, model.name, adminName);
  };
  const deleteModel = (id: string, adminName: string) => {
    setModels(prev => prev.filter(m => m.id !== id));
    logAction(ActionType.DELETE, 'Model', id, 'Modelo', adminName);
  };
  
  const addAccessoryType = (type: AccessoryType, adminName: string) => {
      setAccessoryTypes(prev => [...prev, type]);
      logAction(ActionType.create, 'Accessory', type.id, type.name, adminName);
  };
  
  const deleteAccessoryType = (id: string, adminName: string) => {
      setAccessoryTypes(prev => prev.filter(t => t.id !== id));
      logAction(ActionType.DELETE, 'Accessory', id, 'Tipo Acessório', adminName);
  };

  // --- Maintenance ---
  const addMaintenance = (record: MaintenanceRecord, adminName: string) => {
    setMaintenances(prev => [...prev, record]);
    logAction(ActionType.MAINTENANCE_START, 'Device', record.deviceId, record.description, adminName, `Custo: ${record.cost}`);
  };
  const deleteMaintenance = (id: string, adminName: string) => {
    setMaintenances(prev => prev.filter(m => m.id !== id));
    logAction(ActionType.DELETE, 'Device', id, 'Registro Manutenção', adminName);
  };

  // --- Operations (Assignments & Returns) ---
  const assignAsset = (assetType: 'Device' | 'Sim', assetId: string, userId: string, notes: string, adminName: string, termFile?: File) => {
    // 1. Prepare Term Object
    let assetNameForTerm = '';

    // 2. Resolve Asset
    if (assetType === 'Device') {
      const dev = devices.find(d => d.id === assetId);
      const user = users.find(u => u.id === userId);
      const model = models.find(m => m.id === dev?.modelId);
      
      assetNameForTerm = `${model?.name} (${dev?.assetTag})`;

      setDevices(prev => prev.map(d => d.id === assetId ? { ...d, status: DeviceStatus.IN_USE, currentUserId: userId } : d));
      
      // Log for Device
      if (dev) logAction(ActionType.CHECKOUT, 'Device', assetId, 'Ativo', adminName, `Entregue para: ${user?.fullName}. Obs: ${notes}`);
      // Log for User (Duplicate for history view)
      if (user) logAction(ActionType.CHECKOUT, 'User', user.id, user.fullName, adminName, `Recebeu: ${assetNameForTerm}. Obs: ${notes}`);
      
    } else {
      const sim = sims.find(s => s.id === assetId);
      const user = users.find(u => u.id === userId);
      
      assetNameForTerm = `Chip ${sim?.phoneNumber} (${sim?.operator})`;
      
      setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: userId } : s));
      
      // Log for Sim
      if (sim) logAction(ActionType.CHECKOUT, 'Sim', assetId, sim.phoneNumber, adminName, `Entregue para: ${user?.fullName}. Obs: ${notes}`);
      // Log for User
      if (user) logAction(ActionType.CHECKOUT, 'User', user.id, user.fullName, adminName, `Recebeu: ${assetNameForTerm}. Obs: ${notes}`);
    }

    // 3. Save Term (Always create pending term if no file)
    const fileUrl = termFile ? URL.createObjectURL(termFile) : ''; // Empty means Pending
    const newTerm: Term = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        type: 'ENTREGA',
        assetDetails: assetNameForTerm,
        date: new Date().toISOString(),
        fileUrl
    };
    // Append term to user
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: [...(u.terms || []), newTerm] } : u));
  };

  const returnAsset = (assetType: 'Device' | 'Sim', assetId: string, notes: string, adminName: string, termFile?: File) => {
    let userId = '';
    let assetNameForTerm = '';

    if (assetType === 'Device') {
      const dev = devices.find(d => d.id === assetId);
      userId = dev?.currentUserId || '';
      const model = models.find(m => m.id === dev?.modelId);
      assetNameForTerm = `${model?.name} (${dev?.assetTag})`;

      const user = users.find(u => u.id === userId);
      setDevices(prev => prev.map(d => d.id === assetId ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
      
      logAction(ActionType.CHECKIN, 'Device', assetId, 'Ativo', adminName, `Devolvido por: ${user?.fullName || 'Desconhecido'}. Obs: ${notes}`);
      if (user) logAction(ActionType.CHECKIN, 'User', user.id, user.fullName, adminName, `Devolveu: ${assetNameForTerm}. Obs: ${notes}`);

    } else {
      const sim = sims.find(s => s.id === assetId);
      userId = sim?.currentUserId || '';
      assetNameForTerm = `Chip ${sim?.phoneNumber} (${sim?.operator})`;

      const user = users.find(u => u.id === userId);
      setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
      
      logAction(ActionType.CHECKIN, 'Sim', assetId, 'Sim', adminName, `Devolvido por: ${user?.fullName || 'Desconhecido'}. Obs: ${notes}`);
      if (user) logAction(ActionType.CHECKIN, 'User', user.id, user.fullName, adminName, `Devolveu: ${assetNameForTerm}. Obs: ${notes}`);
    }

    // Save Return Term (Always create)
    if (userId) {
        const fileUrl = termFile ? URL.createObjectURL(termFile) : '';
        const newTerm: Term = {
            id: Math.random().toString(36).substr(2, 9),
            userId,
            type: 'DEVOLUCAO',
            assetDetails: assetNameForTerm,
            date: new Date().toISOString(),
            fileUrl
        };
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, terms: [...(u.terms || []), newTerm] } : u));
    }
  };

  const getHistory = (assetId: string) => {
    return logs.filter(l => l.assetId === assetId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const value: DataContextType = {
    devices, sims, users, logs, loading: false, error: null, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes,
    addDevice, updateDevice, deleteDevice,
    addSim, updateSim, deleteSim,
    addUser, updateUser, toggleUserActive,
    addSystemUser, updateSystemUser, deleteSystemUser,
    updateSettings,
    assignAsset, returnAsset, getHistory,
    addAssetType, deleteAssetType,
    addBrand, deleteBrand,
    addModel, updateModel, deleteModel,
    addMaintenance, deleteMaintenance,
    addSector, deleteSector,
    addAccessoryType, deleteAccessoryType
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};