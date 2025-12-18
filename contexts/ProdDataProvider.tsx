
// ... imports
import React, { useState, useEffect } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField, DeviceStatus } from '../types';

// API Configuration Relative Path
const API_URL = ''; 

export const ProdDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sims, setSims] = useState<SimCard[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({ appName: 'IT Asset', logoUrl: '' });
  const [logs, setLogs] = useState<AuditLog[]>([]);
  
  // New State
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [brands, setBrands] = useState<DeviceBrand[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [maintenances, setMaintenances] = useState<MaintenanceRecord[]>([]);
  const [sectors, setSectors] = useState<UserSector[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [accessoryTypes, setAccessoryTypes] = useState<AccessoryType[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to check response
  const safeJson = async (res: Response, fallbackValue: any = []) => {
      if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status} ${res.statusText}: ${text.substring(0, 100)}`);
      }
      return res.json();
  };

  const fetchData = async () => {
    console.log(`[ITAsset360] Sincronizando dados com API (/api)`);
    try {
      setLoading(true);
      const [
          devicesRes, simsRes, usersRes, logsRes, sysUsersRes, settingsRes, 
          modelsRes, brandsRes, typesRes, maintRes, sectorsRes, termsRes, accTypesRes, customFieldsRes
      ] = await Promise.all([
        fetch(`${API_URL}/api/devices`),
        fetch(`${API_URL}/api/sims`),
        fetch(`${API_URL}/api/users`),
        fetch(`${API_URL}/api/logs`),
        fetch(`${API_URL}/api/system-users`),
        fetch(`${API_URL}/api/settings`),
        fetch(`${API_URL}/api/models`),
        fetch(`${API_URL}/api/brands`),
        fetch(`${API_URL}/api/asset-types`),
        fetch(`${API_URL}/api/maintenances`),
        fetch(`${API_URL}/api/sectors`),
        fetch(`${API_URL}/api/terms`),
        fetch(`${API_URL}/api/accessory-types`),
        fetch(`${API_URL}/api/custom-fields`)
      ]);

      const devicesData = await safeJson(devicesRes);
      const simsData = await safeJson(simsRes);
      const usersData: User[] = await safeJson(usersRes);
      const termsData: Term[] = await safeJson(termsRes, []); 
      
      const usersWithTerms = usersData.map(u => ({
          ...u,
          terms: termsData.filter(t => t.userId === u.id)
      }));

      setDevices(devicesData);
      setSims(simsData);
      setUsers(usersWithTerms);
      setLogs(await safeJson(logsRes, []));
      
      if (sysUsersRes.ok) setSystemUsers(await sysUsersRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
      
      setModels(await safeJson(modelsRes));
      setBrands(await safeJson(brandsRes));
      setAssetTypes(await safeJson(typesRes));
      setMaintenances(await safeJson(maintRes));
      
      if (sectorsRes.ok) setSectors(await sectorsRes.json());
      if (accTypesRes.ok) setAccessoryTypes(await accTypesRes.json());
      if (customFieldsRes.ok) setCustomFields(await customFieldsRes.json());
      setTerms(termsData);
      
    } catch (err: any) {
      setError(`Erro de Conexão: ${err.message}.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Generic POST helper
  const postData = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return safeJson(res);
  };

  // Generic PUT helper
  const putData = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api/${endpoint}/${data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return safeJson(res);
  };

  // Generic DELETE helper
  const deleteData = async (endpoint: string, id: string, extraData?: any) => {
    const options: RequestInit = { method: 'DELETE' };
    if (extraData) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(extraData);
    }
    const url = id ? `${API_URL}/api/${endpoint}/${id}` : `${API_URL}/api/${endpoint}`;
    const res = await fetch(url, options);
    if (!res.ok) throw new Error('Failed to delete');
  };

  const addDevice = async (device: Device, adminName: string) => {
    const saved = await postData('devices', { ...device, _adminUser: adminName });
    setDevices(prev => [...prev, saved]);
    fetchData();
  };

  const updateDevice = async (device: Device, adminName: string) => {
    await putData('devices', { ...device, _adminUser: adminName });
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
    fetchData();
  };

  const deleteDevice = async (id: string, adminName: string, reason: string) => {
    // Soft delete: update device status to RETIRED instead of hard deleting from the database
    const device = devices.find(d => d.id === id);
    if (device) {
      await putData('devices', { ...device, status: DeviceStatus.RETIRED, _adminUser: adminName, _reason: reason });
      await fetchData();
    }
  };

  // Added restoreDevice to satisfy DataContextType interface
  const restoreDevice = async (id: string, adminName: string, reason: string) => {
    const device = devices.find(d => d.id === id);
    if (device) {
      await putData('devices', { ...device, status: DeviceStatus.AVAILABLE, currentUserId: null, _adminUser: adminName, _reason: reason });
      await fetchData();
    }
  };

  const addSim = async (sim: SimCard, adminName: string) => {
    const saved = await postData('sims', { ...sim, _adminUser: adminName });
    setSims(prev => [...prev, saved]);
    fetchData();
  };

  const updateSim = async (sim: SimCard, adminName: string) => {
    await putData('sims', { ...sim, _adminUser: adminName });
    setSims(prev => prev.map(s => s.id === sim.id ? sim : s));
    fetchData();
  };

  const deleteSim = async (id: string, adminName: string, reason: string) => {
    await deleteData('sims', id, { _adminUser: adminName, reason });
    setSims(prev => prev.filter(s => s.id !== id));
    fetchData();
  };

  const addUser = async (user: User, adminName: string) => {
    const saved = await postData('users', { ...user, _adminUser: adminName });
    setUsers(prev => [...prev, { ...saved, terms: [] }]);
    fetchData();
  };

  const updateUser = async (user: User, adminName: string) => {
    await putData('users', { ...user, _adminUser: adminName });
    setUsers(prev => prev.map(u => u.id === user.id ? user : u));
    fetchData();
  };

  const toggleUserActive = async (user: User, adminName: string, reason?: string) => {
    const updatedUser = { ...user, active: !user.active };
    await putData('users', { ...updatedUser, _adminUser: adminName, _reason: reason });
    setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    fetchData();
  };

  const addSystemUser = async (user: SystemUser, adminName: string) => {
    const saved = await postData('system-users', { ...user, _adminUser: adminName });
    setSystemUsers(prev => [...prev, saved]);
  };

  const updateSystemUser = async (user: SystemUser, adminName: string) => {
    await putData('system-users', { ...user, _adminUser: adminName });
    setSystemUsers(prev => prev.map(u => u.id === user.id ? user : u));
  };

  const deleteSystemUser = async (id: string, adminName: string) => {
    await deleteData('system-users', id);
    setSystemUsers(prev => prev.filter(u => u.id !== id));
  };

  const updateSettings = async (newSettings: SystemSettings, adminName: string) => {
      await fetch(`${API_URL}/api/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newSettings, _adminUser: adminName })
      });
      setSettings(newSettings);
      fetchData();
  };

  const assignAsset = async (assetType: 'Device' | 'Sim', assetId: string, userId: string, notes: string, adminName: string, termFile?: File) => {
    const payload = { assetId, assetType, userId, notes, action: 'CHECKOUT', _adminUser: adminName };
    await postData('operations/checkout', payload);

    let assetName = 'Equipamento';
    if (assetType === 'Device') {
        const d = devices.find(x => x.id === assetId);
        const m = models.find(mod => mod.id === d?.modelId);
        assetName = `${m?.name} (${d?.assetTag})`;
    } else {
        const s = sims.find(x => x.id === assetId);
        assetName = `Chip ${s?.phoneNumber}`;
    }

    const termData: Term = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        type: 'ENTREGA',
        assetDetails: assetName,
        date: new Date().toISOString(),
        fileUrl: ''
    };

    await postData('terms', termData);
    await fetchData(); // Sincroniza em vez de recarregar a página
  };

  const returnAsset = async (assetType: 'Device' | 'Sim', assetId: string, notes: string, adminName: string, termFile?: File) => {
    let userId = '';
    let assetName = 'Equipamento';
    if (assetType === 'Device') {
        const d = devices.find(x => x.id === assetId);
        userId = d?.currentUserId || '';
        const m = models.find(mod => mod.id === d?.modelId);
        assetName = `${m?.name} (${d?.assetTag})`;
    } else {
        const s = sims.find(x => x.id === assetId);
        userId = s?.currentUserId || '';
        assetName = `Chip ${s?.phoneNumber}`;
    }

    const payload = { assetId, assetType, notes, action: 'CHECKIN', _adminUser: adminName };
    await postData('operations/checkin', payload);

    if (userId) {
        const termData: Term = {
            id: Math.random().toString(36).substr(2, 9),
            userId,
            type: 'DEVOLUCAO',
            assetDetails: assetName,
            date: new Date().toISOString(),
            fileUrl: ""
        };
        await postData('terms', termData);
    }

    await fetchData(); // Sincroniza em vez de recarregar a página
  };

  const getHistory = (assetId: string) => {
    return logs.filter(l => l.assetId === assetId);
  };

  const addModel = async (model: DeviceModel, adminName: string) => {
      const saved = await postData('models', { ...model, _adminUser: adminName });
      setModels(prev => [...prev, saved]);
  };
  const updateModel = async (model: DeviceModel, adminName: string) => {
      await putData('models', { ...model, _adminUser: adminName });
      setModels(prev => prev.map(m => m.id === model.id ? model : m));
  };
  const deleteModel = async (id: string, adminName: string) => {
      await deleteData('models', id);
      setModels(prev => prev.filter(m => m.id !== id));
  };

  const addBrand = async (brand: DeviceBrand, adminName: string) => {
      const saved = await postData('brands', { ...brand, _adminUser: adminName });
      setBrands(prev => [...prev, saved]);
  };
  const updateBrand = async (brand: DeviceBrand, adminName: string) => {
      await putData('brands', { ...brand, _adminUser: adminName });
      setBrands(prev => prev.map(b => b.id === brand.id ? brand : b));
  };
  const deleteBrand = async (id: string, adminName: string) => {
      await deleteData('brands', id);
      setBrands(prev => prev.filter(b => b.id !== id));
  };

  const addAssetType = async (type: AssetType, adminName: string) => {
      const saved = await postData('asset-types', { ...type, _adminUser: adminName });
      setAssetTypes(prev => [...prev, saved]);
  };
  const updateAssetType = async (type: AssetType, adminName: string) => {
      await putData('asset-types', { ...type, _adminUser: adminName });
      setAssetTypes(prev => prev.map(t => t.id === type.id ? type : t));
  };
  const deleteAssetType = async (id: string, adminName: string) => {
      await deleteData('asset-types', id);
      setAssetTypes(prev => prev.filter(t => t.id !== id));
  };

  const addMaintenance = async (record: MaintenanceRecord, adminName: string) => {
      const saved = await postData('maintenances', { ...record, _adminUser: adminName });
      setMaintenances(prev => [...prev, saved]);
      fetchData();
  };
  const deleteMaintenance = async (id: string, adminName: string) => {
      await deleteData('maintenances', id);
      setMaintenances(prev => prev.filter(m => m.id !== id));
      fetchData();
  };

  const addSector = async (sector: UserSector, adminName: string) => {
      const saved = await postData('sectors', { ...sector, _adminUser: adminName });
      setSectors(prev => [...prev, saved]);
  };
  const deleteSector = async (id: string, adminName: string) => {
      await deleteData('sectors', id);
      setSectors(prev => prev.filter(s => s.id !== id));
  };

  const addAccessoryType = async (type: AccessoryType, adminName: string) => {
      const saved = await postData('accessory-types', { ...type, _adminUser: adminName });
      setAccessoryTypes(prev => [...prev, saved]);
  };
  const updateAccessoryType = async (type: AccessoryType, adminName: string) => {
      await putData('accessory-types', { ...type, _adminUser: adminName });
      setAccessoryTypes(prev => prev.map(t => t.id === type.id ? type : t));
  };
  const deleteAccessoryType = async (id: string, adminName: string) => {
      await deleteData('accessory-types', id);
      setAccessoryTypes(prev => prev.filter(t => t.id !== id));
  };

  const addCustomField = async (field: CustomField, adminName: string) => {
      const saved = await postData('custom-fields', { ...field, _adminUser: adminName });
      setCustomFields(prev => [...prev, saved]);
  };
  const deleteCustomField = async (id: string, adminName: string) => {
      await deleteData('custom-fields', id);
      setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const clearLogs = async () => {
    await fetch(`${API_URL}/api/logs`, { method: 'DELETE' });
    setLogs([]);
    fetchData();
  };

  const restoreItem = async (logId: string, adminName: string) => {
    await postData('restore', { logId, _adminUser: adminName });
    await fetchData();
  };

  const value: DataContextType = {
    devices, sims, users, logs, loading, error, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields,
    addDevice, updateDevice, deleteDevice, restoreDevice,
    addSim, updateSim, deleteSim,
    addUser, updateUser, toggleUserActive,
    addSystemUser, updateSystemUser, deleteSystemUser,
    updateSettings,
    assignAsset, returnAsset, getHistory,
    clearLogs,
    restoreItem,
    addModel, updateModel, deleteModel,
    addBrand, updateBrand, deleteBrand,
    addAssetType, updateAssetType, deleteAssetType,
    addMaintenance, deleteMaintenance,
    addSector, deleteSector,
    addAccessoryType, updateAccessoryType, deleteAccessoryType,
    addCustomField, deleteCustomField
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
