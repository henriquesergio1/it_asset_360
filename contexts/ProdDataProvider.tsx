
import React, { useState, useEffect } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField, DeviceStatus, SoftwareAccount } from '../types';

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
  const [accounts, setAccounts] = useState<SoftwareAccount[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const safeJson = async (res: Response, endpoint: string) => {
      if (!res.ok) {
          const text = await res.text();
          throw new Error(`Erro no endpoint ${endpoint}: ${res.status} ${res.statusText}. Detalhe: ${text.substring(0, 50)}`);
      }
      return res.json();
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log("[ITAsset360] Sincronizando dados com SQL Server via Bootstrap...");

      const res = await fetch(`${API_URL}/api/bootstrap`);
      const data = await safeJson(res, '/api/bootstrap');

      const {
          devices: devicesData, sims: simsData, users: usersData, logs: logsData, 
          systemUsers: sysUsersData, settings: settingsData, models: modelsData, 
          brands: brandsData, assetTypes: typesData, maintenances: maintData, 
          sectors: sectorsData, terms: termsData, accessoryTypes: accTypesData, 
          customFields: customFieldsData, accounts: accountsData
      } = data;

      setDevices(devicesData);
      setSims(simsData);
      
      setUsers(usersData.map((u: User) => ({ 
          ...u, 
          terms: termsData.filter((t: Term) => t.userId === u.id) 
      })));

      setLogs(logsData);
      setSystemUsers(sysUsersData);
      setSettings(settingsData);
      setModels(modelsData);
      setBrands(brandsData);
      setAssetTypes(typesData);
      setMaintenances(maintData);
      setSectors(sectorsData);
      setAccessoryTypes(accTypesData);
      setCustomFields(customFieldsData);
      setTerms(termsData);
      setAccounts(accountsData);
      
      setError(null);
    } catch (err: any) { 
        setError(err.message); 
    } finally { 
        setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  const postData = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return safeJson(res, endpoint);
  };

  const putData = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api/${endpoint}/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return safeJson(res, endpoint);
  };

  const addDevice = async (device: Device, adminName: string) => { 
      await postData('devices', { ...device, _adminUser: adminName }); 
      setDevices(p => [...p, device]); 
  };

  const updateDevice = async (device: Device, adminName: string) => { 
      await putData('devices', { ...device, _adminUser: adminName }); 
      setDevices(p => p.map(d => d.id === device.id ? device : d)); 
  };

  const deleteDevice = async (id: string, adminName: string, reason: string) => {
    const device = devices.find(d => d.id === id);
    if (device) { 
        const updatedDevice = { ...device, status: DeviceStatus.RETIRED, currentUserId: null };
        await putData('devices', { ...updatedDevice, _adminUser: adminName, _reason: reason }); 
        setDevices(p => p.map(d => d.id === id ? updatedDevice : d)); 
    }
  };

  const restoreDevice = async (id: string, adminName: string, reason: string) => {
    const device = devices.find(d => d.id === id);
    if (device) { 
        const restored = { ...device, status: DeviceStatus.AVAILABLE, currentUserId: null };
        await putData('devices', { ...restored, _adminUser: adminName, _reason: reason }); 
        setDevices(p => p.map(d => d.id === id ? restored : d)); 
    }
  };

  const addUser = async (user: User, adminName: string) => { await postData('users', { ...user, _adminUser: adminName }); setUsers(p => [...p, user]); };
  const updateUser = async (user: User, adminName: string, notes?: string) => { await putData('users', { ...user, _adminUser: adminName, _notes: notes }); setUsers(p => p.map(u => u.id === user.id ? user : u)); };
  
  const toggleUserActive = async (user: User, adminName: string, reason?: string) => {
    const updated = { ...user, active: !user.active };
    await putData('users', { ...updated, _adminUser: adminName, _reason: reason });
    setUsers(p => p.map(u => u.id === user.id ? updated : u));
  };

  const addAccount = async (account: SoftwareAccount, adminName: string) => { await postData('accounts', { ...account, _adminUser: adminName }); setAccounts(p => [...p, account]); };
  const updateAccount = async (account: SoftwareAccount, adminName: string) => { await putData('accounts', { ...account, _adminUser: adminName }); setAccounts(p => p.map(a => a.id === account.id ? account : a)); };
  const deleteAccount = async (id: string, adminName: string) => {
    await fetch(`${API_URL}/api/accounts/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _adminUser: adminName }) });
    setAccounts(p => p.filter(a => a.id !== id));
  };

  const updateTermFile = async (termId: string, userId: string, fileUrl: string, adminName: string) => {
      try {
          await putData('terms/file', { id: termId, fileUrl, _adminUser: adminName });
          setUsers(prev => prev.map(u => {
              if (u.id === userId) { const updatedTerms = (u.terms || []).map(t => t.id === termId ? { ...t, fileUrl } : t); return { ...u, terms: updatedTerms }; }
              return u;
          }));
      } catch (err) { alert("Falha ao salvar arquivo do termo."); }
  };

  const deleteTermFile = async (termId: string, userId: string, reason: string, adminName: string) => {
      try {
          await fetch(`${API_URL}/api/terms/${termId}/file`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ _adminUser: adminName, reason }) });
          setUsers(prev => prev.map(u => {
            if (u.id === userId) { const updatedTerms = (u.terms || []).map(t => t.id === termId ? { ...t, fileUrl: '' } : t); return { ...u, terms: updatedTerms }; }
            return u;
          }));
      } catch (err) { alert("Falha ao excluir arquivo do termo."); }
  };

  const addSim = async (s: SimCard, a: string) => { await postData('sims', {...s, _adminUser: a}); setSims(p => [...p, s]); };
  const updateSim = async (s: SimCard, a: string) => { await putData('sims', {...s, _adminUser: a}); setSims(p => p.map(x => x.id === s.id ? s : x)); };
  const deleteSim = async (id: string, a: string, r: string) => { 
      await fetch(`${API_URL}/api/sims/${id}`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({_adminUser: a, reason: r}) });
      setSims(p => p.filter(x => x.id !== id));
  };

  const addSector = async (s: UserSector, adm: string) => { await postData('sectors', { ...s, _adminUser: adm }); setSectors(prev => [...prev, s]); };
  const updateSector = async (s: UserSector, adm: string) => { await putData('sectors', { ...s, _adminUser: adm }); setSectors(prev => prev.map(x => x.id === s.id ? s : x)); };
  const addAssetType = async (t: AssetType, a: string) => { await postData('asset-types', {...t, _adminUser: a}); setAssetTypes(p => [...p, t]); };
  const updateAssetType = async (t: AssetType, a: string) => { await putData('asset-types', {...t, _adminUser: a}); setAssetTypes(p => p.map(x => x.id === t.id ? t : x)); };
  const addBrand = async (b: DeviceBrand, a: string) => { await postData('brands', {...b, _adminUser: a}); setBrands(p => [...p, b]); };
  const updateBrand = async (b: DeviceBrand, a: string) => { await putData('brands', {...b, _adminUser: a}); setBrands(p => p.map(x => x.id === b.id ? b : x)); };
  const addModel = async (m: DeviceModel, a: string) => { await postData('models', {...m, _adminUser: a}); setModels(p => [...p, m]); };
  const updateModel = async (m: DeviceModel, a: string) => { await putData('models', {...m, _adminUser: a}); setModels(p => p.map(x => x.id === m.id ? m : x)); };
  const updateSettings = async (s: SystemSettings, a: string) => { await fetch(`${API_URL}/api/settings`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...s, _adminUser: a}) }); setSettings(s); };

  const value: DataContextType = {
    devices, sims, users, logs, loading, error, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields,
    accounts, addAccount, updateAccount, deleteAccount,
    addDevice, updateDevice, deleteDevice, restoreDevice, addSim, updateSim, deleteSim, addUser, updateUser, toggleUserActive, updateSettings,
    assignAsset: async (at, aid, uid, n, adm, acc) => { 
        await postData('operations/checkout', { assetId: aid, assetType: at, userId: uid, notes: n, _adminUser: adm, accessories: acc }); 
        // Atualização reativa imediata do estado local
        if (at === 'Device') {
            setDevices(prev => prev.map(d => d.id === aid ? { ...d, status: DeviceStatus.IN_USE, currentUserId: uid, accessories: acc } : d));
        } else {
            setSims(prev => prev.map(s => s.id === aid ? { ...s, status: DeviceStatus.IN_USE, currentUserId: uid } : s));
        }
        fetchData(); // Sincronização de fundo
    },
    returnAsset: async (at, aid, n, adm, list, inactivate) => { 
        await postData('operations/checkin', { assetId: aid, assetType: at, notes: n, _adminUser: adm, returnedChecklist: list, inactivateUser: inactivate }); 
        // Atualização reativa imediata do estado local
        if (at === 'Device') {
            setDevices(prev => prev.map(d => d.id === aid ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null } : d));
            // Se houver chip vinculado no dispositivo sendo devolvido, a API libera ele também. Refletimos aqui:
            const dev = devices.find(d => d.id === aid);
            if (dev?.linkedSimId) {
                setSims(prev => prev.map(s => s.id === dev.linkedSimId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
            }
        } else {
            setSims(prev => prev.map(s => s.id === aid ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
        }
        if (inactivate) {
            const devOrSim = at === 'Device' ? devices.find(d => d.id === aid) : sims.find(s => s.id === aid);
            if (devOrSim?.currentUserId) {
                setUsers(prev => prev.map(u => u.id === devOrSim.currentUserId ? { ...u, active: false } : u));
            }
        }
        fetchData(); // Sincronização de fundo
    },
    updateTermFile, deleteTermFile, getHistory: (id) => logs.filter(l => l.assetId === id),
    clearLogs: async () => { await fetch(`${API_URL}/api/logs`, { method: 'DELETE' }); fetchData(); },
    restoreItem: async (lid, adm) => { await postData('restore', { logId: lid, _adminUser: adm }); fetchData(); },
    addAssetType, updateAssetType, deleteAssetType: async (id) => { await fetch(`${API_URL}/api/asset-types/${id}`, {method: 'DELETE'}); setAssetTypes(p => p.filter(x => x.id !== id)); },
    addBrand, updateBrand, deleteBrand: async (id) => { await fetch(`${API_URL}/api/brands/${id}`, {method: 'DELETE'}); setBrands(p => p.filter(x => x.id !== id)); },
    addModel, updateModel, deleteModel: async (id) => { await fetch(`${API_URL}/api/models/${id}`, {method: 'DELETE'}); setModels(p => p.filter(x => x.id !== id)); },
    addMaintenance: async (m, adm) => { await postData('maintenances', {...m, _adminUser: adm}); setMaintenances(p => [...p, m]); },
    deleteMaintenance: async (id) => { await fetch(`${API_URL}/api/maintenances/${id}`, {method: 'DELETE'}); setMaintenances(p => p.filter(x => x.id !== id)); },
    addSector, updateSector, deleteSector: async (id) => { await fetch(`${API_URL}/api/sectors/${id}`, {method: 'DELETE'}); fetchData(); },
    addAccessoryType: async (t, adm) => { await postData('accessory-types', {...t, _adminUser: adm}); setAccessoryTypes(p => [...p, t]); },
    updateAccessoryType: async (t, adm) => { await putData('accessory-types', {...t, _adminUser: adm}); setAccessoryTypes(p => p.map(x => x.id === t.id ? t : x)); },
    deleteAccessoryType: async (id) => { await fetch(`${API_URL}/api/accessory-types/${id}`, {method: 'DELETE'}); setAccessoryTypes(p => p.filter(x => x.id !== id)); },
    addCustomField: async (f, adm) => { await postData('custom-fields', {...f, _adminUser: adm}); setCustomFields(p => [...p, f]); },
    updateCustomField: async (f, adm) => { await putData('custom-fields', {...f, _adminUser: adm}); setCustomFields(p => p.map(x => x.id === f.id ? f : x)); },
    deleteCustomField: async (id) => { await fetch(`${API_URL}/api/custom-fields/${id}`, {method: 'DELETE'}); setCustomFields(p => p.filter(x => x.id !== id)); },
    addSystemUser: async (u, adm) => { await postData('system-users', {...u, _adminUser: adm}); setSystemUsers(p => [...p, u]); },
    updateSystemUser: async (u, adm) => { await putData('system-users', {...u, _adminUser: adm}); setSystemUsers(p => p.map(x => x.id === u.id ? u : x)); },
    deleteSystemUser: async (id) => { await fetch(`${API_URL}/api/system-users/${id}`, {method: 'DELETE'}); setSystemUsers(p => p.filter(x => x.id !== id)); }
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
