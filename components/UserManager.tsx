import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, User as UserIcon, Edit2, Trash2, 
  ChevronLeft, ChevronRight, Download, Filter, 
  FilterX, MoreHorizontal, UserPlus, Info, 
  MapPin, Phone, Mail, CreditCard, Hash, FileText, 
  ExternalLink, Power, History, Shield, 
  Smartphone, Camera, UserCheck,
  Briefcase, CheckCircle2, Clock, AlertCircle, RefreshCw, X, ShieldCheck,   FileSignature, ChevronDown, CheckSquare, Upload, Share2, 
  Save, Eye, EyeOff, Key, FileUp, Building2, Users, FileSpreadsheet, SlidersHorizontal, Check, AlertTriangle, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { User, UserSector, Device, DeviceModel, Term, SoftwareAccount, UserStatus, DeviceStatus } from '../types';
import { normalizeString, phoneticEncode, copyToClipboard } from '../utils/stringUtils';
import { formatCEP, validateCEP } from '../utils/rhValidation';
import { DataTable, Column } from './DataTable';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { UI_LABEL_SMALL, UI_ICON_SIZE_SMALL, UI_BUTTON_PRIMARY, UI_BUTTON_SECONDARY, UI_BUTTON_SUCCESS, UI_BUTTON_DANGER } from '../constants';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import { generateAndPrintTerm, getTermHtml } from '../utils/termGenerator';
import FilePreviewModal from './FilePreviewModal';
import { useRef } from 'react';

const UserManager: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const adminName = 'Admin';
  const [activeTab, setActiveTab] = useState<'DATA' | 'ASSETS' | 'LICENSES' | 'TERMS' | 'LOGS'>('DATA');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'STATUS' | 'SECTOR'>('STATUS');
  const [bulkTargetValue, setBulkTargetValue] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('user_manager_widths');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('user_manager_widths', JSON.stringify(columnWidths));
  }, [columnWidths]);
  const [isEditingTerm, setIsEditingTerm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [resolvingManualTerm, setResolvingManualTerm] = useState<Term | null>(null);
  const [resolveManualReason, setResolveManualReason] = useState('');
  const [termEditData, setTermEditData] = useState<{
    status: string;
    notes: string;
    evidenceFiles: string[];
    condition: string;
    damageDescription: string;
    assetDetails: string;
  }>({
    status: 'PENDING',
    notes: '',
    evidenceFiles: [],
    condition: 'Perfeito',
    damageDescription: '',
    assetDetails: ''
  });

  const [formData, setFormData] = useState<Partial<User & { gender?: string; birthDate?: string; phone?: string; personalPhone?: string; city?: string; state?: string; zipCode?: string; hireDate?: string; notes?: string; }>>({
    fullName: '',
    email: '',
    cpf: '',
    rg: '',
    pis: '',
    gender: 'Masculino',
    birthDate: '',
    phone: '',
    personalPhone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    sectorId: '',
    hireDate: '',
    status: UserStatus.ACTIVE,
    notes: '',
    active: true
  });

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('user_manager_columns');
    return saved ? JSON.parse(saved) : ['email', 'cpf', 'rg', 'sector', 'assetsCount', 'activeSims', 'devicesInfo'];
  });
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: string]: boolean }>({});
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ url: string | string[]; name: string }>({ url: '', name: '' });
  const [generatedSignatureLink, setGeneratedSignatureLink] = useState<string | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  // Estados para importação de colaboradores RH → TI
  const [showRhImportList, setShowRhImportList] = useState(false);
  const [rhSearchTerm, setRhSearchTerm] = useState('');
  const [rhSortKey, setRhSortKey] = useState<'fullName' | 'role' | 'hireDate'>('fullName');
  const [rhSortDirection, setRhSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedRhColab, setSelectedRhColab] = useState<any>(null);
  const [isRhViewModalOpen, setIsRhViewModalOpen] = useState(false);
  const [rhFilter, setRhFilter] = useState<'all' | 'new' | 'update'>('all');
  const [rhSyncTarget, setRhSyncTarget] = useState<any>(null); // User TI alvo de sync
  const columnRef = useRef<HTMLDivElement>(null);

  const { 
    users, 
    sectors, 
    models, 
    brands,
    assetTypes,
    devices, 
    sims, 
    fetchData,
    accounts,
    logs,
    getTermFile,
    getTermEvidences,
    updateTermFile,
    updateTermDetails,
    deleteTermFile,
    resolveTermManual,
    generateSignatureToken,
    addUser,
    updateUser: updateUserData,
    toggleUserActive,
    isReadOnly,
    settings,
    rhCollaborators
  } = useData();
  const { showToast } = useToast();
  const { user: authUser } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get('userId');
    const tabParam = params.get('tab');
    const showPending = params.get('showPendingOnly');

    if (showPending === 'true') {
      setShowPendingOnly(true);
    }

    if (userId && users.length > 0) {
      const u = users.find(user => user.id === userId);
      if (u) {
        handleOpenModal(u, true);
        if (tabParam === 'terms') {
          setActiveTab('TERMS');
        }
      }
    }
  }, [location.search, users]);

  const COLUMN_OPTIONS = [
    { id: 'email', label: 'E-mail' },
    { id: 'cpf', label: 'CPF' },
    { id: 'rg', label: 'RG' },
    { id: 'sector', label: 'Setor' },
    { id: 'assetsCount', label: 'Total Ativos' },
    { id: 'activeSims', label: 'Chips SIM' },
    { id: 'devicesInfo', label: 'Info Dispositivos' }
  ];

  useEffect(() => {
    localStorage.setItem('user_manager_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) setIsColumnSelectorOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (id: string) => {
    setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const exportData = filteredUsers.map(u => {
      const sector = sectors.find(s => s.id === u.sectorId);
      const { userDevices, allUserSims } = getUserAssetsEnrich(u.id);
      return {
        'Nome': u.fullName,
        'E-mail': u.email || '---',
        'CPF': u.cpf || '---',
        'Setor': sector?.name || '---',
        'Status': u.active ? (u.status || 'Ativo') : 'Inativo',
        'Ativos': userDevices.length + allUserSims.length,
        'Chips': allUserSims.map(s => s.phoneNumber).join(', ') || '---'
      };
    });

    const fileName = `colaboradores_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') exportToCSV(exportData, fileName);
    if (format === 'excel') exportToExcel(exportData, fileName);
    if (format === 'pdf') {
      const headers = ['Nome', 'E-mail', 'Setor', 'Status', 'Ativos'];
      const rows = exportData.map(d => [d.Nome, d['E-mail'], d.Setor, d.Status, d.Ativos.toString()]);
      exportToPDF(headers, rows, fileName, 'Relatório de Colaboradores');
    }
  };

  const getUserAssetsFixed = (userId: string) => {
    const userDevices = devices.filter(d => d.currentUserId === userId || (d.additionalUserIds || []).includes(userId));
    const allUserSims = sims.filter(s => s.currentUserId === userId);
    return { userDevices, allUserSims };
  };

  const userAccounts = useMemo(() => 
    accounts.filter(acc => acc.userIds?.includes(editingId || '')),
    [accounts, editingId]
  );

  const currentUserTerms = useMemo(() => {
    const user = users.find(u => u.id === editingId);
    return user?.terms || [];
  }, [users, editingId]);

  const handleResize = (colId: string, startX: number, startWidth: number) => {
    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      setColumnWidths(prev => ({ 
        ...prev, 
        [colId]: Math.max(startWidth + delta, 50) 
      }));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getUserAssetsEnrich = (userId: string) => {
    const userDevices = devices.filter(d => d.currentUserId === userId || (d.additionalUserIds || []).includes(userId));
    const allUserSims = sims.filter(s => s.currentUserId === userId);
    return { userDevices, allUserSims };
  };

  const { userDevices, allUserSims: userSims } = editingId ? getUserAssetsEnrich(editingId) : { userDevices: [] as Device[], allUserSims: [] as any[] };

  const filteredUsers = useMemo(() => {
    let result = users;

    if (showPendingOnly) {
      // Se estiver no modo de termos pendentes, mostra todos (ativos, inativos, afastados) que tenham pendência
      result = result.filter(u => (u.terms || []).some(t => !t.fileUrl && !t.hasFile && t.signatureStatus !== 'APPROVED'));
    } else {
      // Caso contrário, aplica o filtro de status (Ativos/Inativos/Afastados)
      result = result.filter(u => {
        const modeMatch = viewMode === 'ACTIVE' ? u.active && (!u.status || u.status === UserStatus.ACTIVE) :
                          viewMode === 'INACTIVE' ? !u.active :
                          viewMode === 'ON_LEAVE' ? u.active && u.status === UserStatus.ON_LEAVE : true;
        return modeMatch;
      });
    }

    if (searchTerm) {
      const term = normalizeString(searchTerm);
      const phoneticTerm = phoneticEncode(searchTerm);
      result = result.filter(u => {
        const sector = sectors.find(s => s.id === u.sectorId);
        
        // Busca Normalizada (Acentos/Case)
        const matchesNormal = normalizeString(u.fullName).includes(term) ||
          normalizeString(u.email).includes(term) ||
          (sector && normalizeString(sector.name).includes(term));

        // Busca Fonética (W/V, PH/F, etc)
        const matchesPhonetic = phoneticEncode(u.fullName).includes(phoneticTerm);

        return matchesNormal ||
          matchesPhonetic ||
          u.cpf.includes(searchTerm) ||
          (u.rg && u.rg.includes(searchTerm)) ||
          (u.pis && u.pis.includes(searchTerm));
      });
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof User] || '';
        const bVal = b[sortConfig.key as keyof User] || '';
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, viewMode, searchTerm, showPendingOnly, sortConfig]);

  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(filteredUsers.length / Number(itemsPerPage));
  const totalItems = filteredUsers.length;
  const paginatedUsers = useMemo(() => {
    if (itemsPerPage === 'ALL') return filteredUsers;
    const start = (currentPage - 1) * Number(itemsPerPage);
    return filteredUsers.slice(start, start + Number(itemsPerPage));
  }, [filteredUsers, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, viewMode]);

  const handleOpenModal = (u: User | null = null, view: boolean = false) => {
    if (u) {
      setEditingId(u.id);
      // Garantir que não estamos enviando campos calculados/virtuais da tabela para o formData
      const { 
        assetsCount, activeSims, devicesInfo, terms,
        ...validData 
      } = u as any;
      const dataToSet = { ...validData };
      if (!dataToSet.street && dataToSet.address) {
        dataToSet.street = dataToSet.address;
      }
      setFormData(dataToSet);
      setIsViewOnly(view);
    } else {
      setEditingId(null);
      setFormData({
        fullName: '',
        email: '',
        cpf: '',
        rg: '',
        gender: 'Masculino',
        birthDate: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        sectorId: '',
        hireDate: new Date().toISOString().split('T')[0],
        status: UserStatus.ACTIVE,
        active: true
      });
      setIsViewOnly(false);
    }
    setActiveTab('DATA');
    setIsModalOpen(true);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === paginatedUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedUsers.map(u => u.id));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData(p => ({
          ...p,
          zipCode: e.target.value,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || ''
        }));
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
    } finally {
      setCepLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.zipCode && !validateCEP(formData.zipCode)) {
      alert('CEP deve ter 8 dígitos.');
      return;
    }
    const fullAddress = `${formData.street || ''}, ${formData.number || ''} - ${formData.neighborhood || ''}, ${formData.city || ''} - ${formData.state || ''}`;
    const dataToSend = { ...formData, address: fullAddress };

    if (editingId) {
      setEditReason('');
      setIsReasonModalOpen(true);
    } else {
      try {
        addUser({ ...dataToSend, id: Math.random().toString(36).substr(2, 9) } as User, adminName);
        setIsModalOpen(false);
        showToast('Colaborador cadastrado com sucesso!', 'success');
      } catch (err) {
        showToast('Erro ao cadastrar colaborador.', 'error');
      }
    }
  };

  const confirmUserUpdate = () => {
    if (!editReason.trim()) { alert('Informe o motivo da alteração.'); return; }
    if (formData.zipCode && !validateCEP(formData.zipCode)) {
      alert('CEP deve ter 8 dígitos.');
      return;
    }
    const fullAddress = `${formData.street || ''}, ${formData.number || ''} - ${formData.neighborhood || ''}, ${formData.city || ''} - ${formData.state || ''}`;
    const dataToSend = { ...formData, address: fullAddress };

    try {
      updateUserData({ id: editingId, ...dataToSend } as User, adminName, editReason);
      setIsReasonModalOpen(false);
      setIsModalOpen(false);
      showToast('Dados do colaborador atualizados!', 'success');
    } catch (err) {
      showToast('Erro ao atualizar colaborador.', 'error');
    }
  };

  const handleToggleClick = async (u: User) => {
    const action = u.active ? 'inativar' : 'reativar';
    if (window.confirm(`Deseja realmente ${action} o colaborador ${u.fullName}?`)) {
      toggleUserActive(u, 'Admin');
    }
  };

  const handleEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && termEditData.evidenceFiles.length < 3) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTermEditData(prev => ({
          ...prev,
          evidenceFiles: [...prev.evidenceFiles, event.target?.result as string]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setTermEditData(prev => ({
      ...prev,
      evidenceFiles: prev.evidenceFiles.filter((_, i) => i !== index)
    }));
  };

  const handleSaveTermEdit = async () => {
    if (editingTerm) {
      await updateTermDetails(
        editingTerm.id,
        termEditData.condition,
        termEditData.damageDescription,
        termEditData.assetDetails,
        termEditData.notes,
        termEditData.evidenceFiles,
        authUser?.name || 'Admin'
      );
      setEditingTerm(null);
    }
  };

  const handleViewTerm = async (term: Term) => {
    // Prioriza arquivo fixo se existir (manual ou gerado após aprovação)
    let url = term.fileUrl || (term as any).filebinary;
    
    if (!url && !!term.hasFile) {
      try {
        url = await getTermFile(term.id);
      } catch (err) {
        console.error("Erro ao buscar arquivo do termo:", err);
      }
    }
    
    // Se temos uma URL de arquivo assinado/finalizado
    if (url && url !== '#') {
      setPreviewData({ 
        url, 
        name: `termo_${term.type.toLowerCase()}_${editingId || 'document'}.${(url.includes('pdf') || url.includes('application/pdf')) ? 'pdf' : 'jpg'}` 
      });
      setIsPreviewOpen(true);
    } else {
      // Caso contrário, gera a pré-visualização HTML dinâmica usando os dados de assinatura se houver
      try {
        const user = users.find(u => u.id === editingId || u.id === term.userId);
        if (!user) throw new Error("Usuário não encontrado");

        let evidenceFiles = term.evidenceFiles || [];
        if (evidenceFiles.length === 0 && term.hasEvidence) {
          try {
            evidenceFiles = await getTermEvidences(term.id);
          } catch (err) {
            console.error("Erro ao buscar evidências do termo:", err);
          }
        }
        
        const isSim = term.assetDetails.includes('[CHIP:');
        let asset: any = null;
        let modelData: any = null;
        let modelName = '';
        
        const rawAssetId = (term as any).assetId;
        const rawAssetType = (term as any).assetType;

        if (isSim || rawAssetType === 'Sim' || term.assetDetails.includes('[CHIP:')) {
          const contentMatch = term.assetDetails.match(/\[CHIP:\s*(.*?)\]/);
          const content = contentMatch ? contentMatch[1] : '';
          const parts = content.split('|').map(p => p.trim());
          let phoneNumber = parts[0] || '';
          if (!phoneNumber && term.assetDetails.includes('CHIP:')) {
            phoneNumber = term.assetDetails.split('CHIP:')[1].trim().replace(']', '');
          }

          const realSim = sims.find(s => s.id === rawAssetId || (phoneNumber && s.phoneNumber === phoneNumber));
          if (realSim) {
            asset = { ...realSim };
          } else {
            asset = term.linkedSim || {
              operator: 'Operadora',
              iccid: 'N/A',
              phoneNumber: phoneNumber || 'N/A'
            };
          }
        } else {
          const contentMatch = term.assetDetails.match(/\[TAG:\s*(.*?)\]/);
          const content = contentMatch ? contentMatch[1] : '';
          const parts = content.split('|').map(p => p.trim());
          let assetTag = parts[0] || '';
          let serialNumber = '';
          let imei = '';
          parts.forEach(p => {
            if (p.startsWith('S/N:')) serialNumber = p.replace('S/N:', '').trim();
            else if (p.startsWith('IMEI:')) imei = p.replace('IMEI:', '').trim();
          });

          modelName = term.assetDetails.replace(/\[.*?\]\s*/, '').trim();
          const realDevice = devices.find(d => d.id === rawAssetId || (assetTag && d.assetTag === assetTag) || (imei && d.imei === imei));

          // Parse accessories defensively from JSON string or array
          let parsedAccessories = [];
          if (term.accessories) {
            if (typeof term.accessories === 'string') {
              try {
                parsedAccessories = JSON.parse(term.accessories);
              } catch (e) {
                console.error("Erro ao converter acessórios", e);
              }
            } else if (Array.isArray(term.accessories)) {
              parsedAccessories = term.accessories;
            }
          }

          if (realDevice) {
            asset = { ...realDevice };
            if (parsedAccessories && parsedAccessories.length > 0) {
              asset.accessories = parsedAccessories;
            }
            modelData = models.find(m => m.id === realDevice.modelId);
          } else {
            asset = {
              assetTag: assetTag || 'Desconhecido',
              serialNumber: serialNumber || 'Não Localizado',
              imei: imei || '',
              accessories: parsedAccessories
            };
          }
        }

        const sector = sectors.find(s => s.id === user.sectorId);

        let linkedSim = term.linkedSim;
        if (!linkedSim && !isSim && asset && asset.linkedSimId) {
          linkedSim = sims.find(s => s.id === asset.linkedSimId);
        }

        // Se o termo estiver aprovado ou tiver data de assinatura, ele DEVE mostrar a assinatura
        const hasSignatureInfo = !!(term.signatureDate || term.signatureStatus === 'APPROVED');
        let digitalSignature = (term as any).digitalSignature;
        let docPhoto = (term as any).docPhoto;
        let selfiePhoto = (term as any).selfiePhoto;
        let signatureInfo = (term as any).signatureInfo;

        // Se tiver informação de assinatura mas não tiver os dados binários no objeto term, busca na API
        if (hasSignatureInfo && !digitalSignature) {
          try {
            const response = await fetch(`/api/terms/${term.id}/signature-data`);
            if (response.ok) {
              const sigData = await response.json();
              digitalSignature = sigData.signatureCanvas;
              docPhoto = sigData.documentPhoto;
              selfiePhoto = sigData.selfiePhoto;
              signatureInfo = {
                date: term.signatureDate,
                ip: term.signatureIp || '0.0.0.0',
                locAddress: term.signatureLocation || 'Localização não informada',
                token: term.signatureToken || 'TOKEN-LEGACY',
                hash: term.signatureHash || 'HASH-LEGACY'
              };
            }
          } catch (err) {
            console.error("Erro ao buscar dados de assinatura:", err);
          }
        }

        generateAndPrintTerm({
          user,
          asset,
          settings,
          model: modelData || { name: modelName },
          actionType: term.type as 'ENTREGA' | 'DEVOLUCAO',
          sectorName: sector?.name,
          linkedSim,
          checklist: term.checklist,
          notes: term.notes,
          condition: term.condition,
          damageDescription: term.damageDescription,
          digitalSignature,
          docPhoto,
          selfiePhoto,
          signatureInfo,
          evidenceFiles,
          snapshotTemplate: (term as any).snapshotTemplate
        }, false);
      } catch (err) {
        console.error("Erro na pré-visualização:", err);
        handleDownloadTerm(term);
      }
    }
  };

  const handleGenerateSignatureLink = async (termId: string) => {
    if (isReadOnly) return;
    try {
      const token = await generateSignatureToken(termId);
      const link = `${window.location.origin}/#/sign-term/${token}`;
      setGeneratedSignatureLink(link);
      setIsLinkModalOpen(true);
      fetchData(true);
    } catch (err) {
      console.error("Erro ao gerar link:", err);
      showToast(`Erro ao gerar link: ${err.message}`, 'error');
    }
  };

  const handleDownloadTerm = async (term: Term) => {
    // Verifica se existe arquivo assinado
    let url = term.fileUrl || (term as any).filebinary;
    
    // Se não tem URL mas o sistema diz que tem arquivo, busca sob demanda
    if (!url && term.hasFile) {
      try {
        url = await getTermFile(term.id);
      } catch (err) {
        console.error("Erro ao buscar arquivo do termo:", err);
      }
    }
    
    if (url && url !== '#') {
      try {
        if (url.startsWith('data:')) {
          const parts = url.split(',');
          const contentType = parts[0].split(':')[1].split(';')[0];
          const byteCharacters = atob(parts[1]);
          const byteArrays = [];
          for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
          }
          const blob = new Blob(byteArrays, {type: contentType});
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          
          // Lógica inteligente para extensão do arquivo
          const extension = contentType.includes('pdf') ? 'pdf' : (contentType.includes('png') ? 'png' : 'jpg');
          link.download = `termo_${term.type.toLowerCase()}_${editingId}.${extension}`;
          
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
          }, 100);
        } else {
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          
          // Fallback seguro se não for data:, tenta detectar pela URL ou assume PDF para legado
          const isImg = url.toLowerCase().match(/\.(jpg|jpeg|png)$/);
          const extension = isImg ? isImg[1] : 'pdf';
          link.download = `termo_${term.type.toLowerCase()}_${editingId}.${extension}`;
          
          link.click();
        }
      } catch (err) {
        console.error("Erro ao processar download:", err);
        window.open(url, '_blank');
      }
    } else if (term.hasFile) {
      alert("O arquivo assinado ainda não foi sincronizado com o servidor ou está em processamento.");
    } else {
      // MODO REIMPRESSÃO DINÂMICA
      const user = users.find(u => u.id === editingId);
      if (!user) return;

      // Busca evidências se o termo sinalizar que tem, mas elas não estão carregadas no objeto
      let evidenceFiles = term.evidenceFiles || [];
      if (evidenceFiles.length === 0 && term.hasEvidence) {
        try {
          evidenceFiles = await getTermEvidences(term.id);
        } catch (err) {
          console.error("Erro ao buscar evidências do termo:", err);
        }
      }
      
      // Prioridade 1: Usar dados salvos no próprio Termo (Fidelidade Total)
      // Prioridade 2: Reconstruir via assetDetails se for termo antigo
      
      const isSim = term.assetDetails.includes('[CHIP:');
      let asset: any = null;
      let modelData: any = null;
      let modelName = '';
      
      const rawAssetId = (term as any).assetId;
      const rawAssetType = (term as any).assetType;

      if (isSim || rawAssetType === 'Sim' || term.assetDetails.includes('[CHIP:')) {
        const contentMatch = term.assetDetails.match(/\[CHIP:\s*(.*?)\]/);
        const content = contentMatch ? contentMatch[1] : '';
        const parts = content.split('|').map(p => p.trim());
        let phoneNumber = parts[0] || '';
        if (!phoneNumber && term.assetDetails.includes('CHIP:')) {
          phoneNumber = term.assetDetails.split('CHIP:')[1].trim().replace(']', '');
        }

        const realSim = sims.find(s => s.id === rawAssetId || (phoneNumber && s.phoneNumber === phoneNumber));
        asset = term.linkedSim || realSim || {
          operator: 'Operadora',
          iccid: 'N/A',
          phoneNumber: phoneNumber || 'Chip SIM'
        };
        modelName = 'Chip / SIM Card';
      } else {
        const contentMatch = term.assetDetails.match(/\[TAG:\s*(.*?)\]/);
        const content = contentMatch ? contentMatch[1] : '';
        const parts = content.split('|').map(p => p.trim());
        let assetTag = parts[0] || '';
        let serialNumber = '';
        let imei = '';
        parts.forEach(p => {
          if (p.startsWith('S/N:')) serialNumber = p.replace('S/N:', '').trim();
          else if (p.startsWith('IMEI:')) imei = p.replace('IMEI:', '').trim();
        });

        modelName = term.assetDetails.replace(/\[.*?\]\s*/, '').trim();
        const realDevice = devices.find(d => d.id === rawAssetId || (assetTag && d.assetTag === assetTag) || (imei && d.imei === imei));
        
        // Parse accessories defensively from JSON string or array
        let parsedAccessories = [];
        if (term.accessories) {
          if (typeof term.accessories === 'string') {
            try {
              parsedAccessories = JSON.parse(term.accessories);
            } catch (e) {
              console.error("Erro ao converter acessórios", e);
            }
          } else if (Array.isArray(term.accessories)) {
            parsedAccessories = term.accessories;
          }
        }
        
        if (realDevice) {
           asset = { ...realDevice };
           if (parsedAccessories && parsedAccessories.length > 0) {
             asset.accessories = parsedAccessories;
           }
           modelData = models.find(m => m.id === realDevice.modelId);
        } else {
           asset = {
             assetTag: assetTag || 'Desconhecido',
             serialNumber: serialNumber || 'Não Localizado',
             imei: imei || '',
             accessories: parsedAccessories
           };
        }
      }
      
      const sector = sectors.find(s => s.id === user.sectorId);
      
      let linkedSim = term.linkedSim;
      if (!linkedSim && !isSim && asset && asset.linkedSimId) {
        linkedSim = sims.find(s => s.id === asset.linkedSimId);
      }

      // Se for assinado digitalmente e APROVADO, busca dados para inclusão no PDF
      let digitalSignature = null;
      let docPhoto = null;
      let selfiePhoto = null;
      let signatureInfo = null;

      if (term.signatureDate && (term.signatureStatus === 'APPROVED' || !term.signatureStatus)) {
        try {
          const res = await fetch(`/api/terms/${term.id}/signature-data`);
          const data = await res.json();
          digitalSignature = data.signatureCanvas;
          docPhoto = data.documentPhoto;
          selfiePhoto = data.selfiePhoto;
          signatureInfo = {
            date: term.signatureDate,
            ip: term.signatureIp || '0.0.0.0',
            locAddress: term.signatureLocation || 'Localização não informada',
            token: term.signatureToken || 'TOKEN-LEGACY',
            hash: term.signatureHash || 'HASH-LEGACY'
          };
        } catch(err) { console.error("Erro ao carregar dados da assinatura digital:", err); }
      }
      
      generateAndPrintTerm({
        user,
        asset,
        settings,
        model: modelData || { name: modelName },
        actionType: term.type as 'ENTREGA' | 'DEVOLUCAO',
        sectorName: sector?.name,
        linkedSim,
        checklist: term.checklist,
        notes: term.notes,
        condition: term.condition,
        damageDescription: term.damageDescription,
        evidenceFiles: evidenceFiles,
        digitalSignature,
        docPhoto,
        selfiePhoto,
        signatureInfo,
        snapshotTemplate: (term as any).snapshotTemplate
      });
    }
  };

  const handleUploadTermFile = async (termId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingId) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileUrl = event.target?.result as string;
        await updateTermFile(termId, editingId, fileUrl, authUser?.name || 'Admin');
        showToast('Termo assinado enviado com sucesso', 'success');
        await fetchData(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      { bg: 'bg-blue-50 dark:bg-blue-950/50', border: 'border-blue-200 dark:border-blue-800/40', text: 'text-blue-700 dark:text-sky-300' },
      { bg: 'bg-emerald-50 dark:bg-emerald-950/50', border: 'border-emerald-200 dark:border-emerald-800/40', text: 'text-emerald-700 dark:text-emerald-300' },
      { bg: 'bg-purple-50 dark:bg-purple-950/50', border: 'border-purple-200 dark:border-purple-800/40', text: 'text-purple-700 dark:text-purple-300' },
      { bg: 'bg-amber-50 dark:bg-amber-950/50', border: 'border-amber-200 dark:border-amber-800/40', text: 'text-amber-800 dark:text-amber-300' },
      { bg: 'bg-rose-50 dark:bg-rose-950/50', border: 'border-rose-200 dark:border-rose-800/40', text: 'text-rose-700 dark:text-rose-300' },
      { bg: 'bg-cyan-50 dark:bg-cyan-950/50', border: 'border-cyan-200 dark:border-cyan-800/40', text: 'text-cyan-700 dark:text-cyan-300' },
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ').filter(p => !['de', 'da', 'do', 'das', 'dos'].includes(p.toLowerCase()));
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const handleConfirmResolveManual = async () => {
    if (!resolvingManualTerm || !resolveManualReason.trim()) return;
    await resolveTermManual(resolvingManualTerm.id, resolveManualReason, authUser?.name || 'Admin');
    setResolvingManualTerm(null);
    setResolveManualReason('');
    await fetchData(true);
  };

  const handleDeleteTermFile = async (termId: string) => {
    if (editingId && window.confirm('Deseja realmente remover o arquivo deste termo? Esta ação permitirá o reenvio.')) {
      await deleteTermFile(termId, editingId, 'Remoção de arquivo do termo para reenvio', authUser?.name || 'Admin');
      await fetchData(true);
    }
  };

  const handleApproveSignature = async (termId: string) => {
    if(!window.confirm('Deseja aprovar esta assinatura digital?')) return;
    try {
      const res = await fetch(`/api/terms/${termId}/approve-signature`, { method: 'POST' });
      if(res.ok) {
        showToast('Assinatura aprovada com sucesso', 'success');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        // Pequeno delay para o banco processar e atualiza localmente
        setTimeout(() => fetchData(true), 500);
      }
    } catch(err) { console.error(err); }
  };

  const handleRejectSignature = async (termId: string) => {
    if(!window.confirm('Deseja rejeitar esta assinatura? O colaborador precisará assinar novamente.')) return;
    try {
      const res = await fetch(`/api/terms/${termId}/reject-signature`, { method: 'POST' });
      if(res.ok) {
        showToast('Assinatura rejeitada', 'info');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        setTimeout(() => fetchData(true), 500);
      }
    } catch(err) { console.error(err); }
  };

  const renderSignatureStatus = (term: Term) => {
    if (!term.signatureDate) return null;
    
    const status = term.signatureStatus || 'APPROVED';
    
    if (status === 'WAITING_APPROVAL') {
      return (
        <div className="flex flex-col gap-1 items-center animate-pulse">
           <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/10">
              Validar Assinatura
           </div>
           <div className="flex gap-2 mt-1">
             <button 
               onClick={(e) => { e.stopPropagation(); handleApproveSignature(term.id); }}
               className="p-1 px-3 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-emerald-500 transition-all flex items-center gap-1 shadow-lg"
             >
               <Check size={10} /> Aprovar
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); handleRejectSignature(term.id); }}
               className="p-1 px-3 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-red-500 transition-all flex items-center gap-1 shadow-lg"
             >
               <X size={10} /> Rejeitar
             </button>
           </div>
        </div>
      );
    }
    
    if (status === 'REJECTED') {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <div className="bg-red-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/10">
            Rejeitada
          </div>
          <span className="text-[8px] text-red-500/70 font-bold uppercase">Repetir Processo</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/10">
          Validado
        </div>
        <span className="text-[8px] text-emerald-500/70 font-bold uppercase">Digitalmente</span>
      </div>
    );
  };

  // ─── Importação / Sincronização de Colaboradores RH → TI ─────────────────────
  const cleanCpf = (cpf: string) => (cpf || '').replace(/\D/g, '');

  // Mapa de campos mapeáveis RH → TI com labels amigáveis
  const RH_TI_FIELD_MAP: Array<{ label: string; rhKey: string; tiKey: string; }> = [
    { label: 'Nome Completo',        rhKey: 'fullName',       tiKey: 'fullName' },
    { label: 'CPF',                  rhKey: 'cpf',            tiKey: 'cpf' },
    { label: 'RG',                   rhKey: 'rg',             tiKey: 'rg' },
    { label: 'PIS',                  rhKey: 'pis',            tiKey: 'pis' },
    { label: 'E-mail Corporativo',   rhKey: 'emailCorporate', tiKey: 'email' },
    { label: 'Telefone Corporativo', rhKey: 'corporatePhone', tiKey: 'phone' },
    { label: 'Telefone Pessoal',     rhKey: 'personalPhone',  tiKey: 'personalPhone' },
    { label: 'Setor',                rhKey: 'sectorId',       tiKey: 'sectorId' },
    { label: 'CEP',                  rhKey: 'cep',            tiKey: 'zipCode' },
    { label: 'Logradouro',           rhKey: 'street',         tiKey: 'street' },
    { label: 'Número',               rhKey: 'number',         tiKey: 'number' },
    { label: 'Complemento',          rhKey: 'complement',     tiKey: 'complement' },
    { label: 'Bairro',               rhKey: 'neighborhood',   tiKey: 'neighborhood' },
    { label: 'Cidade',               rhKey: 'city',           tiKey: 'city' },
    { label: 'Estado',               rhKey: 'state',          tiKey: 'state' },
  ];

  // Colaboradores novos (CPF não existe em TI)
  const pendingRhImports = useMemo(() => {
    const tiCpfs = new Set(users.map(u => cleanCpf(u.cpf)));
    return (rhCollaborators || []).filter(rc => !tiCpfs.has(cleanCpf(rc.cpf)));
  }, [rhCollaborators, users]);

  // Colaboradores com atualizações (CPF existe em TI, mas há campos divergentes)
  const rhUpdates = useMemo(() => {
    const result: Array<{ rhColab: any; tiUser: User; diffs: Array<{ label: string; rhKey: string; tiKey: string; rhValue: string; tiValue: string }> }> = [];
    for (const rc of (rhCollaborators || [])) {
      const tiUser = users.find(u => cleanCpf(u.cpf) === cleanCpf(rc.cpf));
      if (!tiUser) continue;
      const diffs: Array<{ label: string; rhKey: string; tiKey: string; rhValue: string; tiValue: string }> = [];
      for (const mapping of RH_TI_FIELD_MAP) {
        const rhVal = String((rc as any)[mapping.rhKey] || '').trim();
        const tiVal = String((tiUser as any)[mapping.tiKey] || '').trim();
        if (rhVal !== tiVal && rhVal !== '') {
          diffs.push({ ...mapping, rhValue: rhVal, tiValue: tiVal });
        }
      }
      if (diffs.length > 0) result.push({ rhColab: rc, tiUser, diffs });
    }
    return result;
  }, [rhCollaborators, users]);

  // Lista combinada para exibição (novos + atualizações)
  type RhListItem = { kind: 'new'; rc: any } | { kind: 'update'; rc: any; tiUser: User; diffs: Array<{ label: string; rhKey: string; tiKey: string; rhValue: string; tiValue: string }> };
  const allRhItems = useMemo((): RhListItem[] => {
    const newItems: RhListItem[] = pendingRhImports.map(rc => ({ kind: 'new' as const, rc }));
    const updateItems: RhListItem[] = rhUpdates.map(({ rhColab, tiUser, diffs }) => ({ kind: 'update' as const, rc: rhColab, tiUser, diffs }));
    return [...newItems, ...updateItems];
  }, [pendingRhImports, rhUpdates]);

  const filteredRhList = useMemo((): RhListItem[] => {
    let result = [...allRhItems];
    if (rhFilter === 'new') result = result.filter(i => i.kind === 'new');
    if (rhFilter === 'update') result = result.filter(i => i.kind === 'update');
    if (rhSearchTerm) {
      const term = rhSearchTerm.toLowerCase();
      result = result.filter(i =>
        i.rc.fullName.toLowerCase().includes(term) ||
        (i.rc.cpf || '').includes(term) ||
        (i.rc.role || '').toLowerCase().includes(term)
      );
    }
    result.sort((a, b) => {
      const aVal = (a.rc[rhSortKey] || '') as string;
      const bVal = (b.rc[rhSortKey] || '') as string;
      return rhSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return result;
  }, [allRhItems, rhFilter, rhSearchTerm, rhSortKey, rhSortDirection]);

  const handleImportCollaborator = async (colab: any) => {
    if (!window.confirm(`Confirmar a importação de "${colab.fullName}" para o módulo de T.I.?`)) return;
    const addressStr = [colab.street, colab.number, colab.complement, colab.neighborhood, colab.city, colab.state]
      .filter(Boolean).join(', ');
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      fullName: colab.fullName,
      cpf: colab.cpf || '',
      rg: colab.rg || '',
      pis: colab.pis || '',
      email: colab.emailCorporate || colab.emailPersonal || '',
      sectorId: colab.sectorId || '',
      internalCode: '',
      active: true,
      status: UserStatus.ACTIVE,
      address: addressStr,
      zipCode: colab.cep || '',
      street: colab.street || '',
      number: colab.number || '',
      complement: colab.complement || '',
      neighborhood: colab.neighborhood || '',
      city: colab.city || '',
      state: colab.state || '',
      phone: colab.corporatePhone || colab.personalPhone || '',
      personalPhone: colab.personalPhone || '',
      gender: colab.gender || 'Masculino',
      birthDate: colab.birthDate || '',
      hireDate: colab.hireDate || new Date().toISOString().split('T')[0],
      notes: 'Importado automaticamente do módulo de R.H.',
      photo: colab.photo || '',
      terms: [],
    } as any;
    try {
      await addUser(newUser, adminName);
      showToast(`Colaborador "${colab.fullName}" importado com sucesso!`, 'success');
    } catch (err) {
      showToast('Erro ao importar colaborador.', 'error');
    }
  };

  const handleSyncCollaborator = (item: Extract<RhListItem, { kind: 'update' }>) => {
    const { rc, tiUser, diffs } = item;
    // Monta o formData com os dados atuais do TI + override dos campos divergentes do RH
    const addressStr = [rc.street, rc.number, rc.complement, rc.neighborhood, rc.city, rc.state]
      .filter(Boolean).join(', ');
    setEditingId(tiUser.id);
    setFormData({
      ...tiUser,
      fullName: rc.fullName || tiUser.fullName,
      cpf: rc.cpf || tiUser.cpf,
      rg: rc.rg || tiUser.rg,
      pis: rc.pis || tiUser.pis,
      email: rc.emailCorporate || rc.emailPersonal || tiUser.email,
      sectorId: rc.sectorId || tiUser.sectorId,
      phone: rc.corporatePhone || tiUser.phone,
      personalPhone: rc.personalPhone || tiUser.personalPhone,
      zipCode: rc.cep || tiUser.zipCode,
      street: rc.street || tiUser.street,
      number: rc.number || tiUser.number,
      complement: rc.complement || tiUser.complement,
      neighborhood: rc.neighborhood || tiUser.neighborhood,
      city: rc.city || tiUser.city,
      state: rc.state || tiUser.state,
      address: addressStr || tiUser.address,
      photo: rc.photo || tiUser.photo || '',
    } as any);
    setRhSyncTarget(item);
    setIsRhViewModalOpen(false);
    setSelectedRhColab(null);
    setEditReason('');
    setIsReasonModalOpen(true);
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const columns: Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>[] = [
    { key: 'fullName', label: 'Nome Completo', minWidth: '350px', sortable: true },

    ...(visibleColumns.includes('email') ? [{ key: 'email', label: 'E-mail', minWidth: '200px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('cpf') ? [{ key: 'cpf', label: 'CPF', minWidth: '140px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('rg') ? [{ key: 'rg', label: 'RG', minWidth: '120px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('sector') ? [{ key: 'sectorId', label: 'Setor / Função', minWidth: '180px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('assetsCount') ? [{ key: 'assetsCount', label: 'Ativos', minWidth: '100px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('activeSims') ? [{ key: 'activeSims', label: 'Números de Chip', minWidth: '160px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    ...(visibleColumns.includes('devicesInfo') ? [{ key: 'devicesInfo', label: 'Detalhes de Aparelho', minWidth: '250px', sortable: true } as Column<User & { assetsCount: number; activeSims: string; devicesInfo: string }>] : []),
    { key: 'actions', label: 'Ações', minWidth: '120px', sortable: false }
  ];

  const enrichedUsers = paginatedUsers.map(u => {
    const { userDevices, allUserSims } = getUserAssetsEnrich(u.id);
    return {
      ...u,
      assetsCount: userDevices.length + allUserSims.length,
      activeSims: allUserSims.map(s => s.phoneNumber).join(', ') || '---',
      devicesInfo: userDevices.map(d => {
        const m = models.find(mod => mod.id === d.modelId);
        return `${m?.name || 'Device'} (${d.assetTag || d.serialNumber})`;
      }).join(', ') || '---'
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shadow-2xl relative z-30">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2 truncate">
            <UserIcon className="text-emerald-500 shrink-0" size={24} />
            Gestão de Colaboradores
          </h2>
          <p className="text-[10px] sm:text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-1 sm:mt-1.5 opacity-80 truncate">Total de {users.length} profissionais mapeados no ecossistema</p>
        </div>
        <div className="flex flex-nowrap items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner shrink-0">
            <button onClick={() => handleExport('csv')} className="p-2 sm:p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:text-emerald-400 transition-all" title="Exportar CSV"><FileText size={18}/></button>
            <button onClick={() => handleExport('excel')} className="p-2 sm:p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:text-emerald-400 transition-all" title="Exportar Excel"><FileSpreadsheet size={18}/></button>
            <button onClick={() => handleExport('pdf')} className="p-2 sm:p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:text-emerald-400 transition-all" title="Exportar PDF"><Download size={18}/></button>
          </div>

          <div className={`relative shrink-0 ${isColumnSelectorOpen ? 'z-[9999]' : 'z-[10]'}`} ref={columnRef}>
            <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 font-extrabold text-[10px] sm:text-[11px] uppercase tracking-widest transition-all shadow-inner border-b-4 border-b-slate-800 active:border-b-0 active:translate-y-[2px] whitespace-nowrap">
              <SlidersHorizontal size={18} /> Colunas
            </button>
            {isColumnSelectorOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-2xl z-[500] overflow-hidden animate-fade-in shadow-2xl ring-1 ring-white/5">
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-widest">Personalizar Visão</span>
                  <button onClick={() => setIsColumnSelectorOpen(false)} className="hover:text-slate-900 dark:text-white transition-colors"><X size={14}/></button>
                </div>
                <div className="p-2 space-y-1 bg-white dark:bg-slate-800/50">
                  {COLUMN_OPTIONS.map(col => (
                    <button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${visibleColumns.includes(col.id) ? ' bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : ' hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}>
                      {col.label}
                      {visibleColumns.includes(col.id) && <Check size={14}/>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button 
            disabled={isReadOnly}
            onClick={() => handleOpenModal()} 
            className={`bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl flex items-center gap-2 font-extrabold text-[10px] sm:text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-900/40 border-b-4 border-b-emerald-800 active:border-b-0 active:translate-y-[2px] whitespace-nowrap shrink-0 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Plus size={18} /> Novo Colaborador
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-emerald-500/30 group">
          <div>
            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Ativos</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{users.filter(u => u.active && (!u.status || u.status === UserStatus.ACTIVE)).length}</p>
          </div>
          <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-800/30 group-hover:scale-110 transition-transform"><Smartphone size={24}/></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-blue-500/30 group">
          <div>
            <span className="text-[11px] font-black text-blue-600 dark:text-sky-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Afastados</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{users.filter(u => u.active && u.status === UserStatus.ON_LEAVE).length}</p>
          </div>
          <div className="h-12 w-12 bg-blue-50 dark:bg-sky-500/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-sky-400 border border-blue-800/30 group-hover:scale-110 transition-transform"><MapPin size={24}/></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-slate-500/30 group">
          <div>
            <span className="text-[11px] font-black text-slate-600 dark:text-slate-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Inativos</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{users.filter(u => !u.active).length}</p>
          </div>
          <div className="h-12 w-12 bg-slate-100 dark:bg-slate-800/40 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600/30 group-hover:scale-110 transition-transform"><Briefcase size={24}/></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all hover:border-amber-500/30 group shadow-sm">
          <div>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1.5">Termos Pend.</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{users.filter(u => (u.terms || []).some(t => !t.fileUrl && !t.hasFile && t.signatureStatus !== 'APPROVED')).length}</p>
          </div>
          <div className="h-12 w-12 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><AlertTriangle size={24}/></div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-800 px-4 pt-2 rounded-t-xl transition-colors">
        {(['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const).map(mode => (
          <button 
            key={mode} 
            onClick={() => {
              setViewMode(mode);
              setShowPendingOnly(false);
              setShowRhImportList(false);
            }} 
            className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${(!showPendingOnly && !showRhImportList && viewMode === mode) ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'}`}
          >
            {mode === 'ACTIVE' ? 'Ativos' : mode === 'INACTIVE' ? 'Inativos' : 'Afastados'}
            <span className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] border border-slate-200 dark:border-slate-700">
              {users.filter(u => {
                if (mode === 'ACTIVE') return u.active && (!u.status || u.status === UserStatus.ACTIVE);
                if (mode === 'INACTIVE') return !u.active;
                if (mode === 'ON_LEAVE') return u.active && u.status === UserStatus.ON_LEAVE;
                return false;
              }).length}
            </span>
          </button>
        ))}
        <button 
          onClick={() => { setShowPendingOnly(true); setShowRhImportList(false); }} 
          className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${showPendingOnly ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-amber-600'}`}
        >
          Termos Pendentes
          <span className="ml-2 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 px-2 py-0.5 rounded-full text-[11px] font-bold">
            {users.filter(u => (u.terms || []).some(t => !t.fileUrl && !t.hasFile && t.signatureStatus !== 'APPROVED')).length}
          </span>
        </button>
        <button 
          onClick={() => { setShowRhImportList(true); setShowPendingOnly(false); }} 
          className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${showRhImportList ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-indigo-600'}`}
        >
          Importar do R.H.
          {pendingRhImports.length > 0 && (
            <span className="ml-2 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 px-2 py-0.5 rounded-full text-[11px] font-bold">
              {pendingRhImports.length}
            </span>
          )}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3" size={20} />
        <input 
          type="text" 
          placeholder="Pesquisar por Nome, CPF, E-mail, RG ou PIS..." 
          className="pl-12 w-full border-none rounded-xl py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 transition-colors" 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl flex items-center justify-between sticky top-4 z-50"
          >
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase tracking-wider">{selectedIds.length} Selecionados</span>
              <div className="h-6 w-px bg-white/20 mx-2"/>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setBulkActionType('STATUS'); setIsBulkModalOpen(true); }}
                  className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
                >
                  Alterar Status
                </button>
                <button 
                  onClick={() => { setBulkActionType('SECTOR'); setIsBulkModalOpen(true); }}
                  className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
                >
                  Alterar Setor
                </button>
              </div>
            </div>
            <button onClick={() => setSelectedIds([])} className="p-1 hover:bg-white/10 rounded-full transition-all">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      {showRhImportList ? (
        /* ─── PAINEL: Importar do R.H. ─── */
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl ring-1 ring-white/5">
          {/* Barra de controles e Sub-filtros */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
            {/* Subfiltros: Todos / Novos / Atualizações */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
              <button
                onClick={() => setRhFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${rhFilter === 'all' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Todos ({allRhItems.length})
              </button>
              <button
                onClick={() => setRhFilter('new')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${rhFilter === 'new' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Novos Cadastros ({pendingRhImports.length})
              </button>
              <button
                onClick={() => setRhFilter('update')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${rhFilter === 'update' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Atualizações ({rhUpdates.length})
              </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por nome, CPF ou cargo..."
                  className="pl-9 w-full border border-slate-200 dark:border-slate-700 rounded-xl py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 transition-colors"
                  value={rhSearchTerm}
                  onChange={e => setRhSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ordenar:
                {(['fullName', 'role', 'hireDate'] as const).map(key => (
                  <button
                    key={key}
                    onClick={() => {
                      if (rhSortKey === key) setRhSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                      else { setRhSortKey(key); setRhSortDirection('asc'); }
                    }}
                    className={`px-2.5 py-1 rounded-lg border transition-all ${rhSortKey === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400'}`}
                  >
                    {key === 'fullName' ? 'Nome' : key === 'role' ? 'Cargo' : 'Admissão'}
                    {rhSortKey === key && <span className="ml-1">{rhSortDirection === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabela de Resultados */}
          {filteredRhList.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-indigo-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <UserCheck size={32} className="text-indigo-400" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-widest">
                {rhSearchTerm ? 'Nenhum resultado para a busca' : 'Nenhuma pendência de cadastros ou atualizações do R.H.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Tipo</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Colaborador</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Cargo / Setor</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Divergências / Admissão</th>
                    <th className="px-6 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRhList.map((item) => {
                    const rc = item.rc;
                    const sector = sectors.find(s => s.id === rc.sectorId);
                    const color = getAvatarColor(rc.fullName);
                    const initials = getInitials(rc.fullName);
                    const isUpdate = item.kind === 'update';

                    return (
                      <tr key={rc.id} className="border-b border-slate-200 dark:border-slate-700/50 border-l-4 border-l-transparent hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 hover:border-l-indigo-500 transition-all bg-white dark:bg-slate-800">
                        {/* Tag Tipo */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isUpdate ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <RefreshCw size={10} className="animate-spin-slow" />
                              Atualização ({item.diffs.length})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              <UserPlus size={10} />
                              Novo Cadastro
                            </span>
                          )}
                        </td>

                        {/* Colaborador */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black border ${color.bg} ${color.border} ${color.text} flex-shrink-0`}>
                              {initials}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{rc.fullName}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{rc.cpf || '---'}</p>
                            </div>
                          </div>
                        </td>

                        {/* Cargo / Setor */}
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{rc.role || '---'}</p>
                          <p className="text-[11px] text-slate-400">{sector?.name || '---'}</p>
                        </td>

                        {/* Divergências ou Data de Admissão */}
                        <td className="px-6 py-4">
                          {isUpdate ? (
                            <div>
                              <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                {item.diffs.length} campo{item.diffs.length > 1 ? 's' : ''} alterado{item.diffs.length > 1 ? 's' : ''} no R.H.
                              </p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[200px]" title={item.diffs.map(d => d.label).join(', ')}>
                                {item.diffs.map(d => d.label).join(', ')}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {rc.hireDate ? new Date(rc.hireDate + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}
                            </p>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => { setSelectedRhColab(item); setIsRhViewModalOpen(true); }}
                              className="p-2 rounded-xl bg-indigo-900/20 text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300 transition-all"
                              title={isUpdate ? "Comparar diferenças R.H. x T.I." : "Visualizar dados do R.H."}
                            >
                              <Eye size={15} />
                            </button>

                            {isUpdate ? (
                              <button
                                onClick={() => handleSyncCollaborator(item)}
                                disabled={isReadOnly}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-500 transition-all text-[10px] font-black uppercase tracking-wider shadow-md shadow-amber-900/20 disabled:opacity-40"
                                title="Sincronizar alterações com o T.I."
                              >
                                <RefreshCw size={12} />
                                Sincronizar
                              </button>
                            ) : (
                              <button
                                onClick={() => handleImportCollaborator(rc)}
                                disabled={isReadOnly}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all text-[10px] font-black uppercase tracking-wider shadow-md shadow-emerald-900/20 disabled:opacity-40"
                                title="Importar colaborador para T.I."
                              >
                                <UserPlus size={13} />
                                Importar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl ring-1 ring-white/5">
        <DataTable
          columns={columns}
          data={enrichedUsers}
          sortConfig={sortConfig}
          requestSort={handleSort}
          columnWidths={columnWidths}
          onResize={handleResize}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          renderRow={(u) => {
            const sector = sectors.find(s => s.id === u.sectorId);
            const hasPending = (u.terms || []).some(t => !t.fileUrl && !t.hasFile && t.signatureStatus !== 'APPROVED');

            return (
              <tr 
                key={u.id} 
                onClick={() => handleOpenModal(u, true)} 
                className={`border-b border-slate-200 dark:border-slate-700/50 border-l-4 border-l-transparent transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:border-l-emerald-500 bg-white dark:bg-slate-800 ${!u.active ? 'opacity-60' : ''} ${selectedIds.includes(u.id) ? 'bg-emerald-50 dark:bg-emerald-500/20 border-l-emerald-500' : ''}`}
              >
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 focus:ring-emerald-500"
                    checked={selectedIds.includes(u.id)}
                    onChange={(e) => { e.stopPropagation(); handleSelectOne(u.id); }}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const cleanCpf = u.cpf ? u.cpf.replace(/\D/g, '') : '';
                      const rhColab = cleanCpf ? (rhCollaborators || []).find(rc => rc.cpf && rc.cpf.replace(/\D/g, '') === cleanCpf) : null;
                      const photoUrl = u.photo || rhColab?.photo;

                      if (photoUrl) {
                        return (
                          <div className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm overflow-hidden bg-slate-100 dark:bg-slate-800">
                            <img src={photoUrl} alt={u.fullName} className="w-full h-full object-cover" />
                          </div>
                        );
                      }

                      const color = getAvatarColor(u.fullName);
                      return (
                        <div className={`h-9 w-9 rounded-xl ${color.bg} flex items-center justify-center border ${color.border} shrink-0 shadow-sm overflow-hidden`}>
                          <span className={`text-[11px] font-black ${color.text} tracking-tighter`}>
                            {getInitials(u.fullName)}
                          </span>
                        </div>
                      );
                    })()}
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white text-[13px]">{u.fullName}</div>
                      <div className="flex gap-1 mt-0.5">
                        {u.status === UserStatus.ON_LEAVE && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400">
                            Afastado
                          </span>
                        )}
                        {hasPending && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                {visibleColumns.includes('email') && <td className="px-6 py-4 truncate text-xs">{u.email}</td>}
                {visibleColumns.includes('cpf') && <td className="px-6 py-4 font-mono text-xs truncate">{u.cpf}</td>}
                {visibleColumns.includes('rg') && <td className="px-6 py-4 font-mono text-xs truncate">{u.rg || '---'}</td>}
                {visibleColumns.includes('sector') && (
                  <td className="px-6 py-4 truncate">
                    <span className="text-[11px] font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                      {sector?.name || 'Não Informado'}
                    </span>
                  </td>
                )}
                {visibleColumns.includes('assetsCount') && (
                  <td className="px-6 py-4 text-center truncate">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${u.assetsCount > 0 ? ' bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400' : ' bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                      {u.assetsCount}
                    </span>
                  </td>
                )}
                {visibleColumns.includes('activeSims') && <td className="px-6 py-4 truncate text-[11px] font-mono">{u.activeSims}</td>}
                {visibleColumns.includes('devicesInfo') && <td className="px-6 py-4 truncate text-[11px] font-medium">{u.devicesInfo}</td>}
                <td className="px-6 py-4 text-right truncate">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => handleOpenModal(u, false)} 
                      disabled={isReadOnly} 
                      className={`p-1.5 text-blue-600 dark:text-sky-400 hover:bg-blue-100 dark:bg-sky-500/20 rounded-lg transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => !isReadOnly && handleToggleClick(u)} 
                      disabled={isReadOnly} 
                      className={`p-1.5 rounded-lg transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : (u.active ? ' hover:bg-orange-900/30' : ' hover:bg-emerald-100 dark:bg-emerald-500/20')}`} 
                      title={u.active ? 'Inativar' : 'Reativar'}
                    >
                      {u.active ? <Power size={16} /> : <RefreshCw size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            );
          }}
        />
        <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Exibir:</span>
              <select 
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                value={itemsPerPage} 
                onChange={(e) => setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value="ALL">Todos</option>
              </select>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider">Total: {totalItems} colaboradores</p>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className={`p-2 rounded-lg transition-all ${currentPage === 1 ? 'text-slate-700 dark:text-slate-300 cursor-not-allowed' : ' text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:bg-emerald-500/20'}`}><ChevronLeft size={18}/></button>
              <div className="flex items-center gap-1"><span className="text-xs font-black text-emerald-300 bg-emerald-900/40 px-3 py-1.5 rounded-lg">{currentPage}</span><span className="text-xs font-bold uppercase mx-1">de</span><span className="text-xs font-black text-slate-700 dark:text-slate-300">{totalPages}</span></div>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className={`p-2 rounded-lg transition-all ${currentPage === totalPages ? 'text-slate-700 dark:text-slate-300 cursor-not-allowed' : ' text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:bg-emerald-500/20'}`}><ChevronRight size={18}/></button>
            </div>
          )}
        </div>
      </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up border border-slate-200 dark:border-slate-700 transition-colors">
            <div className="bg-black px-8 py-5 flex justify-between items-center shrink-0 border-b border-white/10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">{editingId ? (isViewOnly ? 'Detalhes do Colaborador' : 'Editar Colaborador') : 'Novo Colaborador'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="h-10 w-10 flex items-center justify-center bg-white/5 hover:text-slate-900 dark:text-white rounded-full hover:bg-white/10 transition-all"><X size={20}/></button>
            </div>

            <div className="flex bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 overflow-x-auto shrink-0 px-4 pt-2">
              <button type="button" onClick={() => setActiveTab('DATA')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${activeTab === 'DATA' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-700 dark:text-slate-300'}`}>Dados Cadastrais</button>
              <button type="button" onClick={() => setActiveTab('ASSETS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'ASSETS' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-700 dark:text-slate-300'}`}>Ativos em Posse <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{(userDevices.length + userSims.length)}</span></button>
              <button type="button" onClick={() => setActiveTab('LICENSES')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'LICENSES' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-700 dark:text-slate-300'}`}>Licenças e Contas <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{userAccounts.length}</span></button>
              <button type="button" onClick={() => setActiveTab('TERMS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'TERMS' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-700 dark:text-slate-300'}`}>Termos Gerados <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{currentUserTerms.length}</span></button>
              <button type="button" onClick={() => setActiveTab('LOGS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-700 dark:text-slate-300'}`}>Histórico</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-800 transition-colors">
              {activeTab === 'DATA' && (
                <form id="userForm" onSubmit={handleSubmit} className="space-y-6">
                  {isViewOnly && (
                    <div className="md:col-span-2 bg-emerald-50 dark:bg-emerald-500/20 p-4 rounded-xl border border-emerald-900/40 flex items-center gap-3 mb-4">
                      <Info className="text-emerald-600 dark:text-emerald-400" size={20} />
                      <p className="text-xs font-bold text-emerald-200">Modo de visualização. Clique no botão "Habilitar Edição" abaixo para realizar alterações.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(() => {
                      const cleanCpf = formData.cpf ? formData.cpf.replace(/\D/g, '') : '';
                      const rhColab = cleanCpf ? (rhCollaborators || []).find(rc => rc.cpf && rc.cpf.replace(/\D/g, '') === cleanCpf) : null;
                      const photoUrl = formData.photo || rhColab?.photo;
                      if (!photoUrl) return null;
                      return (
                        <div className="md:col-span-2 flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                          <div className="h-16 w-16 rounded-2xl border border-slate-300 dark:border-slate-600 overflow-hidden shrink-0 shadow-md">
                            <img src={photoUrl} alt={formData.fullName} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50 mb-1">
                              <Camera size={12} /> Foto do Colaborador (Sincronizada R.H.)
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Foto vinculada via CPF do Módulo de R.H.</p>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Nome Completo</label>
                      <input disabled={isViewOnly} required className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">CPF</label>
                      <input disabled={isViewOnly} required className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-mono bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">RG</label>
                      <input disabled={isViewOnly} required className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-mono bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" value={formData.rg || ''} onChange={e => setFormData({...formData, rg: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">PIS / PASEP</label>
                      <input disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-mono bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" value={formData.pis || ''} onChange={e => setFormData({...formData, pis: e.target.value})} placeholder="Somente números" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">E-mail Corporativo</label>
                      <input disabled={isViewOnly} required type="email" className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value?.trim() || ''})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Cargo / Setor Atual</label>
                      <select disabled={isViewOnly} required className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" value={formData.sectorId || ''} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                        <option value="">Selecione um cargo...</option>
                        {[...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Código Interno</label>
                      <input disabled={isViewOnly} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" value={formData.internalCode || ''} onChange={e => setFormData({...formData, internalCode: e.target.value})} placeholder="Código de sincronização" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Status do Colaborador</label>
                      <select disabled={isViewOnly} required className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" value={formData.status || UserStatus.ACTIVE} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                        <option value={UserStatus.ACTIVE}>Ativo</option>
                        <option value={UserStatus.ON_LEAVE}>Afastado (INSS/Licença)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-700 pt-6 mt-2">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-4">Informações Complementares</h4>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-6 gap-4">
                      <div className="md:col-span-2 relative">
                        <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">CEP (Busca automática)</label>
                        <div className="relative">
                          <input 
                            disabled={isViewOnly} 
                            type="text" 
                            placeholder="00000-000" 
                            className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white pr-10" 
                            value={formData.zipCode || ''} 
                            onBlur={handleCepBlur} 
                            onChange={e => setFormData({...formData, zipCode: formatCEP(e.target.value)})} 
                          />
                          {cepLoading && <RefreshCw size={18} className="animate-spin absolute right-3 top-3.5 text-emerald-500" />}
                        </div>
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Logradouro / Rua</label>
                        <input 
                          disabled={isViewOnly} 
                          type="text" 
                          placeholder="Rua, Avenida, etc." 
                          className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" 
                          value={formData.street || ''} 
                          onChange={e => setFormData({...formData, street: e.target.value})} 
                        />
                      </div>

                      <div className="md:col-span-1">
                        <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Número</label>
                        <input 
                          disabled={isViewOnly} 
                          type="text" 
                          placeholder="Nº" 
                          className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" 
                          value={formData.number || ''} 
                          onChange={e => setFormData({...formData, number: e.target.value})} 
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Complemento</label>
                        <input 
                          disabled={isViewOnly} 
                          type="text" 
                          placeholder="Apto, Bloco, etc. (Opcional)" 
                          className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" 
                          value={formData.complement || ''} 
                          onChange={e => setFormData({...formData, complement: e.target.value})} 
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Bairro</label>
                        <input 
                          disabled={isViewOnly} 
                          type="text" 
                          placeholder="Bairro" 
                          className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" 
                          value={formData.neighborhood || ''} 
                          onChange={e => setFormData({...formData, neighborhood: e.target.value})} 
                        />
                      </div>

                      <div className="md:col-span-1.5 md:col-span-1">
                        <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Cidade</label>
                        <input 
                          disabled={isViewOnly} 
                          type="text" 
                          placeholder="Cidade" 
                          className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white" 
                          value={formData.city || ''} 
                          onChange={e => setFormData({...formData, city: e.target.value})} 
                        />
                      </div>

                      <div className="md:col-span-0.5 md:col-span-1">
                        <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">UF</label>
                        <input 
                          disabled={isViewOnly} 
                          type="text" 
                          placeholder="UF" 
                          className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white uppercase" 
                          value={formData.state || ''} 
                          maxLength={2}
                          onChange={e => setFormData({...formData, state: e.target.value})} 
                        />
                      </div>
                    </div>
                  </div>
                </form>
              )}
              {activeTab === 'ASSETS' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400/80 mb-4 flex items-center gap-2"><Smartphone size={14} className="text-emerald-500" /> Dispositivos e Periféricos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userDevices.map(d => {
                        const m = models.find(mod => mod.id === d.modelId);
                        const isSharedResponsible = d.additionalUserIds?.includes(editingId || '');
                        return (
                          <div 
                            key={d.id} 
                            onClick={() => { setIsModalOpen(false); navigate(`/devices?deviceId=${d.id}`); }}
                            className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 group hover:border-emerald-500/50 transition-all cursor-pointer"
                          >
                              <div className="h-12 w-12 rounded-lg bg-emerald-950/20 flex items-center justify-center border border-emerald-900/30 shrink-0 relative">
                              <Smartphone className="text-emerald-500" size={24}/>
                              {isSharedResponsible && (
                                <div className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full" title="Ativo Compartilhado">
                                  <Users size={UI_ICON_SIZE_SMALL}/>
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">{m?.name || 'Aparelho'}</div>
                                {isSharedResponsible && <span className="text-[11px] font-bold bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30 uppercase">Compartilhado</span>}
                              </div>
                              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">TAG: {d.assetTag || 'N/A'} <span className="h-1 w-1 bg-slate-700 rounded-full"/> S/N: {d.serialNumber || 'N/A'}</div>
                              <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">{d.imei ? `IMEI: ${d.imei}` : ''}</div>
                            </div>
                          </div>
                        );
                      })}
                      {userDevices.length === 0 && <div className="md:col-span-2 text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl"><Smartphone className="mx-auto text-slate-700 mb-2" size={32}/><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Nenhum dispositivo em posse</p></div>}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2"><Briefcase size={14} className="text-blue-500" /> Linhas Móveis (Chips)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userSims.map(sim => (
                        <div 
                          key={sim.id} 
                          onClick={() => { setIsModalOpen(false); navigate(`/sims?simId=${sim.id}`); }}
                          className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 group hover:border-blue-500/50 transition-all cursor-pointer"
                        >
                          <div className="h-12 w-12 rounded-lg bg-blue-950/20 flex items-center justify-center border border-blue-300 dark:border-sky-700/30 shrink-0">
                            <Phone className="text-blue-500" size={24}/>
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate">{sim.phoneNumber}</div>
                            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{sim.assetTag ? `Sim Card: ${sim.assetTag}` : 'Sim Card S/N'}</div>
                            <div className="mt-1"><span className="text-[11px] font-black bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400 px-2 py-0.5 rounded uppercase tracking-wider">Ativa</span></div>
                          </div>
                        </div>
                      ))}
                      {userSims.length === 0 && <div className="md:col-span-2 text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl"><Phone className="mx-auto text-slate-700 mb-2" size={32}/><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Nenhuma linha associada</p></div>}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'LICENSES' && (
                <div className="space-y-4">
                   <div className="grid grid-cols-1 gap-3">
                    {userAccounts.map(acc => (
                      <div key={acc.id} className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between group hover:border-emerald-500/40 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-300 dark:border-slate-600">
                            <Mail className="text-emerald-600 dark:text-emerald-400" size={24} />
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">{acc.name}</div>
                            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate max-w-[250px] mb-1">{acc.login}</div>
                            {acc.password && (
                              <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <Key size={12} className="text-slate-500 dark:text-slate-400"/>
                                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-700 dark:text-slate-300">
                                  {visiblePasswords[acc.id] ? acc.password : '••••••••'}
                                </span>
                                <button 
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setVisiblePasswords(prev => ({ ...prev, [acc.id]: !prev[acc.id] })); }}
                                  className="text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:text-emerald-400 p-0.5 ml-1 transition-colors"
                                  title={visiblePasswords[acc.id] ? "Ocultar Senha" : "Mostrar Senha"}
                                >
                                  {visiblePasswords[acc.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const success = await copyToClipboard(acc.password || '');
                                    if (success) {
                                      showToast('Senha copiada', 'success');
                                    } else {
                                      showToast('Erro ao copiar senha', 'error');
                                    }
                                  }}
                                  className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400 p-0.5 transition-colors"
                                  title="Copiar Senha"
                                >
                                  <Copy size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="text-right">
                              <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Status da Conta</div>
                              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">Ativa</span>
                           </div>
                           <button 
                             onClick={() => { setIsModalOpen(false); navigate(`/accounts?accountId=${acc.id}`); }}
                             className="p-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:text-slate-900 dark:text-white transition-colors border border-slate-200 dark:border-slate-700"
                           >
                             <ExternalLink size={16} />
                           </button>
                        </div>
                      </div>
                    ))}
                    {userAccounts.length === 0 && (
                      <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <Mail className="mx-auto text-slate-800 mb-4" size={48} />
                        <h4 className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Nenhuma conta Microsoft/Google</h4>
                        <p className="text-xs text-slate-600 mt-2">Este colaborador não possui licenças atribuídas no momento.</p>
                      </div>
                    )}
                   </div>
                </div>
              )}
              {activeTab === 'TERMS' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    {currentUserTerms.map(term => (
                      <div key={term.id} className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between group hover:border-emerald-500/40 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-300 dark:border-slate-600">
                            {term.type === 'ENTREGA' ? <FileSignature className="text-emerald-600 dark:text-emerald-400" size={24} /> : <RefreshCw className="text-blue-600 dark:text-sky-400" size={24} />}
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">{term.type === 'ENTREGA' ? 'Termo de Entrega' : 'Termo de Devolução'}</div>
                            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex flex-col gap-0.5 mt-1">
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-500/80">EMITIDO EM: {new Date(term.date).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                                {term.assetDetails || '---'}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-lg ${
                              term.isManual 
                                ? 'bg-orange-600 text-white shadow-orange-500/20' 
                                : (term.fileUrl || term.hasFile || (term.signatureDate && term.signatureStatus === 'APPROVED')) 
                                  ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                                  : term.signatureStatus === 'WAITING_APPROVAL'
                                    ? 'bg-blue-600 text-white animate-pulse shadow-blue-500/20'
                                    : 'bg-orange-600 text-white shadow-orange-500/20'
                            }`} title={term.isManual ? `Resolvido Manualmente: ${term.resolutionReason || 'Sem motivo'}` : ''}>
                              {term.isManual ? 'Manual' : (term.fileUrl || term.hasFile || (term.signatureDate && term.signatureStatus === 'APPROVED') ? 'Assinado' : (term.signatureStatus === 'WAITING_APPROVAL' ? 'Validar' : 'Pendente'))}
                            </span>
                            {term.isManual && (
                              <div className="text-[9px] font-bold text-orange-500/70 mt-0.5 uppercase tracking-tighter">Resolução Manual</div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button 
                              type="button"
                              onClick={async () => {
                                setEditingTerm(term); 
                                
                                // Busca evidências se o termo sinalizar que tem, mas elas não estão no objeto local
                                let evidences = term.evidenceFiles || [];
                                if (evidences.length === 0 && term.hasEvidence) {
                                  try {
                                    evidences = await getTermEvidences(term.id);
                                  } catch (err) {
                                    console.error("Erro ao carregar evidências para edição:", err);
                                  }
                                }

                                setTermEditData({
                                  status: (term.fileUrl || term.hasFile ? 'SIGNED' : 'PENDING'), 
                                  notes: term.notes || '', 
                                  evidenceFiles: evidences,
                                  condition: term.condition || 'Perfeito',
                                  damageDescription: term.damageDescription || '',
                                  assetDetails: term.assetDetails || ''
                                });
                              }} 
                              disabled={!!(term.fileUrl || term.hasFile)}
                              className={`p-2 bg-white dark:bg-slate-800 rounded-lg transition-all border border-slate-200 dark:border-slate-700 ${term.fileUrl || term.hasFile ? 'opacity-30 cursor-not-allowed text-slate-500 dark:text-slate-400' : 'text-blue-600 dark:text-sky-400 hover:bg-blue-50 dark:bg-sky-500/20'}`}
                            >
                              <Edit2 size={16} />
                            </button>
                            {!!(term.fileUrl || term.hasFile || term.signatureDate) && (
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewTerm(term); }}
                                className="p-2 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:text-emerald-300 transition-all border border-emerald-900/40"
                                title={!!(term.fileUrl || term.hasFile) ? "Visualizar Arquivo Assinado" : "Visualizar Comprovante Digital"}
                              >
                                <Eye size={16} />
                              </button>
                            )}

                             {!(term.fileUrl || term.hasFile) && !term.signatureDate && (
                               <div className="flex gap-2">
                                 <button 
                                   type="button"
                                   onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownloadTerm(term); }}
                                   className="p-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:text-slate-900 dark:text-white transition-all border border-slate-200 dark:border-slate-700"
                                   title="Gerar Termo"
                                 >
                                   <Download size={16} />
                                 </button>

                                 <button 
                                   type="button"
                                   onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleGenerateSignatureLink(term.id); }}
                                   className="p-2 bg-blue-50 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400 rounded-lg hover:text-blue-300 transition-all border border-blue-300 dark:border-sky-700/40"
                                   title="Gerar Link de Assinatura"
                                 >
                                   <Share2 size={16} />
                                 </button>
                               </div>
                             )}

                             {term.signatureDate && (
                               renderSignatureStatus(term)
                             )}

                             {/* Evidências Jurídicas Avançadas */}
                             {!!(term.hasSignaturePhoto || term.hasSignatureSelfiePhoto) && (
                               <div className="flex gap-2">
                                 <button 
                                   onClick={async (e) => {
                                     e.stopPropagation();
                                     try {
                                       const res = await fetch(`/api/terms/${term.id}/signature-data`);
                                       const data = await res.json();
                                       const evidenceUrls = [];
                                       if(data.documentPhoto) evidenceUrls.push(data.documentPhoto);
                                       if(data.selfiePhoto) evidenceUrls.push(data.selfiePhoto);
                                       
                                       if(evidenceUrls.length > 0) {
                                         setPreviewData({ url: evidenceUrls, name: `EVIDENCIAS_${term.id}.jpg` });
                                         setIsPreviewOpen(true);
                                       }
                                     } catch(err) { console.error(err); }
                                   }}
                                   className="p-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600/50 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5"
                                   title="Ver Evidências de Identidade (Doc + Selfie)"
                                 >
                                   <Camera size={14} className="text-blue-600 dark:text-sky-400" />
                                   <span className="text-[9px] font-black uppercase tracking-widest px-1">Evidências</span>
                                 </button>
                               </div>
                             )}
                             
                            {!(term.fileUrl || term.hasFile) ? (
                              <div className="flex gap-2">
                                {!(term.isManual) && (
                                  <button 
                                    type="button"
                                    onClick={() => setResolvingManualTerm(term)}
                                    className="p-2 bg-white dark:bg-slate-800 text-orange-400 rounded-lg hover:bg-orange-900/20 transition-all border border-slate-200 dark:border-slate-700"
                                    title="Resolução Manual"
                                  >
                                    <CheckSquare size={16} />
                                  </button>
                                )}
                                <label className="p-2 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:bg-emerald-500/20 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer" title="Upload Assinado">
                                  <Upload size={16} />
                                  <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => handleUploadTermFile(term.id, e)} />
                                </label>
                              </div>
                            ) : (
                              <button 
                                type="button"
                                onClick={() => handleDeleteTermFile(term.id)}
                                className="p-2 bg-white dark:bg-slate-800 text-red-400 rounded-lg hover:bg-red-900/20 transition-all border border-slate-200 dark:border-slate-700"
                                title="Excluir/Alterar"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {currentUserTerms.length === 0 && (
                      <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <FileText className="mx-auto text-slate-800 mb-4" size={48} />
                        <h4 className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Nenhum termo gerado</h4>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'LOGS' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    {(() => {
                      const currentUser = users.find(u => u.id === editingId);
                      const name = currentUser?.fullName.toLowerCase().trim() || '';
                      const userLogs = logs.filter(l => {
                        const target = (l.targetName || '').toLowerCase();
                        const notes = (l.notes || '').toLowerCase();
                        return target === name || 
                               target.includes(name) ||
                               notes.includes(name) ||
                               (name.split(' ').length > 1 && notes.includes(name.split(' ')[0]) && notes.includes(name.split(' ').pop() || ''));
                      });
                      return (
                        <>
                          <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Total de Eventos: {userLogs.length}</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const currentUser = users.find(u => u.id === editingId);
                      const name = currentUser?.fullName.toLowerCase().trim() || '';
                      const userLogs = logs.filter(l => {
                        const target = (l.targetName || '').toLowerCase();
                        const notes = (l.notes || '').toLowerCase();
                        return target === name || 
                               target.includes(name) ||
                               notes.includes(name) ||
                               (name.split(' ').length > 1 && notes.includes(name.split(' ')[0]) && notes.includes(name.split(' ').pop() || ''));
                      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                      if (userLogs.length === 0) {
                        return (
                          <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <History className="mx-auto text-slate-800 mb-4" size={48} />
                            <h4 className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Nenhuma atividade registrada</h4>
                          </div>
                        );
                      }

                      return userLogs.map(log => {
                        const statusClass = log.action.includes('ENTREGA') ? 'bg-emerald-950 text-emerald-600 dark:text-emerald-400' :
                                           log.action.includes('DEVOLUCAO') ? 'bg-blue-950 text-blue-600 dark:text-sky-400' :
                                           'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
                        return (
                          <div key={log.id} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2 group hover:border-slate-300 dark:border-slate-600 transition-all">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <span className={ "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter " + statusClass }>
                                  {log.action}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{new Date(log.timestamp).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <span className="text-[10px] font-black text-slate-600 uppercase">AUDIT#{log.id.slice(0,5).toUpperCase()}</span>
                            </div>
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{log.notes || 'Sem observações registradas.'}</div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                              <UserIcon size={12} className="text-slate-600"/> Executor: {log.adminUser}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 px-8 py-5 flex justify-between items-center shrink-0 border-t border-white/5">
              <div className="flex gap-3">
                {!isViewOnly && (
                  <button type="button" onClick={() => setIsViewOnly(true)} className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-[11px] uppercase tracking-widest hover:bg-slate-750 transition-all">Cancelar Edição</button>
                )}
                {isViewOnly && (
                  <button type="button" onClick={() => setIsViewOnly(false)} className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-black text-[11px] uppercase tracking-widest hover:bg-emerald-50 dark:bg-emerald-500/20 transition-all border border-emerald-900/30">Habilitar Edição</button>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-[11px] uppercase tracking-widest hover:bg-slate-750 transition-all">Fechar</button>
                {!isViewOnly && (
                  <button type="submit" form="userForm" className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"><Save size={16}/> Salvar Alterações</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingTerm && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900/90 z-[200] flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 animate-scale-up shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800/50">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Gerenciar Termo</h3>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">ID: {editingTerm.id.toUpperCase()}</p>
              </div>
              <button onClick={() => setEditingTerm(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={20}/></button>
            </div>

            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">

              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2">Observações Detalhadas</label>
                <textarea className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-500 min-h-[100px] text-sm" value={termEditData.notes} onChange={e => setTermEditData({...termEditData, notes: e.target.value})} placeholder="Adicione notas sobre o estado dos itens ou observações do colaborador..."/>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2">Evidências (Fotos / B.O.) - Máx 3</label>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {termEditData.evidenceFiles.map((file, index) => (
                    <div key={index} className="relative rounded-xl overflow-hidden border-2 border-slate-300 dark:border-slate-600 group h-32">
                      <img src={file} alt={`Evidência ${index + 1}`} className="w-full h-full object-cover"/>
                      <div className="absolute inset-0 bg-white dark:bg-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => handleRemoveEvidence(index)} className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform" title="Remover Imagem">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {termEditData.evidenceFiles.length < 3 && (
                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                      <div className="flex flex-col items-center justify-center p-4 text-center">
                        <Upload className="w-6 h-6 mb-2"/>
                        <p className="text-xs">Adicionar</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleEvidenceUpload} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 flex gap-3 justify-end">
              <button onClick={() => setEditingTerm(null)} className="px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
              <button onClick={handleSaveTermEdit} className="px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest text-slate-900 dark:text-white transition-all">Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {isReasonModalOpen && (
        <div className="fixed inset-0 bg-white dark:bg-slate-800/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm overflow-hidden border border-blue-300 dark:border-sky-700/40">
            <div className="p-8">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="h-16 w-16 bg-blue-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center mb-4 shadow-inner border border-blue-800">
                  <Save size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Confirmar Alterações?</h3>
                <p className="text-xs mt-2">Informe o motivo da alteração para auditoria:</p>
              </div>
              <textarea 
                className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-blue-100 focus:ring-blue-900/20 outline-none mb-6 transition-all bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                rows={3}
                placeholder="Descreva o que foi alterado..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              ></textarea>
              <div className="flex gap-4">
                <button onClick={() => setIsReasonModalOpen(false)} className={`flex-1 py-3 rounded-2xl ${UI_BUTTON_SECONDARY}`}>Voltar</button>
                <button onClick={confirmUserUpdate} disabled={!editReason.trim()} className={`flex-1 py-3 rounded-2xl ${UI_BUTTON_PRIMARY}`}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resolvingManualTerm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[300] p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">Resolução Manual de Termo</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 font-medium leading-relaxed">
              Deseja resolver este termo manualmente para <span className="text-slate-900 dark:text-white font-bold">{users.find(u => u.id === editingId)?.fullName}</span>? 
              Isso marcará a pendência como resolvida sem anexo.
            </p>
            <div className="mb-6">
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Motivo/Justificativa</label>
              <textarea
                rows={4}
                className="w-full p-4 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-600 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                placeholder="Ex: Assinatura física coletada em via única, Contingência de sistema, etc..."
                value={resolveManualReason}
                onChange={(e) => setResolveManualReason(e.target.value)}
              ></textarea>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setResolvingManualTerm(null); setResolveManualReason(''); }}
                className="flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmResolveManual}
                disabled={!resolveManualReason.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-900/20"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {isLinkModalOpen && generatedSignatureLink && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[501] p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-xl border border-slate-200 dark:border-slate-700 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
            
            <div className="flex justify-between items-center mb-6">
              <div className="h-12 w-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                <Share2 size={24} />
              </div>
              <button 
                onClick={() => setIsLinkModalOpen(false)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Link de Assinatura Gerado</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 font-medium">Compartilhe este link com o colaborador para que ele possa assinar o termo digitalmente.</p>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6 group transition-all hover:border-emerald-500/30">
              <div className="flex items-center justify-between gap-4">
                <div className="truncate text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  {generatedSignatureLink}
                </div>
                <button 
                  onClick={async () => {
                    const success = await copyToClipboard(generatedSignatureLink);
                    if (success) {
                      showToast('Link copiado com sucesso!', 'success');
                    } else {
                      showToast('Não foi possível copiar automaticamente. Selecione e copie o link manualmente.', 'error');
                    }
                  }}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 active:scale-95"
                >
                  <Copy size={16} /> Copiar
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-300 dark:border-slate-600/50">
                <div className="flex gap-3 items-start">
                  <div className="bg-blue-500/10 p-2 rounded-lg text-blue-600 dark:text-sky-400 shrink-0">
                    <Info size={16} />
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed uppercase tracking-wider">
                    Este link é único para este termo. Caso o colaborador não consiga copiar, você pode enviar o link acima manualmente por e-mail ou WhatsApp.
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsLinkModalOpen(false)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
              >
                Fechar Janela
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Modal Visualização Restrita / Diff R.H. x T.I. ─── */}
      {isRhViewModalOpen && selectedRhColab && (() => {
        const item = selectedRhColab.kind ? selectedRhColab : { kind: 'new', rc: selectedRhColab };
        const rc = item.rc;
        const isUpdateItem = item.kind === 'update';
        const diffs = isUpdateItem ? item.diffs : [];
        const tiUser = isUpdateItem ? item.tiUser : null;

        return (
          <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className={`px-8 py-5 flex justify-between items-center shrink-0 ${isUpdateItem ? 'bg-gradient-to-r from-amber-900 via-amber-800 to-amber-700' : 'bg-gradient-to-r from-indigo-900 to-indigo-700'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border ${getAvatarColor(rc.fullName).bg} ${getAvatarColor(rc.fullName).border} ${getAvatarColor(rc.fullName).text}`}>
                    {getInitials(rc.fullName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">{rc.fullName}</h3>
                      {isUpdateItem ? (
                        <span className="bg-amber-400 text-amber-950 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">
                          Atualização no R.H.
                        </span>
                      ) : (
                        <span className="bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">
                          Novo Cadastro
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/80 font-bold uppercase tracking-widest">{rc.role || 'Sem Cargo'} • CPF: {rc.cpf || '---'}</p>
                  </div>
                </div>
                <button onClick={() => { setIsRhViewModalOpen(false); setSelectedRhColab(null); }} className="h-9 w-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-all text-white">
                  <X size={18} />
                </button>
              </div>

              {/* Banner informativo */}
              <div className={`${isUpdateItem ? 'bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/30' : 'bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800/30'} px-6 py-2.5 flex items-center gap-2`}>
                {isUpdateItem ? (
                  <>
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 font-bold">
                      Este colaborador já possui cadastro no T.I., porém foram identificadas {diffs.length} alteração(ões) no R.H. Veja a comparação abaixo.
                    </p>
                  </>
                ) : (
                  <>
                    <Shield size={14} className="text-indigo-500 flex-shrink-0" />
                    <p className="text-[11px] text-indigo-600 dark:text-indigo-300 font-bold">
                      Exibindo apenas dados relevantes para importação. Informações sensíveis de remuneração e filiação estão ocultas.
                    </p>
                  </>
                )}
              </div>

              {/* Corpo do Modal */}
              <div className="overflow-y-auto p-8 space-y-6">
                {/* Se for ATUALIZAÇÃO: Tabela comparativa de diferenças */}
                {isUpdateItem && diffs.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
                    <p className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                      <RefreshCw size={14} /> Comparação de Campos Alterados
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-amber-500/30 text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">
                            <th className="py-2 px-3">Campo</th>
                            <th className="py-2 px-3">Valor Atual no T.I.</th>
                            <th className="py-2 px-3">Novo Valor no R.H.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-500/20">
                          {diffs.map((d, idx) => {
                            const isSectorField = d.rhKey === 'sectorId';
                            const rhDisplay = isSectorField ? (sectors.find(s => s.id === d.rhValue)?.name || d.rhValue) : d.rhValue;
                            const tiDisplay = isSectorField ? (sectors.find(s => s.id === d.tiValue)?.name || d.tiValue) : d.tiValue;

                            return (
                              <tr key={idx} className="bg-white/40 dark:bg-slate-900/40">
                                <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-200">{d.label}</td>
                                <td className="py-2.5 px-3 font-mono text-rose-600 dark:text-rose-400 line-through bg-rose-500/5 rounded">
                                  {tiDisplay || '--- (Vazio)'}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded">
                                  {rhDisplay || '---'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Dados Cadastrais Gerais do R.H. */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><CreditCard size={12}/> Documentos</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">CPF</p>
                      <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">{rc.cpf || '---'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">RG</p>
                      <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">{rc.rg || '---'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">PIS</p>
                      <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">{rc.pis || '---'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Admissão</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {rc.hireDate ? new Date(rc.hireDate + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contato */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Mail size={12}/> Contato</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 flex items-center gap-3">
                      <Mail size={14} className="text-indigo-400 flex-shrink-0"/>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">E-mail Corporativo</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{rc.emailCorporate || '---'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Telefone Corporativo</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{rc.corporatePhone || '---'}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Telefone Pessoal</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{rc.personalPhone || '---'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Função */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Briefcase size={12}/> Função</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Cargo</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{rc.role || '---'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Setor</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{sectors.find(s => s.id === rc.sectorId)?.name || '---'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Tipo de Contrato</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{rc.contractType || '---'}</p>
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><MapPin size={12}/> Endereço no R.H.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">CEP</p>
                      <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">{rc.cep || '---'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Bairro</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{rc.neighborhood || '---'}</p>
                    </div>
                    <div className="col-span-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Logradouro</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {[rc.street, rc.number, rc.complement].filter(Boolean).join(', ') || '---'}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Cidade</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{rc.city || '---'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Estado</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{rc.state || '---'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <button
                  onClick={() => { setIsRhViewModalOpen(false); setSelectedRhColab(null); }}
                  className="px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-all"
                >
                  Fechar
                </button>

                {isUpdateItem ? (
                  <button
                    onClick={() => handleSyncCollaborator(item)}
                    disabled={isReadOnly}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-lg shadow-amber-900/20 disabled:opacity-40"
                  >
                    <RefreshCw size={14} />
                    Sincronizar Dados com T.I.
                  </button>
                ) : (
                  <button
                    onClick={() => { setIsRhViewModalOpen(false); handleImportCollaborator(rc); }}
                    disabled={isReadOnly}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-40"
                  >
                    <UserPlus size={14} />
                    Importar para T.I.
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      <FilePreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        fileUrl={previewData.url}
        fileName={previewData.name}
      />
    </div>
  );
};

export default UserManager;
