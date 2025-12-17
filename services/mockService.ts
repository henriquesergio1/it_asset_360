
import { Device, DeviceStatus, SimCard, User, AuditLog, ActionType, SystemUser, SystemRole, SystemSettings, AssetType, DeviceBrand, DeviceModel, MaintenanceRecord, MaintenanceType, UserSector, AccessoryType, CustomField } from '../types';

const DEFAULT_DELIVERY_DECLARATION = `Declaro que recebi da empresa <strong>{NOME_EMPRESA}</strong> (CNPJ: {CNPJ}), a título de empréstimo...`;
const DEFAULT_DELIVERY_CLAUSES = `<h3>2. Condições Gerais...</h3>...`;
const DEFAULT_RETURN_DECLARATION = `Declaro que devolvi...`;
const DEFAULT_RETURN_CLAUSES = `<p>O material foi conferido...</p>`;

const DEFAULT_CONFIG_JSON = JSON.stringify({
    delivery: { declaration: DEFAULT_DELIVERY_DECLARATION, clauses: DEFAULT_DELIVERY_CLAUSES },
    return: { declaration: DEFAULT_RETURN_DECLARATION, clauses: DEFAULT_RETURN_CLAUSES }
});

export const mockSystemSettings: SystemSettings = {
  appName: 'IT Asset 360',
  cnpj: '00.000.000/0001-00',
  logoUrl: '',
  termTemplate: DEFAULT_CONFIG_JSON, 
  returnTermTemplate: ''
};

export const mockSystemUsers: SystemUser[] = [
  { id: 'admin1', name: 'Administrador TI', email: 'admin@empresa.com', password: 'admin', role: SystemRole.ADMIN, avatarUrl: '' },
  { id: 'op1', name: 'Operador Suporte', email: 'suporte@empresa.com', password: '123', role: SystemRole.OPERATOR }
];

// --- Configuração de Campos e Tipos (Mock) ---

export const mockCustomFields: CustomField[] = [
    { id: 'cf_ram', name: 'Memória RAM' },
    { id: 'cf_storage', name: 'Armazenamento' },
    { id: 'cf_flexx', name: 'ID FlexxGPS' },
    { id: 'cf_sales', name: 'ID Connect Sales' }
];

export const mockAssetTypes: AssetType[] = [
  { id: 't1', name: 'Notebook', customFieldIds: ['cf_ram', 'cf_storage'] },
  { id: 't2', name: 'Smartphone', customFieldIds: ['cf_storage', 'cf_flexx', 'cf_sales'] },
  { id: 't3', name: 'Tablet', customFieldIds: ['cf_flexx'] },
  { id: 't4', name: 'Monitor', customFieldIds: [] }
];

export const mockAccessoryTypes: AccessoryType[] = [
    { id: 'ac1', name: 'Carregador Original' },
    { id: 'ac2', name: 'Mouse Sem Fio' },
    { id: 'ac3', name: 'Mochila' },
    { id: 'ac4', name: 'Capa Protetora' }
];

export const mockBrands: DeviceBrand[] = [
  { id: 'b1', name: 'Dell' },
  { id: 'b2', name: 'Apple' },
  { id: 'b3', name: 'Samsung' },
  { id: 'b4', name: 'Lenovo' }
];

export const mockModels: DeviceModel[] = [
  { id: 'm1', name: 'Latitude 5420', brandId: 'b1', typeId: 't1', imageUrl: '' },
  { id: 'm2', name: 'iPhone 13 128GB', brandId: 'b2', typeId: 't2', imageUrl: '' },
  { id: 'm3', name: 'Galaxy S21 FE', brandId: 'b3', typeId: 't2', imageUrl: '' }
];

export const mockDevices: Device[] = [
  {
    id: 'd1',
    modelId: 'm1', // Dell Latitude
    serialNumber: '8H2K92',
    assetTag: 'TI-001',
    purchaseDate: '2023-01-15',
    purchaseCost: 4500.00,
    supplier: 'Dell Oficial',
    invoiceNumber: 'NF-10293',
    status: DeviceStatus.AVAILABLE,
    currentUserId: null,
    sectorId: 'sec3', // TI
    costCenter: 'CC-1010',
    // Dados migrados para customData
    customData: {
        'cf_ram': '16GB',
        'cf_storage': '512GB SSD'
    }
  },
  {
    id: 'd2',
    modelId: 'm2', // iPhone 13
    serialNumber: 'FFGJW2',
    assetTag: 'TI-002',
    purchaseDate: '2023-03-10',
    purchaseCost: 3800.00,
    status: DeviceStatus.IN_USE,
    currentUserId: 'u1',
    linkedSimId: 's1', 
    imei: '356988012345678',
    pulsusId: '10928',
    sectorId: 'sec1', 
    costCenter: 'CC-2020',
    customData: {
        'cf_storage': '128GB',
        'cf_flexx': 'FX-100',
        'cf_sales': 'CS-999'
    }
  },
  {
    id: 'd3',
    modelId: 'm3', // Samsung S21
    serialNumber: 'R5CR20',
    assetTag: 'TI-003',
    purchaseDate: '2022-11-05',
    purchaseCost: 2900.00,
    status: DeviceStatus.MAINTENANCE,
    currentUserId: null,
    imei: '357999098765432',
    pulsusId: '10930',
    sectorId: 'sec1',
    costCenter: 'CC-2020',
    customData: {}
  }
];

export const mockMaintenanceRecords: MaintenanceRecord[] = [
  {
    id: 'mr1',
    deviceId: 'd3',
    type: MaintenanceType.CORRECTIVE,
    date: '2023-10-01',
    description: 'Troca de Tela',
    cost: 450.00,
    provider: 'Assistência Técnica Express',
  }
];

export const mockSims: SimCard[] = [
  {
    id: 's1',
    phoneNumber: '(11) 99999-1234',
    operator: 'Vivo',
    iccid: '89551012345678901234',
    status: DeviceStatus.IN_USE,
    currentUserId: 'u1',
    planDetails: 'Smart Empresas 20GB'
  },
  {
    id: 's2',
    phoneNumber: '(11) 98888-5678',
    operator: 'Claro',
    iccid: '89550509876543210987',
    status: DeviceStatus.AVAILABLE,
    currentUserId: null,
    planDetails: 'Claro Total 50GB'
  }
];

export const mockSectors: UserSector[] = [
    { id: 'sec1', name: 'Vendas' },
    { id: 'sec2', name: 'Administrativo' },
    { id: 'sec3', name: 'T.I.' },
    { id: 'sec4', name: 'Logística' }
];

export const mockUsers: User[] = [
  {
    id: 'u1',
    fullName: 'Carlos Silva',
    cpf: '123.456.789-00',
    rg: '12.345.678-9',
    pis: '12345678901',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    email: 'carlos.silva@empresa.com.br',
    sectorId: 'sec1',
    jobTitle: 'Gerente de Contas',
    active: true,
    terms: []
  },
  {
    id: 'u2',
    fullName: 'Ana Pereira',
    cpf: '987.654.321-11',
    rg: '22.333.444-5',
    pis: '10987654321',
    address: 'Rua Augusta, 500 - São Paulo, SP',
    email: 'ana.pereira@empresa.com.br',
    sectorId: 'sec2',
    jobTitle: 'Analista Financeiro',
    active: true,
    terms: []
  },
  {
    id: 'u3',
    fullName: 'Roberto Santos',
    cpf: '456.789.123-22',
    rg: '44.555.666-7',
    address: 'Rua Funchal, 200 - São Paulo, SP',
    email: 'roberto.santos@empresa.com.br',
    sectorId: 'sec1',
    jobTitle: 'Promotor de Vendas',
    active: true,
    terms: []
  }
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'log1',
    assetId: 'd2',
    assetType: 'Device',
    targetName: 'iPhone 13 Corp',
    action: ActionType.CHECKOUT,
    timestamp: '2023-03-12T09:00:00Z',
    adminUser: 'Administrador TI',
    notes: 'Entrega inicial - Kit novo'
  }
];

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
