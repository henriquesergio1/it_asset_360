

export enum DeviceStatus {
  AVAILABLE = 'Disponível',
  IN_USE = 'Em Uso',
  MAINTENANCE = 'Manutenção',
  RETIRED = 'Descartado'
}

export enum AccountType {
  EMAIL = 'E-mail',
  GOOGLE = 'Google Account',
  ERP = 'Licença ERP',
  OFFICE = 'Pacote Office',
  OTHER = 'Outros'
}

export interface SoftwareAccount {
  id: string;
  name: string; // Nome amigável (ex: Office 365 Pro)
  type: AccountType;
  login: string;
  password?: string;
  accessUrl?: string; // Renomeado de licenseKey para accessUrl
  status: 'Ativo' | 'Inativo';
  
  // Vínculos
  userId?: string | null;
  deviceId?: string | null;
  sectorId?: string | null;
  
  notes?: string;
}

// Campos Personalizados
export interface CustomField {
  id: string;
  name: string; 
}

// Configurações Dinâmicas (Tipo de Ativo)
export interface AssetType {
  id: string;
  name: string;
  customFieldIds?: string[]; 
}

export interface DeviceBrand {
  id: string;
  name: string; 
}

export interface DeviceModel {
  id: string;
  name: string; 
  brandId: string;
  typeId: string;
  imageUrl?: string; 
}

// Acessórios
export interface AccessoryType {
    id: string;
    name: string; 
}

export interface DeviceAccessory {
    id: string;
    deviceId: string;
    accessoryTypeId: string; 
    name: string; 
}

export interface MaintenanceRecord {
  id: string;
  deviceId: string;
  type: MaintenanceType;
  date: string;
  description: string;
  cost: number;
  provider: string; 
  invoiceUrl?: string; 
  /* Adicionado para suportar indicador de anexo no lightweight sync */
  hasInvoice?: boolean;
}

export enum MaintenanceType {
  CORRECTIVE = 'Corretiva',
  PREVENTIVE = 'Preventiva',
  AUDIT = 'Auditoria'
}

export interface Device {
  id: string;
  modelId: string; 
  serialNumber: string;
  assetTag: string; 
  status: DeviceStatus;
  currentUserId?: string | null;
  internalCode?: string; 
  
  imei?: string;         
  pulsusId?: string;
  customData?: Record<string, string>; 
  sectorId?: string;     
  costCenter?: string;   
  linkedSimId?: string | null;
  accessories?: DeviceAccessory[]; 
  previousStatus?: DeviceStatus;
  previousUserId?: string | null;

  purchaseDate: string;
  purchaseCost: number;
  invoiceNumber?: string;
  supplier?: string;
  purchaseInvoiceUrl?: string; 
  /* Adicionado para suportar indicador de anexo no lightweight sync */
  hasInvoice?: boolean;
}

export interface SimCard {
  id: string;
  phoneNumber: string;
  operator: string;
  iccid: string;
  status: DeviceStatus;
  currentUserId?: string | null;
  planDetails?: string;
}

export interface UserSector {
  id: string;
  name: string;
}

export interface Term {
  id: string;
  userId: string;
  type: 'ENTREGA' | 'DEVOLUCAO';
  assetDetails: string; 
  date: string;
  fileUrl: string; 
  /* Adicionado para suportar indicador de anexo no lightweight sync */
  hasFile?: boolean;
}

export type ReturnChecklist = Record<string, boolean>;

export interface User {
  id: string;
  fullName: string;
  cpf: string;
  rg: string;
  pis?: string;
  address: string;
  email: string;
  sectorId: string; 
  internalCode?: string; 
  active: boolean;
  terms?: Term[];
  hasPendingIssues?: boolean; 
  pendingIssuesNote?: string;
}

export enum SystemRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR' 
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: SystemRole;
  avatarUrl?: string;
}

export interface SystemSettings {
  appName: string;
  cnpj?: string; 
  logoUrl: string;
  termTemplate?: string; 
  returnTermTemplate?: string; 
}

export enum ActionType {
  create = 'Criação',
  UPDATE = 'Atualização',
  DELETE = 'Exclusão',
  RESTORE = 'Restauração', 
  CHECKOUT = 'Entrega',
  CHECKIN = 'Devolução',
  MAINTENANCE_START = 'Envio Manutenção',
  MAINTENANCE_END = 'Retorno Manutenção',
  LOGIN = 'Login',
  INACTIVATE = 'Inativação',
  ACTIVATE = 'Ativação',
  RESOLVE_PENDENCY = 'Resolução Manual'
}

export interface AuditLog {
  id: string;
  assetId: string;
  assetType: 'Device' | 'Sim' | 'User' | 'System' | 'Model' | 'Brand' | 'Type' | 'Sector' | 'Accessory' | 'CustomField' | 'Account';
  targetName?: string;
  action: ActionType;
  timestamp: string;
  notes?: string;
  adminUser: string;
  backupData?: string; 
  previousData?: string; // NOVO: Snapshot antes da alteração
  newData?: string;      // NOVO: Snapshot depois da alteração
}

export interface DashboardStats {
  totalDevices: number;
  availableDevices: number;
  totalSims: number;
  activeUsers: number;
}