
import React, { useState, useEffect } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField, DeviceStatus } from '../types';

const API_URL = ''; 

export const ProdDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sims, setSims] = useState<SimCard[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({ appName: 'IT Asset', logoUrl: '' });
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [brands, setBrands] = useState<DeviceBrand[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [maintenances, setMaintenances] = useState<MaintenanceRecord[]>([]);
  const [sectors, setSectors] = useState<UserSector[]>([]);
  const [accessoryTypes, setAccessoryTypes] = useState<AccessoryType[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const safeJson = async (res: Response) => {
      if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `${res.status} ${res.statusText}`);
      }
      return res.json();
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [
          devicesRes, simsRes, usersRes, logsRes, sysUsersRes, settingsRes, 
          modelsRes, brandsRes, typesRes, maintRes, sectorsRes, accTypesRes, customFieldsRes, termsRes
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
        fetch(`${API_URL}/api/accessory-types`),
        fetch(`${API_URL}/api/custom-fields`),
        fetch(`${API_URL}/api/terms`)
      ]);

      setDevices(await safeJson(devicesRes));
      setSims(await safeJson(simsRes));
      
      const usersData = await safeJson(usersRes);
      const termsData = await safeJson(termsRes);
      setUsers(usersData.map((u: User) => ({ ...u, terms: termsData.filter((t: Term) => t.userId === u.id) })));

      setLogs(await safeJson(logsRes));
      setSystemUsers(await safeJson(sysUsersRes));
      setSettings(await safeJson(settingsRes));
      setModels(await safeJson(modelsRes));
      setBrands(await safeJson(brandsRes));
      setAssetTypes(await safeJson(typesRes));
      setMaintenances(await safeJson(maintRes));
      setSectors(await safeJson(sectorsRes));
      setAccessoryTypes(await safeJson(accTypesRes));
      setCustomFields(await safeJson(customFieldsRes));
      
      setError(null);
    } catch (err: any) {
      console.error("Erro na sincronização:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const postData = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return safeJson(res);
  };

  const putData = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api/${endpoint}/${data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return safeJson(res);
  };

  const deleteData = async (endpoint: string, id: string, extra: any = {}) => {
      const res = await fetch(`${API_URL}/api/${endpoint}/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(extra)
      });
      return safeJson(res);
  };

  // --- IMPLEMENTAÇÃO DE MÉTODOS ---

  const addDevice = async (d: Device, a: string) => { await postData('devices', { ...d, _adminUser: a }); fetchData(); };
  const updateDevice = async (d: Device, a: string) => { await putData('devices', { ...d, _adminUser: a }); fetchData(); };
  const deleteDevice = async (id: string, a: string, r: string) => { 
      const dev = devices.find(d => d.id === id);
      if (dev) {
          await putData('devices', { ...dev, status: DeviceStatus.RETIRED, _adminUser: a, _reason: r });
          fetchData();
      }
  };
  const restoreDevice = async (id: string, a: string, r: string) => {
      const dev = devices.find(d => d.id === id);
      if (dev) {
          await putData('devices', { ...dev, status: DeviceStatus.AVAILABLE, currentUserId: null, _adminUser: a, _reason: r });
          fetchData();
      }
  };

  const addUser = async (u: User, a: string) => { await postData('users', { ...u, _adminUser: a }); fetchData(); };
  const updateUser = async (u: User, a: string, n?: string) => { await putData('users', { ...u, _adminUser: a, _notes: n }); fetchData(); };
  const toggleUserActive = async (u: User, a: string, r?: string) => { await putData('users', { ...u, active: !u.active, _adminUser: a, _reason: r }); fetchData(); };

  const addSim = async (s: SimCard, a: string) => { await postData('sims', { ...s, _adminUser: a }); fetchData(); };
  const updateSim = async (s: SimCard, a: string) => { await putData('sims', { ...s, _adminUser: a }); fetchData(); };
  const deleteSim = async (id: string, a: string, r: string) => { await deleteData('sims', id, { _adminUser: a, reason: r }); fetchData(); };

  const addSector = async (s: UserSector, a: string) => { await postData('sectors', { ...s, _adminUser: a }); fetchData(); };
  const deleteSector = async (id: string, a: string) => { await deleteData('sectors', id, { _adminUser: a }); fetchData(); };

  const addBrand = async (b: DeviceBrand, a: string) => { await postData('brands', { ...b, _adminUser: a }); fetchData(); };
  const updateBrand = async (b: DeviceBrand, a: string) => { await putData('brands', { ...b, _adminUser: a }); fetchData(); };
  const deleteBrand = async (id: string, a: string) => { await deleteData('brands', id, { _adminUser: a }); fetchData(); };

  const addAssetType = async (t: AssetType, a: string) => { await postData('asset-types', { ...t, _adminUser: a }); fetchData(); };
  const updateAssetType = async (t: AssetType, a: string) => { await putData('asset-types', { ...t, _adminUser: a }); fetchData(); };
  const deleteAssetType = async (id: string, a: string) => { await deleteData('asset-types', id, { _adminUser: a }); fetchData(); };

  const addModel = async (m: DeviceModel, a: string) => { await postData('models', { ...m, _adminUser: a }); fetchData(); };
  const updateModel = async (m: DeviceModel, a: string) => { await putData('models', { ...m, _adminUser: a }); fetchData(); };
  const deleteModel = async (id: string, a: string) => { await deleteData('models', id, { _adminUser: a }); fetchData(); };

  const addMaintenance = async (m: MaintenanceRecord, a: string) => { await postData('maintenances', { ...m, _adminUser: a }); fetchData(); };
  const deleteMaintenance = async (id: string, a: string) => { await deleteData('maintenances', id, { _adminUser: a }); fetchData(); };

  const addAccessoryType = async (t: AccessoryType, a: string) => { await postData('accessory-types', { ...t, _adminUser: a }); fetchData(); };
  const updateAccessoryType = async (t: AccessoryType, a: string) => { await putData('accessory-types', { ...t, _adminUser: a }); fetchData(); };
  const deleteAccessoryType = async (id: string, a: string) => { await deleteData('accessory-types', id, { _adminUser: a }); fetchData(); };

  const addCustomField = async (f: CustomField, a: string) => { await postData('custom-fields', { ...f, _adminUser: a }); fetchData(); };
  const deleteCustomField = async (id: string, a: string) => { await deleteData('custom-fields', id, { _adminUser: a }); fetchData(); };

  const updateSettings = async (s: SystemSettings, a: string) => { await putData('settings', { ...s, id: 1, _adminUser: a }); fetchData(); };

  const value: DataContextType = {
    devices, sims, users, logs, loading, error, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields,
    addDevice, updateDevice, deleteDevice, restoreDevice,
    addSim, updateSim, deleteSim,
    addUser, updateUser, toggleUserActive,
    addSector, deleteSector,
    addBrand, updateBrand, deleteBrand,
    addAssetType, updateAssetType, deleteAssetType,
    addModel, updateModel, deleteModel,
    addMaintenance, deleteMaintenance,
    addAccessoryType, updateAccessoryType, deleteAccessoryType,
    addCustomField, deleteCustomField,
    updateSettings,
    assignAsset: async (at, aid, uid, n, adm) => { await postData('operations/checkout', { assetId: aid, assetType: at, userId: uid, notes: n, _adminUser: adm }); fetchData(); },
    returnAsset: async (at, aid, n, adm) => { await postData('operations/checkin', { assetId: aid, assetType: at, notes: n, _adminUser: adm }); fetchData(); },
    updateTermFile: async (tid, uid, furl, adm) => { await putData(`terms/file`, { id: tid, fileUrl: furl, _adminUser: adm }); fetchData(); },
    deleteTermFile: async (tid, uid, r, adm) => { await deleteData('terms', tid, { _adminUser: adm, reason: r, type: 'FILE' }); fetchData(); },
    getHistory: (id) => logs.filter(l => l.assetId === id),
    clearLogs: async () => { await fetch(`${API_URL}/api/logs`, { method: 'DELETE' }); fetchData(); },
    restoreItem: async (lid, adm) => { await postData('restore', { logId: lid, _adminUser: adm }); fetchData(); },
    addSystemUser: async (u, adm) => { await postData('system-users', { ...u, _adminUser: adm }); fetchData(); },
    updateSystemUser: async (u, adm) => { await putData('system-users', { ...u, _adminUser: adm }); fetchData(); },
    deleteSystemUser: async (id, adm) => { await deleteData('system-users', id, { _adminUser: adm }); fetchData(); }
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
