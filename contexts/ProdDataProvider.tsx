import React, { useState, useEffect } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term } from '../types';

// API Configuration Relative Path
// Agora usamos o Nginx como Proxy Reverso.
// O navegador chama /api/... na porta 8083, e o Nginx repassa para a API na porta 5000 internamente.
const API_URL = ''; // Deixamos vazio para usar o mesmo host/porta, pois os endpoints abaixo já começam com /api

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      console.log(`[ITAsset360] Conectando API via Proxy Nginx (/api)`);
      try {
        setLoading(true);
        // Execute fetches safely using relative paths
        const [
            devicesRes, simsRes, usersRes, logsRes, sysUsersRes, settingsRes, 
            modelsRes, brandsRes, typesRes, maintRes, sectorsRes, termsRes
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
          fetch(`${API_URL}/api/terms`)
        ]);

        if (!devicesRes.ok) {
           const text = await devicesRes.text();
           throw new Error(`API Error ${devicesRes.status}: ${text}`);
        }

        // Process Users and Terms safely
        const fetchedUsers: User[] = await usersRes.json();
        
        let fetchedTerms: Term[] = [];
        if (termsRes.ok) {
            fetchedTerms = await termsRes.json();
        }

        // Map terms into users structure
        const usersWithTerms = fetchedUsers.map(u => ({
            ...u,
            terms: fetchedTerms.filter(t => t.userId === u.id)
        }));

        setDevices(await devicesRes.json());
        setSims(await simsRes.json());
        setUsers(usersWithTerms);
        setLogs(await logsRes.json());
        
        if (sysUsersRes.ok) setSystemUsers(await sysUsersRes.json());
        if (settingsRes.ok) setSettings(await settingsRes.json());
        
        setModels(await modelsRes.json());
        setBrands(await brandsRes.json());
        setAssetTypes(await typesRes.json());
        setMaintenances(await maintRes.json());
        if (sectorsRes.ok) setSectors(await sectorsRes.json());
        setTerms(fetchedTerms);
        
      } catch (err: any) {
        console.error("API Connection Failed. Verifique se o container API está rodando.", err);
        setError(`Erro de Conexão: ${err.message}.`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Generic POST helper
  const postData = async (endpoint: string, data: any) => {
    // Note: endpoint passed usually doesn't have /api prefix in the calls below, so we add it if needed
    // But inspecting the code below, calls are like postData('devices'...).
    // We need to ensure we hit /api/devices
    const res = await fetch(`${API_URL}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Failed to post to ${endpoint}`);
    return res.json();
  };

  // Generic PUT helper
  const putData = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api/${endpoint}/${data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  };

  // Generic DELETE helper
  const deleteData = async (endpoint: string, id: string) => {
    await fetch(`${API_URL}/api/${endpoint}/${id}`, { method: 'DELETE' });
  };

  // --- CRUD Implementations ---

  const addDevice = async (device: Device, adminName: string) => {
    try {
      const saved = await postData('devices', { ...device, _adminUser: adminName });
      setDevices(prev => [...prev, saved]);
    } catch (e) { alert('Erro ao salvar dispositivo'); }
  };

  const updateDevice = async (device: Device, adminName: string) => {
    await putData('devices', { ...device, _adminUser: adminName });
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
  };

  const deleteDevice = async (id: string, adminName: string) => {
    await deleteData('devices', id);
    setDevices(prev => prev.filter(d => d.id !== id));
  };

  const addSim = async (sim: SimCard, adminName: string) => {
    const saved = await postData('sims', { ...sim, _adminUser: adminName });
    setSims(prev => [...prev, saved]);
  };

  const updateSim = async (sim: SimCard, adminName: string) => {
    await putData('sims', { ...sim, _adminUser: adminName });
    setSims(prev => prev.map(s => s.id === sim.id ? sim : s));
  };

  const deleteSim = async (id: string, adminName: string) => {
    await deleteData('sims', id);
    setSims(prev => prev.filter(s => s.id !== id));
  };

  const addUser = async (user: User, adminName: string) => {
    const saved = await postData('users', { ...user, _adminUser: adminName });
    setUsers(prev => [...prev, { ...saved, terms: [] }]);
  };

  const updateUser = async (user: User, adminName: string) => {
    await putData('users', { ...user, _adminUser: adminName });
    setUsers(prev => prev.map(u => u.id === user.id ? user : u));
  };

  const toggleUserActive = async (user: User, adminName: string) => {
    const updatedUser = { ...user, active: !user.active };
    await putData('users', { ...updatedUser, _adminUser: adminName });
    setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
  };

  // System Users
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

  // Settings
  const updateSettings = async (newSettings: SystemSettings, adminName: string) => {
      await fetch(`${API_URL}/api/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newSettings, _adminUser: adminName })
      });
      setSettings(newSettings);
  };

  const assignAsset = async (assetType: 'Device' | 'Sim', assetId: string, userId: string, notes: string, adminName: string, termFile?: File) => {
    const payload = { assetId, assetType, userId, notes, action: 'CHECKOUT', _adminUser: adminName };
    await postData('operations/checkout', payload);
    window.location.reload(); 
  };

  const returnAsset = async (assetType: 'Device' | 'Sim', assetId: string, notes: string, adminName: string, termFile?: File) => {
    const payload = { assetId, assetType, notes, action: 'CHECKIN', _adminUser: adminName };
    await postData('operations/checkin', payload);
    window.location.reload();
  };

  const getHistory = (assetId: string) => {
    return logs.filter(l => l.assetId === assetId);
  };

  // --- New CRUD Implementations ---

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
  const deleteBrand = async (id: string, adminName: string) => {
      await deleteData('brands', id);
      setBrands(prev => prev.filter(b => b.id !== id));
  };

  const addAssetType = async (type: AssetType, adminName: string) => {
      const saved = await postData('asset-types', { ...type, _adminUser: adminName });
      setAssetTypes(prev => [...prev, saved]);
  };
  const deleteAssetType = async (id: string, adminName: string) => {
      await deleteData('asset-types', id);
      setAssetTypes(prev => prev.filter(t => t.id !== id));
  };

  const addMaintenance = async (record: MaintenanceRecord, adminName: string) => {
      const saved = await postData('maintenances', { ...record, _adminUser: adminName });
      setMaintenances(prev => [...prev, saved]);
  };
  const deleteMaintenance = async (id: string, adminName: string) => {
      await deleteData('maintenances', id);
      setMaintenances(prev => prev.filter(m => m.id !== id));
  };

  const addSector = async (sector: UserSector, adminName: string) => {
      const saved = await postData('sectors', { ...sector, _adminUser: adminName });
      setSectors(prev => [...prev, saved]);
  };
  const deleteSector = async (id: string, adminName: string) => {
      await deleteData('sectors', id);
      setSectors(prev => prev.filter(s => s.id !== id));
  };

  const value: DataContextType = {
    devices, sims, users, logs, loading, error, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors,
    addDevice, updateDevice, deleteDevice,
    addSim, updateSim, deleteSim,
    addUser, updateUser, toggleUserActive,
    addSystemUser, updateSystemUser, deleteSystemUser,
    updateSettings,
    assignAsset, returnAsset, getHistory,
    addModel, updateModel, deleteModel,
    addBrand, deleteBrand,
    addAssetType, deleteAssetType,
    addMaintenance, deleteMaintenance,
    addSector, deleteSector
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};