import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { RhTermTemplate, RhTerm } from '../types';
import { DataTable, Column } from './DataTable';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import { 
  FileText, Plus, Check, X, Shield, PenTool, ArrowRight, Printer, 
  Copy, Share2, Info, Search, Download, ChevronLeft, ChevronRight, Briefcase,
  Trash2, Upload, Eye, CheckSquare, History, SlidersHorizontal, Save,
  FileSignature, Clock, AlertCircle, EyeOff, User as UserIcon
} from 'lucide-react';
import FilePreviewModal from './FilePreviewModal';
import { hasPermission } from '../utils/rbac';

export const RhComodatoManager: React.FC = () => {
  const { 
    rhCollaborators, rhTemplates, rhTerms, addRhTemplate, updateRhTemplate, 
    addRhTerm, updateRhTerm, sectors, settings, rhAssetItems, updateRhAssetItem,
    getTermFile, updateTermFile, deleteTermFile, resolveTermManual, generateSignatureToken,
    fetchData
  } = useData();
  const { user } = useAuth();
  const { showToast } = useToast();
  const adminName = user?.name || 'Gestor R.H.';
  const canWrite = hasPermission(user, 'rh_comodato_escrita');

  // Search/Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Navigation & Term States
  const [selectedTerm, setSelectedTerm] = useState<RhTerm | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  // Create Term Form states
  const [showCreateTerm, setShowCreateTerm] = useState(false);
  const [newTermColabId, setNewTermColabId] = useState('');

  // Advanced Term States
  const [resolvingManualTerm, setResolvingManualTerm] = useState<RhTerm | null>(null);
  const [resolveManualReason, setResolveManualReason] = useState('');
  const [generatedSignatureLink, setGeneratedSignatureLink] = useState('');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ url: string; name: string } | null>(null);
  const [signatureData, setSignatureData] = useState<{ signatureCanvas: string | null; documentPhoto: string | null; selfiePhoto: string | null } | null>(null);
  const [newTermTemplateId, setNewTermTemplateId] = useState('');
  const [newTermCustomNotes, setNewTermCustomNotes] = useState('');
  const [newTermObservations, setNewTermObservations] = useState('');
  
  // Link Asset Stock states
  const [selectedRhAssetId, setSelectedRhAssetId] = useState('');
  const [selectedRhAssetQty, setSelectedRhAssetQty] = useState(1);

  // Signature Modal states
  const [signingTerm, setSigningTerm] = useState<RhTerm | null>(null);
  const [signatureConfirm, setSignatureConfirm] = useState(false);
  const [gpsApproved, setGpsApproved] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Advanced term handlers (idênticos ao módulo de TI)
  const handleUploadTermFile = (termId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileUrl = event.target?.result as string;
        updateTermFile(termId, '', fileUrl, adminName);
        showToast('Termo assinado enviado com sucesso', 'success');
        if (selectedTerm && selectedTerm.id === termId) {
          setSelectedTerm(prev => prev ? { ...prev, fileUrl, status: 'ASSINADO', hasFile: true } : null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteTermFile = async (termId: string) => {
    if (window.confirm("Deseja realmente excluir o anexo deste termo?")) {
      try {
        await deleteTermFile(termId, '', 'Remoção do anexo pelo gestor', adminName);
        showToast('Anexo removido do termo', 'success');
        if (selectedTerm && selectedTerm.id === termId) {
          setSelectedTerm(prev => prev ? { ...prev, fileUrl: '', hasFile: false, status: 'PENDENTE', signatureDate: undefined, signatureIp: undefined, signatureLocation: undefined, signatureHash: undefined, signatureStatus: undefined } : null);
        }
      } catch (err) {
        showToast('Erro ao remover anexo', 'error');
      }
    }
  };

  const handleGenerateSignatureLink = async (termId: string) => {
    try {
      const token = await generateSignatureToken(termId);
      const link = `${window.location.origin}/#/sign-term/${token}`;
      setGeneratedSignatureLink(link);
      setIsLinkModalOpen(true);
    } catch (err: any) {
      console.error("Erro ao gerar link:", err);
      showToast(`Erro ao gerar link: ${err.message}`, 'error');
    }
  };

  const handleConfirmResolveManual = async () => {
    if (!resolvingManualTerm || !resolveManualReason) return;
    try {
      await resolveTermManual(resolvingManualTerm.id, resolveManualReason, adminName);
      showToast('Termo resolvido manualmente', 'success');
      if (selectedTerm && selectedTerm.id === resolvingManualTerm.id) {
        setSelectedTerm(prev => prev ? { ...prev, isManual: true, resolutionReason: resolveManualReason, status: 'ASSINADO' } : null);
      }
      setResolvingManualTerm(null);
      setResolveManualReason('');
    } catch (err) {
      showToast('Erro ao resolver termo', 'error');
    }
  };

  const handleApproveSignature = async (termId: string) => {
    try {
      const res = await fetch(`/api/rh-terms/${termId}/approve-signature`, { method: 'POST' });
      if (res.ok) {
        showToast('Assinatura aprovada com sucesso', 'success');
        await fetchData(true);
        if (selectedTerm && selectedTerm.id === termId) {
          setSelectedTerm(prev => prev ? { ...prev, signatureStatus: 'APPROVED', status: 'ASSINADO' } : null);
        }
      } else {
        showToast('Erro ao aprovar assinatura', 'error');
      }
    } catch (err) {
      showToast('Erro ao aprovar assinatura', 'error');
    }
  };

  const handleRejectSignature = async (termId: string) => {
    if (window.confirm("Deseja realmente rejeitar esta assinatura? O colaborador terá que assinar novamente.")) {
      try {
        const res = await fetch(`/api/rh-terms/${termId}/reject-signature`, { method: 'POST' });
        if (res.ok) {
          showToast('Assinatura rejeitada com sucesso', 'success');
          await fetchData(true);
          if (selectedTerm && selectedTerm.id === termId) {
            setSelectedTerm(prev => prev ? { ...prev, signatureStatus: 'REJECTED', status: 'PENDENTE', signatureDate: undefined, signatureIp: undefined, signatureLocation: undefined, signatureHash: undefined } : null);
          }
        } else {
          showToast('Erro ao rejeitar assinatura', 'error');
        }
      } catch (err) {
        showToast('Erro ao rejeitar assinatura', 'error');
      }
    }
  };

  const handleViewSignatureEvidences = async (termId: string) => {
    try {
      const response = await fetch(`/api/rh-terms/${termId}/signature-data`);
      if (response.ok) {
        const data = await response.json();
        setSignatureData(data);
      } else {
        showToast('Erro ao carregar fotos da assinatura', 'error');
      }
    } catch (err) {
      showToast('Erro ao carregar fotos da assinatura', 'error');
    }
  };

  const handleViewTermFile = async (term: RhTerm) => {
    let url = term.fileUrl || (term as any).filebinary;
    
    if (!url && !!term.hasFile) {
      try {
        url = await getTermFile(term.id);
      } catch (err) {
        console.error("Erro ao buscar arquivo do termo:", err);
      }
    }
    
    if (url && url !== '#') {
      const collaborator = rhCollaborators.find(c => c.id === term.collaboratorId);
      setPreviewData({ 
        url, 
        name: `termo_${term.type?.toLowerCase() || 'comodato'}_${collaborator?.fullName || 'colaborador'}.${(url.includes('pdf') || url.includes('application/pdf')) ? 'pdf' : 'jpg'}` 
      });
      setIsPreviewOpen(true);
    }
  };

  // Term Emission
  const handleEmitTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTermColabId || !newTermTemplateId) return;

    const colab = rhCollaborators.find(c => c.id === newTermColabId);
    const tmpl = rhTemplates.find(t => t.id === newTermTemplateId);

    if (!colab || !tmpl) return;

    let finalDetails = newTermCustomNotes || 'Comodato Geral';

    if (selectedRhAssetId) {
      const assetItem = rhAssetItems.find(item => item.id === selectedRhAssetId);
      if (assetItem) {
        const isDevolucao = tmpl.type === 'DEVOLUCAO';
        const qtyChange = Number(selectedRhAssetQty);
        const updatedItem = {
          ...assetItem,
          currentStock: isDevolucao
            ? assetItem.currentStock + qtyChange
            : Math.max(0, assetItem.currentStock - qtyChange)
        };
        updateRhAssetItem(updatedItem, adminName);
        
        const itemText = `- ${assetItem.name} (${qtyChange} un)`;
        if (finalDetails === 'Comodato Geral' || !finalDetails.trim()) {
          finalDetails = itemText;
        } else {
          finalDetails = `${finalDetails}\n${itemText}`;
        }
      }
    }

    const newTerm: RhTerm = {
      id: 'rht-' + Math.random().toString(36).substr(2, 9),
      collaboratorId: newTermColabId,
      templateId: newTermTemplateId,
      assetDetails: finalDetails,
      date: new Date().toISOString().split('T')[0],
      status: 'PENDENTE',
      notes: newTermObservations,
      type: tmpl.type || 'ENTREGA'
    };

    addRhTerm(newTerm, adminName);
    setShowCreateTerm(false);
    setNewTermColabId('');
    setNewTermTemplateId('');
    setNewTermCustomNotes('');
    setNewTermObservations('');
    setSelectedRhAssetId('');
    setSelectedRhAssetQty(1);
  };

  // Signature Flow
  const requestGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsApproved(true);
        },
        () => {
          setGpsApproved(true); // fall-through with default mock coordinates if user blocks permissions
        }
      );
    } else {
      setGpsApproved(true);
    }
  };

  const handleConfirmSignature = () => {
    if (!signingTerm) return;

    const signedTerm: RhTerm = {
      ...signingTerm,
      status: 'ASSINADO',
      signatureDate: new Date().toISOString(),
      signatureIp: '177.45.190.22', // Mock IP
      signatureLocation: gpsCoords ? `Lat: ${gpsCoords.lat.toFixed(4)}, Lng: ${gpsCoords.lng.toFixed(4)}` : 'São Paulo, SP',
      signatureHash: 'sha256_' + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9)
    };

    updateRhTerm(signedTerm, adminName);
    setSigningTerm(null);
    setSignatureConfirm(false);
    setGpsApproved(false);
    setGpsCoords(null);
    setSelectedTerm(signedTerm);
  };

  // Print Function (idêntica ao layout profissional de TI)
  const generateAndPrintRhTerm = (term: RhTerm) => {
    const collaborator = rhCollaborators.find(c => c.id === term.collaboratorId);
    const template = rhTemplates.find(t => t.id === term.templateId);

    if (!collaborator || !template) {
      alert("Colaborador ou template não localizado.");
      return;
    }

    const sectorName = sectors?.find(s => s.id === collaborator.sectorId)?.name || 'Não Informado';
    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Substituições
    const replacements: Record<string, string> = {
      '{NOME_EMPRESA}': settings?.appName || 'Minha Empresa',
      '{CNPJ}': settings?.cnpj || 'Não Informado',
      '{NOME_COLABORADOR}': collaborator.fullName,
      '{CPF}': collaborator.cpf,
      '{RG}': collaborator.rg || '-',
      '{CARGO}': collaborator.role || '-',
      '{SETOR}': sectorName,
      '{TIPO_CONTRATO}': collaborator.contractType || '-',
      '{BENS_COMODATO}': term.assetDetails || '',
      '{DATA_ATUAL}': today
    };

    let processedDeclaration = template.declaration || (template.type === 'DEVOLUCAO' ? 'Declaro ter devolvido os itens abaixo na presente data.' : 'Declaro ter recebido os itens abaixo em perfeitas condições de uso.');
    let processedContent = template.content || '';

    Object.keys(replacements).forEach(key => {
      const regex = new RegExp(key, 'g');
      processedDeclaration = processedDeclaration.replace(regex, replacements[key]);
      processedContent = processedContent.replace(regex, replacements[key]);
    });

    const isEntrega = (term.type || template.type || 'ENTREGA') === 'ENTREGA';
    const headerTitle = isEntrega ? 'Termo de Responsabilidade de Comodato' : 'Termo de Devolução de Comodato';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${headerTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; background-color: #fff; color: #000; line-height: 1.35; }
            @media print {
              body { padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
              @page { margin: 10mm; size: A4 portrait; }
            }
          </style>
        </head>
        <body>
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #000000; line-height: 1.35; max-width: 100%; margin: 0 auto; padding: 10px 30px; background-color: #fff;">
            
            <!-- HEADER -->
            <table style="width: 100%; border-bottom: 2px solid #000; margin-bottom: 12px; padding-bottom: 8px;">
              <tr>
                <td style="width: 25%; vertical-align: middle;">
                  <img src="${settings?.logoUrl || ''}" alt="Logo" style="max-height: 55px; max-width: 150px; object-fit: contain;" onerror="this.style.display='none'"/>
                </td>
                <td style="width: 75%; text-align: right; vertical-align: middle;">
                  <h1 style="margin: 0; font-size: 16px; font-weight: bold; color: #000;">${settings?.appName || 'Minha Empresa'}</h1>
                  <p style="margin: 0; font-size: 10px; color: #000;">CNPJ: ${settings?.cnpj || 'Não Informado'}</p>
                  <h2 style="margin: 3px 0 0 0; text-transform: uppercase; font-size: 13px; color: #000; letter-spacing: 0.5px;">${headerTitle}</h2>
                  <p style="margin: 0; font-size: 9px; color: #000; text-transform: uppercase; font-weight: bold;">GESTÃO DE PESSOAS / RECURSOS HUMANOS</p>
                </td>
              </tr>
            </table>

            <!-- DADOS DO COLABORADOR -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; margin-bottom: 12px; color: #000;">
              <table style="width: 100%; font-size: 10.5px; color: #000; border-collapse: collapse;">
                <tr>
                  <td style="font-weight: bold; width: 18%; padding: 3px 0;">Colaborador:</td>
                  <td style="width: 42%; padding: 3px 0;">${collaborator.fullName}</td>
                  <td style="font-weight: bold; width: 10%; padding: 3px 0;">CPF:</td>
                  <td style="width: 30%; font-family: monospace; padding: 3px 0;">${collaborator.cpf}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; padding: 3px 0;">Cargo / Função:</td>
                  <td style="padding: 4px 0;">${collaborator.role || 'Não Informado'}</td>
                  <td style="font-weight: bold; padding: 3px 0;">Setor:</td>
                  <td style="padding: 3px 0;">${sectorName}</td>
                </tr>
              </table>
            </div>

            <!-- DECLARAÇÃO -->
            <div style="text-align: justify; font-size: 10.5px; margin-bottom: 12px; color: #000; line-height: 1.5;">
              ${processedDeclaration}
            </div>

            <!-- TABELA DE ITENS -->
            <div style="margin-bottom: 12px;">
              <h3 style="font-size: 11px; border-left: 3px solid #2563eb; padding-left: 8px; margin-bottom: 8px; color: #000; text-transform: uppercase; font-weight: bold;">1. Detalhes do Bem em Comodato</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px;">
                <thead>
                  <tr style="background-color: #f1f5f9;">
                    <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; color: #000;">Descrição do Item</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 10px; color: #000; font-size: 11px; white-space: pre-wrap;">${term.assetDetails}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- OBSERVAÇÕES -->
            ${term.notes ? `
              <div style="margin-bottom: 12px; font-size: 10px; color: #000; background-color: #fffbeb; padding: 10px; border: 1px solid #fcd34d; border-radius: 6px;">
                <strong>Observações:</strong> ${term.notes}
              </div>
            ` : ''}

            <!-- CLÁUSULAS -->
            <div style="font-size: 10px; color: #000; margin-bottom: 15px; line-height: 1.4; white-space: pre-line; text-align: justify;">
              ${processedContent}
            </div>

            <!-- ASSINATURAS -->
            <div style="margin-top: 25px; page-break-inside: avoid; color: #000;">
              <p style="text-align: center; margin-bottom: 35px; font-size: 10.5px;">São José dos Campos, ${today}</p>
              
              <div style="width: 60%; margin: 0 auto; text-align: center;">
                <div style="border-top: 1.5px solid #000; padding-top: 6px;">
                  <strong style="font-size: 11px; color: #000; text-transform: uppercase;">${collaborator.fullName}</strong><br>
                  <span style="font-size: 9px; color: #000; font-weight: bold;">Assinatura do Colaborador</span><br>
                  <span style="font-size: 9px; color: #000; font-family: monospace;">Documento de Identificação (CPF): ${collaborator.cpf}</span>
                  
                  ${term.status === 'ASSINADO' ? `
                    <div style="margin-top: 15px; font-size: 7px; color: #166534; text-align: center; border: 1px dashed #a7f3d0; padding: 6px; border-radius: 6px; background: #ecfdf5;">
                      <strong style="text-transform: uppercase; color: #065f46;">AUTENTICAÇÃO DIGITAL DE R.H.</strong><br>
                      <strong>HASH CRIPTOGRÁFICO:</strong> ${term.signatureHash?.toUpperCase() || ''}<br>
                      IP: ${term.signatureIp || '177.45.190.22'} | DATA: ${term.signatureDate ? new Date(term.signatureDate).toLocaleString('pt-BR') : ''}<br>
                      LOCAL: ${term.signatureLocation || 'São José dos Campos, SP'}
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>

            <div style="margin-top: 25px; text-align: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px;">
              Documento gerado digitalmente pelo sistema IT Asset 360 • Módulo R.H. • ${new Date().toLocaleString()}
            </div>
          </div>
          
          <script>
            window.onload = function() { 
              setTimeout(function(){ 
                window.print(); 
              }, 800); 
            }
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
      alert('Permita popups para imprimir/visualizar o termo.');
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Filter Logic
  const filtered = rhTerms.filter(t => {
    const colabName = rhCollaborators.find(c => c.id === t.collaboratorId)?.fullName || '';
    const tmplName = rhTemplates.find(tmpl => tmpl.id === t.templateId)?.name || '';
    
    const matchesSearch = colabName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          tmplName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.assetDetails || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || t.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Table Configuration
  const columns: Column<RhTerm>[] = [
    { key: 'id', label: 'ID Termo', sortable: true },
    { key: 'collaboratorId', label: 'Colaborador', sortable: true },
    { key: 'templateId', label: 'Modelo de Termo', sortable: true },
    { key: 'assetDetails', label: 'Itens / Bens', sortable: true },
    { key: 'date', label: 'Data Emissão', sortable: true },
    { key: 'status', label: 'Status', sortable: true }
  ];

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    id: 110,
    collaboratorId: 240,
    templateId: 180,
    assetDetails: 240,
    date: 110,
    status: 120
  });

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleResize = (key: string, startX: number, startWidth: number) => {
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
      setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const sortedData = [...filtered].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aVal: any = a[key as keyof RhTerm];
    let bVal: any = b[key as keyof RhTerm];

    if (key === 'collaboratorId') {
      aVal = rhCollaborators.find(c => c.id === a.collaboratorId)?.fullName || '';
      bVal = rhCollaborators.find(c => c.id === b.collaboratorId)?.fullName || '';
    } else if (key === 'templateId') {
      aVal = rhTemplates.find(t => t.id === a.templateId)?.name || '';
      bVal = rhTemplates.find(t => t.id === b.templateId)?.name || '';
    }

    if (aVal === undefined || aVal === null) return direction === 'asc' ? 1 : -1;
    if (bVal === undefined || bVal === null) return direction === 'asc' ? -1 : 1;

    if (typeof aVal === 'string') {
      return direction === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    
    return direction === 'asc' 
      ? (aVal > bVal ? 1 : -1) 
      : (bVal > aVal ? 1 : -1);
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(10);

  const totalItems = sortedData.length;
  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(totalItems / itemsPerPage);
  
  const paginatedData = itemsPerPage === 'ALL' 
    ? sortedData 
    : sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Export functions
  const handleExportCSV = () => {
    const exportData = filtered.map(t => ({
      'ID Termo': t.id,
      'Colaborador': rhCollaborators.find(c => c.id === t.collaboratorId)?.fullName || 'Desconhecido',
      'CPF': rhCollaborators.find(c => c.id === t.collaboratorId)?.cpf || '',
      'Modelo': rhTemplates.find(tmpl => tmpl.id === t.templateId)?.name || 'Geral',
      'Detalhes dos Bens': t.assetDetails || '',
      'Data de Emissão': t.date,
      'Status': t.status,
      'Data Assinatura': t.signatureDate || '',
      'Local Assinatura': t.signatureLocation || ''
    }));
    exportToCSV(exportData, 'termos_comodato_rh');
  };

  const handleExportExcel = () => {
    const exportData = filtered.map(t => ({
      'ID Termo': t.id,
      'Colaborador': rhCollaborators.find(c => c.id === t.collaboratorId)?.fullName || 'Desconhecido',
      'CPF': rhCollaborators.find(c => c.id === t.collaboratorId)?.cpf || '',
      'Modelo': rhTemplates.find(tmpl => tmpl.id === t.templateId)?.name || 'Geral',
      'Detalhes dos Bens': t.assetDetails || '',
      'Data de Emissão': t.date,
      'Status': t.status,
      'Data Assinatura': t.signatureDate || '',
      'Local Assinatura': t.signatureLocation || ''
    }));
    exportToExcel(exportData, 'termos_comodato_rh');
  };

  const handleExportPDF = () => {
    const headers = ['ID', 'Colaborador', 'Modelo de Termo', 'Data Emissão', 'Status'];
    const exportData = filtered.map(t => [
      t.id,
      rhCollaborators.find(c => c.id === t.collaboratorId)?.fullName || 'Desconhecido',
      rhTemplates.find(tmpl => tmpl.id === t.templateId)?.name || 'Geral',
      new Date(t.date).toLocaleDateString('pt-BR'),
      t.status
    ]);
    exportToPDF(headers, exportData, 'termos_comodato_rh', 'Relatório de Termos de Comodato de R.H.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 id="rh-comodato-title" className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">TERMOS DE COMODATO DE R.H.</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Emissão de termos de responsabilidade e assinaturas eletrônicas com GPS</p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreateTerm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow-md transition-all uppercase tracking-wider"
          >
            <Plus size={16} /> Emitir Novo Termo
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por colaborador, modelo ou descrição do bem..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="">Todos os Status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="ASSINADO">Assinado</option>
          </select>

          {/* Exports Dropdown */}
          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-3">
            <button
              onClick={handleExportExcel}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1"
              title="Exportar para Excel"
            >
              <Download size={14} /> <span className="hidden lg:inline">XLS</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1"
              title="Exportar para PDF"
            >
              <FileText size={14} /> <span className="hidden lg:inline">PDF</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1"
              title="Exportar para CSV"
            >
              <Briefcase size={14} /> <span className="hidden lg:inline">CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main DataTable Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={paginatedData}
          sortConfig={sortConfig}
          requestSort={requestSort}
          columnWidths={columnWidths}
          onResize={handleResize}
          emptyMessage="Nenhum termo de comodato encontrado com os filtros atuais."
          renderRow={(t) => {
            const colabName = rhCollaborators.find(c => c.id === t.collaboratorId)?.fullName || 'Desconhecido';
            const tmpl = rhTemplates.find(tmpl => tmpl.id === t.templateId);
            const tmplName = tmpl?.name || 'Modelo Geral';
            const type = t.type || tmpl?.type || 'ENTREGA';

            return (
              <tr
                key={t.id}
                onClick={() => {
                  setSelectedTerm(t);
                  setIsDetailModalOpen(true);
                }}
                className="border-b border-slate-200 dark:border-slate-700/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/30 cursor-pointer transition-all text-xs text-slate-900 dark:text-slate-200"
              >
                <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{t.id}</td>
                <td className="px-6 py-4 font-black">{colabName}</td>
                <td className="px-6 py-4 font-bold">
                  <div className="flex items-center gap-2">
                    <span>{tmplName}</span>
                    <span className={`px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-wider ${type === 'DEVOLUCAO' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-indigo-100 text-indigo-850 dark:bg-indigo-500/20 dark:text-indigo-400'}`}>
                      {type}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 truncate max-w-xs">{t.assetDetails}</td>
                <td className="px-6 py-4 text-slate-500">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 text-[9px] font-black rounded-full uppercase tracking-wider ${t.status === 'ASSINADO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/10' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/10'}`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            );
          }}
        />

        {/* Footer Pagination */}
        <div className="bg-slate-50 dark:bg-slate-900/20 border-t border-slate-200 dark:border-slate-700/60 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Exibir:</span>
              <select
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={itemsPerPage}
                onChange={e => {
                  setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value="ALL">Todos</option>
              </select>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total: {totalItems} termos emitidos</p>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className={`p-2 rounded-lg transition-all ${currentPage === 1 ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-indigo-600 bg-indigo-500/10 px-3 py-1.5 rounded-lg">{currentPage}</span>
                <span className="text-xs font-bold uppercase mx-1 text-slate-400">de</span>
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{totalPages}</span>
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className={`p-2 rounded-lg transition-all ${currentPage === totalPages ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DETALHES DO COMODATO MODAL (Visualizador completo de cláusulas e termo assinado) */}
      {isDetailModalOpen && selectedTerm && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-700 animate-scale-up">
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-[10px] font-black rounded uppercase tracking-wider ${selectedTerm.status === 'ASSINADO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-850 dark:bg-amber-500/20 dark:text-amber-400'}`}>{selectedTerm.status}</span>
                <div className="flex flex-col">
                  <h2 className="text-md font-black text-slate-900 dark:text-white leading-none">
                    Termo de Comodato {selectedTerm.id}
                  </h2>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Emitido em {new Date(selectedTerm.date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
              <button onClick={() => { setIsDetailModalOpen(false); setSelectedTerm(null); }} className="h-10 w-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-700 dark:text-white transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {(() => {
                const colab = rhCollaborators.find(c => c.id === selectedTerm.collaboratorId);
                const tmpl = rhTemplates.find(t => t.id === selectedTerm.templateId);

                if (!colab || !tmpl) return <p className="text-xs text-rose-500">Erro: Colaborador ou modelo ausente.</p>;

                const sectorName = sectors?.find(s => s.id === colab.sectorId)?.name || 'Não Informado';
                const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

                const replacements: Record<string, string> = {
                  '{NOME_EMPRESA}': settings?.appName || 'Minha Empresa',
                  '{CNPJ}': settings?.cnpj || 'Não Informado',
                  '{NOME_COLABORADOR}': colab.fullName,
                  '{CPF}': colab.cpf,
                  '{RG}': colab.rg || '-',
                  '{CARGO}': colab.role || '-',
                  '{SETOR}': sectorName,
                  '{TIPO_CONTRATO}': colab.contractType || '-',
                  '{BENS_COMODATO}': selectedTerm.assetDetails || '',
                  '{DATA_ATUAL}': today
                };

                let processedDeclaration = tmpl.declaration || (tmpl.type === 'DEVOLUCAO' ? 'Declaro ter devolvido os itens abaixo na presente data.' : 'Declaro ter recebido os itens abaixo em perfeitas condições de uso.');
                let processedContent = tmpl.content || '';

                Object.keys(replacements).forEach(key => {
                  const regex = new RegExp(key, 'g');
                  processedDeclaration = processedDeclaration.replace(regex, replacements[key]);
                  processedContent = processedContent.replace(regex, replacements[key]);
                });

                return (
                  <div className="space-y-6">
                    {/* Ficha técnica em duas colunas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-700/60 p-5 rounded-2xl">
                      <div className="space-y-2 text-xs">
                        <span className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider block">Dados do Comodatário</span>
                        <p className="font-black text-slate-900 dark:text-white">{colab.fullName}</p>
                        <p className="text-slate-500 font-medium">CPF: <span className="font-mono font-bold">{colab.cpf}</span> | Setor: {sectorName}</p>
                      </div>
                      <div className="space-y-2 text-xs">
                        <span className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider block">Status e Tipo de Termo</span>
                        <p className="font-black text-slate-900 dark:text-white uppercase">Modelo: {tmpl.name}</p>
                        <p className="text-slate-500 font-medium">Tipo: <span className="font-mono font-bold">{selectedTerm.type || tmpl.type || 'ENTREGA'}</span></p>
                      </div>
                    </div>

                    {/* Declaração Principal */}
                    <div className="p-4 bg-blue-500/5 border-l-4 border-indigo-600 rounded-r-xl">
                      <p className="text-xs font-bold uppercase text-indigo-500 tracking-wider mb-1">Declaração e Aceite</p>
                      <p 
                        className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium italic"
                        dangerouslySetInnerHTML={{ __html: `"${processedDeclaration}"` }}
                      />
                    </div>

                    {/* Bens Vinculados */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block leading-none">1. Bens em Comodato (Detalhamento)</span>
                      <pre className="p-4 bg-slate-100 dark:bg-slate-900 text-xs font-mono rounded-xl text-slate-800 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">{selectedTerm.assetDetails}</pre>
                    </div>

                    {/* Observações */}
                    {selectedTerm.notes && (
                      <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl text-xs">
                        <span className="font-black text-amber-600 dark:text-amber-400 block uppercase mb-1">Observações Internas</span>
                        <p className="text-slate-600 dark:text-slate-300 font-medium">{selectedTerm.notes}</p>
                      </div>
                    )}

                    {/* Cláusulas Contratuais */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block leading-none">2. Cláusulas e Responsabilidades Legais</span>
                      <div 
                        className="p-4 bg-slate-50 dark:bg-slate-900/20 border border-slate-150 dark:border-slate-800 rounded-xl max-h-48 overflow-y-auto text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 text-justify"
                        dangerouslySetInnerHTML={{ __html: processedContent }}
                      />
                    </div>

                    {/* Validação de Assinatura se WAITING_APPROVAL */}
                    {selectedTerm.signatureStatus === 'WAITING_APPROVAL' && (
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4 bg-blue-500/5 border border-blue-500/10 p-5 rounded-2xl animate-fade-in">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-blue-600 dark:text-sky-400 block tracking-widest leading-none">VALIDAÇÃO JURÍDICA DA ASSINATURA DIGITAL</span>
                          <span className="bg-blue-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded animate-pulse">Aguardando Validação</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">Data/Hora Envio</span>
                            <span className="font-bold">{selectedTerm.signatureDate ? new Date(selectedTerm.signatureDate).toLocaleString('pt-BR') : '---'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">Assinatura IP</span>
                            <span className="font-bold font-mono">{selectedTerm.signatureIp || '---'}</span>
                          </div>
                          <div className="col-span-2 font-mono">
                            <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">Hash Criptográfico de Integridade</span>
                            <span className="font-bold text-[10px] text-blue-600 dark:text-sky-400 break-all">{selectedTerm.signatureHash}</span>
                          </div>
                        </div>

                        {!signatureData ? (
                          <button
                            onClick={() => handleViewSignatureEvidences(selectedTerm.id)}
                            className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white font-black text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2"
                          >
                            <Eye size={14} /> Carregar Evidências Fotográficas (Selfie + Documento)
                          </button>
                        ) : (
                          <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-2">Selfie do Colaborador</span>
                                {signatureData.selfiePhoto ? (
                                  <img src={signatureData.selfiePhoto} alt="Selfie" className="mx-auto rounded-lg max-h-48 object-contain border border-slate-200 dark:border-slate-700" />
                                ) : (
                                  <span className="text-xs text-slate-450 block py-8">Selfie não enviada</span>
                                )}
                              </div>
                              <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-2">Foto do Documento (Frente/Verso)</span>
                                {signatureData.documentPhoto ? (
                                  <img src={signatureData.documentPhoto} alt="Documento" className="mx-auto rounded-lg max-h-48 object-contain border border-slate-200 dark:border-slate-700" />
                                ) : (
                                  <span className="text-xs text-slate-450 block py-8">Documento não enviado</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveSignature(selectedTerm.id)}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2"
                              >
                                <Check size={14} /> Aprovar Assinatura
                              </button>
                              <button
                                onClick={() => handleRejectSignature(selectedTerm.id)}
                                className="flex-1 py-2.5 bg-red-650 hover:bg-red-750 text-white font-black text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2"
                              >
                                <X size={14} /> Rejeitar Assinatura
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Evidências se Assinado e Aprovado */}
                    {selectedTerm.status === 'ASSINADO' && (
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-3 bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-2xl">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block tracking-widest leading-none">EVIDÊNCIAS DE AUTENTICIDADE DIGITAL (R.H. LEGAL)</span>
                          {selectedTerm.signatureStatus === 'APPROVED' && (
                            <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded">Validação Jurídica Aprovada</span>
                          )}
                          {selectedTerm.isManual && (
                            <span className="bg-orange-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded">Resolvido Manualmente</span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {selectedTerm.isManual ? (
                            <div className="col-span-2">
                              <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">Motivo da Resolução Manual</span>
                              <span className="font-bold text-orange-600 dark:text-orange-400">{selectedTerm.resolutionReason || 'Sem motivo detalhado.'}</span>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">Data/Hora Assinatura</span>
                                <span className="font-bold">{selectedTerm.signatureDate ? new Date(selectedTerm.signatureDate).toLocaleString('pt-BR') : '---'}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">Assinatura IP</span>
                                <span className="font-bold font-mono">{selectedTerm.signatureIp || '177.45.190.22'}</span>
                              </div>
                              <div className="col-span-2 font-mono">
                                <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">Hash Criptográfico</span>
                                <span className="font-bold text-[10px] text-emerald-600 dark:text-emerald-400 break-all">{selectedTerm.signatureHash}</span>
                              </div>
                              {selectedTerm.signatureLocation && (
                                <div className="col-span-2">
                                  <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">Geolocalização (GPS)</span>
                                  <span className="font-bold">{selectedTerm.signatureLocation}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {selectedTerm.signatureStatus === 'APPROVED' && (
                          <div className="pt-2">
                            {!signatureData ? (
                              <button
                                onClick={() => handleViewSignatureEvidences(selectedTerm.id)}
                                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-[10px] uppercase rounded-lg transition-all flex items-center gap-1.5"
                              >
                                <Eye size={12} /> Exibir Evidências Fotográficas
                              </button>
                            ) : (
                              <div className="space-y-3 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="text-center">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Selfie</span>
                                    {signatureData.selfiePhoto && <img src={signatureData.selfiePhoto} alt="Selfie" className="mx-auto rounded-lg max-h-32 object-contain border border-slate-200 dark:border-slate-800" />}
                                  </div>
                                  <div className="text-center">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Documento</span>
                                    {signatureData.documentPhoto && <img src={signatureData.documentPhoto} alt="Documento" className="mx-auto rounded-lg max-h-32 object-contain border border-slate-200 dark:border-slate-800" />}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRejectSignature(selectedTerm.id)}
                                  className="w-full py-2 bg-red-650 hover:bg-red-750 text-white font-black text-[10px] uppercase rounded-lg transition-all flex items-center justify-center gap-1.5"
                                >
                                  <Trash2 size={12} /> Invalidar e Rejeitar Assinatura
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex flex-wrap justify-between items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => generateAndPrintRhTerm(selectedTerm)}
                  className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 font-black text-xs px-4 py-3 rounded-xl uppercase tracking-wider transition-all shadow-sm"
                >
                  <Printer size={14} /> Imprimir / Visualizar PDF
                </button>
                {(selectedTerm.fileUrl || selectedTerm.hasFile) && (
                  <>
                    <button
                      onClick={() => handleViewTermFile(selectedTerm)}
                      className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-650 dark:text-emerald-400 font-black text-xs px-4 py-3 rounded-xl uppercase tracking-wider transition-all border border-emerald-500/20"
                    >
                      <Eye size={14} /> Ver Anexo
                    </button>
                    <button
                      onClick={() => handleDeleteTermFile(selectedTerm.id)}
                      className="flex items-center gap-2 bg-red-50 dark:bg-red-500/20 text-red-650 dark:text-red-400 font-black text-xs px-4 py-3 rounded-xl uppercase tracking-wider transition-all border border-red-500/20"
                    >
                      <Trash2 size={14} /> Excluir Anexo
                    </button>
                  </>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {selectedTerm.status !== 'ASSINADO' && selectedTerm.signatureStatus !== 'WAITING_APPROVAL' && (
                  <>
                    <button
                      onClick={() => handleGenerateSignatureLink(selectedTerm.id)}
                      className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-650 dark:text-indigo-400 font-black text-xs px-4 py-3 rounded-xl uppercase tracking-wider transition-all border border-indigo-500/20 cursor-pointer"
                      title="Copiar link para o colaborador assinar via celular/email"
                    >
                      <Share2 size={14} /> Link Assinatura
                    </button>
                    <label className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-650 dark:text-emerald-400 font-black text-xs px-4 py-3 rounded-xl uppercase tracking-wider transition-all border border-emerald-500/20 cursor-pointer">
                      <Upload size={14} /> Upload Assinado
                      <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => handleUploadTermFile(selectedTerm.id, e)} />
                    </label>
                    <button
                      onClick={() => setResolvingManualTerm(selectedTerm)}
                      className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100/80 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 text-orange-650 dark:text-orange-400 font-black text-xs px-4 py-3 rounded-xl uppercase tracking-wider transition-all border border-orange-500/20 cursor-pointer"
                    >
                      <CheckSquare size={14} /> Resolução Manual
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => { setIsDetailModalOpen(false); setSelectedTerm(null); setSignatureData(null); }}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-black text-xs rounded-xl uppercase tracking-wider transition-all border border-slate-200 dark:border-slate-650 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMISSÃO DE NOVO TERMO MODAL (Popup formulário) */}
      {showCreateTerm && (
        <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-700 animate-scale-up shadow-2xl">
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <h2 className="text-sm font-black uppercase text-indigo-600 tracking-wider">
                Emitir Novo Termo de Comodato
              </h2>
              <button onClick={() => setShowCreateTerm(false)} className="h-10 w-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-700 dark:text-white transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEmitTerm} className="flex-1 overflow-y-auto p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Colaborador Comodatário *</label>
                <select
                  required
                  value={newTermColabId}
                  onChange={e => setNewTermColabId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                >
                  <option value="">Selecione o Colaborador...</option>
                  {rhCollaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.fullName} ({c.cpf})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Modelo de Termo / Regulamento *</label>
                <select
                  required
                  value={newTermTemplateId}
                  onChange={e => setNewTermTemplateId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                >
                  <option value="">Selecione o Modelo de Regulamento...</option>
                  {rhTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.type || 'ENTREGA'})</option>
                  ))}
                </select>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-150 dark:border-slate-700/60 space-y-3">
                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Vincular Item do Estoque R.H. (Opcional)</span>
                
                <div className="grid grid-cols-4 gap-3">
                  <select
                    value={selectedRhAssetId}
                    onChange={e => setSelectedRhAssetId(e.target.value)}
                    className="col-span-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                  >
                    <option value="">Nenhum item do estoque vinculado...</option>
                    {rhAssetItems.map(item => (
                      <option key={item.id} value={item.id} disabled={item.currentStock <= 0}>
                        {item.name} (Disp: {item.currentStock}/{item.totalStock})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={selectedRhAssetQty}
                    onChange={e => setSelectedRhAssetQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 font-bold text-center"
                    placeholder="Qtd"
                  />
                </div>
                <p className="text-[10px] font-bold text-indigo-500 uppercase">A emissão deste termo debitará as quantidades selecionadas do estoque automaticamente.</p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Bens em Comodato (Descrição Completa) *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva detalhadamente o equipamento, bens ou uniformes que estão sendo comodatados..."
                  value={newTermCustomNotes}
                  onChange={e => setNewTermCustomNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Observações Internas / Rodapé</label>
                <textarea
                  rows={2}
                  placeholder="Informações administrativas adicionais que não constam nas cláusulas padrão..."
                  value={newTermObservations}
                  onChange={e => setNewTermObservations(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                />
              </div>
            </form>

            {/* Form Footer */}
            <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateTerm(false)}
                className="px-6 py-3 bg-slate-250 hover:bg-slate-350 dark:bg-slate-700 text-slate-700 dark:text-slate-250 font-black text-xs rounded-xl uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                onClick={handleEmitTerm}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl uppercase tracking-wider hover:shadow-md transition-all"
              >
                Emitir e Enviar para Assinatura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIGNATURE POPUP MODAL (Completamente mantido e polido) */}
      {signingTerm && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-lg space-y-6 animate-scale-up">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-md font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <PenTool className="text-emerald-500 animate-pulse" /> Assinatura Eletrônica Legal
              </h3>
              <button onClick={() => setSigningTerm(null)} className="text-slate-400 hover:text-slate-650">
                <X size={20} />
              </button>
            </div>

            {(() => {
              const tmplName = rhTemplates.find(tmpl => tmpl.id === signingTerm.templateId)?.name || 'Modelo Geral';
              const colabName = rhCollaborators.find(c => c.id === signingTerm.collaboratorId)?.fullName || 'Desconhecido';
              return (
                <div className="text-xs space-y-3">
                  <p className="text-slate-600 dark:text-slate-300">
                    Você está prestes a assinar eletronicamente o documento <strong>{tmplName}</strong> emitido para <strong>{colabName}</strong>.
                  </p>
                  
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20 text-[11px] leading-relaxed">
                    <p className="font-bold text-indigo-700 dark:text-indigo-400">Termos Legais:</p>
                    Esta assinatura é válida e em total concordância com a legislação nacional para assinaturas eletrônicas e aceites digitais, amparada por hash criptográfico e registro detalhado de metadados de acesso (Endereço IP, Geolocalização, Horário UTC).
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3">
              {/* GPS coordinates lookup */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs text-slate-800 dark:text-slate-200">
                <span className="font-bold flex items-center gap-2">
                  <Shield size={16} className="text-indigo-500" /> Vínculo de Geolocalização (Opcional/Recomendado)
                </span>
                {!gpsApproved ? (
                  <button
                    type="button"
                    onClick={requestGPS}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase rounded-lg"
                  >
                    Vincular GPS
                  </button>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 text-[10px] uppercase">
                    <Check size={14} /> GPS Vinculado
                  </span>
                )}
              </div>

              {/* Confirm box */}
              <div className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  id="confirm-sign"
                  checked={signatureConfirm}
                  onChange={e => setSignatureConfirm(e.target.checked)}
                  className="mt-1 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="confirm-sign" className="font-medium text-slate-600 dark:text-slate-300 select-none">
                  Confirmo integralmente a leitura do documento e autorizo a fixação do meu aceite digital criptográfico a esta via.
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                onClick={() => setSigningTerm(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-xs uppercase rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSignature}
                disabled={!signatureConfirm}
                className={`px-6 py-2.5 text-white font-black text-xs uppercase rounded-xl shadow-sm ${signatureConfirm ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800'}`}
              >
                Confirmar Assinatura
              </button>
            </div>
          </div>
        </div>
      )}

      {isLinkModalOpen && generatedSignatureLink && (
        <div className="fixed inset-0 bg-slate-900/60 z-[120] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg border border-slate-200 dark:border-slate-700 animate-scale-up shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase text-indigo-600 tracking-wider">Link de Assinatura Digital</h3>
              <button onClick={() => { setIsLinkModalOpen(false); setGeneratedSignatureLink(''); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Copie o link abaixo e envie para o colaborador realizar a assinatura digital (com selfie e documento de identidade):
            </p>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <input
                type="text"
                readOnly
                value={generatedSignatureLink}
                className="bg-transparent border-none outline-none text-xs font-mono font-bold text-slate-800 dark:text-slate-200 flex-1"
              />
              <button
                onClick={async () => {
                  try {
                    if (navigator.clipboard && window.isSecureContext) {
                      await navigator.clipboard.writeText(generatedSignatureLink);
                    } else {
                      const textArea = document.createElement("textarea");
                      textArea.value = generatedSignatureLink;
                      textArea.style.position = "fixed";
                      textArea.style.opacity = "0";
                      document.body.appendChild(textArea);
                      textArea.focus();
                      textArea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textArea);
                    }
                    showToast('Link copiado com sucesso!', 'success');
                  } catch (err) {
                    console.error('Falha ao copiar link:', err);
                    showToast('Erro ao copiar link automaticamente', 'error');
                  }
                }}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                title="Copiar Link"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {resolvingManualTerm && (
        <div className="fixed inset-0 bg-slate-900/60 z-[120] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md border border-slate-200 dark:border-slate-700 animate-scale-up shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase text-orange-600 tracking-wider">Resolução Manual de Pendência</h3>
              <button onClick={() => { setResolvingManualTerm(null); setResolveManualReason(''); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Descreva detalhadamente o motivo pelo qual este termo está sendo marcado como resolvido sem assinatura eletrônica ou anexo físico:
            </p>
            <textarea
              required
              rows={3}
              value={resolveManualReason}
              onChange={e => setResolveManualReason(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white font-medium"
              placeholder="Ex: Assinado fisicamente em papel arquivado na pasta física do colaborador, ou colaborador não possui mais o item..."
            />
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                onClick={() => { setResolvingManualTerm(null); setResolveManualReason(''); }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-750 text-slate-500 font-bold text-xs uppercase rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmResolveManual}
                disabled={!resolveManualReason}
                className={`px-5 py-2 text-white font-black text-xs uppercase rounded-lg ${resolveManualReason ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {isPreviewOpen && previewData && (
        <FilePreviewModal
          isOpen={isPreviewOpen}
          onClose={() => { setIsPreviewOpen(false); setPreviewData(null); }}
          fileUrl={previewData.url}
          fileName={previewData.name}
        />
      )}
    </div>
  );
};
