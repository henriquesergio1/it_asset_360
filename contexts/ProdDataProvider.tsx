
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
  const [terms, setTerms] = useState<Term[]>([]);
  const [accessoryTypes, setAccessoryTypes] = useState<AccessoryType[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const safeJson = async (res: Response) => {
      if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status} ${res.statusText}: ${text.substring(0, 100)}`);
      }
      return res.json();
  };

  const fetchData = async () => {
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

      setDevices(await safeJson(devicesRes));
      setSims(await safeJson(simsRes));
      const usersData = await safeJson(usersRes);
      const termsData = await safeJson(termsRes);
      
      setUsers(usersData.map((u: User) => ({
          ...u,
          terms: termsData.filter((t: Term) => t.userId === u.id)
      })));

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
      setTerms(termsData);
      
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

  const addDevice = async (device: Device, adminName: string) => { await postData('devices', { ...device, _adminUser: adminName }); fetchData(); };
  const updateDevice = async (device: Device, adminName: string) => { await putData('devices', { ...device, _adminUser: adminName }); fetchData(); };
  const deleteDevice = async (id: string, adminName: string, reason: string) => {
    const device = devices.find(d => d.id === id);
    if (device) await putData('devices', { ...device, status: DeviceStatus.RETIRED, _adminUser: adminName, _reason: reason });
    fetchData();
  };
  const restoreDevice = async (id: string, adminName: string, reason: string) => {
    const device = devices.find(d => d.id === id);
    if (device) await putData('devices', { ...device, status: DeviceStatus.AVAILABLE, currentUserId: null, _adminUser: adminName, _reason: reason });
    fetchData();
  };

  const addUser = async (user: User, adminName: string) => { await postData('users', { ...user, _adminUser: adminName }); fetchData(); };
  const updateUser = async (user: User, adminName: string) => { await putData('users', { ...user, _adminUser: adminName }); fetchData(); };
  const toggleUserActive = async (user: User, adminName: string, reason?: string) => {
    await putData('users', { ...user, active: !user.active, _adminUser: adminName, _reason: reason });
    fetchData();
  };

  const addSim = async (s: SimCard, a: string) => { await postData('sims', {...s, _adminUser: a}); fetchData(); };
  const updateSim = async (s: SimCard, a: string) => { await putData('sims', {...s, _adminUser: a}); fetchData(); };
  const deleteSim = async (id: string, a: string, r: string) => { 
      await fetch(`${API_URL}/api/sims/${id}`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({_adminUser: a, reason: r}) });
      fetchData(); 
  };

  const addAssetType = async (t: AssetType, a: string) => { await postData('asset-types', {...t, _adminUser: a}); fetchData(); };
  const updateAssetType = async (t: AssetType, a: string) => { await putData('asset-types', {...t, _adminUser: a}); fetchData(); };
  const addBrand = async (b: DeviceBrand, a: string) => { await postData('brands', {...b, _adminUser: a}); fetchData(); };
  const updateBrand = async (b: DeviceBrand, a: string) => { await putData('brands', {...b, _adminUser: a}); fetchData(); };
  const addModel = async (m: DeviceModel, a: string) => { await postData('models', {...m, _adminUser: a}); fetchData(); };
  const updateModel = async (m: DeviceModel, a: string) => { await putData('models', {...m, _adminUser: a}); fetchData(); };
  const updateSettings = async (s: SystemSettings, a: string) => { await fetch(`${API_URL}/api/settings`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...s, _adminUser: a}) }); fetchData(); };

  const value: DataContextType = {
    devices, sims, users, logs, loading, error, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields,
    addDevice, updateDevice, deleteDevice, restoreDevice,
    addSim, updateSim, deleteSim,
    addUser, updateUser, toggleUserActive,
    updateSettings,
    assignAsset: async (at, aid, uid, n, adm) => { await postData('operations/checkout', { assetId: aid, assetType: at, userId: uid, notes: n, _adminUser: adm }); fetchData(); },
    returnAsset: async (at, aid, n, adm) => { await postData('operations/checkin', { assetId: aid, assetType: at, notes: n, _adminUser: adm }); fetchData(); },
    getHistory: (id) => logs.filter(l => l.assetId === id),
    clearLogs: async () => { await fetch(`${API_URL}/api/logs`, { method: 'DELETE' }); fetchData(); },
    restoreItem: async (lid, adm) => { await postData('restore', { logId: lid, _adminUser: adm }); fetchData(); },
    addAssetType, updateAssetType, deleteAssetType: async (id) => { await fetch(`${API_URL}/api/asset-types/${id}`, {method: 'DELETE'}); fetchData(); },
    addBrand, updateBrand, deleteBrand: async (id) => { await fetch(`${API_URL}/api/brands/${id}`, {method: 'DELETE'}); fetchData(); },
    addModel, updateModel, deleteModel: async (id) => { await fetch(`${API_URL}/api/models/${id}`, {method: 'DELETE'}); fetchData(); },
    addMaintenance: async (m, adm) => { await postData('maintenances', {...m, _adminUser: adm}); fetchData(); },
    deleteMaintenance: async (id) => { await fetch(`${API_URL}/api/maintenances/${id}`, {method: 'DELETE'}); fetchData(); },
    addSector: async (s, adm) => { await postData('sectors', {...s, _adminUser: adm}); fetchData(); },
    deleteSector: async (id) => { await fetch(`${API_URL}/api/sectors/${id}`, {method: 'DELETE'}); fetchData(); },
    addAccessoryType: async (t, adm) => { await postData('accessory-types', {...t, _adminUser: adm}); fetchData(); },
    updateAccessoryType: async (t, adm) => { await putData('accessory-types', {...t, _adminUser: adm}); fetchData(); },
    deleteAccessoryType: async (id) => { await fetch(`${API_URL}/api/accessory-types/${id}`, {method: 'DELETE'}); fetchData(); },
    addCustomField: async (f, adm) => { await postData('custom-fields', {...f, _adminUser: adm}); fetchData(); },
    deleteCustomField: async (id) => { await fetch(`${API_URL}/api/custom-fields/${id}`, {method: 'DELETE'}); fetchData(); },
    addSystemUser: async (u, adm) => { await postData('system-users', {...u, _adminUser: adm}); fetchData(); },
    updateSystemUser: async (u, adm) => { await putData('system-users', {...u, _adminUser: adm}); fetchData(); },
    deleteSystemUser: async (id) => { await fetch(`${API_URL}/api/system-users/${id}`, {method: 'DELETE'}); fetchData(); }
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
