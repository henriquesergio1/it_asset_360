import React, { useState, useEffect } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType } from '../types';

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

  const fetchLogs = async () => {
      try {
          const res = await fetch(`${API_URL}/api/logs`);
          if (res.ok) setLogs(await res.json());
      } catch (e) { console.error('Failed to fetch logs', e); }
  };

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      console.log(`[ITAsset360] Conectando API via Proxy Nginx (/api)`);
      try {
        setLoading(true);
        // Execute fetches safely using relative paths
        const [
            devicesRes, simsRes, usersRes, logsRes, sysUsersRes, settingsRes, 
            modelsRes, brandsRes, typesRes, maintRes, sectorsRes, termsRes, accTypesRes
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
          fetch(`${API_URL}/api/accessory-types`)
        ]);

        // Process Responses safely
        const devicesData = await safeJson(devicesRes);
        const simsData = await safeJson(simsRes);
        const usersData: User[] = await safeJson(usersRes);
        const termsData: Term[] = await safeJson(termsRes, []); // Fallback not used due to throw, but standard
        
        // Map terms into users structure
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
        setTerms(termsData);
        
      } catch (err: any) {
        console.error("API Connection Failed.", err);
        setError(`Erro de Conexão: ${err.message}. Verifique o container API.`);
      } finally {
        setLoading(false);
      }
    };

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
  const deleteData = async (endpoint: string, id: string) => {
    const res = await fetch(`${API_URL}/api/${endpoint}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
  };

  // --- CRUD Implementations ---

  const addDevice = async (device: Device, adminName: string) => {
    try {
      const saved = await postData('devices', { ...device, _adminUser: adminName });
      setDevices(prev => [...prev, saved]);
      fetchLogs();
    } catch (e) { alert('Erro ao salvar dispositivo'); }
  };

  const updateDevice = async (device: Device, adminName: string) => {
    await putData('devices', { ...device, _adminUser: adminName });
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
    fetchLogs();
  };

  const deleteDevice = async (id: string, adminName: string) => {
    await deleteData('devices', id);
    setDevices(prev => prev.filter(d => d.id !== id));
    fetchLogs();
  };

  const addSim = async (sim: SimCard, adminName: string) => {
    const saved = await postData('sims', { ...sim, _adminUser: adminName });
    setSims(prev => [...prev, saved]);
    fetchLogs();
  };

  const updateSim = async (sim: SimCard, adminName: string) => {
    await putData('sims', { ...sim, _adminUser: adminName });
    setSims(prev => prev.map(s => s.id === sim.id ? sim : s));
    fetchLogs();
  };

  const deleteSim = async (id: string, adminName: string) => {
    await deleteData('sims', id);
    setSims(prev => prev.filter(s => s.id !== id));
    fetchLogs();
  };

  const addUser = async (user: User, adminName: string) => {
    const saved = await postData('users', { ...user, _adminUser: adminName });
    setUsers(prev => [...prev, { ...saved, terms: [] }]);
    fetchLogs();
  };

  const updateUser = async (user: User, adminName: string) => {
    await putData('users', { ...user, _adminUser: adminName });
    setUsers(prev => prev.map(u => u.id === user.id ? user : u));
    fetchLogs();
  };

  const toggleUserActive = async (user: User, adminName: string) => {
    const updatedUser = { ...user, active: !user.active };
    await putData('users', { ...updatedUser, _adminUser: adminName });
    setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    fetchLogs(); // Essential: Update logs to show "Inativação"/"Ativação" immediately
  };

  // System Users
  const addSystemUser = async (user: SystemUser, adminName: string) => {
    const saved = await postData('system-users', { ...user, _adminUser: adminName });
    setSystemUsers(prev => [...prev, saved]);
    fetchLogs();
  };

  const updateSystemUser = async (user: SystemUser, adminName: string) => {
    await putData('system-users', { ...user, _adminUser: adminName });
    setSystemUsers(prev => prev.map(u => u.id === user.id ? user : u));
    fetchLogs();
  };

  const deleteSystemUser = async (id: string, adminName: string) => {
    await deleteData('system-users', id);
    setSystemUsers(prev => prev.filter(u => u.id !== id));
    fetchLogs();
  };

  // Settings
  const updateSettings = async (newSettings: SystemSettings, adminName: string) => {
      await fetch(`${API_URL}/api/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newSettings, _adminUser: adminName })
      });
      setSettings(newSettings);
      fetchLogs();
  };

  // --- Operations Logic Updated to Create Terms ---
  const assignAsset = async (assetType: 'Device' | 'Sim', assetId: string, userId: string, notes: string, adminName: string, termFile?: File) => {
    // 1. Log Operation (Checkout)
    const payload = { assetId, assetType, userId, notes, action: 'CHECKOUT', _adminUser: adminName };
    await postData('operations/checkout', payload);

    // 2. Create Term Record (Pending or Signed)
    // We need asset name for term record
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
        id: Math.random().toString(36).substr(2, 9), // API should ideally generate ID, but we do it here for now
        userId,
        type: 'ENTREGA',
        assetDetails: assetName,
        date: new Date().toISOString(),
        fileUrl: termFile ? 'PENDING_UPLOAD' : '' // 'PENDING_UPLOAD' is just a placeholder logic, simpler is empty string if no file
    };

    if (termFile) {
        // Mocking the URL for prod demo (in real world, upload endpoint needed)
        termData.fileUrl = "signed_doc.pdf"; 
    } else {
        termData.fileUrl = "";
    }

    await postData('terms', termData);
    window.location.reload(); 
  };

  const returnAsset = async (assetType: 'Device' | 'Sim', assetId: string, notes: string, adminName: string, termFile?: File) => {
    // Determine User before checkin
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

    // 1. Log Operation
    const payload = { assetId, assetType, notes, action: 'CHECKIN', _adminUser: adminName };
    await postData('operations/checkin', payload);

    // 2. Create Return Term Record
    if (userId) {
        const termData: Term = {
            id: Math.random().toString(36).substr(2, 9),
            userId,
            type: 'DEVOLUCAO',
            assetDetails: assetName,
            date: new Date().toISOString(),
            fileUrl: termFile ? "signed_return.pdf" : ""
        };
        await postData('terms', termData);
    }

    window.location.reload();
  };

  const getHistory = (assetId: string) => {
    return logs.filter(l => l.assetId === assetId);
  };

  // --- New CRUD Implementations ---

  const addModel = async (model: DeviceModel, adminName: string) => {
      const saved = await postData('models', { ...model, _adminUser: adminName });
      setModels(prev => [...prev, saved]);
      fetchLogs();
  };
  const updateModel = async (model: DeviceModel, adminName: string) => {
      await putData('models', { ...model, _adminUser: adminName });
      setModels(prev => prev.map(m => m.id === model.id ? model : m));
      fetchLogs();
  };
  const deleteModel = async (id: string, adminName: string) => {
      await deleteData('models', id);
      setModels(prev => prev.filter(m => m.id !== id));
      fetchLogs();
  };

  const addBrand = async (brand: DeviceBrand, adminName: string) => {
      const saved = await postData('brands', { ...brand, _adminUser: adminName });
      setBrands(prev => [...prev, saved]);
      fetchLogs();
  };
  const deleteBrand = async (id: string, adminName: string) => {
      await deleteData('brands', id);
      setBrands(prev => prev.filter(b => b.id !== id));
      fetchLogs();
  };

  const addAssetType = async (type: AssetType, adminName: string) => {
      const saved = await postData('asset-types', { ...type, _adminUser: adminName });
      setAssetTypes(prev => [...prev, saved]);
      fetchLogs();
  };
  const deleteAssetType = async (id: string, adminName: string) => {
      await deleteData('asset-types', id);
      setAssetTypes(prev => prev.filter(t => t.id !== id));
      fetchLogs();
  };

  const addMaintenance = async (record: MaintenanceRecord, adminName: string) => {
      const saved = await postData('maintenances', { ...record, _adminUser: adminName });
      setMaintenances(prev => [...prev, saved]);
      fetchLogs();
  };
  const deleteMaintenance = async (id: string, adminName: string) => {
      await deleteData('maintenances', id);
      setMaintenances(prev => prev.filter(m => m.id !== id));
      fetchLogs();
  };

  const addSector = async (sector: UserSector, adminName: string) => {
      const saved = await postData('sectors', { ...sector, _adminUser: adminName });
      setSectors(prev => [...prev, saved]);
      fetchLogs();
  };
  const deleteSector = async (id: string, adminName: string) => {
      await deleteData('sectors', id);
      setSectors(prev => prev.filter(s => s.id !== id));
      fetchLogs();
  };

  const addAccessoryType = async (type: AccessoryType, adminName: string) => {
      const saved = await postData('accessory-types', { ...type, _adminUser: adminName });
      setAccessoryTypes(prev => [...prev, saved]);
      fetchLogs();
  };
  const deleteAccessoryType = async (id: string, adminName: string) => {
      await deleteData('accessory-types', id);
      setAccessoryTypes(prev => prev.filter(t => t.id !== id));
      fetchLogs();
  };

  const value: DataContextType = {
    devices, sims, users, logs, loading, error, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes,
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
    addSector, deleteSector,
    addAccessoryType, deleteAccessoryType
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};