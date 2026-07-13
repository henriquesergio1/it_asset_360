import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Smartphone, Users, AlertTriangle, FileWarning, ArrowRight, Lock, 
  ChevronDown, ChevronUp, DollarSign, Wrench, AlertCircle, FileText, 
  Info, Clock, X, ClipboardList, ChevronRight, Package, TrendingUp, 
  Activity, CheckCircle2, LayoutDashboard, FileSignature, Edit2, Trash2, Printer,
  Eye, Download, Share2, Camera, CheckSquare, Upload, Copy, RefreshCw, Check,
  Briefcase, Phone, Mail, Key, EyeOff, ExternalLink, History, User as UserIcon
} from 'lucide-react';
import { DeviceStatus, AccountType, Task, TaskStatus } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { UI_LABEL_SMALL, UI_ICON_SIZE_SMALL, UI_BUTTON_PRIMARY, UI_BUTTON_SECONDARY, UI_BUTTON_SUCCESS, UI_BUTTON_DANGER } from '../constants';
import { TaskDashboardWidget } from './TaskDashboardWidget';
import { TaskDetailModal } from './TaskDetailModal';
import { useToast } from '../contexts/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { generateAndPrintTerm } from '../utils/termGenerator';
import FilePreviewModal from './FilePreviewModal';

const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick, trend, children }: any) => (
  <div 
    className={`bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-between hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-500 group relative overflow-hidden ${onClick ? 'cursor-pointer hover:border-blue-500/50' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between mb-4 z-10">
      <div className={`p-3 rounded-xl ${color} bg-opacity-20 text-slate-900 dark:text-white shadow-lg group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-1 rounded-full">
          <TrendingUp size={12} />
          {trend}
        </div>
      )}
    </div>
    <div className="z-10">
      <p className="text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-slate-400/80">{title}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</h3>
      </div>
      {subtitle && <p className="text-[11px] mt-2 text-slate-600 dark:text-slate-400 font-medium italic">{subtitle}</p>}
    </div>
    
    {children && (
      <div className="absolute inset-0 bg-white dark:bg-slate-800/95 backdrop-blur-md p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-in-out z-20 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Icon className={`w-4 h-4 ${color.replace('bg-', 'text-')}`} />
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">{title} Detalhes</h4>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {children}
        </div>
      </div>
    )}
    
    {/* Background glow effect */}
    <div className={`absolute -bottom-10 -right-10 w-32 h-32 ${color.replace('bg-', 'bg-').replace('-600', '-600/10')} rounded-full blur-2xl transition-all duration-500 group-hover:scale-150 opacity-0 group-hover:opacity-100`}></div>
  </div>
);

const Dashboard = () => {
  const { 
    devices, users, accounts, sectors, maintenances, models, brands, assetTypes,
    refreshData, resolveTermManual, expedienteAlerts, fetchExpedienteAlerts, saveExpedienteOverride, 
    tasks, updateTask, systemUsers, consumables,
    sims, getTermFile, getTermEvidences, updateTermFile, deleteTermFile, updateTermDetails, generateSignatureToken, settings, fetchData, isReadOnly, logs
  } = useData();
  const { isAdmin, user: authUser } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [isTermsExpanded, setIsTermsExpanded] = useState(true);
  const [isValidationExpanded, setIsValidationExpanded] = useState(true);
  const [isExpedienteExpanded, setIsExpedienteExpanded] = useState(true);
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);
  const [isConsumablesExpanded, setIsConsumablesExpanded] = useState(true);
  const [resolvingTerm, setResolvingTerm] = useState<{termId: string, userName: string} | null>(null);
  const [resolveReason, setResolveReason] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingExpediente, setEditingExpediente] = useState<{codigo: string, nome: string, observation: string, reactivationDate: string} | null>(null);
  const navigate = useNavigate();

  // Estados para o Modal de Detalhes do Colaborador no Dashboard
  const [selectedUserForModal, setSelectedUserForModal] = useState<any | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'DATA' | 'ASSETS' | 'LICENSES' | 'TERMS' | 'LOGS'>('TERMS');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ url: string | string[]; name: string }>({ url: '', name: '' });
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [generatedSignatureLink, setGeneratedSignatureLink] = useState('');
  const [resolvingManualTerm, setResolvingManualTerm] = useState<any | null>(null);
  const [resolveManualReason, setResolveManualReason] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const [printersData, setPrintersData] = useState<Record<string, any>>({});
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  const printers = useMemo(() => {
    return (devices || []).filter(d => d.zabbixHostId && d.zabbixHostId.trim() !== '');
  }, [devices]);

  const fetchPrintersZabbixData = async () => {
    const validHostIds = printers.map(p => p.zabbixHostId).filter(Boolean);
    if (validHostIds.length === 0) return;
    try {
      setLoadingPrinters(true);
      const res = await fetch('/api/zabbix/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "item.get",
          params: {
            output: ["name", "key_", "lastvalue", "units", "hostid"],
            hostids: validHostIds,
          },
          id: 1
        })
      });
      if (!res.ok) throw new Error("Erro de comunicação");
      const json = await res.json();
      if (json.result) {
        const grouped: Record<string, any[]> = {};
        json.result.forEach((item: any) => {
          if (!grouped[item.hostid]) {
            grouped[item.hostid] = [];
          }
          grouped[item.hostid].push(item);
        });
        setPrintersData(grouped);
      }
    } catch (err) {
      console.error("Erro ao buscar dados das impressoras no Zabbix:", err);
    } finally {
      setLoadingPrinters(false);
    }
  };

  useEffect(() => {
    if (printers.length > 0) {
      fetchPrintersZabbixData();
    }
  }, [devices]);

  useEffect(() => {
    fetchExpedienteAlerts();
  }, []);

  const handleDownloadTerm = async (term: any) => {
    let url = term.fileUrl || (term as any).filebinary;
    
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
          const extension = contentType.includes('pdf') ? 'pdf' : (contentType.includes('png') ? 'png' : 'jpg');
          link.download = `termo_${term.type.toLowerCase()}_${selectedUserForModal?.id || 'document'}.${extension}`;
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
          const isImg = url.toLowerCase().match(/\.(jpg|jpeg|png)$/);
          const extension = isImg ? isImg[1] : 'pdf';
          link.download = `termo_${term.type.toLowerCase()}_${selectedUserForModal?.id || 'document'}.${extension}`;
          link.click();
        }
      } catch (err) {
        console.error("Erro ao processar download:", err);
        window.open(url, '_blank');
      }
    } else if (term.hasFile) {
      showToast("O arquivo assinado ainda não foi sincronizado com o servidor ou está em processamento.", "info");
    } else {
      const user = selectedUserForModal || users.find(u => u.id === term.userId);
      if (!user) return;

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
        notes: term.notes,
        condition: term.condition,
        damageDescription: term.damageDescription,
        evidenceFiles: evidenceFiles,
        digitalSignature,
        docPhoto,
        selfiePhoto,
        signatureInfo
      });
    }
  };

  const handleViewTerm = async (term: any) => {
    let url = term.fileUrl || (term as any).filebinary;
    
    if (!url && term.hasFile) {
      try {
        url = await getTermFile(term.id);
      } catch (err) {
        console.error("Erro ao buscar arquivo do termo:", err);
      }
    }
    
    if (url && url !== '#') {
      setPreviewData({ 
        url, 
        name: `termo_${term.type.toLowerCase()}_${selectedUserForModal?.id || 'document'}.${(url.includes('pdf') || url.includes('application/pdf')) ? 'pdf' : 'jpg'}` 
      });
      setIsPreviewOpen(true);
    }
  };

  const handleUploadTermFile = (termId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedUserForModal) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileUrl = event.target?.result as string;
        updateTermFile(termId, selectedUserForModal.id, fileUrl, authUser?.name || 'Admin');
        showToast('Termo assinado enviado com sucesso', 'success');
        setTimeout(() => {
          const updatedUser = users.find(u => u.id === selectedUserForModal.id);
          if (updatedUser) {
            setSelectedUserForModal(updatedUser);
          }
        }, 500);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteTermFile = (termId: string) => {
    if (selectedUserForModal && window.confirm('Deseja realmente remover o arquivo deste termo? Esta ação permitirá o reenvio.')) {
      deleteTermFile(termId, selectedUserForModal.id, 'Remoção de arquivo do termo para reenvio', authUser?.name || 'Admin');
      setTimeout(() => {
        const updatedUser = users.find(u => u.id === selectedUserForModal.id);
        if (updatedUser) {
          setSelectedUserForModal(updatedUser);
        }
      }, 500);
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
    } catch (err: any) {
      console.error("Erro ao gerar link:", err);
      showToast(`Erro ao gerar link: ${err.message}`, 'error');
    }
  };

  const handleConfirmResolveManual = async () => {
    if (!resolvingManualTerm || !resolveManualReason.trim()) return;
    await resolveTermManual(resolvingManualTerm.id, resolveManualReason, authUser?.name || 'Admin');
    setResolvingManualTerm(null);
    setResolveManualReason('');
    showToast('Termo resolvido manualmente com sucesso', 'success');
    setTimeout(() => {
      if (selectedUserForModal) {
        const updatedUser = users.find(u => u.id === selectedUserForModal.id);
        if (updatedUser) {
          setSelectedUserForModal(updatedUser);
        }
      }
    }, 500);
  };

  const handleApproveSignature = async (termId: string) => {
    if(!window.confirm('Deseja aprovar esta assinatura digital?')) return;
    try {
      const res = await fetch(`/api/terms/${termId}/approve-signature`, { method: 'POST' });
      if(res.ok) {
        showToast('Assinatura aprovada com sucesso', 'success');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        setTimeout(() => {
          fetchData(true);
          if (selectedUserForModal) {
            const updatedUser = users.find(u => u.id === selectedUserForModal.id);
            if (updatedUser) {
              setSelectedUserForModal(updatedUser);
            }
          }
        }, 500);
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
        setTimeout(() => {
          fetchData(true);
          if (selectedUserForModal) {
            const updatedUser = users.find(u => u.id === selectedUserForModal.id);
            if (updatedUser) {
              setSelectedUserForModal(updatedUser);
            }
          }
        }, 500);
      }
    } catch(err) { console.error(err); }
  };

  const renderSignatureStatus = (term: any) => {
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

  const [editingTerm, setEditingTerm] = useState<any | null>(null);
  const [termEditData, setTermEditData] = useState<any | null>(null);

  const handleEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && termEditData) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileUrl = event.target?.result as string;
        setTermEditData((prev: any) => ({
          ...prev,
          evidenceFiles: [...(prev.evidenceFiles || []), fileUrl].slice(0, 3)
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setTermEditData((prev: any) => ({
      ...prev,
      evidenceFiles: (prev.evidenceFiles || []).filter((_: any, i: number) => i !== index)
    }));
  };

  const handleSaveTermEdit = async () => {
    if (editingTerm && termEditData) {
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
      showToast('Detalhes do termo salvos com sucesso', 'success');
      setTimeout(() => {
        if (selectedUserForModal) {
          const updatedUser = users.find(u => u.id === selectedUserForModal.id);
          if (updatedUser) {
            setSelectedUserForModal(updatedUser);
          }
        }
      }, 500);
    }
  };

  const availableDevices = devices.filter(d => d.status === DeviceStatus.AVAILABLE).length;
  const inUseDevices = devices.filter(d => d.status === DeviceStatus.IN_USE).length;
  const maintenanceDevices = devices.filter(d => d.status === DeviceStatus.MAINTENANCE).length;

  // Filtra termos pendentes
  const pendingTerms = useMemo(() => {
    return users.flatMap(u => 
      (u.terms || []).filter(t => !t.fileUrl && !t.hasFile && t.signatureStatus !== 'APPROVED').map(t => ({
        term: t,
        user: u
      }))
    ).sort((a, b) => new Date(b.term.date).getTime() - new Date(a.term.date).getTime());
  }, [users]);

  // Filtra assinaturas aguardando validação
  const pendingApprovalSignatures = useMemo(() => {
    return users.flatMap(u => 
      (u.terms || []).filter(t => t.signatureStatus === 'WAITING_APPROVAL').map(t => ({
        term: t,
        user: u
      }))
    ).sort((a, b) => new Date(b.term.signatureDate || 0).getTime() - new Date(a.term.signatureDate || 0).getTime());
  }, [users]);

  // Alertas de Consumíveis
  const consumableAlerts = useMemo(() => {
    if (!consumables) return [];
    return consumables.filter(c => c.currentStock <= c.minStock).map(c => ({
      ...c,
      isCritical: c.currentStock === 0
    })).sort((a, b) => (a.currentStock / a.minStock) - (b.currentStock / b.minStock));
  }, [consumables]);

  // Filtra alertas de expediente
  const filteredExpedienteAlerts = useMemo(() => {
    return expedienteAlerts.filter(alert => {
      const localUser = users.find(u => u.cpf?.replace(/\D/g, '') === alert.cpf?.replace(/\D/g, ''));
      return localUser && localUser.active;
    }).sort((a, b) => {
      const now = new Date();
      const aHasActiveOverride = a.reactivationDate && new Date(a.reactivationDate) > now;
      const bHasActiveOverride = b.reactivationDate && new Date(b.reactivationDate) > now;
      if (aHasActiveOverride && !bHasActiveOverride) return 1;
      if (!aHasActiveOverride && bHasActiveOverride) return -1;
      return a.nome.localeCompare(b.nome);
    });
  }, [expedienteAlerts, users]);

  // Agrupamento de Dispositivos por Tipo
  const devicesByType = useMemo(() => {
    const summary: Record<string, { total: number, available: number, inUse: number }> = {};
    devices.forEach(d => {
      const model = models.find(m => m.id === d.modelId);
      const type = assetTypes.find(t => t.id === model?.typeId);
      const typeName = type?.name || 'Outros';
      
      if (!summary[typeName]) {
        summary[typeName] = { total: 0, available: 0, inUse: 0 };
      }
      summary[typeName].total++;
      if (d.status === DeviceStatus.AVAILABLE) summary[typeName].available++;
      if (d.status === DeviceStatus.IN_USE) summary[typeName].inUse++;
    });
    return Object.entries(summary).sort((a, b) => b[1].total - a[1].total);
  }, [devices, models, assetTypes]);

  // Agrupamento de Colaboradores por Setor
  const usersBySector = useMemo(() => {
    const summary: Record<string, number> = {};
    users.filter(u => u.active).forEach(u => {
      const sector = sectors.find(s => s.id === u.sectorId);
      const sectorName = sector?.name || 'Sem Setor';
      summary[sectorName] = (summary[sectorName] || 0) + 1;
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [users, sectors]);

  // Agrupamento de Licenças por Tipo
  const accountsByType = useMemo(() => {
    const summary: Record<string, number> = {};
    accounts.filter(a => a.status === 'Ativo').forEach(a => {
      summary[a.type] = (summary[a.type] || 0) + 1;
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [accounts]);

  const handleResolveManual = async () => {
    if (!resolvingTerm || !resolveReason.trim()) return;
    await resolveTermManual(resolvingTerm.termId, resolveReason, authUser?.name || 'Admin');
    setResolvingTerm(null);
    setResolveReason('');
  };

  const userDevices = selectedUserForModal 
    ? devices.filter(d => d.currentUserId === selectedUserForModal.id || (d.additionalUserIds || []).includes(selectedUserForModal.id))
    : [];

  const userSims = selectedUserForModal
    ? sims.filter(s => s.currentUserId === selectedUserForModal.id)
    : [];

  const userAccounts = selectedUserForModal
    ? accounts.filter(acc => acc.userIds?.includes(selectedUserForModal.id))
    : [];

  const currentUserTerms = selectedUserForModal
    ? (selectedUserForModal.terms || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy: ', err);
      return false;
    }
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <LayoutDashboard className="text-blue-500" size={28} />
            Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium mt-1">Bem-vindo ao centro de controle do seu inventário de TI.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Sistema Online</span>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Dispositivos"
          value={devices.length}
          icon={Smartphone}
          color="bg-blue-600"
          subtitle={`${availableDevices} disponíveis para entrega`}
          onClick={() => navigate('/devices')}
        >
          <div className="space-y-3">
            {devicesByType.map(([type, stats]) => (
              <div key={type} className="flex flex-col gap-1 border-b border-slate-200 dark:border-slate-700/50 pb-2 last:border-0">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{type}</span>
                  <span className="text-slate-600 dark:text-slate-400">{stats.total} total</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-medium">
                  <span className="text-emerald-600 dark:text-emerald-400">{stats.available} disp.</span>
                  <span className="text-blue-600 dark:text-sky-400">{stats.inUse} em uso</span>
                </div>
              </div>
            ))}
          </div>
        </StatCard>
        
        <StatCard 
          title="Colaboradores"
          value={users.filter(u => u.active).length}
          icon={Users}
          color="bg-emerald-600"
          subtitle={`${users.length} cadastrados no total`}
          onClick={() => navigate('/users')}
        >
          <div className="space-y-2">
            {usersBySector.map(([sector, count]) => (
              <div key={sector} className="flex justify-between items-center text-xs border-b border-slate-200 dark:border-slate-700/50 pb-2 last:border-0">
                <span className="font-bold text-slate-700 dark:text-slate-300 truncate pr-2">{sector}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded">{count}</span>
              </div>
            ))}
          </div>
        </StatCard>

        <StatCard 
          title="Licenças & Contas"
          value={accounts.length}
          icon={Lock}
          color="bg-indigo-600"
          subtitle={`${accounts.filter(a => a.status === 'Ativo').length} contas ativas`}
          onClick={() => navigate('/accounts')}
        >
          <div className="space-y-2">
            {accountsByType.map(([type, count]) => (
              <div key={type} className="flex justify-between items-center text-xs border-b border-slate-200 dark:border-slate-700/50 pb-2 last:border-0">
                <span className="font-bold text-slate-700 dark:text-slate-300">{type}</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black bg-indigo-100 dark:bg-indigo-500/20 px-2 py-0.5 rounded">{count}</span>
              </div>
            ))}
          </div>
        </StatCard>

        <StatCard 
          title="Em Manutenção"
          value={maintenanceDevices}
          icon={Wrench}
          color="bg-amber-500"
          subtitle="Aguardando retorno técnico"
          onClick={() => navigate('/devices?status=Em Manutenção')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Main Content */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Alertas Críticos Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} />
                Alertas do Sistema
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* 1º Alerta de Expediente ERP */}
              {filteredExpedienteAlerts.length > 0 ? (
                <div className="bg-white dark:bg-slate-800 border-l-4 border-l-red-500 dark:border-l-red-500 border-y border-r border-slate-200 dark:border-slate-700 rounded-xl p-4 animate-fade-in shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-900/30 text-red-400 rounded-lg shrink-0">
                      <Clock size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Alertas de Expediente
                          <span className="ml-2 bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase">
                            {filteredExpedienteAlerts.length}
                          </span>
                        </h3>
                        <button 
                          onClick={() => setIsExpedienteExpanded(!isExpedienteExpanded)}
                          className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          {isExpedienteExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                        Colaboradores com expediente <span className="font-bold text-red-400">FALSO</span> no ERP.
                      </p>
                      
                      <div className={`space-y-3 transition-all duration-300 ${isExpedienteExpanded ? 'max-h-[500px] overflow-y-auto pr-2 custom-scrollbar' : 'max-h-[0px] overflow-hidden'}`}>
                        {filteredExpedienteAlerts.map(alert => {
                          const localUser = users.find(u => u.cpf?.replace(/\D/g, '') === alert.cpf?.replace(/\D/g, ''));
                          const now = new Date();
                          const hasActiveOverride = alert.reactivationDate && new Date(alert.reactivationDate) > now;
                          return (
                            <div key={alert.codigo} className={`bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg border flex flex-col gap-2 group transition-all ${hasActiveOverride ? ' border-amber-200 dark:border-amber-500/30 hover:border-amber-700' : ' border-red-900/30 hover:border-red-700'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${hasActiveOverride ? ' bg-amber-900/40 text-amber-600 dark:text-amber-400' : ' bg-red-900/40 text-red-400'}`}>
                                    {alert.nome.charAt(0)}
                                  </div>
                                  <div className="flex-1 flex items-center justify-between min-w-0">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate" title={alert.nome}>{alert.nome}</p>
                                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-widest shrink-0 ${hasActiveOverride ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-red-900/20 text-red-400'}`}>
                                        {hasActiveOverride ? 'Desativado' : 'Expediente Falso'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => setEditingExpediente({
                                          codigo: alert.codigo,
                                          nome: alert.nome,
                                          observation: alert.observation || '',
                                          reactivationDate: alert.reactivationDate ? new Date(alert.reactivationDate).toISOString().split('T')[0] : ''
                                        })}
                                        className="p-1.5 hover:bg-blue-900/40 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400 rounded-lg transition-colors"
                                        title="Adicionar Observação/Reativação"
                                      >
                                        <FileText size={16} />
                                      </button>
                                      {localUser && (
                                        <Link 
                                          to={`/users?userId=${localUser.id}`}
                                          className="p-1.5 hover:bg-blue-900/40 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400 rounded-lg transition-colors"
                                          title="Ver Colaborador Local"
                                        >
                                          <ArrowRight size={16} />
                                        </Link>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium pl-11 w-full">
                                {localUser ? (
                                  <>
                                    <span className="uppercase tracking-tighter truncate shrink-0" style={{maxWidth: '150px'}} title={sectors.find(s => s.id === localUser.sectorId)?.name || 'Sem Setor'}>
                                      {sectors.find(s => s.id === localUser.sectorId)?.name || 'Sem Setor'}
                                    </span>
                                    <span className="text-slate-600 shrink-0">|</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="uppercase tracking-tighter shrink-0">Sem Setor</span>
                                    <span className="text-slate-600 shrink-0">|</span>
                                  </>
                                )}
                                <span className="uppercase tracking-tighter shrink-0">Cód: {alert.codigo}</span>
                                <span className="text-slate-600 shrink-0">|</span>
                                <span className="uppercase tracking-tighter shrink-0">CPF: {alert.cpf}</span>
                              </div>
                              {hasActiveOverride && (
                                <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/20 p-2 rounded border border-amber-900/30 ml-11">
                                  <span className="font-bold">Motivo:</span> {alert.observation} <br/>
                                  <span className="font-bold">Reativação:</span> {new Date(alert.reactivationDate!).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 border-l-4 border-l-emerald-500 dark:border-l-emerald-500 border-y border-r border-slate-200 dark:border-slate-700 rounded-xl p-4 animate-fade-in shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Alertas de Expediente
                        <span className="bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase transition-colors">0</span>
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Nenhum colaborador online no ERP divergente do local.</p>
                    </div>
                  </div>
                  <CheckCircle2 className="text-emerald-500" size={24} />
                </div>
              )}

              {/* 2º Alerta de Consumíveis */}
              {consumableAlerts.length > 0 ? (
                <div className="bg-white dark:bg-slate-800 border-l-4 border-l-amber-500 dark:border-l-amber-500 border-y border-r border-slate-200 dark:border-slate-700 rounded-xl p-4 animate-fade-in shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg shrink-0">
                      <Package size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Estoque Crítico
                          <span className="ml-2 bg-amber-900/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase">
                            {consumableAlerts.length}
                          </span>
                        </h3>
                        <button 
                          onClick={() => setIsConsumablesExpanded(!isConsumablesExpanded)}
                          className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          {isConsumablesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                        Itens que atingiram o estoque mínimo e precisam de reposição.
                      </p>
                      
                      <div className={`space-y-3 transition-all duration-300 ${isConsumablesExpanded ? 'max-h-[500px] overflow-y-auto pr-2 custom-scrollbar' : 'max-h-[0px] overflow-hidden'}`}>
                        {consumableAlerts.map(item => (
                          <div key={item.id} className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg border border-amber-900/30 flex flex-col gap-2 group hover:border-amber-700 transition-all">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${item.currentStock === 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></div>
                                <div className="flex-1 flex items-center justify-between min-w-0">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate" title={item.name}>{item.name}</p>
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-widest shrink-0 ${item.currentStock === 0 ? 'bg-red-900/20 text-red-400' : 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                                      {item.currentStock === 0 ? 'Esgotado' : 'Baixo'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <p className={`text-sm font-black ${item.currentStock === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                                      {item.currentStock} {item.unit}
                                    </p>
                                    <Link to="/consumables" className="p-1.5 hover:bg-blue-900/40 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:text-sky-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Repor Estoque">
                                      <ArrowRight size={16} />
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium pl-5">
                              <span className="uppercase tracking-tighter">Estoque Mínimo: {item.minStock} {item.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 border-l-4 border-l-emerald-500 dark:border-l-emerald-500 border-y border-r border-slate-200 dark:border-slate-700 rounded-xl p-4 animate-fade-in shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                      <Package size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Estoque Crítico
                        <span className="bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase transition-colors">0</span>
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Não há itens apontando baixo estoque.</p>
                    </div>
                  </div>
                  <CheckCircle2 className="text-emerald-500" size={24} />
                </div>
              )}

              {/* 3º Alerta de Termos Pendentes */}
              {pendingTerms.length > 0 && (
                <div className="bg-white dark:bg-slate-800 border-l-4 border-l-orange-500 dark:border-l-amber-500 border-y border-r border-slate-200 dark:border-slate-700 rounded-xl p-4 animate-fade-in shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-900/30 text-orange-400 rounded-lg shrink-0">
                      <FileWarning size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Termos Pendentes
                          <span className="ml-2 bg-orange-900/40 text-orange-400 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase">
                            {pendingTerms.length}
                          </span>
                        </h3>
                        <button 
                          onClick={() => setIsTermsExpanded(!isTermsExpanded)}
                          className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          {isTermsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                        Colaboradores com dispositivos sem termo assinado.
                      </p>
                      
                      <div className={`space-y-3 transition-all duration-300 ${isTermsExpanded ? 'max-h-[500px] overflow-y-auto pr-2 custom-scrollbar' : 'max-h-[220px] overflow-hidden'}`}>
                        {pendingTerms.slice(0, isTermsExpanded ? pendingTerms.length : 5).map(({term, user}) => {
                          const isWaitingApproval = term.signatureStatus === 'WAITING_APPROVAL';
                          return (
                            <div key={term.id} className={`bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg border flex flex-col gap-2 group transition-all ${isWaitingApproval ? 'border-blue-300 dark:border-sky-700/40 bg-blue-900/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-orange-900/30 hover:border-orange-700'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isWaitingApproval ? 'bg-blue-600 text-white shadow-lg' : 'bg-orange-900/40 text-orange-400'}`}>
                                    {user.fullName.charAt(0)}
                                  </div>
                                  <div className="flex-1 flex items-center justify-between min-w-0">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate" title={user.fullName}>{user.fullName}</p>
                                      {isWaitingApproval ? (
                                        <span className="bg-blue-500/20 text-blue-600 dark:text-sky-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shrink-0 animate-pulse border border-blue-500/30">
                                          Assinado (Validar)
                                        </span>
                                      ) : (
                                        <span className="bg-orange-900/20 text-orange-400 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-widest shrink-0">
                                          Pendente
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button 
                                        onClick={() => setResolvingTerm({ termId: term.id, userName: user.fullName })}
                                        className="p-1.5 hover:bg-red-900/40 text-slate-600 dark:text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                        title="Resolver sem termo (Contingência)"
                                      >
                                        <AlertCircle size={16} />
                                      </button>
                                      <button 
                                        onClick={() => { setSelectedUserForModal(user); setActiveModalTab('TERMS'); }}
                                        className={`p-1.5 rounded-lg transition-all flex items-center gap-2 px-3 text-[10px] font-black uppercase ${isWaitingApproval ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg' : 'hover:bg-orange-900/40 text-slate-600 dark:text-slate-400 hover:text-orange-400'}`}
                                      >
                                        {isWaitingApproval ? <>Analisar <ArrowRight size={14} /></> : <FileText size={16} />}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium pl-11 w-full">
                                <span className="uppercase tracking-tighter truncate shrink-0" style={{maxWidth: '120px'}} title={sectors.find(s => s.id === user.sectorId)?.name || 'Sem Setor'}>
                                  {sectors.find(s => s.id === user.sectorId)?.name || 'Sem Setor'}
                                </span>
                                <span className="text-slate-600 shrink-0">|</span>
                                <span className="uppercase tracking-tighter shrink-0">Cód: {user.internalCode || 'N/A'}</span>
                                <span className="text-slate-600 shrink-0">|</span>
                                <span className="uppercase tracking-tighter truncate flex-1" title={term.assetDetails}>{term.assetDetails}</span>
                                <span className="text-slate-600 shrink-0">|</span>
                                <span className="uppercase tracking-tighter shrink-0">Data: {new Date(term.date).toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>
                          );
                        })}
                        {pendingTerms.length > 5 && !isTermsExpanded && (
                          <button onClick={() => setIsTermsExpanded(true)} className="w-full py-2 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-slate-700 dark:text-slate-300 transition-colors">
                            Ver mais {pendingTerms.length - 5} pendências
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4º Alerta de Assinaturas Aguardando Validação */}
              {pendingApprovalSignatures.length > 0 && (
                <div className="bg-white dark:bg-slate-800 border-l-4 border-l-blue-500 dark:border-l-sky-500 border-y border-r border-slate-200 dark:border-slate-700 rounded-xl p-4 animate-fade-in shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400 rounded-lg shrink-0">
                      <FileSignature size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Validações Pendentes
                          <span className="ml-2 bg-blue-900/40 text-blue-600 dark:text-sky-400 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase">
                            {pendingApprovalSignatures.length}
                          </span>
                        </h3>
                        <button 
                          onClick={() => setIsValidationExpanded(!isValidationExpanded)}
                          className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          {isValidationExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                        Assinaturas digitais que aguardam aprovação do jurídico/TI.
                      </p>
                      
                      <div className={`space-y-3 transition-all duration-300 ${isValidationExpanded ? 'max-h-[500px] overflow-y-auto pr-2 custom-scrollbar' : 'max-h-[220px] overflow-hidden'}`}>
                        {pendingApprovalSignatures.map(({term, user}) => (
                            <div key={term.id} className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg border border-blue-300 dark:border-sky-700/30 flex flex-col gap-2 group hover:border-blue-700 transition-all">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="w-8 h-8 rounded-full bg-blue-900/40 flex items-center justify-center font-bold text-xs shrink-0 text-blue-600 dark:text-sky-400">
                                    {user.fullName.charAt(0)}
                                  </div>
                                  <div className="flex-1 flex items-center justify-between min-w-0">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate" title={user.fullName}>{user.fullName}</p>
                                      <span className="bg-blue-50 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-widest shrink-0 animate-pulse">
                                        Validar
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button 
                                        onClick={() => { setSelectedUserForModal(user); setActiveModalTab('TERMS'); }}
                                        className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-400 transition-all text-[10px] font-black uppercase flex items-center gap-2 px-3"
                                      >
                                        Analisar <ArrowRight size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium pl-11 w-full">
                                <span className="uppercase tracking-tighter truncate flex-1" title={term.assetDetails}>{term.assetDetails}</span>
                                <span className="text-slate-600 shrink-0">|</span>
                                <span className="uppercase tracking-tighter shrink-0">Assinado em: {new Date(term.signatureDate!).toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Monitoramento de Impressoras (Zabbix) */}
          <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="text-blue-500 w-5 h-5" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Monitoramento de Impressoras</h3>
              </div>
              <button 
                onClick={fetchPrintersZabbixData} 
                disabled={loadingPrinters}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500 hover:text-blue-500 flex items-center gap-1.5 text-xs font-bold"
                title="Sincronizar Zabbix"
              >
                <RefreshCw size={14} className={loadingPrinters ? 'animate-spin' : ''} />
                <span className="text-[10px] uppercase tracking-wider font-black">Sincronizar</span>
              </button>
            </div>

            {printers.length === 0 ? (
              <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs font-medium italic">
                Nenhuma impressora monitorada por Zabbix encontrada no inventário.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {printers.map(printer => {
                  const hostItems = printersData[printer.zabbixHostId || ''] || [];
                  const tonerItem = hostItems.find((i: any) => i.name.toLowerCase().includes('toner level')) || hostItems.find((i: any) => i.name.toLowerCase().includes('toner') && !isNaN(parseFloat(i.lastvalue)) && i.units === '%');
                  const tonerVal = tonerItem ? parseFloat(tonerItem.lastvalue) : null;
                  const displayToner = tonerVal !== null && !isNaN(tonerVal) ? Math.max(0, Math.min(100, tonerVal)) : null;

                  const drumItem = hostItems.find((i: any) => i.name.toLowerCase().includes('drum unit %') || i.name.toLowerCase().includes('drum unit') || i.name.toLowerCase().includes('cilindro'));
                  const drumVal = drumItem ? parseFloat(drumItem.lastvalue) : null;
                  const displayDrum = drumVal !== null && !isNaN(drumVal) ? Math.max(0, Math.min(100, drumVal)) : null;

                  const icmpItem = hostItems.find((i: any) => i.name.toLowerCase().includes('icmp ping') || i.key_.toLowerCase().includes('icmp.ping') || i.name.toLowerCase().includes('icmp: icmp ping'));
                  const isOnline = icmpItem ? (String(icmpItem.lastvalue).toLowerCase() === '1' || String(icmpItem.lastvalue).toLowerCase().includes('up') || String(icmpItem.lastvalue).toLowerCase().includes('1')) : false;

                  const modelName = models.find(m => m.id === printer.modelId)?.name || 'Modelo Desconhecido';
                  const sectorName = sectors.find(s => s.id === printer.sectorId)?.name || 'Sem Setor';

                  return (
                    <div 
                      key={printer.id} 
                      onClick={() => navigate(`/devices?deviceId=${printer.id}&tab=MONITOR`)}
                      className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-blue-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate" title={modelName}>{modelName}</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">S/N: {printer.serialNumber || 'N/A'}</p>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">{sectorName}</p>
                          </div>
                          
                          {/* ICMP Status Indicator */}
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isOnline ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>

                      {/* Toner & Drum Bars */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Toner Bar */}
                        <div>
                          <div className="flex justify-between text-[10px] font-bold mb-1">
                            <span className="text-slate-500 dark:text-slate-400">Toner</span>
                            <span className="text-slate-700 dark:text-slate-300">
                              {displayToner !== null ? `${displayToner}%` : 'Carregando...'}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${displayToner !== null ? (displayToner === 100 ? 'bg-green-500' : displayToner <= 20 ? 'bg-red-500' : displayToner <= 50 ? 'bg-yellow-500' : 'bg-slate-800 dark:bg-slate-400') : 'bg-slate-300 animate-pulse'}`}
                              style={{ width: `${displayToner !== null ? displayToner : 0}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Drum Bar */}
                        <div>
                          <div className="flex justify-between text-[10px] font-bold mb-1">
                            <span className="text-slate-500 dark:text-slate-400">Cilindro</span>
                            <span className="text-slate-700 dark:text-slate-300">
                              {displayDrum !== null ? `${displayDrum}%` : drumItem ? '0%' : 'Carregando...'}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${displayDrum !== null ? 'bg-emerald-500' : drumItem ? 'bg-emerald-500' : 'bg-slate-300 animate-pulse'}`}
                              style={{ width: `${displayDrum !== null ? displayDrum : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tasks Widget */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col h-full min-h-[600px]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 text-blue-600 dark:text-sky-400 rounded-lg">
                  <ClipboardList size={20} />
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Tarefas</h2>
              </div>
              <span className="bg-blue-500/20 text-blue-600 dark:text-sky-400 px-2 py-1 rounded-full text-[11px] font-black uppercase">
                {tasks.filter(t => t.status !== TaskStatus.COMPLETED).length} Ativas
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <TaskDashboardWidget 
                tasks={tasks} 
                onViewAll={() => navigate('/tasks')}
                onTaskClick={(task) => setSelectedTask(task)}
                systemUsers={systemUsers}
                currentUserId={localStorage.getItem('it_asset_user') ? JSON.parse(localStorage.getItem('it_asset_user')!).id : ''}
              />
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <button 
                onClick={() => navigate('/tasks')}
                className={`w-full py-3 ${UI_BUTTON_SECONDARY} text-xs rounded-xl transition-all flex items-center justify-center gap-2`}
              >
                Gerenciar Todas <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {resolvingTerm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">Resolver Pendência Manualmente</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 font-medium leading-relaxed">
              Você está resolvendo a pendência de <span className="text-slate-900 dark:text-white font-bold">{resolvingTerm.userName}</span> sem anexo. 
              Esta ação será registrada nos logs de auditoria.
            </p>
            <div className="mb-6">
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Motivo da Resolução</label>
              <textarea
                rows={4}
                className="w-full p-4 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Descreva por que este termo está sendo resolvido sem anexo..."
                value={resolveReason}
                onChange={(e) => setResolveReason(e.target.value)}
              ></textarea>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setResolvingTerm(null); setResolveReason(''); }}
                className="flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleResolveManual}
                disabled={!resolveReason.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (tid, updates) => {
            await updateTask(tid, updates, localStorage.getItem('userName') || 'Admin');
            setSelectedTask(null);
          }}
          currentUser={localStorage.getItem('userName') || 'Admin'}
          isAdmin={isAdmin}
          systemUsers={systemUsers}
          devices={devices}
          models={models}
        />
      )}

      {editingExpediente && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800/50">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Ajuste de Expediente</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1 uppercase tracking-tighter">{editingExpediente.nome}</p>
              </div>
              <button onClick={() => setEditingExpediente(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Motivo / Observação</label>
                <textarea 
                  className="w-full p-4 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-600"
                  rows={3}
                  placeholder="Ex: Férias, Licença Médica, etc."
                  value={editingExpediente.observation}
                  onChange={e => setEditingExpediente({...editingExpediente, observation: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Data para Reativação</label>
                <input 
                  type="date"
                  className="w-full p-4 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  value={editingExpediente.reactivationDate}
                  onChange={e => setEditingExpediente({...editingExpediente, reactivationDate: e.target.value})}
                />
              </div>
            </div>
            <div className="p-6 bg-white dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex gap-3">
              <button 
                onClick={() => setEditingExpediente(null)}
                className="flex-1 py-3 text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  try {
                    await saveExpedienteOverride(editingExpediente.codigo, editingExpediente.observation, editingExpediente.reactivationDate || null);
                    setEditingExpediente(null);
                  } catch (err) {
                    alert('Erro ao salvar.');
                  }
                }}
                className="flex-1 py-3 text-sm font-black uppercase tracking-widest bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all active:scale-95"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES DO COLABORADOR */}
      {selectedUserForModal && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up border border-slate-200 dark:border-slate-700 transition-colors">
            <div className="bg-black px-8 py-5 flex justify-between items-center shrink-0 border-b border-white/10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Detalhes do Colaborador</h3>
              <button onClick={() => setSelectedUserForModal(null)} className="h-10 w-10 flex items-center justify-center bg-white/5 hover:text-slate-900 dark:text-white rounded-full hover:bg-white/10 transition-all"><X size={20}/></button>
            </div>

            <div className="flex bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 overflow-x-auto shrink-0 px-4 pt-2">
              <button type="button" onClick={() => setActiveModalTab('DATA')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${activeModalTab === 'DATA' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-700 dark:text-slate-300'}`}>Dados Cadastrais</button>
              <button type="button" onClick={() => setActiveModalTab('ASSETS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeModalTab === 'ASSETS' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-700 dark:text-slate-300'}`}>Ativos em Posse <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{(userDevices.length + userSims.length)}</span></button>
              <button type="button" onClick={() => setActiveModalTab('LICENSES')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeModalTab === 'LICENSES' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-700 dark:text-slate-300'}`}>Licenças e Contas <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{userAccounts.length}</span></button>
              <button type="button" onClick={() => setActiveModalTab('TERMS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${activeModalTab === 'TERMS' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-700 dark:text-slate-300'}`}>Termos Gerados <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{currentUserTerms.length}</span></button>
              <button type="button" onClick={() => setActiveModalTab('LOGS')} className={`px-6 py-4 text-[11px] font-bold uppercase tracking-wider border-b-4 transition-all whitespace-nowrap ${activeModalTab === 'LOGS' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 ' : 'border-transparent hover:text-slate-700 dark:text-slate-300'}`}>Histórico</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-800 transition-colors">
              {activeModalTab === 'DATA' && (
                <div className="space-y-6">
                  <div className="bg-emerald-50 dark:bg-emerald-500/20 p-4 rounded-xl border border-emerald-900/40 flex items-center gap-3 mb-4">
                    <Info className="text-emerald-600 dark:text-emerald-400" size={20} />
                    <p className="text-xs font-bold text-emerald-200">Modo de visualização. As alterações de cadastro devem ser feitas na tela de colaboradores.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Nome Completo</label>
                      <input disabled className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold outline-none" value={selectedUserForModal.fullName || ''} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">CPF</label>
                      <input disabled className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-mono outline-none" value={selectedUserForModal.cpf || ''} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">RG</label>
                      <input disabled className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-mono outline-none" value={selectedUserForModal.rg || ''} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">PIS / PASEP</label>
                      <input disabled className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-mono outline-none" value={selectedUserForModal.pis || ''} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">E-mail Corporativo</label>
                      <input disabled className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white outline-none" value={selectedUserForModal.email || ''} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Cargo / Setor Atual</label>
                      <select disabled className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold outline-none" value={selectedUserForModal.sectorId || ''}>
                        <option value="">Selecione um cargo...</option>
                        {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Código Interno</label>
                      <input disabled className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold outline-none" value={selectedUserForModal.internalCode || ''} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Status do Colaborador</label>
                      <select disabled className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold outline-none" value={selectedUserForModal.active ? 'active' : 'inactive'}>
                        <option value="active">Ativo</option>
                        <option value="inactive">Inativo</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase mb-1 tracking-wider text-slate-500 dark:text-slate-400/80">Endereço Residencial</label>
                      <input disabled className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold outline-none" value={selectedUserForModal.address || 'Não cadastrado'} />
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'ASSETS' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400/80 mb-4 flex items-center gap-2"><Smartphone size={14} className="text-emerald-500" /> Dispositivos e Periféricos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userDevices.map(d => {
                        const m = models.find(mod => mod.id === d.modelId);
                        const isSharedResponsible = d.additionalUserIds?.includes(selectedUserForModal.id);
                        return (
                          <div 
                            key={d.id} 
                            onClick={() => { setSelectedUserForModal(null); navigate(`/devices?deviceId=${d.id}`); }}
                            className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 group hover:border-emerald-500/50 transition-all cursor-pointer"
                          >
                            <div className="h-12 w-12 rounded-lg bg-emerald-950/20 flex items-center justify-center border border-emerald-900/30 shrink-0 relative">
                              <Smartphone className="text-emerald-500" size={24}/>
                              {isSharedResponsible && (
                                <div className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full" title="Ativo Compartilhado">
                                  <Users size={10}/>
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
                          onClick={() => { setSelectedUserForModal(null); navigate(`/sims?simId=${sim.id}`); }}
                          className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 group hover:border-blue-500/50 transition-all cursor-pointer"
                        >
                          <div className="h-12 w-12 rounded-lg bg-blue-950/20 flex items-center justify-center border border-blue-300 dark:border-sky-700/30 shrink-0">
                            <Phone className="text-blue-500" size={24}/>
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate">{sim.phoneNumber}</div>
                            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{(sim as any).assetTag ? `Sim Card: ${(sim as any).assetTag}` : 'Sim Card S/N'}</div>
                            <div className="mt-1"><span className="text-[11px] font-black bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400 px-2 py-0.5 rounded uppercase tracking-wider">Ativa</span></div>
                          </div>
                        </div>
                      ))}
                      {userSims.length === 0 && <div className="md:col-span-2 text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl"><Phone className="mx-auto text-slate-700 mb-2" size={32}/><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Nenhuma linha associada</p></div>}
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'LICENSES' && (
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
                             onClick={() => { setSelectedUserForModal(null); navigate(`/accounts?accountId=${acc.id}`); }}
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

              {activeModalTab === 'TERMS' && (
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

              {activeModalTab === 'LOGS' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    {(() => {
                      const name = selectedUserForModal.fullName.toLowerCase().trim() || '';
                      const userLogs = logs.filter(l => {
                        const target = (l.targetName || '').toLowerCase();
                        const notes = (l.notes || '').toLowerCase();
                        return target === name || 
                               target.includes(name) ||
                               notes.includes(name) ||
                               (name.split(' ').length > 1 && notes.includes(name.split(' ')[0]) && notes.includes(name.split(' ').pop() || ''));
                      });
                      return (
                        <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Total de Eventos: {userLogs.length}</span>
                      );
                    })()}
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const name = selectedUserForModal.fullName.toLowerCase().trim() || '';
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
          </div>
        </div>
      )}

      {/* MODAL LINK ASSINATURA */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg border border-slate-200 dark:border-slate-700 animate-scale-up shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Assinatura Eletrônica</h3>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Sincronização Ativa</p>
              </div>
              <button onClick={() => setIsLinkModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="bg-blue-950/30 p-4 rounded-xl border border-blue-300 dark:border-sky-700/40 text-blue-600 dark:text-sky-400 text-xs font-bold leading-relaxed flex items-center gap-3">
                <Info size={24} className="shrink-0" />
                <span>Envie o link abaixo para o colaborador realizar o processo de assinatura digital de forma autenticada.</span>
              </div>
              <div className="flex gap-2">
                <input readOnly className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-slate-700 dark:text-slate-300 font-mono text-xs select-all outline-none" value={generatedSignatureLink} />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedSignatureLink);
                    showToast('Link copiado para a área de transferência!', 'success');
                  }}
                  className="bg-blue-600 text-white font-black uppercase text-[11px] tracking-widest px-6 rounded-xl hover:bg-blue-500 active:scale-95 transition-all"
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESOLUÇÃO MANUAL DO TERMO */}
      {resolvingManualTerm && (
        <div className="fixed inset-0 bg-white dark:bg-slate-800/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 animate-scale-up">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-wider">Resolução Contingencial</h3>
              <button onClick={() => setResolvingManualTerm(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Motivo da Dispensa de Assinatura</label>
                <textarea 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-slate-700 dark:text-slate-200 outline-none focus:border-orange-500 min-h-[120px] text-xs font-bold" 
                  value={resolveManualReason} 
                  onChange={e => setResolveManualReason(e.target.value)} 
                  placeholder="Justifique o motivo de não coletar a assinatura deste termo (Ex: Colaborador desligado, extravio coberto por seguro, decisão da diretoria...)"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex gap-3">
              <button onClick={() => setResolvingManualTerm(null)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-white dark:bg-slate-800 rounded-xl transition-all border border-slate-200 dark:border-slate-700">Cancelar</button>
              <button onClick={handleConfirmResolveManual} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest bg-orange-600 text-white rounded-xl shadow-lg hover:bg-orange-500 transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICAO DE DETALHES DO TERMO */}
      {editingTerm && termEditData && (
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
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setTermEditData({...termEditData, status: 'PENDING'})} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${termEditData.status === 'PENDING' ? 'border-orange-500 bg-orange-900/20 text-orange-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'}`}><Clock size={20}/><span className="text-[11px] font-black uppercase tracking-widest">Pendente</span></button>
                <button onClick={() => setTermEditData({...termEditData, status: 'SIGNED'})} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${termEditData.status === 'SIGNED' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'}`}><CheckCircle2 size={20}/><span className="text-[11px] font-black uppercase tracking-widest">Assinado</span></button>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2">Observações Detalhadas</label>
                <textarea className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-500 min-h-[100px] text-sm" value={termEditData.notes} onChange={e => setTermEditData({...termEditData, notes: e.target.value})} placeholder="Adicione notas sobre o estado dos itens ou observações do colaborador..."/>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2">Evidências (Fotos / B.O.) - Máx 3</label>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {termEditData.evidenceFiles.map((file: string, index: number) => (
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
              <button onClick={handleSaveTermEdit} className="px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest bg-emerald-600 text-white transition-all">Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* FILE PREVIEW MODAL */}
      {isPreviewOpen && (
        <FilePreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} fileUrl={previewData.url} fileName={previewData.name} />
      )}
    </div>
  );
};

export default Dashboard;
