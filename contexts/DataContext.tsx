
import React, { createContext, useContext } from 'react';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, AccessoryType, CustomField } from '../types';

export interface DataContextType {
  devices: Device[];
  sims: SimCard[];
  users: User[];
  systemUsers: SystemUser[];
  logs: AuditLog[];
  settings: SystemSettings;
  
  // Novos dados
  models: DeviceModel[];
  brands: DeviceBrand[];
  assetTypes: AssetType[];
  maintenances: MaintenanceRecord[];
  sectors: UserSector[];
  accessoryTypes: AccessoryType[];
  customFields: CustomField[]; // Novo

  loading?: boolean;
  error?: string | null;
  
  // CRUD Dispositivos
  addDevice: (device: Device, adminName: string) => void;
  updateDevice: (device: Device, adminName: string) => void;
  deleteDevice: (id: string, adminName: string, reason: string) => void;
  // Função para restaurar dispositivos que foram marcados como descartados
  restoreDevice: (id: string, adminName: string, reason: string) => void;
  
  // CRUD Sims
  addSim: (sim: SimCard, adminName: string) => void;
  updateSim: (sim: SimCard, adminName: string) => void;
  deleteSim: (id: string, adminName: string, reason: string) => void;
  
  // CRUD Users
  addUser: (user: User, adminName: string) => void;
  updateUser: (user: User, adminName: string, notes?: string) => void; // Updated signature
  toggleUserActive: (user: User, adminName: string, reason?: string) => void;
  
  // CRUD Sectors
  addSector: (sector: UserSector, adminName: string) => void;
  deleteSector: (id: string, adminName: string) => void;
  
  // CRUD System Users
  addSystemUser: (user: SystemUser, adminName: string) => void;
  updateSystemUser: (user: SystemUser, adminName: string) => void;
  deleteSystemUser: (id: string, adminName: string) => void;

  // Settings
  updateSettings: (settings: SystemSettings, adminName: string) => void;

  // Operations
  assignAsset: (assetType: 'Device' | 'Sim', assetId: string, userId: string, notes: string, adminName: string, termFile?: File) => void;
  returnAsset: (assetType: 'Device' | 'Sim', assetId: string, notes: string, adminName: string, termFile?: File, returnedChecklist?: Record<string, boolean>) => void;
  getHistory: (assetId: string) => AuditLog[];
  
  // Admin Tools
  clearLogs: () => void;
  restoreItem: (logId: string, adminName: string) => void;

  // --- Gestão de Configurações (CRUDs Completos) ---
  addAssetType: (type: AssetType, adminName: string) => void;
  updateAssetType: (type: AssetType, adminName: string) => void; // Added Update
  deleteAssetType: (id: string, adminName: string) => void;

  addBrand: (brand: DeviceBrand, adminName: string) => void;
  updateBrand: (brand: DeviceBrand, adminName: string) => void; // Added Update
  deleteBrand: (id: string, adminName: string) => void;

  addModel: (model: DeviceModel, adminName: string) => void;
  updateModel: (model: DeviceModel, adminName: string) => void;
  deleteModel: (id: string, adminName: string) => void;

  addAccessoryType: (type: AccessoryType, adminName: string) => void;
  updateAccessoryType: (type: AccessoryType, adminName: string) => void; // Added Update
  deleteAccessoryType: (id: string, adminName: string) => void;

  // --- Custom Fields ---
  addCustomField: (field: CustomField, adminName: string) => void;
  deleteCustomField: (id: string, adminName: string) => void;

  // --- Manutenção ---
  addMaintenance: (record: MaintenanceRecord, adminName: string) => void;
  deleteMaintenance: (id: string, adminName: string) => void;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider (Mock or Prod)');
  return context;
};
