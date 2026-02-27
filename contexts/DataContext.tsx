import React, { createContext, useContext } from 'react';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, AccessoryType, CustomField, DeviceAccessory, SoftwareAccount, ExternalDbConfig, ExpedienteAlert } from '../types';

export interface DataContextType {
  devices: Device[];
  sims: SimCard[];
  users: User[];
  systemUsers: SystemUser[];
  logs: AuditLog[];
  settings: SystemSettings;
  
  // ERP Integration
  externalDbConfig: ExternalDbConfig | null;
  expedienteAlerts: ExpedienteAlert[];
  
  // Novos dados
  models: DeviceModel[];
  brands: DeviceBrand[];
  assetTypes: AssetType[];
  maintenances: MaintenanceRecord[];
  sectors: UserSector[];
  accessoryTypes: AccessoryType[];
  customFields: CustomField[]; 
  accounts: SoftwareAccount[]; 

  loading?: boolean;
  error?: string | null;
  
  // Sincronização
  fetchData: (silent?: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
  
  // Carregamento sob demanda (Otimização de Bootstrap)
  getTermFile: (id: string) => Promise<string>;
  getDeviceInvoice: (id: string) => Promise<string>;
  getMaintenanceInvoice: (id: string) => Promise<string>;
  getLogDetail: (id: string) => Promise<AuditLog>;

  // CRUD Dispositivos
  addDevice: (device: Device, adminName: string) => void;
  updateDevice: (device: Device, adminName: string) => void;
  deleteDevice: (id: string, adminName: string, reason: string) => void;
  restoreDevice: (id: string, adminName: string, reason: string) => void;
  
  // CRUD Sims
  addSim: (sim: SimCard, adminName: string) => void;
  updateSim: (sim: SimCard, adminName: string) => void;
  deleteSim: (id: string, adminName: string, reason: string) => void;
  
  // CRUD Users
  addUser: (user: User, adminName: string) => void;
  updateUser: (user: User, adminName: string, notes?: string) => void; 
  toggleUserActive: (user: User, adminName: string, reason?: string) => void;
  
  // CRUD Sectors
  addSector: (sector: UserSector, adminName: string) => void;
  updateSector: (sector: UserSector, adminName: string) => void; 
  deleteSector: (id: string, adminName: string) => void;

  // CRUD Accounts
  addAccount: (account: SoftwareAccount, adminName: string) => void;
  updateAccount: (account: SoftwareAccount, adminName: string) => void;
  deleteAccount: (id: string, adminName: string) => void;
  
  // CRUD System Users
  addSystemUser: (user: SystemUser, adminName: string) => void;
  updateSystemUser: (user: SystemUser, adminName: string) => void;
  deleteSystemUser: (id: string, adminName: string) => void;

  // Settings
  updateSettings: (settings: SystemSettings, adminName: string) => void;

  // Operations
  assignAsset: (assetType: 'Device' | 'Sim', assetId: string, userId: string, notes: string, adminName: string, accessories?: DeviceAccessory[]) => void;
  returnAsset: (assetType: 'Device' | 'Sim', assetId: string, notes: string, adminName: string, returnedChecklist?: Record<string, boolean>, inactivateUser?: boolean) => void;
  
  // Term Management
  updateTermFile: (termId: string, userId: string, fileUrl: string, adminName: string) => void;
  deleteTermFile: (termId: string, userId: string, reason: string, adminName: string) => void;

  getHistory: (assetId: string) => AuditLog[];
  
  // Admin Tools
  clearLogs: () => void;
  restoreItem: (logId: string, adminName: string) => void;

  // --- Gestão de Configurações ---
  addAssetType: (type: AssetType, adminName: string) => void;
  updateAssetType: (type: AssetType, adminName: string) => void; 
  deleteAssetType: (id: string, adminName: string) => void;

  addBrand: (brand: DeviceBrand, adminName: string) => void;
  updateBrand: (brand: DeviceBrand, adminName: string) => void; 
  deleteBrand: (id: string, adminName: string) => void;

  addModel: (model: DeviceModel, adminName: string) => void;
  updateModel: (model: DeviceModel, adminName: string) => void;
  deleteModel: (id: string, adminName: string) => void;

  addAccessoryType: (type: AccessoryType, adminName: string) => void;
  updateAccessoryType: (type: AccessoryType, adminName: string) => void; 
  deleteAccessoryType: (id: string, adminName: string) => void;

  // --- Custom Fields ---
  addCustomField: (field: CustomField, adminName: string) => void;
  updateCustomField: (field: CustomField, adminName: string) => void;
  deleteCustomField: (id: string, adminName: string) => void;

  // --- Manutenção ---
  addMaintenance: (record: MaintenanceRecord, adminName: string) => void;
  deleteMaintenance: (id: string, adminName: string) => void;
  finishMaintenance: (deviceId: string, maintenanceRecord: MaintenanceRecord, adminName: string) => void;

  // ERP Integration Actions
  updateExternalDbConfig: (config: ExternalDbConfig, adminName: string) => Promise<void>;
  testExternalDbConnection: (config: ExternalDbConfig) => Promise<{ success: boolean; message: string }>;
  fetchExpedienteAlerts: () => Promise<void>;
  optimizeDatabase: (adminName: string) => Promise<{ success: boolean; migratedCount: number; manualCount: number; cleanedCount: number }>;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider (Mock or Prod)');
  return context;
};
