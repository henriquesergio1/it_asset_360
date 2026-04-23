import React, { useState } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { useToast } from './ToastContext';
import { Device, SimCard, User, AuditLog, DeviceStatus, ActionType, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField, DeviceAccessory, SoftwareAccount, ExternalDbConfig, ExpedienteAlert, Task, TaskLog, TaskStatus, TaskType, RecurrenceType, TaskRecurrenceConfig, Consumable, ConsumableTransaction } from '../types';
import { mockDevices, mockSims, mockUsers, mockAuditLogs, mockSystemUsers, mockSystemSettings, mockModels, mockBrands, mockAssetTypes, mockMaintenanceRecords, mockSectors, mockAccessoryTypes, mockCustomFields } from '../services/mockService';

export const MockDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  
  // RESET FORÇADO: Sempre usamos os dados do mockService para garantir que as alterações reflitam imediatamente
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [sims, setSims] = useState<SimCard[]>(mockSims);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [logs, setLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(mockSystemUsers);
  
  const [settings, setSettings] = useState<SystemSettings>(() => {
    // Forçar atualização das configurações mock
    const defaultSettings = { ...mockSystemSettings };
    localStorage.setItem('mock_settings', JSON.stringify(defaultSettings));
    return defaultSettings;
  });
  
  const [models, setModels] = useState<DeviceModel[]>(mockModels);
  const [brands, setBrands] = useState<DeviceBrand[]>(mockBrands);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>(mockAssetTypes);
  const [maintenances, setMaintenances] = useState<MaintenanceRecord[]>(mockMaintenanceRecords);
  const [sectors, setSectors] = useState<UserSector[]>(mockSectors);
  const [accessoryTypes, setAccessoryTypes] = useState<AccessoryType[]>(mockAccessoryTypes);
  const [customFields, setCustomFields] = useState<CustomField[]>(mockCustomFields);
  const [accounts, setAccounts] = useState<SoftwareAccount[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([
    { id: '1', name: 'Mouse Logitech', unit: 'UN', currentStock: 8, minStock: 5, category: 'Periféricos' },
    { id: '2', name: 'Teclado Dell', unit: 'UN', currentStock: 4, minStock: 10, category: 'Periféricos' }
  ]);
  const [consumableTransactions, setConsumableTransactions] = useState<ConsumableTransaction[]>([]);

  const isReadOnly = !settings.licenseExpires || new Date(settings.licenseExpires) <= new Date();

  const logAction = (action: ActionType, assetType: any, assetId: string, targetName: string, adminName: string, notes?: string) => {
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

  const value: DataContextType = {
    devices, sims, users, logs, loading: false, error: null, systemUsers, settings,
    models, brands, assetTypes, maintenances, sectors, accessoryTypes, customFields, accounts,
    externalDbConfig: null, expedienteAlerts: [], consumables, consumableTransactions,
    isReadOnly,
    fetchData: async () => {},
    refreshData: async () => {},
    getTermFile: async (id) => {
      // Simula a busca de um arquivo assinado no mock
      const userWithTerm = users.find(u => u.terms?.some(t => t.id === id));
      const term = userWithTerm?.terms?.find(t => t.id === id);
      if (term && (term.fileUrl || term.hasFile)) {
        return term.fileUrl || "data:application/pdf;base64,JVBERi0xLjQKJ...[MOCK_PDF_CONTENT]...";
      }
      return "";
    },
    getDeviceInvoice: async () => "",
    getMaintenanceInvoice: async () => "",
    getLogDetail: async (id) => logs.find(l => l.id === id) as any,
    addDevice: (d) => setDevices(p => [...p, d]),
    updateDevice: (d) => setDevices(p => p.map(x => x.id === d.id ? d : x)),
    deleteDevice: (id) => setDevices(p => p.filter(x => x.id !== id)),
    restoreDevice: (id) => {},
    addSim: (s) => setSims(p => [...p, s]),
    updateSim: (s) => setSims(p => p.map(x => x.id === s.id ? s : x)),
    deleteSim: (id) => setSims(p => p.filter(x => x.id !== id)),
    addUser: (u) => setUsers(p => [...p, u]),
    updateUser: (u) => setUsers(p => p.map(x => x.id === u.id ? u : x)),
    toggleUserActive: (u) => setUsers(p => p.map(x => x.id === u.id ? { ...x, active: !x.active } : x)),
    addSector: (s) => setSectors(p => [...p, s]),
    updateSector: (s) => setSectors(p => p.map(x => x.id === s.id ? s : x)),
    deleteSector: (id) => setSectors(p => p.filter(x => x.id !== id)),
    addAccount: (a) => setAccounts(p => [...p, a]),
    updateAccount: (a) => setAccounts(p => p.map(x => x.id === a.id ? a : x)),
    deleteAccount: (id) => setAccounts(p => p.filter(x => x.id !== id)),
    addSystemUser: (u) => setSystemUsers(p => [...p, u]),
    updateSystemUser: (u) => setSystemUsers(p => p.map(x => x.id === u.id ? u : x)),
    deleteSystemUser: (id) => setSystemUsers(p => p.filter(x => x.id !== id)),
    updateSettings: (s) => setSettings(s),
    assignAsset: (assetType, assetId, userId, notes, adminName, accessories) => {
      const user = users.find(u => u.id === userId);
      const isSim = assetType === 'Sim';
      const asset = isSim ? sims.find(s => s.id === assetId) : devices.find(d => d.id === assetId);
      
      if (!user || !asset) return;

      // Criação de Termo
      let assetDetails = '';
      let linkedSim: SimCard | undefined = undefined;

      if ('phoneNumber' in asset) {
        assetDetails = `[CHIP: ${asset.phoneNumber} | ICCID: ${asset.iccid}] Chip SIM Card`;
      } else {
        const tag = asset.assetTag || 'S/T';
        const sn = asset.serialNumber || 'S/N';
        const imei = asset.imei || 'S/I';
        assetDetails = `[TAG: ${tag} | S/N: ${sn} | IMEI: ${imei}] ${models.find(m => m.id === asset.modelId)?.name || 'Equipamento'}`;
        
        if (asset.linkedSimId) {
          linkedSim = sims.find(s => s.id === asset.linkedSimId);
        }
      }

      const newTerm: Term = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        type: 'ENTREGA',
        assetDetails,
        date: new Date().toISOString(),
        fileUrl: '',
        notes,
        accessories: accessories?.map(a => ({ id: a.id, name: a.name })) || [],
        linkedSim
      };

      const updatedUser = { ...user, terms: [newTerm, ...(user.terms || [])] };
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));

      // Atualiza status do ativo
      if (isSim) {
        setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.IN_USE, currentUserId: userId } : s));
      } else {
        setDevices(prev => prev.map(d => d.id === assetId ? { ...d, status: DeviceStatus.IN_USE, currentUserId: userId, accessories: accessories || [] } : d));
      }

      logAction(ActionType.CHECKOUT, assetType, assetId, user.fullName, adminName, notes);
      showToast('Termo de entrega gerado com sucesso', 'success');
    },
    returnAsset: (assetType, assetId, notes, adminName, returnedChecklist, inactivateUser, condition, damageDescription, evidenceFiles, isManual) => {
      const isSim = assetType === 'Sim';
      const asset = isSim ? sims.find(s => s.id === assetId) : devices.find(d => d.id === assetId);
      const userId = asset?.currentUserId;
      const user = users.find(u => u.id === userId);

      if (!asset || !userId || !user) return;

      // Criação de Termo de Devolução
      let assetDetails = '';
      let linkedSim: SimCard | undefined = undefined;

      if ('phoneNumber' in asset) {
        assetDetails = `[CHIP: ${asset.phoneNumber} | ICCID: ${asset.iccid}] Chip SIM Card`;
      } else {
        const tag = asset.assetTag || 'S/T';
        const sn = asset.serialNumber || 'S/N';
        const imei = asset.imei || 'S/I';
        assetDetails = `[TAG: ${tag} | S/N: ${sn} | IMEI: ${imei}] ${models.find(m => m.id === asset.modelId)?.name || 'Equipamento'}`;
        if (asset.linkedSimId) {
          linkedSim = sims.find(s => s.id === asset.linkedSimId);
        }
      }

      const newTerm: Term = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        type: 'DEVOLUCAO',
        assetDetails,
        date: new Date().toISOString(),
        fileUrl: '',
        notes,
        condition,
        damageDescription,
        evidenceFiles,
        accessories: !isSim ? (asset as Device).accessories?.map(a => ({ id: a.id, name: a.name })) : [],
        linkedSim
      };

      let updatedUser = { ...user, terms: [newTerm, ...(user.terms || [])] };
      if (inactivateUser) {
        updatedUser.active = false;
        updatedUser.status = 'Inativo';
      }
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));

      // Atualiza status do ativo
      if (isSim) {
        setSims(prev => prev.map(s => s.id === assetId ? { ...s, status: DeviceStatus.AVAILABLE, currentUserId: null } : s));
      } else {
        setDevices(prev => prev.map(d => d.id === assetId ? { ...d, status: DeviceStatus.AVAILABLE, currentUserId: null, accessories: [] } : d));
      }

      logAction(ActionType.CHECKIN, assetType, assetId, user.fullName, adminName, notes);
      showToast('Termo de devolução processado', 'success');
    },
    updateTermFile: () => {},
    deleteTermFile: () => {},
    updateTermDetails: () => {},
    clearLogs: () => setLogs([]),
    restoreItem: () => {},
    addAssetType: (t) => setAssetTypes(p => [...p, t]),
    updateAssetType: (t) => setAssetTypes(p => p.map(x => x.id === t.id ? t : x)),
    deleteAssetType: (id) => setAssetTypes(p => p.filter(x => x.id !== id)),
    addBrand: (b) => setBrands(p => [...p, b]),
    updateBrand: (b) => setBrands(p => p.map(x => x.id === b.id ? b : x)),
    deleteBrand: (id) => setBrands(p => p.filter(x => x.id !== id)),
    addModel: (m) => setModels(p => [...p, m]),
    updateModel: (m) => setModels(p => p.map(x => x.id === m.id ? m : x)),
    deleteModel: (id) => setModels(p => p.filter(x => x.id !== id)),
    tasks, taskLogs,
    addTask: async () => {}, updateTask: async () => {}, bulkUpdateTasks: async () => {}, 
    bulkUpdateDevices: async () => {}, fetchTaskLogs: async () => [],
    updateLicense: async () => ({ success: true }),
    getLicenseStatus: async () => ({ status: 'ACTIVE', client: settings.licenseClient || 'Mock', expiresAt: settings.licenseExpires || null }),
    addCustomField: () => {},
    updateCustomField: () => {},
    deleteCustomField: () => {},
    addMaintenance: () => {},
    deleteMaintenance: () => {},
    finishMaintenance: () => {},
    updateExternalDbConfig: async () => {},
    testExternalDbConnection: async () => ({ success: true, message: 'Mock connection successful' }),
    fetchExpedienteAlerts: async () => { console.log("Mock fetching alerts..."); },
    saveExpedienteOverride: async () => {},
    fetchConsumableTransactions: async () => [],
    addAccessoryType: () => {},
    updateAccessoryType: () => {},
    deleteAccessoryType: () => {}
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
