import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, User as UserIcon, Edit2, Trash2, 
  ChevronLeft, ChevronRight, Download, Filter, 
  FilterX, MoreHorizontal, UserPlus, Info, 
  MapPin, Phone, Mail, CreditCard, Hash, FileText, 
  ExternalLink, Power, History, Shield, Smartphone, 
  Briefcase, CheckCircle2, Clock, AlertCircle, RefreshCw, X, 
  FileSignature, ChevronDown, CheckSquare, Upload, Share2, 
  Save, Eye, EyeOff, Key, FileUp, Building2, Users, FileSpreadsheet, SlidersHorizontal, Check, AlertTriangle, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { User, UserSector, Device, DeviceModel, Term, SoftwareAccount, UserStatus, DeviceStatus } from '../types';
import { normalizeString, phoneticEncode } from '../utils/stringUtils';
import { DataTable, Column } from './DataTable';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { UI_LABEL_SMALL, UI_ICON_SIZE_SMALL, UI_BUTTON_PRIMARY, UI_BUTTON_SECONDARY, UI_BUTTON_SUCCESS, UI_BUTTON_DANGER } from '../constants';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import { generateAndPrintTerm } from '../utils/termGenerator';
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
  }>({
    status: 'PENDING',
    notes: '',
    evidenceFiles: []
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
  const columnRef = useRef<HTMLDivElement>(null);

  const { 
    users, 
    sectors, 
    models, 
    devices, 
    sims, 
    accounts,
    logs,
    getTermFile,
    updateTermFile,
    deleteTermFile,
    resolveTermManual,
    addUser,
    updateUser: updateUserData,
    toggleUserActive,
    isReadOnly,
    settings
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
      result = result.filter(u => (u.terms || []).some(t => !t.fileUrl && !t.hasFile));
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
      setFormData(validData);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      setEditReason('');
      setIsReasonModalOpen(true);
    } else {
      try {
        addUser({ ...formData, id: Math.random().toString(36).substr(2, 9) } as User, adminName);
        setIsModalOpen(false);
        showToast('Colaborador cadastrado com sucesso!', 'success');
      } catch (err) {
        showToast('Erro ao cadastrar colaborador.', 'error');
      }
    }
  };

  const confirmUserUpdate = () => {
    if (!editReason.trim()) { alert('Informe o motivo da alteração.'); return; }
    try {
      updateUserData({ id: editingId, ...formData } as User, adminName, editReason);
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

  const handleSaveTermEdit = () => {
    if (editingTerm) {
      const user = users.find(u => u.id === editingId);
      if (user) {
        const updatedTerms = user.terms.map(t => 
          t.id === editingTerm.id 
            ? { ...t, notes: termEditData.notes, evidenceFiles: termEditData.evidenceFiles } 
            : t
        );
        updateUserData({ ...user, terms: updatedTerms }, authUser?.name || 'Admin', 'Atualização de notas/evidências do termo');
      }
      setEditingTerm(null);
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
        
        if (realDevice) {
           asset = { ...realDevice };
           if (term.accessories && term.accessories.length > 0) {
             asset.accessories = term.accessories;
           }
           modelData = models.find(m => m.id === realDevice.modelId);
        } else {
           asset = {
             assetTag: assetTag || 'Desconhecido',
             serialNumber: serialNumber || 'Não Localizado',
             imei: imei || '',
             accessories: term.accessories || []
           };
        }
      }
      
      const sector = sectors.find(s => s.id === user.sectorId);
      
      let linkedSim = term.linkedSim;
      if (!linkedSim && !isSim && asset && asset.linkedSimId) {
        linkedSim = sims.find(s => s.id === asset.linkedSimId);
      }
      
      generateAndPrintTerm({
        user,
        asset,
        settings,
        model: modelData || { name: modelName },
        actionType: term.type as 'ENTREGA' | 'DEVOLUCAO',
        sectorName: sector?.name,
        linkedSim,
        notes: term.notes,
        condition: term.condition,
        damageDescription: term.damageDescription,
        evidenceFiles: term.evidenceFiles
      });
    }
  };

  const handleUploadTermFile = (termId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingId) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileUrl = event.target?.result as string;
        updateTermFile(termId, editingId, fileUrl, authUser?.name || 'Admin');
        showToast('Termo assinado enviado com sucesso', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      { bg: 'bg-blue-600/10', border: 'border-blue-500/20', text: 'text-blue-400' },
      { bg: 'bg-emerald-600/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
      { bg: 'bg-violet-600/10', border: 'border-violet-500/20', text: 'text-violet-400' },
      { bg: 'bg-amber-600/10', border: 'border-amber-500/20', text: 'text-amber-400' },
      { bg: 'bg-rose-600/10', border: 'border-rose-500/20', text: 'text-rose-400' },
      { bg: 'bg-cyan-600/10', border: 'border-cyan-500/20', text: 'text-cyan-400' },
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
  };

  const handleDeleteTermFile = (termId: string) => {
    if (editingId && window.confirm('Deseja realmente remover o arquivo deste termo? Esta ação permitirá o reenvio.')) {
      deleteTermFile(termId, editingId, 'Remoção de arquivo do termo para reenvio', authUser?.name || 'Admin');
    }
  };

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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 p-4 sm:p-6 rounded-xl border border-slate-800 transition-colors shadow-2xl overflow-hidden">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-2 truncate">
            <UserIcon className="text-emerald-500 shrink-0" size={24} />
            Gestão de Colaboradores
          </h2>
          <p className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 sm:mt-1.5 opacity-80 truncate">Total de {users.length} profissionais mapeados no ecossistema</p>
        </div>
        <div className="flex flex-nowrap items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner shrink-0">
            <button onClick={() => handleExport('csv')} className="p-2 sm:p-2.5 hover:bg-slate-800 border-r border-slate-800 text-slate-400 hover:text-emerald-400 transition-all" title="Exportar CSV"><FileText size={18}/></button>
            <button onClick={() => handleExport('excel')} className="p-2 sm:p-2.5 hover:bg-slate-800 border-r border-slate-800 text-slate-400 hover:text-emerald-400 transition-all" title="Exportar Excel"><FileSpreadsheet size={18}/></button>
            <button onClick={() => handleExport('pdf')} className="p-2 sm:p-2.5 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-all" title="Exportar PDF"><Download size={18}/></button>
          </div>

          <div className="relative shrink-0" ref={columnRef}>
            <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="bg-slate-950 border border-slate-800 text-slate-300 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-800 font-extrabold text-[10px] sm:text-[11px] uppercase tracking-widest transition-all shadow-inner border-b-4 border-b-slate-800 active:border-b-0 active:translate-y-[2px] whitespace-nowrap">
              <SlidersHorizontal size={18} /> Colunas
            </button>
            {isColumnSelectorOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl z-[80] overflow-hidden animate-fade-in shadow-2xl ring-1 ring-white/5">
                <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-widest">Personalizar Visão</span>
                  <button onClick={() => setIsColumnSelectorOpen(false)} className="hover:text-white transition-colors"><X size={14}/></button>
                </div>
                <div className="p-2 space-y-1 bg-slate-900/50">
                  {COLUMN_OPTIONS.map(col => (
                    <button key={col.id} onClick={() => toggleColumn(col.id)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${visibleColumns.includes(col.id) ? ' bg-emerald-900/20 text-emerald-400' : ' hover:bg-slate-800 text-slate-500 hover:text-slate-300'}`}>
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
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-emerald-500/30 group">
          <div>
            <span className="text-[11px] font-black text-emerald-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Ativos</span>
            <p className="text-2xl font-black text-slate-100">{users.filter(u => u.active && (!u.status || u.status === UserStatus.ACTIVE)).length}</p>
          </div>
          <div className="h-12 w-12 bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-800/30 group-hover:scale-110 transition-transform"><Smartphone size={24}/></div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-blue-500/30 group">
          <div>
            <span className="text-[11px] font-black text-blue-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Afastados</span>
            <p className="text-2xl font-black text-slate-100">{users.filter(u => u.active && u.status === UserStatus.ON_LEAVE).length}</p>
          </div>
          <div className="h-12 w-12 bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-800/30 group-hover:scale-110 transition-transform"><MapPin size={24}/></div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-slate-500/30 group">
          <div>
            <span className="text-[11px] font-black text-slate-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Inativos</span>
            <p className="text-2xl font-black text-slate-100">{users.filter(u => !u.active).length}</p>
          </div>
          <div className="h-12 w-12 bg-slate-800/40 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-700/30 group-hover:scale-110 transition-transform"><Briefcase size={24}/></div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-all hover:border-orange-500/30 group">
          <div>
            <span className="text-[11px] font-black text-orange-400/80 uppercase tracking-[0.2em] block mb-1.5 opacity-70">Termos Pend.</span>
            <p className="text-2xl font-black text-slate-100">{users.filter(u => (u.terms || []).some(t => !t.fileUrl && !t.hasFile)).length}</p>
          </div>
          <div className="h-12 w-12 bg-orange-900/20 rounded-2xl flex items-center justify-center text-orange-400 border border-orange-800/30 group-hover:scale-110 transition-transform"><AlertTriangle size={24}/></div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-800 overflow-x-auto bg-slate-900 px-4 pt-2 rounded-t-xl transition-colors">
        {(['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const).map(mode => (
          <button 
            key={mode} 
            onClick={() => {
              setViewMode(mode);
              setShowPendingOnly(false);
            }} 
            className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${(!showPendingOnly && viewMode === mode) ? 'border-emerald-600 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            {mode === 'ACTIVE' ? 'Ativos' : mode === 'INACTIVE' ? 'Inativos' : 'Afastados'}
            <span className="ml-2 bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px]">
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
          onClick={() => setShowPendingOnly(true)} 
          className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${showPendingOnly ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-500 hover:text-orange-400'}`}
        >
          Termos Pendentes
          <span className="ml-2 bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded-full text-[11px]">
            {users.filter(u => (u.terms || []).some(t => !t.fileUrl && !t.hasFile)).length}
          </span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3" size={20} />
        <input 
          type="text" 
          placeholder="Pesquisar por Nome, CPF, E-mail, RG ou PIS..." 
          className="pl-12 w-full border-none rounded-xl py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-200 bg-slate-900 transition-colors" 
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

      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl ring-1 ring-white/5">
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
            const hasPending = (u.terms || []).some(t => !t.fileUrl && !t.hasFile);

            return (
              <tr 
                key={u.id} 
                onClick={() => handleOpenModal(u, true)} 
                className={`border-b border-slate-800/50 border-l-4 border-l-transparent transition-all cursor-pointer hover:bg-slate-800/60 hover:border-l-emerald-500 bg-slate-900 ${!u.active ? 'opacity-60' : ''} ${selectedIds.includes(u.id) ? 'bg-emerald-900/20 border-l-emerald-500' : ''}`}
              >
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox"
                    className="rounded border-slate-700 bg-slate-800 focus:ring-emerald-500"
                    checked={selectedIds.includes(u.id)}
                    onChange={(e) => { e.stopPropagation(); handleSelectOne(u.id); }}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {(() => {
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
                      <div className="font-semibold text-slate-100 text-[13px]">{u.fullName}</div>
                      <div className="flex gap-1 mt-0.5">
                        {u.status === UserStatus.ON_LEAVE && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-blue-900/30 text-blue-400">
                            Afastado
                          </span>
                        )}
                        {hasPending && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-amber-900/30 text-amber-400">
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
                    <span className="text-[11px] font-bold bg-slate-800 px-2.5 py-1 rounded-full">
                      {sector?.name || 'Não Informado'}
                    </span>
                  </td>
                )}
                {visibleColumns.includes('assetsCount') && (
                  <td className="px-6 py-4 text-center truncate">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${u.assetsCount > 0 ? ' bg-blue-900/30 text-blue-400' : ' bg-slate-800 text-slate-400'}`}>
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
                      className={`p-1.5 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => !isReadOnly && handleToggleClick(u)} 
                      disabled={isReadOnly} 
                      className={`p-1.5 rounded-lg transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : (u.active ? ' hover:bg-orange-900/30' : ' hover:bg-emerald-900/30')}`} 
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
        <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Exibir:</span>
              <select 
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
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
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className={`p-2 rounded-lg transition-all ${currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : ' text-emerald-400 hover:bg-emerald-900/30'}`}><ChevronLeft size={18}/></button>
              <div className="flex items-center gap-1"><span className="text-xs font-black text-emerald-300 bg-emerald-900/40 px-3 py-1.5 rounded-lg">{currentPage}</span><span className="text-xs font-bold uppercase mx-1">de</span><span className="text-xs font-black text-slate-300">{totalPages}</span></div>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className={`p-2 rounded-lg transition-all ${currentPage === totalPages ? 'text-slate-300 cursor-not-allowed' : ' text-emerald-400 hover:bg-emerald-900/30'}`}><ChevronRight size={18}/></button>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up border border-slate-800 transition-colors">
            <div className="bg-black px-8 py-5 flex justify-between items-center shrink-0 border-b border-white/10">
              <h3 className="text-lg font-bold text-white uppercase tracking-tight">{editingId ? (isViewOnly ? 'Detalhes do Colaborador' : 'Editar Colaborador') : 'Novo Colaborador'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="h-10 w-10 flex items-center justify-center bg-white/5 hover:text-white rounded-full hover:bg-white/10 transition-all"><X size={20}/></button>
            </div>

            <div className="flex bg-slate-950 border-b border-slate-800 overflow-x-auto shrink-0 px-4 pt-2">
              <button type="button" onClick={() => setActiveTab('DATA')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${activeTab === 'DATA' ? 'border-emerald-600 text-emerald-400 bg-slate-900 ' : 'border-transparent hover:text-slate-300'}`}>Dados Cadastrais</button>
              <button type="button" onClick={() => setActiveTab('ASSETS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'ASSETS' ? 'border-emerald-600 text-emerald-400 bg-slate-900 ' : 'border-transparent hover:text-slate-300'}`}>Ativos em Posse <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{(userDevices.length + userSims.length)}</span></button>
              <button type="button" onClick={() => setActiveTab('LICENSES')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'LICENSES' ? 'border-emerald-600 text-emerald-400 bg-slate-900 ' : 'border-transparent hover:text-slate-300'}`}>Licenças e Contas <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{userAccounts.length}</span></button>
              <button type="button" onClick={() => setActiveTab('TERMS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'TERMS' ? 'border-emerald-600 text-emerald-400 bg-slate-900 ' : 'border-transparent hover:text-slate-300'}`}>Termos Gerados <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{currentUserTerms.length}</span></button>
              <button type="button" onClick={() => setActiveTab('LOGS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-400 bg-slate-900 ' : 'border-transparent hover:text-slate-300'}`}>Histórico</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-900 transition-colors">
              {activeTab === 'DATA' && (
                <form id="userForm" onSubmit={handleSubmit} className="space-y-6">
                  {isViewOnly && (
                    <div className="md:col-span-2 bg-emerald-900/20 p-4 rounded-xl border border-emerald-900/40 flex items-center gap-3 mb-4">
                      <Info className="text-emerald-400" size={20} />
                      <p className="text-xs font-bold text-emerald-200">Modo de visualização. Clique no botão "Habilitar Edição" abaixo para realizar alterações.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">Nome Completo</label>
                      <input disabled={isViewOnly} required className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-800/50 text-slate-100" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">CPF</label>
                      <input disabled={isViewOnly} required className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-mono bg-slate-800/50 text-slate-100" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">RG</label>
                      <input disabled={isViewOnly} required className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-mono bg-slate-800/50 text-slate-100" value={formData.rg || ''} onChange={e => setFormData({...formData, rg: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">PIS / PASEP</label>
                      <input disabled={isViewOnly} className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-mono bg-slate-800/50 text-slate-100" value={formData.pis || ''} onChange={e => setFormData({...formData, pis: e.target.value})} placeholder="Somente números" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">E-mail Corporativo</label>
                      <input disabled={isViewOnly} required type="email" className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none bg-slate-800/50 text-slate-100" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value?.trim() || ''})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">Cargo / Setor Atual</label>
                      <select disabled={isViewOnly} required className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-800/50 text-slate-100" value={formData.sectorId || ''} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                        <option value="">Selecione um cargo...</option>
                        {[...sectors].sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500/80">Status do Colaborador</label>
                      <select disabled={isViewOnly} required className="w-full border-2 border-slate-800 rounded-xl p-3 focus:border-emerald-500 outline-none font-bold bg-slate-800/50 text-slate-100" value={formData.status || UserStatus.ACTIVE} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                        <option value={UserStatus.ACTIVE}>Ativo</option>
                        <option value={UserStatus.ON_LEAVE}>Afastado (INSS/Licença)</option>
                      </select>
                    </div>
                  </div>
                </form>
              )}
              {activeTab === 'ASSETS' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500/80 mb-4 flex items-center gap-2"><Smartphone size={14} className="text-emerald-500" /> Dispositivos e Periféricos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userDevices.map(d => {
                        const m = models.find(mod => mod.id === d.modelId);
                        const isSharedResponsible = d.additionalUserIds?.includes(editingId || '');
                        return (
                          <div 
                            key={d.id} 
                            onClick={() => { setIsModalOpen(false); navigate(`/devices?id=${d.id}`); }}
                            className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center gap-4 group hover:border-emerald-500/50 transition-all cursor-pointer"
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
                                <div className="text-[11px] font-bold text-slate-100 uppercase tracking-tight truncate">{m?.name || 'Aparelho'}</div>
                                {isSharedResponsible && <span className="text-[11px] font-bold bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30 uppercase">Compartilhado</span>}
                              </div>
                              <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2">TAG: {d.assetTag || 'N/A'} <span className="h-1 w-1 bg-slate-700 rounded-full"/> S/N: {d.serialNumber || 'N/A'}</div>
                              <div className="text-[11px] font-mono text-emerald-400 mt-1">{d.imei ? `IMEI: ${d.imei}` : ''}</div>
                            </div>
                          </div>
                        );
                      })}
                      {userDevices.length === 0 && <div className="md:col-span-2 text-center py-8 border-2 border-dashed border-slate-800 rounded-xl"><Smartphone className="mx-auto text-slate-700 mb-2" size={32}/><p className="text-xs font-bold text-slate-500 uppercase">Nenhum dispositivo em posse</p></div>}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Briefcase size={14} className="text-blue-500" /> Linhas Móveis (Chips)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userSims.map(sim => (
                        <div 
                          key={sim.id} 
                          onClick={() => { setIsModalOpen(false); navigate(`/devices?id=${sim.id}`); }}
                          className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center gap-4 group hover:border-blue-500/50 transition-all cursor-pointer"
                        >
                          <div className="h-12 w-12 rounded-lg bg-blue-950/20 flex items-center justify-center border border-blue-900/30 shrink-0">
                            <Phone className="text-blue-500" size={24}/>
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-100 uppercase tracking-tighter truncate">{sim.phoneNumber}</div>
                            <div className="text-[11px] font-bold text-slate-500 uppercase">{sim.assetTag ? `Sim Card: ${sim.assetTag}` : 'Sim Card S/N'}</div>
                            <div className="mt-1"><span className="text-[11px] font-black bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded uppercase tracking-wider">Ativa</span></div>
                          </div>
                        </div>
                      ))}
                      {userSims.length === 0 && <div className="md:col-span-2 text-center py-8 border-2 border-dashed border-slate-800 rounded-xl"><Phone className="mx-auto text-slate-700 mb-2" size={32}/><p className="text-xs font-bold text-slate-500 uppercase">Nenhuma linha associada</p></div>}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'LICENSES' && (
                <div className="space-y-4">
                   <div className="grid grid-cols-1 gap-3">
                    {userAccounts.map(acc => (
                      <div key={acc.id} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-emerald-500/40 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-700">
                            <Mail className="text-emerald-400" size={24} />
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-100 uppercase tracking-widest">{acc.name}</div>
                            <div className="text-xs font-bold text-slate-400 truncate max-w-[250px] mb-1">{acc.login}</div>
                            {acc.password && (
                              <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <Key size={12} className="text-slate-500"/>
                                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-300">
                                  {visiblePasswords[acc.id] ? acc.password : '••••••••'}
                                </span>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setVisiblePasswords(prev => ({ ...prev, [acc.id]: !prev[acc.id] })); }}
                                  className="text-slate-500 hover:text-emerald-400 p-0.5 ml-1 transition-colors"
                                  title={visiblePasswords[acc.id] ? "Ocultar Senha" : "Mostrar Senha"}
                                >
                                  {visiblePasswords[acc.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(acc.password || '');
                                    showToast('Senha copiada', 'success');
                                  }}
                                  className="text-slate-500 hover:text-blue-400 p-0.5 transition-colors"
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
                              <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Status da Conta</div>
                              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-900/30 text-emerald-400">Ativa</span>
                           </div>
                           <button 
                             onClick={() => { setIsModalOpen(false); navigate(`/accounts?id=${acc.id}`); }}
                             className="p-2 bg-slate-900 text-slate-400 rounded-lg hover:text-white transition-colors border border-slate-800"
                           >
                             <ExternalLink size={16} />
                           </button>
                        </div>
                      </div>
                    ))}
                    {userAccounts.length === 0 && (
                      <div className="text-center py-16 bg-slate-950/50 rounded-3xl border-2 border-dashed border-slate-800">
                        <Mail className="mx-auto text-slate-800 mb-4" size={48} />
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhuma conta Microsoft/Google</h4>
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
                      <div key={term.id} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-emerald-500/40 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-700">
                            {term.type === 'ENTREGA' ? <FileSignature className="text-emerald-400" size={24} /> : <RefreshCw className="text-blue-400" size={24} />}
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-100 uppercase tracking-widest">{term.type === 'ENTREGA' ? 'Termo de Entrega' : 'Termo de Devolução'}</div>
                            <div className="text-[11px] font-bold text-slate-500 uppercase flex flex-col gap-0.5 mt-1">
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-500/80">EMITIDO EM: {new Date(term.date).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium">
                                {term.assetDetails || '---'}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                              term.isManual 
                                ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30' 
                                : (term.fileUrl || term.hasFile) 
                                  ? 'bg-emerald-900 text-emerald-400' 
                                  : 'bg-orange-900 text-orange-400'
                            }`} title={term.isManual ? `Resolvido Manualmente: ${term.resolutionReason || 'Sem motivo'}` : ''}>
                              {term.isManual ? 'Manual' : (term.fileUrl || term.hasFile ? 'Assinado' : 'Pendente')}
                            </span>
                            {term.isManual && (
                              <div className="text-[9px] font-bold text-orange-500/70 mt-0.5 uppercase tracking-tighter">Resolução Manual</div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button 
                              type="button"
                              onClick={() => {
                                setEditingTerm(term); 
                                setTermEditData({
                                  status: (term.fileUrl || term.hasFile ? 'SIGNED' : 'PENDING'), 
                                  notes: term.notes || '', 
                                  evidenceFiles: term.evidenceFiles || []
                                });
                              }} 
                              disabled={!!(term.fileUrl || term.hasFile)}
                              className={`p-2 bg-slate-900 rounded-lg transition-all border border-slate-800 ${term.fileUrl || term.hasFile ? 'opacity-30 cursor-not-allowed text-slate-500' : 'text-blue-400 hover:bg-blue-900/20'}`}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownloadTerm(term); }}
                              className="p-2 bg-slate-900 text-slate-400 rounded-lg hover:text-white transition-all border border-slate-800"
                              title={term.fileUrl || term.hasFile ? 'Baixar Assinado' : 'Gerar Termo'}
                            >
                              <Download size={16} />
                            </button>
                             
                            {!(term.fileUrl || term.hasFile) ? (
                              <div className="flex gap-2">
                                {!(term.isManual) && (
                                  <button 
                                    type="button"
                                    onClick={() => setResolvingManualTerm(term)}
                                    className="p-2 bg-slate-900 text-orange-400 rounded-lg hover:bg-orange-900/20 transition-all border border-slate-800"
                                    title="Resolução Manual"
                                  >
                                    <CheckSquare size={16} />
                                  </button>
                                )}
                                <label className="p-2 bg-slate-900 text-emerald-400 rounded-lg hover:bg-emerald-900/20 transition-all border border-slate-800 cursor-pointer" title="Upload Assinado">
                                  <Upload size={16} />
                                  <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => handleUploadTermFile(term.id, e)} />
                                </label>
                              </div>
                            ) : (
                              <button 
                                type="button"
                                onClick={() => handleDeleteTermFile(term.id)}
                                className="p-2 bg-slate-900 text-red-400 rounded-lg hover:bg-red-900/20 transition-all border border-slate-800"
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
                      <div className="text-center py-16 bg-slate-950/50 rounded-3xl border-2 border-dashed border-slate-800">
                        <FileText className="mx-auto text-slate-800 mb-4" size={48} />
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum termo gerado</h4>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'LOGS' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-800/20 p-4 rounded-xl border border-slate-800">
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
                          <span className="text-[11px] font-black uppercase text-slate-500 tracking-widest">Total de Eventos: {userLogs.length}</span>
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
                          <div className="text-center py-16 bg-slate-950/50 rounded-3xl border-2 border-dashed border-slate-800">
                            <History className="mx-auto text-slate-800 mb-4" size={48} />
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhuma atividade registrada</h4>
                          </div>
                        );
                      }

                      return userLogs.map(log => {
                        const statusClass = log.action.includes('ENTREGA') ? 'bg-emerald-950 text-emerald-400' :
                                           log.action.includes('DEVOLUCAO') ? 'bg-blue-950 text-blue-400' :
                                           'bg-slate-800 text-slate-400';
                        return (
                          <div key={log.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-2 group hover:border-slate-700 transition-all">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <span className={ "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter " + statusClass }>
                                  {log.action}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">{new Date(log.timestamp).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <span className="text-[10px] font-black text-slate-600 uppercase">AUDIT#{log.id.slice(0,5).toUpperCase()}</span>
                            </div>
                            <div className="text-xs font-bold text-slate-300">{log.notes || 'Sem observações registradas.'}</div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
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

            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center shrink-0 border-t border-white/5">
              <div className="flex gap-3">
                {!isViewOnly && (
                  <button type="button" onClick={() => setIsViewOnly(true)} className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-black text-[11px] uppercase tracking-widest hover:bg-slate-750 transition-all">Cancelar Edição</button>
                )}
                {isViewOnly && (
                  <button type="button" onClick={() => setIsViewOnly(false)} className="px-6 py-3 rounded-xl bg-slate-800 text-emerald-400 font-black text-[11px] uppercase tracking-widest hover:bg-emerald-900/20 transition-all border border-emerald-900/30">Habilitar Edição</button>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-black text-[11px] uppercase tracking-widest hover:bg-slate-750 transition-all">Fechar</button>
                {!isViewOnly && (
                  <button type="submit" form="userForm" className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"><Save size={16}/> Salvar Alterações</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingTerm && (
        <div className="fixed inset-0 bg-slate-950/90 z-[200] flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-slate-900 rounded-3xl w-full max-w-2xl border border-slate-800 animate-scale-up shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Gerenciar Termo</h3>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">ID: {editingTerm.id.toUpperCase()}</p>
              </div>
              <button onClick={() => setEditingTerm(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X size={20}/></button>
            </div>

            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setTermEditData({...termEditData, status: 'PENDING'})} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${termEditData.status === 'PENDING' ? 'border-orange-500 bg-orange-900/20 text-orange-400' : 'border-slate-800 hover:border-slate-700'}`}><Clock size={20}/><span className="text-[11px] font-black uppercase tracking-widest">Pendente</span></button>
                <button onClick={() => setTermEditData({...termEditData, status: 'SIGNED'})} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${termEditData.status === 'SIGNED' ? 'border-emerald-500 bg-emerald-900/20 text-emerald-400' : 'border-slate-800 hover:border-slate-700'}`}><CheckCircle2 size={20}/><span className="text-[11px] font-black uppercase tracking-widest">Assinado</span></button>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2">Observações Detalhadas</label>
                <textarea className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 outline-none focus:border-emerald-500 min-h-[100px] text-sm" value={termEditData.notes} onChange={e => setTermEditData({...termEditData, notes: e.target.value})} placeholder="Adicione notas sobre o estado dos itens ou observações do colaborador..."/>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2">Evidências (Fotos / B.O.) - Máx 3</label>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {termEditData.evidenceFiles.map((file, index) => (
                    <div key={index} className="relative rounded-xl overflow-hidden border-2 border-slate-700 group h-32">
                      <img src={file} alt={`Evidência ${index + 1}`} className="w-full h-full object-cover"/>
                      <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => handleRemoveEvidence(index)} className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform" title="Remover Imagem">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {termEditData.evidenceFiles.length < 3 && (
                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors">
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

            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex gap-3 justify-end">
              <button onClick={() => setEditingTerm(null)} className="px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={handleSaveTermEdit} className="px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest text-white transition-all">Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {isReasonModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden border border-blue-900/40">
            <div className="p-8">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="h-16 w-16 bg-blue-900/30 rounded-full flex items-center justify-center mb-4 shadow-inner border border-blue-800">
                  <Save size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-100 uppercase tracking-tight">Confirmar Alterações?</h3>
                <p className="text-xs mt-2">Informe o motivo da alteração para auditoria:</p>
              </div>
              <textarea 
                className="w-full border-2 border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-blue-100 focus:ring-blue-900/20 outline-none mb-6 transition-all bg-slate-800 text-slate-100"
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
          <div className="bg-slate-900 rounded-2xl p-8 w-full max-w-md border border-slate-800 shadow-2xl">
            <h3 className="text-xl font-black text-slate-100 mb-4 uppercase tracking-tight">Resolução Manual de Termo</h3>
            <p className="text-sm text-slate-400 mb-6 font-medium leading-relaxed">
              Deseja resolver este termo manualmente para <span className="text-slate-100 font-bold">{users.find(u => u.id === editingId)?.fullName}</span>? 
              Isso marcará a pendência como resolvida sem anexo.
            </p>
            <div className="mb-6">
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Motivo/Justificativa</label>
              <textarea
                rows={4}
                className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                placeholder="Ex: Assinatura física coletada em via única, Contingência de sistema, etc..."
                value={resolveManualReason}
                onChange={(e) => setResolveManualReason(e.target.value)}
              ></textarea>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setResolvingManualTerm(null); setResolveManualReason(''); }}
                className="flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800 transition-all"
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
    </div>
  );
};

export default UserManager;
