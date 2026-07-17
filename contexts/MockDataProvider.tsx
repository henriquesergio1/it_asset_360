import React, { useState } from 'react';
import { DataContext, DataContextType } from './DataContext';
import { useToast } from './ToastContext';
import { Device, SimCard, User, AuditLog, DeviceStatus, ActionType, SystemUser, SystemSettings, DeviceModel, DeviceBrand, AssetType, MaintenanceRecord, UserSector, Term, AccessoryType, CustomField, DeviceAccessory, SoftwareAccount, ExternalDbConfig, ExpedienteAlert, Task, TaskLog, TaskStatus, TaskType, RecurrenceType, TaskRecurrenceConfig, Consumable, ConsumableTransaction, UserStatus, DeviceAudit, RhCollaborator, RhDocument, RhOccurrence, RhTermTemplate, RhTerm, RhAssetItem } from '../types';
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
  const [audits, setAudits] = useState<DeviceAudit[]>([]);

  // Módulo R.H. Mock States
  const [rhCollaborators, setRhCollaborators] = useState<RhCollaborator[]>([
    {
      id: 'rh-c1',
      fullName: 'Carlos Henrique Silva',
      birthDate: '1988-05-15',
      gender: 'Masculino',
      maritalStatus: 'Casado',
      motherName: 'Maria Antônia Silva',
      personalPhone: '(11) 98888-1111',
      corporatePhone: '(11) 99999-1234',
      emailPersonal: 'carlos.h.silva@personal.com',
      emailCorporate: 'carlos.silva@empresa.com.br',
      cep: '01310-100',
      street: 'Avenida Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      rg: '12.345.678-9',
      cpf: '123.456.789-00',
      pis: '12345678901',
      electorTitle: '123456789012',
      ctps: '1234567-001/SP',
      cnhNumber: '12345678900',
      cnhCategory: 'B',
      cnhExpiration: '2027-08-20',
      role: 'Analista de Vendas Senior',
      sectorId: 'sec1',
      contractType: 'CLT',
      hireDate: '2015-08-10', // 11 years (aquisição: 11 meses de férias etc.)
      salary: 5800.00,
      weeklyHours: 44,
      documents: [
        { id: 'rh-doc-1', category: 'CPF', fileName: 'cpf_carlos.pdf', fileUrl: 'mock_cpf_url', uploadDate: '2022-03-01' },
        { id: 'rh-doc-2', category: 'Contrato de Trabalho', fileName: 'contrato_clt.pdf', fileUrl: 'mock_contract_url', uploadDate: '2022-03-01' }
      ]
    },
    {
      id: 'rh-c2',
      fullName: 'Ana Julia Pereira',
      birthDate: '1995-10-22',
      gender: 'Feminino',
      maritalStatus: 'Solteiro',
      motherName: 'Beatriz Pereira',
      personalPhone: '(11) 97777-2222',
      emailPersonal: 'anajulia.p@gmail.com',
      emailCorporate: 'ana.pereira@empresa.com.br',
      cep: '01234-000',
      street: 'Rua Augusta',
      number: '500',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
      rg: '22.333.444-5',
      cpf: '987.654.321-11',
      pis: '10987654321',
      role: 'Coordenadora Administrativa',
      sectorId: 'sec2',
      contractType: 'CLT',
      hireDate: '2025-09-10', // expiração contrato de experiência próximo
      salary: 7200.00,
      weeklyHours: 44,
      documents: []
    }
  ]);

  const [rhOccurrences, setRhOccurrences] = useState<RhOccurrence[]>([
    {
      id: 'rh-occ-1',
      collaboratorId: 'rh-c1',
      type: 'Atestado Médico',
      startDate: '2024-02-10',
      endDate: '2024-02-12',
      daysCount: 3,
      cid: 'M54.5',
      crm: 'CRM-SP 123456',
      notes: 'Atestado de 3 dias por dor lombar',
      fileUrl: 'mock_atestado_url'
    }
  ]);

  const [rhTemplates, setRhTemplates] = useState<RhTermTemplate[]>([
    {
      id: 'rh-tmpl-1',
      name: 'Termo de Comodato Equipamento de R.H.',
      content: `Declaro que recebi da empresa **{{nome_empresa}}**, o equipamento **{{equipamento_nome}}**, número de série **{{numero_serie}}** para fins de comodato corporativo.`
    }
  ]);

  const [rhTerms, setRhTerms] = useState<RhTerm[]>([
    {
      id: 'rh-term-1',
      collaboratorId: 'rh-c1',
      templateId: 'rh-tmpl-1',
      assetDetails: 'Cadeira Ergonômica Flexform',
      date: '2023-03-15',
      status: 'ASSINADO',
      signatureToken: 'sig-token-123',
      signatureIp: '189.10.20.30',
      signatureDate: '2023-03-15T14:30:00Z',
      signatureLocation: 'São Paulo, SP',
      signatureHash: 'hash_sha256_mock_123456'
    }
  ]);

  const [rhAssetItems, setRhAssetItems] = useState<RhAssetItem[]>([
    { id: 'rh-item-1', name: 'Botina de Segurança 42', type: 'CONSUMIVEL', totalStock: 15, currentStock: 15, minStock: 5, notes: 'Equipamento de Proteção Individual (EPI)' },
    { id: 'rh-item-2', name: 'Camiseta de Uniforme G', type: 'CONSUMIVEL', totalStock: 30, currentStock: 30, minStock: 10, notes: 'Uniforme padrão de malha fria' },
    { id: 'rh-item-3', name: 'Capacete de Proteção', type: 'ATIVO', totalStock: 5, currentStock: 5, minStock: 2, notes: 'Capacete com regulagem e carneira' }
  ]);

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
    externalDbConfig: null, expedienteAlerts: [], consumables, consumableTransactions, audits,
    isReadOnly,
    rhCollaborators,
    rhOccurrences,
    rhTemplates,
    rhTerms,
    rhAssetItems,
    addRhCollaborator: (c) => {
      setRhCollaborators(p => [...p, c]);
      showToast('Colaborador cadastrado no R.H. (Mock)', 'success');
    },
    updateRhCollaborator: (c) => {
      setRhCollaborators(p => p.map(x => x.id === c.id ? c : x));
      showToast('Colaborador atualizado no R.H. (Mock)', 'success');
    },
    deleteRhCollaborator: (id) => {
      setRhCollaborators(p => p.filter(x => x.id !== id));
      showToast('Colaborador removido do R.H. (Mock)', 'success');
    },
    addRhOccurrence: (o) => {
      setRhOccurrences(p => [...p, o]);
      showToast('Ocorrência de R.H. lançada (Mock)', 'success');
    },
    deleteRhOccurrence: (id) => {
      setRhOccurrences(p => p.filter(x => x.id !== id));
      showToast('Ocorrência removida (Mock)', 'success');
    },
    addRhTemplate: (t) => {
      setRhTemplates(p => [...p, t]);
      showToast('Template de Termo criado (Mock)', 'success');
    },
    updateRhTemplate: (t) => {
      setRhTemplates(p => p.map(x => x.id === t.id ? t : x));
      showToast('Template de Termo atualizado (Mock)', 'success');
    },
    deleteRhTemplate: (id) => {
      setRhTemplates(p => p.filter(x => x.id !== id));
      showToast('Template de Termo removido (Mock)', 'success');
    },
    addRhTerm: (t) => {
      setRhTerms(p => [...p, t]);
      // Se houver itens consumíveis associados ao termo, reduz do estoque
      if (t.deliveredItems && t.deliveredItems.length > 0) {
        setRhAssetItems(prev => prev.map(item => {
          const linkedItem = t.deliveredItems?.find(li => li.id === item.id);
          if (linkedItem && item.type === 'CONSUMIVEL') {
            return {
              ...item,
              currentStock: Math.max(0, item.currentStock - (linkedItem.quantity || 1))
            };
          }
          return item;
        }));
      }
      showToast('Termo de R.H. emitido (Mock)', 'success');
    },
    updateRhTerm: (t) => {
      setRhTerms(p => p.map(x => x.id === t.id ? t : x));
      // Se for assinado ou se for termo de devolução, podemos repor se aplicável
      if (t.type === 'DEVOLUCAO' && t.deliveredItems) {
        setRhAssetItems(prev => prev.map(item => {
          const linkedItem = t.deliveredItems?.find(li => li.id === item.id);
          if (linkedItem && item.type === 'CONSUMIVEL') {
            return {
              ...item,
              currentStock: item.currentStock + (linkedItem.quantity || 1)
            };
          }
          return item;
        }));
      }
    },
    addRhAssetItem: (item) => {
      setRhAssetItems(p => [...p, item]);
      showToast('Item de R.H. cadastrado (Mock)', 'success');
    },
    updateRhAssetItem: (item) => {
      setRhAssetItems(p => p.map(x => x.id === item.id ? item : x));
      showToast('Item de R.H. atualizado (Mock)', 'success');
    },
    deleteRhAssetItem: (id) => {
      setRhAssetItems(p => p.filter(x => x.id !== id));
      showToast('Item de R.H. removido (Mock)', 'success');
    },
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
    getTermEvidences: async () => [],
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
        updatedUser.status = UserStatus.INACTIVE;
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
    updateTermFile: async (termId, userId, fileUrl) => {
      const isRh = termId.startsWith('rht-');
      if (isRh) {
        setRhTerms(prev => prev.map(t => t.id === termId ? { ...t, fileUrl, status: 'ASSINADO', hasFile: true } : t));
      } else {
        setUsers(prev => prev.map(u => {
          if (u.id === userId) {
            return {
              ...u,
              terms: u.terms.map(t => t.id === termId ? { ...t, fileUrl, hasFile: true, updatedAt: new Date().toISOString() } : t)
            };
          }
          return u;
        }));
      }
      showToast('Arquivo do termo atualizado (Mock)', 'success');
    },
    deleteTermFile: async (termId, userId) => {
      const isRh = termId.startsWith('rht-');
      if (isRh) {
        setRhTerms(prev => prev.map(t => t.id === termId ? { ...t, fileUrl: '', hasFile: false, isManual: false, resolutionReason: '', status: 'PENDENTE', signatureDate: undefined, signatureIp: undefined, signatureLocation: undefined, signatureHash: undefined, signatureStatus: undefined, signatureToken: undefined } : t));
      } else {
        setUsers(prev => prev.map(u => {
          if (u.id === userId) {
            return {
              ...u,
              terms: u.terms.map(t => t.id === termId ? { ...t, fileUrl: '', hasFile: false, isManual: false, resolutionReason: '' } : t)
            };
          }
          return u;
        }));
      }
      showToast('Anexo removido do termo (Mock)', 'success');
    },
    resolveTermManual: async (termId, reason) => {
      const isRh = termId.startsWith('rht-');
      if (isRh) {
        setRhTerms(prev => prev.map(t => t.id === termId ? { ...t, isManual: true, resolutionReason: reason, fileUrl: '', hasFile: false, status: 'ASSINADO' } : t));
      } else {
        setUsers(prev => prev.map(u => ({
          ...u,
          terms: u.terms.map(t => t.id === termId ? { ...t, isManual: true, resolutionReason: reason, fileUrl: '', hasFile: false } : t)
        })));
      }
      showToast('Termo resolvido manualmente (Mock)', 'success');
    },
    updateTermDetails: async () => {},
    generateSignatureToken: async (termId) => {
      const token = Math.random().toString(36).substring(2, 15);
      const isRh = termId.startsWith('rht-');
      if (isRh) {
        setRhTerms(prev => prev.map(t => t.id === termId ? { ...t, signatureToken: token } : t));
      }
      return token;
    },
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
    addAudit: (a) => setAudits(p => [...p, a]),
    deleteAudit: (id) => setAudits(p => p.filter(x => x.id !== id)),
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
