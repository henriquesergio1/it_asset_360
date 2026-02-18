import React, { createContext, useContext } from 'react';
import { Device, SimCard, User, AuditLog, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, AccessoryType, CustomField, DeviceAccessory, SoftwareAccount } from '../types';

export interface DataContextType {
  devices: Device[];
  sims: SimCard[];
  users: User[];
  systemUsers: SystemUser[];
  logs: AuditLog[];
  settings: SystemSettings;
  
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
  
  fetchData: (silent?: boolean) => Promise<void>;
  
  getTermFile: (id: string) => Promise<string>;
  getDeviceInvoice: (id: string) => Promise<string>;
  getMaintenanceInvoice: (id: string) => Promise<string>;
  getLogDetail: (id: string) => Promise<AuditLog>;

  addDevice: (device: Device, adminName: string) => void;
  updateDevice: (device: Device, adminName: string) => void;
  deleteDevice: (id: string, adminName: string, reason: string) => void;
  restoreDevice: (id: string, adminName: string, reason: string) => void;
  
  addSim: (sim: SimCard, adminName: string) => void;
  updateSim: (sim: SimCard, adminName: string) => void;
  deleteSim: (id: string, adminName: string, reason: string) => void;
  
  addUser: (user: User, adminName: string) => void;
  updateUser: (user: User, adminName: string, notes?: string) => void; 
  toggleUserActive: (user: User, adminName: string, reason?: string) => void;
  
  addSector: (sector: UserSector, adminName: string) => void;
  updateSector: (sector: UserSector, adminName: string) => void; 
  deleteSector: (id: string, adminName: string) => void;

  addAccount: (account: SoftwareAccount, adminName: string) => void;
  updateAccount: (account: SoftwareAccount, adminName: string) => void;
  deleteAccount: (id: string, adminName: string) => void;
  
  addSystemUser: (user: SystemUser, adminName: string) => void;
  updateSystemUser: (user: SystemUser, adminName: string) => void;
  deleteSystemUser: (id: string, adminName: string) => void;

  updateSettings: (settings: SystemSettings, adminName: string) => void;

  assignAsset: (assetType: 'Device' | 'Sim', assetId: string, userId: string, notes: string, adminName: string, accessories?: DeviceAccessory[], termSnapshot?: any) => void;
  returnAsset: (assetType: 'Device' | 'Sim', assetId: string, notes: string, adminName: string, returnedChecklist?: Record<string, boolean>, inactivateUser?: boolean, termSnapshot?: any) => void;
  
  updateTermFile: (termId: string, userId: string, fileUrl: string, adminName: string) => void;
  deleteTermFile: (termId: string, userId: string, reason: string, adminName: string) => void;

  getHistory: (assetId: string) => AuditLog[];
  
  clearLogs: () => void;
  restoreItem: (logId: string, adminName: string) => void;

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

  addCustomField: (field: CustomField, adminName: string) => void;
  updateCustomField: (field: CustomField, adminName: string) => void;
  deleteCustomField: (id: string, adminName: string) => void;

  addMaintenance: (record: MaintenanceRecord, adminName: string) => void;
  deleteMaintenance: (id: string, adminName: string) => void;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider (Mock or Prod)');
  return context;
};