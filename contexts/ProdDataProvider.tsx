
import React, { useState, useEffect } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField } from '../types';

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

  const safeJson = async (res: Response, fallbackValue: any = []) => {
      if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `${res.status} ${res.statusText}`);
      }
      return res.json();
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null); // Limpar erros anteriores para permitir nova tentativa de render
      const [devs, simsR, usrs, logsR, sysUsrs, setts, mods, brnds, typs, maints, sects, accTyps, cFields] = await Promise.all([
        fetch(`${API_URL}/api/devices`).then(r => safeJson(r)),
        fetch(`${API_URL}/api/sims`).then(r => safeJson(r)),
        fetch(`${API_URL}/api/users`).then(r => safeJson(r)),
        fetch(`${API_URL}/api/logs`).then(r => safeJson(r)),
        fetch(`${API_URL}/api/system-users`).then(r => safeJson(r)),
        fetch(`${API_URL}/api/settings`).then(r => safeJson(r, {})),
        fetch(`${API_URL}/api/models`).then(r => safeJson(r)),
        fetch(`${API_URL}/api/brands`).then(r => safeJson(r)),
        fetch(`${API_URL}/api/asset-types`).then(r => safeJson(r)),
        fetch(`${API_URL}/api/maintenances`).then(r => safeJson(r)),
        fetch(`${API_URL}/api/sectors`).then(r => safeJson(r)),
        fetch(`${API_URL}/api/accessory-types`).then(r => safeJson(r)),
        fetch(`${API_URL}/api/custom-fields`).then(r => safeJson(r))
      ]);

      setDevices(devs);
      setSims(simsR);
      setUsers(usrs);
      setLogs(logsR);
      setSystemUsers(sysUsrs);
      setSettings(setts);
      setModels(mods);
      setBrands(brnds);
      setAssetTypes(typs);
      setMaintenances(maints);
      setSectors(sects);
      setAccessoryTypes(accTyps);
      setCustomFields(cFields);
    } catch (err: any) {
      setError(err.message);
      console.error("[ITAsset360] Erro ao sincronizar:", err);
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

  const deleteData = async (endpoint: string, id: string) => {
    await fetch(`${API_URL}/api/${endpoint}/${id}`, { method: 'DELETE' });
  };

  const addDevice = async (d: Device, admin: string) => { await postData('devices', { ...d, _adminUser: admin }); await fetchData(); };
  const updateDevice = async (d: Device, admin: string) => { await putData('devices', { ...d, _adminUser: admin }); await fetchData(); };
  const deleteDevice = async (id: string, admin: string, reason: string) => { await fetch(`${API_URL}/api/devices/${id}`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({_adminUser: admin, reason}) }); await fetchData(); };

  const addUser = async (u: User, admin: string) => { await postData('users', { ...u, _adminUser: admin }); await fetchData(); };
  const updateUser = async (u: User, admin: string) => { await putData('users', { ...u, _adminUser: admin }); await fetchData(); };
  const toggleUserActive = async (u: User, admin: string, reason?: string) => { await putData('users', { ...u, active: !u.active, _adminUser: admin, _reason: reason }); await fetchData(); };

  const addSector = async (s: UserSector, admin: string) => { await postData('sectors', { ...s, _adminUser: admin }); await fetchData(); };
  const updateSector = async (s: UserSector, admin: string) => { await putData('sectors', { ...s, _adminUser: admin }); await fetchData(); };
  const deleteSector = async (id: string, admin: string) => { await deleteData('sectors', id); await fetchData(); };

  const addSim = async (s: SimCard, admin: string) => { await postData('sims', { ...s, _adminUser: admin }); await fetchData(); };
  const updateSim = async (s: SimCard, admin: string) => { await putData('sims', { ...s, _adminUser: admin }); await fetchData(); };
  const deleteSim = async (id: string, admin: string, reason: string) => { await fetch(`${API_URL}/api/sims/${id}`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({_adminUser: admin, reason}) }); await fetchData(); };

  const addAssetType = async (t: AssetType, admin: string) => { await postData('asset-types', { ...t, _adminUser: admin }); await fetchData(); };
  const updateAssetType = async (t: AssetType, admin: string) => { await putData('asset-types', { ...t, _adminUser: admin }); await fetchData(); };
  const deleteAssetType = async (id: string, admin: string) => { await deleteData('asset-types', id); await fetchData(); };

  const addBrand = async (b: DeviceBrand, admin: string) => { await postData('brands', { ...b, _adminUser: admin }); await fetchData(); };
  const updateBrand = async (b: DeviceBrand, admin: string) => { await putData('brands', { ...b, _adminUser: admin }); await fetchData(); };
  const deleteBrand = async (id: string, admin: string) => { await deleteData('brands', id); await fetchData(); };

  const addModel = async (m: DeviceModel, admin: string) => { await postData('models', { ...m, _adminUser: admin }); await fetchData(); };
  const updateModel = async (m: DeviceModel, admin: string) => { await putData('models', { ...m, _adminUser: admin }); await fetchData(); };
  const deleteModel = async (id: string, admin: string) => { await deleteData('models', id); await fetchData(); };

  const addMaintenance = async (r: MaintenanceRecord, admin: string) => { await postData('maintenances', { ...r, _adminUser: admin }); await fetchData(); };
  const deleteMaintenance = async (id: string, admin: string) => { await deleteData('maintenances', id); await fetchData(); };

  const addAccessoryType = async (t: AccessoryType, admin: string) => { await postData('accessory-types', { ...t, _adminUser: admin }); await fetchData(); };
  const updateAccessoryType = async (t: AccessoryType, admin: string) => { await putData('accessory-types', { ...t, _adminUser: admin }); await fetchData(); };
  const deleteAccessoryType = async (id: string, admin: string) => { await deleteData('accessory-types', id); await fetchData(); };

  const addCustomField = async (f: CustomField, admin: string) => { await postData('custom-fields', { ...f, _adminUser: admin }); await fetchData(); };
  const deleteCustomField = async (id: string, admin: string) => { await deleteData('custom-fields', id); await fetchData(); };

  const assignAsset = async (type: 'Device' | 'Sim', id: string, uId: string, notes: string, admin: string) => {
    await postData(`operations/checkout`, { assetId: id, assetType: type, userId: uId, notes, action: 'CHECKOUT', _adminUser: admin });
    await fetchData();
  };

  const returnAsset = async (type: 'Device' | 'Sim', id: string, notes: string, admin: string) => {
    await postData(`operations/checkin`, { assetId: id, assetType: type, notes, action: 'CHECKIN', _adminUser: admin });
    await fetchData();
  };

  const getHistory = (id: string) => logs.filter(l => l.assetId === id);
  const clearLogs = async () => { await fetch(`${API_URL}/api/logs`, { method: 'DELETE' }); await fetchData(); };
  const restoreItem = async (logId: string, admin: string) => { await postData('restore', { logId, _adminUser: admin }); await fetchData(); };
  const updateSettings = async (s: SystemSettings, admin: string) => { await fetch(`${API_URL}/api/settings`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...s, _adminUser: admin}) }); await fetchData(); };
  const addSystemUser = async (u: SystemUser, admin: string) => { await postData('system-users', u); await fetchData(); };
  const updateSystemUser = async (u: SystemUser, admin: string) => { await putData('system-users', u); await fetchData(); };
  const deleteSystemUser = async (id: string, admin: string) => { await deleteData('system-users', id); await fetchData(); };

  const value: DataContextType = {
    devices, sims, users, logs, loading, error, systemUsers, settings, models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields,
    addDevice, updateDevice, deleteDevice, addSim, updateSim, deleteSim, addUser, updateUser, toggleUserActive, addSystemUser, updateSystemUser, deleteSystemUser, updateSettings, assignAsset, returnAsset, getHistory, clearLogs, restoreItem, addModel, updateModel, deleteModel, addBrand, updateBrand, deleteBrand, addAssetType, updateAssetType, deleteAssetType, addMaintenance, deleteMaintenance, addSector, deleteSector, addAccessoryType, updateAccessoryType, deleteAccessoryType, addCustomField, deleteCustomField
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
