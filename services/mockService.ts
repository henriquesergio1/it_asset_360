import { Device, DeviceStatus, SimCard, User, AuditLog, ActionType, SystemUser, SystemRole, SystemSettings, AssetType, DeviceBrand, DeviceModel, MaintenanceRecord, MaintenanceType, UserSector, AccessoryType } from '../types';

// Texto padrão otimizado para 1 Página A4 com conteúdo Jurídico Completo
// Versão 1.7.8 - Inclusão de Observações
const DEFAULT_TERM_TEMPLATE = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; line-height: 1.4; max-width: 100%; margin: 0 auto; padding: 20px 30px; background-color: #fff;">
    
    <!-- HEADER -->
    <table style="width: 100%; border-bottom: 2px solid #1f2937; margin-bottom: 15px; padding-bottom: 5px;">
        <tr>
            <td style="width: 25%; vertical-align: middle;">
                 <img src="{LOGO_URL}" alt="Logo" style="max-height: 60px; max-width: 150px; object-fit: contain;" onerror="this.style.display='none'"/>
            </td>
            <td style="width: 75%; text-align: right; vertical-align: middle;">
                <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">{NOME_EMPRESA}</h1>
                <p style="margin: 0; font-size: 11px; color: #4b5563;">CNPJ: {CNPJ}</p>
                <h2 style="margin: 5px 0 0 0; text-transform: uppercase; font-size: 14px; color: #4b5563;">Termo de Responsabilidade</h2>
                <p style="margin: 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">{TIPO_TERMO} DE ATIVO DE TI</p>
            </td>
        </tr>
    </table>

    <!-- DADOS DO COLABORADOR -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; margin-bottom: 15px;">
        <table style="width: 100%; font-size: 11px;">
            <tr>
                <td style="font-weight: bold; width: 15%; color: #475569;">Colaborador:</td>
                <td style="width: 45%;">{NOME_COLABORADOR}</td>
                <td style="font-weight: bold; width: 10%; color: #475569;">CPF:</td>
                <td style="width: 30%;">{CPF}</td>
            </tr>
            <tr>
                <td style="font-weight: bold; color: #475569;">Setor:</td>
                <td>{NOME_SETOR}</td>
                <td style="font-weight: bold; color: #475569;">RG:</td>
                <td>{RG}</td>
            </tr>
        </table>
    </div>

    <p style="text-align: justify; font-size: 11px; margin-bottom: 15px; color: #333;">
        Declaro que recebi da empresa <strong>{NOME_EMPRESA}</strong> (CNPJ: {CNPJ}), a título de empréstimo para uso exclusivo profissional, os equipamentos relacionados abaixo. Comprometo-me a zelar pela sua guarda, conservação e limpeza, responsabilizando-me por qualquer dano causado por negligência, imprudência ou imperícia.
    </p>

    <!-- TABELA DE ITENS -->
    <h3 style="font-size: 12px; border-bottom: 1px solid #cbd5e1; margin-bottom: 8px; padding-bottom: 2px; color: #0f172a; text-transform: uppercase;">1. Detalhes do Equipamento</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
        <thead>
            <tr style="background-color: #f1f5f9;">
                <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 60%;">Descrição / Modelo</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 40%;">Identificação</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">
                    <strong style="font-size: 12px; color: #1e293b;">{MODELO_DISPOSITIVO}</strong><br>
                    <span style="color: #64748b;">Acessórios: {ACESSORIOS}</span>
                </td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">
                    <strong>Patrimônio:</strong> {TAG_PATRIMONIO}<br>
                    <strong>Serial:</strong> {NUMERO_SERIE}<br>
                    <strong>ID/IMEI:</strong> {IMEI_ICCID}
                </td>
            </tr>
            {CHIP_VINCULADO_HTML}
        </tbody>
    </table>

    <!-- OBSERVAÇÕES -->
    <div style="margin-bottom: 20px; font-size: 11px; color: #333; background-color: #fffbeb; padding: 8px; border: 1px solid #fcd34d; border-radius: 4px;">
        <strong>Observações / Estado de Conservação:</strong> {OBSERVACOES}
    </div>

    <!-- CLAUSULAS COMPLETAS -->
    <h3 style="font-size: 12px; border-bottom: 1px solid #cbd5e1; margin-bottom: 8px; padding-bottom: 2px; color: #0f172a; text-transform: uppercase;">2. Condições Gerais de Uso e Responsabilidade</h3>
    <ul style="font-size: 10.5px; padding-left: 15px; color: #334155; margin-bottom: 20px; line-height: 1.4; list-style-type: decimal;">
        <li style="margin-bottom: 5px;">
            <strong>Finalidade e Uso Adequado:</strong> O equipamento é uma ferramenta de trabalho de propriedade da empresa, cedido em comodato. É estritamente vedado o seu uso para fins pessoais, bem como a instalação de jogos ou softwares não homologados pelo departamento de T.I.
        </li>
        <li style="margin-bottom: 5px;">
            <strong>Segurança da Informação:</strong> O colaborador compromete-se a zelar pela segurança lógica e física do ativo, não compartilhando senhas de acesso. A empresa reserva-se o direito de auditar o equipamento e seus dados a qualquer momento, sem aviso prévio, para garantir a conformidade com as políticas corporativas.
        </li>
        <li style="margin-bottom: 5px;">
            <strong>Sinistros (Perda, Roubo ou Furto):</strong> Em caso de sinistro, o colaborador deverá comunicar imediatamente o seu gestor e o departamento de T.I., apresentando o Boletim de Ocorrência (B.O.) no prazo máximo de 48 horas. A não apresentação do B.O. poderá acarretar na responsabilização total pelos custos de reposição do bem.
        </li>
        <li style="margin-bottom: 5px;">
            <strong>Devolução:</strong> Ao término do contrato de trabalho ou quando solicitado pela empresa, o equipamento deverá ser devolvido imediatamente, em perfeito estado de conservação e funcionamento.
        </li>
        <li style="margin-bottom: 5px;">
            <strong>Autorização de Desconto:</strong> Em conformidade com o § 1º do Art. 462 da CLT, autorizo o desconto em folha de pagamento ou verbas rescisórias dos valores correspondentes ao reparo ou reposição do equipamento, caso seja comprovado dano causado por dolo (intenção) ou culpa (negligência, imprudência ou imperícia) de minha parte.
        </li>
    </ul>

    <!-- ASSINATURA ÚNICA -->
    <div style="margin-top: 30px; page-break-inside: avoid;">
        <p style="text-align: center; margin-bottom: 35px; font-size: 11px;">{CIDADE_DATA}</p>
        
        <div style="width: 50%; margin: 0 auto; text-align: center;">
            <div style="border-top: 1px solid #000; padding-top: 5px;">
                <strong style="font-size: 12px; color: #000; text-transform: uppercase;">{NOME_COLABORADOR}</strong><br>
                <span style="font-size: 10px; color: #64748b;">Assinatura do Colaborador</span><br>
                <span style="font-size: 10px; color: #94a3b8;">CPF: {CPF}</span>
            </div>
        </div>
    </div>

    <div style="margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 5px;">
        Documento gerado digitalmente pelo sistema IT Asset 360 • {ID_TERMO_AUTO}
    </div>
</div>
`;

const DEFAULT_RETURN_TEMPLATE = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; line-height: 1.4; max-width: 100%; margin: 0 auto; padding: 20px 30px; background-color: #fff;">
    
    <!-- HEADER -->
    <table style="width: 100%; border-bottom: 2px solid #1f2937; margin-bottom: 15px; padding-bottom: 5px;">
        <tr>
            <td style="width: 25%; vertical-align: middle;">
                 <img src="{LOGO_URL}" alt="Logo" style="max-height: 60px; max-width: 150px; object-fit: contain;" onerror="this.style.display='none'"/>
            </td>
            <td style="width: 75%; text-align: right; vertical-align: middle;">
                <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">{NOME_EMPRESA}</h1>
                <p style="margin: 0; font-size: 11px; color: #4b5563;">CNPJ: {CNPJ}</p>
                <h2 style="margin: 5px 0 0 0; text-transform: uppercase; font-size: 14px; color: #4b5563;">Termo de Devolução</h2>
                <p style="margin: 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">RECIBO DE ENTREGA DE EQUIPAMENTO</p>
            </td>
        </tr>
    </table>

    <!-- DADOS DO COLABORADOR -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; margin-bottom: 15px;">
        <table style="width: 100%; font-size: 11px;">
            <tr>
                <td style="font-weight: bold; width: 15%; color: #475569;">Colaborador:</td>
                <td style="width: 45%;">{NOME_COLABORADOR}</td>
                <td style="font-weight: bold; width: 10%; color: #475569;">CPF:</td>
                <td style="width: 30%;">{CPF}</td>
            </tr>
            <tr>
                <td style="font-weight: bold; color: #475569;">Setor:</td>
                <td>{NOME_SETOR}</td>
                <td style="font-weight: bold; color: #475569;">RG:</td>
                <td>{RG}</td>
            </tr>
        </table>
    </div>

    <p style="text-align: justify; font-size: 11px; margin-bottom: 15px; color: #333;">
        Declaro que devolvi à empresa <strong>{NOME_EMPRESA}</strong> os equipamentos e acessórios descritos abaixo, cessando minha responsabilidade sobre a guarda dos mesmos a partir desta data.
    </p>

    <!-- CHECKLIST INJETADO AQUI -->
    <!-- TABELA DE ITENS -->

    <!-- OBSERVAÇÕES -->
    <div style="margin-bottom: 20px; font-size: 11px; color: #333; background-color: #fffbeb; padding: 8px; border: 1px solid #fcd34d; border-radius: 4px;">
        <strong>Observações / Pendências:</strong> {OBSERVACOES}
    </div>

    <!-- CLAUSULAS COMPLETAS -->
    
    <!-- ASSINATURA ÚNICA -->
    <div style="margin-top: 30px; page-break-inside: avoid;">
        <p style="text-align: center; margin-bottom: 35px; font-size: 11px;">{CIDADE_DATA}</p>
        
        <table style="width: 100%; text-align: center;">
            <tr>
                <td style="width: 50%;">
                    <div style="border-top: 1px solid #000; padding-top: 5px; width: 90%; margin: 0 auto;">
                        <strong style="font-size: 12px; color: #000; text-transform: uppercase;">{NOME_COLABORADOR}</strong><br>
                        <span style="font-size: 10px; color: #64748b;">Colaborador (Devolvente)</span>
                    </div>
                </td>
                <td style="width: 50%;">
                    <div style="border-top: 1px solid #000; padding-top: 5px; width: 90%; margin: 0 auto;">
                        <strong style="font-size: 12px; color: #000; text-transform: uppercase;">DEPARTAMENTO DE T.I.</strong><br>
                        <span style="font-size: 10px; color: #64748b;">Responsável pelo Recebimento</span>
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <div style="margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 5px;">
        Documento gerado digitalmente pelo sistema IT Asset 360 • {ID_TERMO_AUTO}
    </div>
</div>
`;

// Mock Config Data
export const mockSystemSettings: SystemSettings = {
  appName: 'IT Asset 360',
  cnpj: '00.000.000/0001-00',
  logoUrl: '',
  termTemplate: DEFAULT_TERM_TEMPLATE,
  returnTermTemplate: DEFAULT_RETURN_TEMPLATE
};

export const mockSystemUsers: SystemUser[] = [
  {
    id: 'admin1',
    name: 'Administrador TI',
    email: 'admin@empresa.com',
    password: 'admin',
    role: SystemRole.ADMIN,
    avatarUrl: ''
  },
  {
    id: 'op1',
    name: 'Operador Suporte',
    email: 'suporte@empresa.com',
    password: '123',
    role: SystemRole.OPERATOR
  }
];

// --- New Structure Mocks ---

export const mockAssetTypes: AssetType[] = [
  { id: 't1', name: 'Notebook' },
  { id: 't2', name: 'Smartphone' },
  { id: 't3', name: 'Tablet' },
  { id: 't4', name: 'Monitor' }
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
  { 
    id: 'm1', 
    name: 'Latitude 5420', 
    brandId: 'b1', 
    typeId: 't1', 
    imageUrl: 'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/latitude-notebooks/14-5420/media-gallery/peripherals_laptop_latitude_5420_gallery_1.psd?fmt=png-alpha&pscan=auto&scl=1&hei=402&wid=555&qlt=100,1&resMode=sharp2&size=555,402&chrss=full' 
  },
  { 
    id: 'm2', 
    name: 'iPhone 13 128GB', 
    brandId: 'b2', 
    typeId: 't2',
    imageUrl: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-13-midnight-select-2021?wid=940&hei=1112&fmt=png-alpha&.v=1645572315940'
  },
  { 
    id: 'm3', 
    name: 'Galaxy S21 FE', 
    brandId: 'b3', 
    typeId: 't2',
    imageUrl: 'https://images.samsung.com/is/image/samsung/p6pim/br/sm-g990ezagzto/gallery/br-galaxy-s21-fe-g990-sm-g990ezagzto-530656209?$650_519_PNG$' 
  }
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
    costCenter: 'CC-1010'
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
    linkedSimId: 's1', // Vinculado ao chip s1
    imei: '356988012345678',
    pulsusId: '10928',
    sectorId: 'sec1', // Vendas
    costCenter: 'CC-2020'
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
    costCenter: 'CC-2020'
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