
import React, { useState, useEffect } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField, DeviceStatus, SoftwareAccount, ExternalDbConfig, ExpedienteAlert } from '../types';

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
  const [accounts, setAccounts] = useState<SoftwareAccount[]>([]);
  
  // ERP Integration State
  const [externalDbConfig, setExternalDbConfig] = useState<ExternalDbConfig | null>(null);
  const [expedienteAlerts, setExpedienteAlerts] = useState<ExpedienteAlert[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const safeJson = async (res: Response, endpoint: string) => {
      if (!res.ok) {
          const text = await res.text();
          throw new Error(`Erro no endpoint ${endpoint}: ${res.status} ${res.statusText}. Detalhe: ${text.substring(0, 50)}`);
      }
      return res.json();
  };

  const fetchData = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      
      // Se for atualização silenciosa (navegação), usa o endpoint /api/sync que economiza 99% de banda (sem fotos)
      const endpoint = silent ? '/api/sync' : '/api/bootstrap';
      console.log(`[ITAsset360] Sincronizando dados via ${endpoint}...`);

      const res = await fetch(`${API_URL}${endpoint}`);
      const data = await safeJson(res, endpoint);

      const {
          devices: devicesData, sims: simsData, users: usersData, logs: logsData, 
          maintenances: maintData, terms: termsData, accounts: accountsData
      } = data;

      setDevices(devicesData);
      setSims(simsData);
      setUsers(usersData.map((u: User) => ({ 
          ...u, 
          terms: termsData.filter((t: Term) => t.userId === u.id) 
      })));
      setLogs(logsData);
      setMaintenances(maintData);
      // setTerms call removed as state is not defined and data is mapped to users
      setAccounts(accountsData);

      // Apenas atualiza catálogo no bootstrap inicial ou carregamento forçado
      if (!silent) {
          setSystemUsers(data.systemUsers || []);
          setSettings(data.settings || { appName: 'IT Asset', logoUrl: '' });
          setModels(data.models || []);
          setBrands(data.brands || []);
          setAssetTypes(data.assetTypes || []);
          setSectors(data.sectors || []);
          setAccessoryTypes(data.accessoryTypes || []);
          setCustomFields(data.customFields || []);
          
          // Busca configuração do ERP no bootstrap
          fetchExternalDbConfig();
      }
      
      setError(null);
    } catch (err: any) { 
        if (!silent) setError(err.message); 
        console.error("Sync Error:", err.message);
    } finally { 
        if (!silent) setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getLogDetail = async (id: string): Promise<AuditLog> => {
      const res = await fetch(`${API_URL}/api/logs/${id}`);
      return safeJson(res, `/api/logs/${id}`);
  };

  const getTermFile = async (id: string): Promise<string> => {
      const res = await fetch(`${API_URL}/api/terms/${id}/file`);
      const data = await safeJson(res, `/api/terms/${id}/file`);
      return data.fileUrl || '';
  };

  const getDeviceInvoice = async (id: string): Promise<string> => {
      const res = await fetch(`${API_URL}/api/devices/${id}/invoice`);
      const data = await safeJson(res, `/api/devices/${id}/invoice`);
      return data.invoiceUrl || '';
  };

  const getMaintenanceInvoice = async (id: string): Promise<string> => {
      const res = await fetch(`${API_URL}/api/maintenances/${id}/invoice`);
      const data = await safeJson(res, `/api/maintenances/${id}/invoice`);
      return data.invoiceUrl || '';
  };

  const postData = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return safeJson(res, endpoint);
  };

  const putData = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}/api/${endpoint}/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return safeJson(res, endpoint);
  };

  // CRUD Dispositivos
  const addDevice = async (device: Device, adminName: string) => { await postData('devices', { ...device, _adminUser: adminName }); fetchData(true); };
  const updateDevice = async (device: Device, adminName: string) => { await putData('devices', { ...device, _adminUser: adminName }); fetchData(true); };
  const deleteDevice = async (id: string, adminName: string, reason: string) => {
    const device = devices.find(d => d.id === id);
    if (device) { 
        const updatedDevice = { ...device, status: DeviceStatus.RETIRED, currentUserId: null };
        await putData('devices', { ...updatedDevice, _adminUser: adminName, _reason: reason }); 
        fetchData(true);
    }
  };

  const restoreDevice = async (id: string, adminName: string, reason: string) => {
    const device = devices.find(d => d.id === id);
    if (device) { 
        const restored = { ...device, status: DeviceStatus.AVAILABLE, currentUserId: null };
        await putData('devices', { ...restored, _adminUser: adminName, _reason: reason }); 
        fetchData(true);
    }
  };

  const addUser = async (user: User, adminName: string) => { await postData('users', { ...user, _adminUser: adminName }); fetchData(true); };
  const updateUser = async (user: User, adminName: string, notes?: string) => { await putData('users', { ...user, _adminUser: adminName, _notes: notes }); fetchData(true); };
  const toggleUserActive = async (user: User, adminName: string, reason?: string) => {
    const updated = { ...user, active: !user.active };
    await putData('users', { ...updated, _adminUser: adminName, _reason: reason });
    fetchData(true);
  };

  const addAccount = async (account: SoftwareAccount, adminName: string) => { await postData('accounts', { ...account, _adminUser: adminName }); fetchData(true); };
  const updateAccount = async (account: SoftwareAccount, adminName: string) => { await putData('accounts', { ...account, _adminUser: adminName }); fetchData(true); };
  const deleteAccount = async (id: string, adminName: string) => {
    await fetch(`${API_URL}/api/accounts/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _adminUser: adminName }) });
    fetchData(true);
  };

  const updateTermFile = async (termId: string, userId: string, fileUrl: string, adminName: string) => {
      try { await putData('terms/file', { id: termId, fileUrl, _adminUser: adminName }); fetchData(true); } catch (err) { alert("Falha ao salvar arquivo do termo."); }
  };

  const deleteTermFile = async (termId: string, userId: string, reason: string, adminName: string) => {
      try { await fetch(`${API_URL}/api/terms/${termId}/file`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ _adminUser: adminName, reason }) }); fetchData(true); } catch (err) { alert("Falha ao excluir arquivo do termo."); }
  };

  const addSim = async (s: SimCard, a: string) => { await postData('sims', {...s, _adminUser: a}); fetchData(true); };
  const updateSim = async (s: SimCard, a: string) => { await putData('sims', {...s, _adminUser: a}); fetchData(true); };
  const deleteSim = async (id: string, a: string, r: string) => { 
      await fetch(`${API_URL}/api/sims/${id}`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({_adminUser: a, reason: r}) });
      fetchData(true);
  };

  const fetchExternalDbConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/external-db/config`);
      const data = await safeJson(res, '/api/admin/external-db/config');
      setExternalDbConfig(data);
    } catch (err) {
      console.error("Erro ao buscar config ERP:", err);
    }
  };

  const fetchExpedienteAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard/expediente-alerts`);
      const data = await safeJson(res, '/api/dashboard/expediente-alerts');
      setExpedienteAlerts(data);
    } catch (err) {
      console.error("Erro ao buscar alertas de expediente:", err);
    }
  };

  const updateExternalDbConfig = async (config: ExternalDbConfig, adminName: string) => {
    await postData('admin/external-db/config', { ...config, _adminUser: adminName });
    setExternalDbConfig(config);
  };

  const testExternalDbConnection = async (config: ExternalDbConfig) => {
    const res = await fetch(`${API_URL}/api/admin/external-db/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return safeJson(res, '/api/admin/external-db/test');
  };

  const value: DataContextType = {
    devices, sims, users, logs, loading, error, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields,
    accounts, externalDbConfig, expedienteAlerts, fetchData, refreshData: fetchData, getTermFile, getDeviceInvoice, getMaintenanceInvoice, getLogDetail,
    addAccount, updateAccount, deleteAccount, addDevice, updateDevice, deleteDevice, restoreDevice, addSim, updateSim, deleteSim, addUser, updateUser, toggleUserActive,
    updateSettings: async (s: SystemSettings, a: string) => { await fetch(`${API_URL}/api/settings`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...s, _adminUser: a}) }); setSettings(s); },
    assignAsset: async (at, aid, uid, n, adm, acc) => { await postData('operations/checkout', { assetId: aid, assetType: at, userId: uid, notes: n, _adminUser: adm, accessories: acc }); fetchData(true); },
    returnAsset: async (at, aid, n, adm, list, inactivate) => { await postData('operations/checkin', { assetId: aid, assetType: at, notes: n, _adminUser: adm, returnedChecklist: list, inactivateUser: inactivate }); fetchData(true); },
    updateTermFile, deleteTermFile, getHistory: (id) => logs.filter(l => l.assetId === id),
    clearLogs: async () => { await fetch(`${API_URL}/api/logs`, { method: 'DELETE' }); fetchData(true); },
    restoreItem: async (lid, adm) => { await postData('restore', { logId: lid, _adminUser: adm }); fetchData(true); },
    // Fix: replaced 'a' with 'adm' to match function parameters
    addAssetType: async (t, adm) => { await postData('asset-types', {...t, _adminUser: adm}); fetchData(true); },
    updateAssetType: async (t, adm) => { await putData('asset-types', {...t, _adminUser: adm}); fetchData(true); },
    deleteAssetType: async (id) => { await fetch(`${API_URL}/api/asset-types/${id}`, {method: 'DELETE'}); fetchData(true); },
    addBrand: async (b, adm) => { await postData('brands', {...b, _adminUser: adm}); fetchData(true); },
    updateBrand: async (b, adm) => { await putData('brands', {...b, _adminUser: adm}); fetchData(true); },
    deleteBrand: async (id) => { await fetch(`${API_URL}/api/brands/${id}`, {method: 'DELETE'}); fetchData(true); },
    addModel: async (m, adm) => { await postData('models', {...m, _adminUser: adm}); fetchData(true); },
    updateModel: async (m, adm) => { await putData('models', {...m, _adminName: adm}); fetchData(true); },
    deleteModel: async (id) => { await fetch(`${API_URL}/api/models/${id}`, {method: 'DELETE'}); fetchData(true); },
    addMaintenance: async (m, adm) => { await postData('maintenances', {...m, _adminUser: adm}); fetchData(true); },
    deleteMaintenance: async (id) => { await fetch(`${API_URL}/api/maintenances/${id}`, {method: 'DELETE'}); fetchData(true); },
    finishMaintenance: async (did, m, adm) => { await putData('maintenances/finish', { ...m, deviceId: did, _adminUser: adm }); fetchData(true); },
    addSector: async (s, adm) => { await postData('sectors', { ...s, _adminUser: adm }); fetchData(true); },
    updateSector: async (s, adm) => { await putData('sectors', { ...s, _adminUser: adm }); fetchData(true); },
    deleteSector: async (id) => { await fetch(`${API_URL}/api/sectors/${id}`, {method: 'DELETE'}); fetchData(true); },
    addAccessoryType: async (t, adm) => { await postData('accessory-types', {...t, _adminUser: adm}); fetchData(true); },
    updateAccessoryType: async (t, adm) => { await putData('accessory-types', {...t, _adminUser: adm}); fetchData(true); },
    deleteAccessoryType: async (id) => { await fetch(`${API_URL}/api/accessory-types/${id}`, {method: 'DELETE'}); fetchData(true); },
    addCustomField: async (f, adm) => { await postData('custom-fields', {...f, _adminUser: adm}); fetchData(true); },
    updateCustomField: async (f, adm) => { await putData('custom-fields', {...f, _adminUser: adm}); fetchData(true); },
    deleteCustomField: async (id) => { await fetch(`${API_URL}/api/custom-fields/${id}`, {method: 'DELETE'}); fetchData(true); },
    addSystemUser: async (u, adm) => { await postData('system-users', {...u, _adminUser: adm}); fetchData(true); },
    updateSystemUser: async (u, adm) => { await putData('system-users', {...u, _adminUser: adm}); fetchData(true); },
    deleteSystemUser: async (id) => { await fetch(`${API_URL}/api/system-users/${id}`, {method: 'DELETE'}); fetchData(true); },
    updateExternalDbConfig, testExternalDbConnection, fetchExpedienteAlerts
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
