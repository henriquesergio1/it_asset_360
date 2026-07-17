import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { RhCollaborator, RhDocument, RhOccurrence, RhTerm } from '../types';
import { DataTable, Column } from './DataTable';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';
import { 
  Search, Plus, Edit2, Trash2, Eye, EyeOff, MapPin, FileText, 
  Upload, Calendar, ArrowLeft, ArrowRight, UserPlus, UserMinus, Info, 
  Check, X, Loader2, Download, ChevronLeft, ChevronRight, Briefcase,
  SlidersHorizontal, AlertTriangle, Copy, Printer, ExternalLink, Map,
  FileSignature, RefreshCw, Share2, Camera, CheckSquare, History, User as UserIcon
} from 'lucide-react';
import FilePreviewModal from './FilePreviewModal';
import { 
  normalizeName, validateCPF, validateEmail, validatePhone, validateCEP,
  formatCPF, formatPhone, formatCEP, cleanDocument 
} from '../utils/rhValidation';

const COLUMN_OPTIONS = [
  { id: 'fullName', label: 'Nome Completo' },
  { id: 'cpf', label: 'CPF' },
  { id: 'role', label: 'Cargo / Função' },
  { id: 'sectorId', label: 'Setor' },
  { id: 'contractType', label: 'Contrato' },
  { id: 'hireDate', label: 'Admissão' },
  { id: 'salary', label: 'Salário' },
  { id: 'docs', label: 'Anexos' }
];

export const RhCollaboratorManager: React.FC = () => {
  const { 
    rhCollaborators, 
    sectors, 
    addRhCollaborator, 
    updateRhCollaborator, 
    deleteRhCollaborator, 
    rhOccurrences, 
    addRhOccurrence, 
    deleteRhOccurrence,
    rhTerms,
    rhTemplates,
    settings,
    getTermFile,
    updateTermFile,
    deleteTermFile,
    generateSignatureToken,
    resolveTermManual,
    fetchData,
    isReadOnly,
    logs
  } = useData();
  const { user } = useAuth();
  const { showToast } = useToast();
  const adminName = user?.name || 'Gestor R.H.';

  // Estados locais para controle de Termos de Comodato do RH
  const [previewData, setPreviewData] = useState<{ url: any; name: string } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<any>(null);
  const [generatedSignatureLink, setGeneratedSignatureLink] = useState<string | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [resolvingManualTerm, setResolvingManualTerm] = useState<RhTerm | null>(null);
  const [resolveManualReason, setResolveManualReason] = useState('');

  // Estados para trava de alteração cadastral obrigatória com justificativa
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [editReasonText, setEditReasonText] = useState('');
  const [pendingSaveData, setPendingSaveData] = useState<RhCollaborator | null>(null);

  // Search/Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [filterContractType, setFilterContractType] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Ativo' | 'Demitido' | 'Todos'>('Ativo');

  // Modals & Selection
  const [selectedColab, setSelectedColab] = useState<RhCollaborator | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [revealSalaries, setRevealSalaries] = useState<Record<string, boolean>>({});
  const [cepLoading, setCepLoading] = useState(false);

  // Tabs for creating/editing collaborator modal
  const [activeTab, setActiveTab] = useState<'cadastro' | 'documentos' | 'ocorrencias'>('cadastro');

  // Tabs for viewing collaborator detail modal
  const [detailTab, setDetailTab] = useState<'cadastro' | 'documentos' | 'ocorrencias'>('cadastro');

  // --- Funções de Auditoria e Trava de Edição de Cadastro ---
  const handleConfirmEditReason = () => {
    if (!pendingSaveData || !editReasonText.trim()) return;
    
    const finalData = {
      ...pendingSaveData,
      _notes: editReasonText.trim(),
      _adminUser: adminName
    };
    
    updateRhCollaborator(finalData, adminName);
    setSelectedColab(finalData);
    setIsReasonModalOpen(false);
    setPendingSaveData(null);
    setEditReasonText('');
    setIsEditing(false);
  };

  // --- Funções de Gestão de Termos de Comodato do RH ---
  const handleUploadTermFile = (termId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileUrl = event.target?.result as string;
        updateTermFile(termId, '', fileUrl, adminName);
        showToast('Termo assinado enviado com sucesso', 'success');
        fetchData(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteTermFile = async (termId: string) => {
    if (window.confirm("Deseja realmente excluir o anexo deste termo?")) {
      try {
        await deleteTermFile(termId, '', 'Remoção do anexo pelo gestor', adminName);
        showToast('Anexo removido do termo', 'success');
        fetchData(true);
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
      setResolvingManualTerm(null);
      setResolveManualReason('');
      fetchData(true);
    } catch (err) {
      showToast('Erro ao resolver termo', 'error');
    }
  };

  const handleApproveSignature = async (termId: string) => {
    try {
      const res = await fetch(`/api/rh-terms/${termId}/approve-signature`, { method: 'POST' });
      if (res.ok) {
        showToast('Assinatura aprovada com sucesso', 'success');
        fetchData(true);
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
          fetchData(true);
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

    let processedDeclaration = term.snapshotDeclaration || template.declaration || (template.type === 'DEVOLUCAO' ? 'Declaro ter devolvido os itens abaixo na presente data.' : 'Declaro ter recebido os itens abaixo em perfeitas condições de uso.');
    let processedContent = term.snapshotClauses || template.content || '';

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

  // Column Selector
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('rh_collaborator_columns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return ['fullName', 'cpf', 'role', 'sectorId', 'contractType', 'hireDate', 'salary', 'docs'];
  });

  const columnRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    localStorage.setItem('rh_collaborator_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) {
        setIsColumnSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (id: string) => {
    setVisibleColumns(prev => {
      if (prev.includes(id)) {
        if (prev.length > 1) {
          return prev.filter(c => c !== id);
        }
        return prev;
      }
      return [...prev, id];
    });
  };

  // Dismiss Flow
  const [isDismissModalOpen, setIsDismissModalOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState('Demissão sem Justa Causa');
  const [dismissCustomNote, setDismissCustomNote] = useState('');
  const [confirmDismissWithPending, setConfirmDismissWithPending] = useState(false);

  // Quick Occurrence form states
  const [quickOccType, setQuickOccType] = useState<string>('Atestado Médico');
  const [quickOccStart, setQuickOccStart] = useState('');
  const [quickOccEnd, setQuickOccEnd] = useState('');
  const [quickOccNotes, setQuickOccNotes] = useState('');

  // Photo states & handlers
  const [isExpandedPhotoOpen, setIsExpandedPhotoOpen] = useState(false);
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const photoBase64 = event.target?.result as string;
        setForm(p => ({ ...p, photo: photoBase64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Form State
  const [form, setForm] = useState<Partial<RhCollaborator>>({
    fullName: '',
    birthDate: '',
    gender: 'Masculino',
    maritalStatus: 'Solteiro',
    motherName: '',
    fatherName: '',
    personalPhone: '',
    corporatePhone: '',
    emailPersonal: '',
    emailCorporate: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    rg: '',
    cpf: '',
    pis: '',
    electorTitle: '',
    ctps: '',
    cnhNumber: '',
    cnhCategory: '',
    cnhExpiration: '',
    role: '',
    sectorId: '',
    contractType: 'CLT',
    hireDate: '',
    salary: 0,
    weeklyHours: 44,
    documents: [],
    photo: ''
  });

  // Attachments temp state
  const [docCategory, setDocCategory] = useState<'RG' | 'CPF' | 'Comprovante de Residência' | 'Contrato de Trabalho' | 'Outros'>('RG');
  const [docFileName, setDocFileName] = useState('');

  // Cep Lookup
  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(p => ({
          ...p,
          cep: e.target.value,
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações básicas
    if (!form.fullName || !form.cpf || !form.sectorId) {
      alert('Nome Completo, CPF e Setor são obrigatórios.');
      return;
    }

    if (!validateCPF(form.cpf)) {
      alert('CPF inválido. Por favor, verifique o número informado.');
      return;
    }

    if (form.emailPersonal && !validateEmail(form.emailPersonal)) {
      alert('E-mail pessoal inválido.');
      return;
    }

    if (form.emailCorporate && !validateEmail(form.emailCorporate)) {
      alert('E-mail corporativo inválido.');
      return;
    }

    if (form.personalPhone && !validatePhone(form.personalPhone)) {
      alert('Telefone pessoal deve ter pelo menos 10 dígitos.');
      return;
    }

    if (form.cep && !validateCEP(form.cep)) {
      alert('CEP deve ter 8 dígitos.');
      return;
    }

    // Normalização de dados
    const normalizedForm = {
      ...form,
      fullName: normalizeName(form.fullName || ''),
      motherName: normalizeName(form.motherName || ''),
      fatherName: normalizeName(form.fatherName || ''),
      street: normalizeName(form.street || ''),
      neighborhood: normalizeName(form.neighborhood || ''),
      city: normalizeName(form.city || ''),
      role: normalizeName(form.role || ''),
      emailPersonal: (form.emailPersonal || '').trim().toLowerCase(),
      emailCorporate: (form.emailCorporate || '').trim().toLowerCase(),
      cpf: cleanDocument(form.cpf || ''),
      rg: cleanDocument(form.rg || ''),
      pis: cleanDocument(form.pis || ''),
      cep: cleanDocument(form.cep || ''),
      personalPhone: cleanDocument(form.personalPhone || ''),
      corporatePhone: cleanDocument(form.corporatePhone || ''),
      status: form.status || 'Ativo'
    };

    // Trava de duplicidade de documentos (apenas para criação ou se mudou o documento)
    const checkDuplicate = (docType: 'cpf' | 'rg' | 'pis', value: string) => {
      if (!value) return false;
      return rhCollaborators.some(c => 
        c.id !== selectedColab?.id && 
        cleanDocument(c[docType] || '') === value
      );
    };

    if (checkDuplicate('cpf', normalizedForm.cpf)) {
      alert(`Já existe um colaborador cadastrado com este CPF (${formatCPF(normalizedForm.cpf)}).`);
      return;
    }

    if (normalizedForm.rg && checkDuplicate('rg', normalizedForm.rg)) {
      alert(`Já existe um colaborador cadastrado com este RG (${normalizedForm.rg}).`);
      return;
    }

    if (normalizedForm.pis && checkDuplicate('pis', normalizedForm.pis)) {
      alert(`Já existe um colaborador cadastrado com este PIS (${normalizedForm.pis}).`);
      return;
    }

    if (isCreating) {
      const newColab: RhCollaborator = {
        ...(normalizedForm as RhCollaborator),
        id: 'colab-' + Math.random().toString(36).substr(2, 9),
        documents: form.documents || []
      };
      addRhCollaborator(newColab, adminName);
      setSelectedColab(newColab);
      setIsCreating(false);
      setIsEditing(false);
    } else if (isEditing && selectedColab) {
      const updated: RhCollaborator = {
        ...selectedColab,
        ...(normalizedForm as RhCollaborator)
      };
      setPendingSaveData(updated);
      setEditReasonText('');
      setIsReasonModalOpen(true);
    }
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFileName) return;

    const newDoc: RhDocument = {
      id: 'doc-' + Math.random().toString(36).substr(2, 9),
      category: docCategory,
      fileName: docFileName,
      fileUrl: 'mock_doc_url_' + Math.random().toString(36).substr(2, 5),
      uploadDate: new Date().toISOString().split('T')[0]
    };

    const updatedDocs = [...(form.documents || []), newDoc];
    setForm(p => ({ ...p, documents: updatedDocs }));
    if (selectedColab && isEditing) {
      const updatedColab = { ...selectedColab, documents: updatedDocs };
      updateRhCollaborator(updatedColab, adminName);
      setSelectedColab(updatedColab);
    }

    setDocFileName('');
  };

  const handleDeleteDoc = (docId: string) => {
    const updatedDocs = (form.documents || []).filter(d => d.id !== docId);
    setForm(p => ({ ...p, documents: updatedDocs }));
    if (selectedColab && isEditing) {
      const updatedColab = { ...selectedColab, documents: updatedDocs };
      updateRhCollaborator(updatedColab, adminName);
      setSelectedColab(updatedColab);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza de que deseja remover este colaborador de R.H.?')) {
      deleteRhCollaborator(id, adminName);
      setSelectedColab(null);
      setIsDetailModalOpen(false);
    }
  };

  const toggleSalary = (colabId: string) => {
    setRevealSalaries(p => ({ ...p, [colabId]: !p[colabId] }));
  };

  const handleDismissColab = () => {
    if (!selectedColab) return;
    
    const updatedColab: RhCollaborator = {
      ...selectedColab,
      terminationDate: new Date().toISOString().split('T')[0],
      terminationReason: `${dismissReason}${dismissCustomNote ? ` - ${dismissCustomNote}` : ''}`,
      status: 'Demitido'
    };

    updateRhCollaborator(updatedColab, adminName);
    setSelectedColab(updatedColab);
    setIsDismissModalOpen(false);
    setIsDetailModalOpen(false);
  };

  // Filter Logic
  const filtered = rhCollaborators.filter(c => {
    const matchesSearch = c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || c.cpf.includes(searchTerm);
    const matchesSector = !filterSector || c.sectorId === filterSector;
    const matchesContract = !filterContractType || c.contractType === filterContractType;
    
    const isColabDemitido = !!c.terminationDate || c.status === 'Demitido';
    let matchesStatus = true;
    if (filterStatus === 'Ativo') {
      matchesStatus = !isColabDemitido;
    } else if (filterStatus === 'Demitido') {
      matchesStatus = isColabDemitido;
    }
    
    return matchesSearch && matchesSector && matchesContract && matchesStatus;
  });

  // Table Configuration (Sorting, Resize, Pagination)
  const columns: Column<RhCollaborator>[] = [
    ...(visibleColumns.includes('fullName') ? [{ key: 'fullName', label: 'Nome Completo', sortable: true } as Column<RhCollaborator>] : []),
    ...(visibleColumns.includes('cpf') ? [{ key: 'cpf', label: 'CPF', sortable: true } as Column<RhCollaborator>] : []),
    ...(visibleColumns.includes('role') ? [{ key: 'role', label: 'Cargo / Função', sortable: true } as Column<RhCollaborator>] : []),
    ...(visibleColumns.includes('sectorId') ? [{ key: 'sectorId', label: 'Setor', sortable: true } as Column<RhCollaborator>] : []),
    ...(visibleColumns.includes('contractType') ? [{ key: 'contractType', label: 'Contrato', sortable: true } as Column<RhCollaborator>] : []),
    ...(visibleColumns.includes('hireDate') ? [{ key: 'hireDate', label: 'Admissão', sortable: true } as Column<RhCollaborator>] : []),
    ...(visibleColumns.includes('salary') ? [{ key: 'salary', label: 'Salário', sortable: true } as Column<RhCollaborator>] : []),
    ...(visibleColumns.includes('docs') ? [{ key: 'docs', label: 'Anexos', sortable: false } as Column<RhCollaborator>] : [])
  ];

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    fullName: 240,
    cpf: 130,
    role: 160,
    sectorId: 130,
    contractType: 100,
    hireDate: 110,
    salary: 130,
    docs: 80
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
    
    let aVal: any = a[key as keyof RhCollaborator];
    let bVal: any = b[key as keyof RhCollaborator];

    if (key === 'sectorId') {
      aVal = sectors.find(s => s.id === a.sectorId)?.name || '';
      bVal = sectors.find(s => s.id === b.sectorId)?.name || '';
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
    const exportData = filtered.map(c => ({
      'Nome Completo': c.fullName,
      'Data de Nascimento': c.birthDate || '',
      'Gênero': c.gender || '',
      'Estado Civil': c.maritalStatus || '',
      'Telefone Pessoal': c.personalPhone || '',
      'Telefone Corporativo': c.corporatePhone || '',
      'E-mail Pessoal': c.emailPersonal || '',
      'E-mail Corporativo': c.emailCorporate || '',
      'CPF': c.cpf,
      'RG': c.rg || '',
      'Cargo': c.role || '',
      'Tipo de Contrato': c.contractType,
      'Data de Admissão': c.hireDate || '',
      'Salário Mensal': c.salary || 0,
      'Carga Horária Semanal': c.weeklyHours || 44
    }));
    exportToCSV(exportData, 'colaboradores_rh');
  };

  const handleExportExcel = () => {
    const exportData = filtered.map(c => ({
      'Nome Completo': c.fullName,
      'Data de Nascimento': c.birthDate || '',
      'Gênero': c.gender || '',
      'Estado Civil': c.maritalStatus || '',
      'Telefone Pessoal': c.personalPhone || '',
      'Telefone Corporativo': c.corporatePhone || '',
      'E-mail Pessoal': c.emailPersonal || '',
      'E-mail Corporativo': c.emailCorporate || '',
      'CPF': c.cpf,
      'RG': c.rg || '',
      'Cargo': c.role || '',
      'Tipo de Contrato': c.contractType,
      'Data de Admissão': c.hireDate || '',
      'Salário Mensal': c.salary || 0,
      'Carga Horária Semanal': c.weeklyHours || 44
    }));
    exportToExcel(exportData, 'colaboradores_rh');
  };

  const handleExportPDF = () => {
    const headers = ['Nome Completo', 'CPF', 'Cargo', 'Contrato', 'Admissão', 'Salário'];
    const exportData = filtered.map(c => [
      c.fullName,
      c.cpf,
      c.role || 'S/ Cargo',
      c.contractType,
      c.hireDate ? new Date(c.hireDate).toLocaleDateString('pt-BR') : '',
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.salary || 0)
    ]);
    exportToPDF(headers, exportData, 'colaboradores_rh', 'Relatório de Colaboradores de R.H.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 id="rh-collaborators-title" className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">CADASTRO DE COLABORADORES (R.H.)</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gestão integral de dados pessoais, contratos e documentos regulamentares</p>
        </div>
        <button
          onClick={() => {
            setForm({
              fullName: '', birthDate: '', gender: 'Masculino', maritalStatus: 'Solteiro',
              motherName: '', fatherName: '', personalPhone: '', corporatePhone: '',
              emailPersonal: '', emailCorporate: '', cep: '', street: '', number: '',
              complement: '', neighborhood: '', city: '', state: '', rg: '', cpf: '',
              pis: '', electorTitle: '', ctps: '', cnhNumber: '', cnhCategory: '',
              cnhExpiration: '', role: '', sectorId: '', contractType: 'CLT',
              hireDate: '', salary: 0, weeklyHours: 44, documents: []
            });
            setIsCreating(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow-md transition-all uppercase tracking-wider"
        >
          <Plus size={16} /> Adicionar Colaborador
        </button>
      </div>

      {/* Filter Toolbar (Top Style similar to IT Module) */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value as any); setCurrentPage(1); }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="Ativo">Apenas Ativos</option>
            <option value="Demitido">Apenas Demitidos</option>
            <option value="Todos">Todos os Status</option>
          </select>

          {/* Sector Filter */}
          <select
            value={filterSector}
            onChange={e => { setFilterSector(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="">Todos os Setores</option>
            {sectors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Contract Type Filter */}
          <select
            value={filterContractType}
            onChange={e => { setFilterContractType(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="">Todos os Contratos</option>
            <option value="CLT">CLT</option>
            <option value="PJ">PJ</option>
            <option value="Estágio">Estágio</option>
            <option value="Cooperado">Cooperado</option>
          </select>

          {/* Column Selector */}
          <div className={`relative shrink-0 ${isColumnSelectorOpen ? 'z-[9999]' : 'z-[10]'}`} ref={columnRef}>
            <button
              type="button"
              onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 font-extrabold text-[10px] uppercase tracking-widest transition-all shadow-inner border-b-4 border-b-slate-800 active:border-b-0 active:translate-y-[2px] whitespace-nowrap"
            >
              <SlidersHorizontal size={14} /> Colunas
            </button>
            {isColumnSelectorOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-2xl z-[500] overflow-hidden animate-fade-in shadow-2xl ring-1 ring-white/5">
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-widest">Personalizar Visão</span>
                  <button
                    type="button"
                    onClick={() => setIsColumnSelectorOpen(false)}
                    className="hover:text-slate-900 dark:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="p-2 space-y-1 bg-white dark:bg-slate-800/50">
                  {COLUMN_OPTIONS.map(col => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => toggleColumn(col.id)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        visibleColumns.includes(col.id)
                          ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {col.label}
                      {visibleColumns.includes(col.id) && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Exports Dropdown / Quick Buttons */}
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
          emptyMessage="Nenhum colaborador encontrado com os filtros atuais."
          renderRow={(c) => {
            const sectorName = sectors.find(s => s.id === c.sectorId)?.name || 'Sem Setor';
            const isColabDemitido = !!c.terminationDate || c.status === 'Demitido';
            return (
              <tr
                key={c.id}
                onClick={() => {
                  setSelectedColab(c);
                  setForm(c);
                  setDetailTab('cadastro');
                  setIsDetailModalOpen(true);
                }}
                className={`border-b border-slate-200 dark:border-slate-700/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/30 cursor-pointer transition-all text-xs ${isColabDemitido ? 'bg-rose-50/10 text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-200'}`}
              >
                {visibleColumns.includes('fullName') && (
                  <td className="px-6 py-4 font-black">
                    <div className="flex items-center gap-4">
                      {c.photo ? (
                        <img 
                          src={c.photo} 
                          alt={c.fullName} 
                          className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700 hover:scale-105 transition-all shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0 border border-slate-200 dark:border-slate-700">
                          {c.fullName.charAt(0)}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className={isColabDemitido ? "text-slate-400 line-through" : ""}>{c.fullName}</span>
                        {isColabDemitido && (
                          <span className="text-[9px] font-black tracking-wider uppercase text-rose-500 mt-1 flex items-center gap-1">
                            <AlertTriangle size={10} /> Demitido em {c.terminationDate ? new Date(c.terminationDate).toLocaleDateString('pt-BR') : '---'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                )}
                {visibleColumns.includes('cpf') && <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{formatCPF(c.cpf)}</td>}
                {visibleColumns.includes('role') && <td className="px-6 py-4 font-bold">{c.role || 'Sem Cargo'}</td>}
                {visibleColumns.includes('sectorId') && <td className="px-6 py-4 text-slate-500">{sectorName}</td>}
                {visibleColumns.includes('contractType') && (
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900 rounded font-black text-[10px] tracking-wide uppercase">{c.contractType}</span>
                  </td>
                )}
                {visibleColumns.includes('hireDate') && <td className="px-6 py-4 text-slate-500">{c.hireDate ? new Date(c.hireDate).toLocaleDateString('pt-BR') : '---'}</td>}
                {visibleColumns.includes('salary') && (
                  <td className="px-6 py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {revealSalaries[c.id] 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.salary || 0)
                      : 'R$ •••••••'
                    }
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSalary(c.id); }}
                      className="ml-2 p-1 bg-slate-50 dark:bg-slate-900/40 rounded hover:bg-slate-200 inline-flex items-center justify-center align-middle"
                    >
                      {revealSalaries[c.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </td>
                )}
                {visibleColumns.includes('docs') && (
                  <td className="px-6 py-4 text-center">
                    {c.documents && c.documents.length > 0 ? (
                      <span className="bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/20">{c.documents.length} docs</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                )}
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
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total: {totalItems} colaboradores</p>
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

      {/* DETAIL MODAL (Sophisticated popup style same as IT module details) */}
      {isDetailModalOpen && selectedColab && !isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700 animate-scale-up">
            <div className="px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <div className="flex items-center gap-3">
                {selectedColab.photo ? (
                  <img 
                    src={selectedColab.photo} 
                    alt={selectedColab.fullName} 
                    className="w-10 h-10 rounded-full object-cover border border-slate-350 dark:border-slate-650 hover:scale-105 transition-all shadow-md shrink-0 cursor-pointer"
                    onClick={() => setIsExpandedPhotoOpen(true)}
                    title="Clique para expandir"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200 dark:border-slate-700">
                    {selectedColab.fullName.charAt(0)}
                  </div>
                )}
                <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-black rounded uppercase tracking-wider">{selectedColab.contractType}</span>
                <div className="flex flex-col">
                  <h2 className="text-md font-black text-slate-900 dark:text-white leading-none">{selectedColab.fullName}</h2>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedColab.role || 'Sem Cargo'}</span>
                </div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="h-10 w-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-700 dark:text-white transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Tabs Control */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20 px-8 shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none">
              <button
                type="button"
                onClick={() => setDetailTab('cadastro')}
                className={`py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all -mb-[1px] whitespace-nowrap ${
                  detailTab === 'cadastro'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                1. Cadastro
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('documentos')}
                className={`py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all -mb-[1px] whitespace-nowrap ${
                  detailTab === 'documentos'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                2. Documentos & Termos
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('ocorrencias')}
                className={`py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all -mb-[1px] whitespace-nowrap ${
                  detailTab === 'ocorrencias'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                3. Faltas / Férias / Atestados
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('historico')}
                className={`py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all -mb-[1px] whitespace-nowrap flex items-center gap-1.5 ${
                  detailTab === 'historico'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <History size={12} />
                4. Histórico
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {detailTab === 'cadastro' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Bloco 1 */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest border-b border-slate-100 dark:border-slate-700/40 pb-2">1. Dados Pessoais e Contato</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Nascimento</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.birthDate ? new Date(selectedColab.birthDate).toLocaleDateString('pt-BR') : '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Gênero</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.gender || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Estado Civil</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.maritalStatus || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Mãe</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.motherName || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Pai</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.fatherName || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">E-mail Corporativo</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block" title={selectedColab.emailCorporate}>{selectedColab.emailCorporate || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">E-mail Pessoal</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block" title={selectedColab.emailPersonal}>{selectedColab.emailPersonal || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Tel. Corporativo</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{selectedColab.corporatePhone ? formatPhone(selectedColab.corporatePhone) : '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Tel. Pessoal</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{selectedColab.personalPhone ? formatPhone(selectedColab.personalPhone) : '---'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2 */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest border-b border-slate-100 dark:border-slate-700/40 pb-2">2. Documentação Regulamentar</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">CPF</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{formatCPF(selectedColab.cpf)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">RG</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.rg || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">PIS</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.pis || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">CTPS</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.ctps || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Título de Eleitor</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.electorTitle || '---'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">CNH</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-sans">
                          {selectedColab.cnhNumber ? `${selectedColab.cnhNumber} (Cat: ${selectedColab.cnhCategory || ''}) - Vence em ${selectedColab.cnhExpiration ? new Date(selectedColab.cnhExpiration).toLocaleDateString('pt-BR') : ''}` : 'Não cadastrada'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 3 */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest border-b border-slate-100 dark:border-slate-700/40 pb-2">3. Endereço Residencial</h3>
                    <div className="text-xs space-y-2 flex items-start gap-3">
                      <MapPin size={20} className="text-slate-400 mt-1 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                            {selectedColab.street || 'Endereço não cadastrado'}, nº {selectedColab.number || 'S/N'}
                            {selectedColab.complement && ` - ${selectedColab.complement}`}
                          </span>
                          {selectedColab.street && (
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${selectedColab.street || ''}, ${selectedColab.number || ''}, ${selectedColab.neighborhood || ''}, ${selectedColab.city || ''} - ${selectedColab.state || ''}, ${selectedColab.cep || ''}`
                              )}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 shrink-0"
                              title="Abrir no Google Maps"
                            >
                              <Map size={14} />
                            </a>
                          )}
                        </div>
                        <span className="text-slate-400 block text-[10px] font-bold">
                          {selectedColab.neighborhood || ''} • {selectedColab.city || ''} - {selectedColab.state || ''}
                        </span>
                        <span className="text-slate-400 block text-[10px] font-mono">CEP: {selectedColab.cep ? formatCEP(selectedColab.cep) : '---'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 4 */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest border-b border-slate-100 dark:border-slate-700/40 pb-2">4. Cargo e Remuneração</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Data de Admissão</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.hireDate ? new Date(selectedColab.hireDate).toLocaleDateString('pt-BR') : '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Jornada Semanal</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.weeklyHours || 44}h semanais</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Setor</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{sectors.find(s => s.id === selectedColab.sectorId)?.name || 'Sem Setor'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Tipo de Contrato</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.contractType || '---'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Salário Mensal</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono font-bold text-md text-emerald-600 dark:text-emerald-400">
                            {revealSalaries[selectedColab.id] 
                              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedColab.salary || 0)
                              : 'R$ •••••••'
                            }
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleSalary(selectedColab.id)}
                            className="p-1 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200"
                          >
                            {revealSalaries[selectedColab.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'documentos' && (
                <div className="space-y-8">
                  {/* Bloco 5: Documentos */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest border-b border-slate-100 dark:border-slate-700/40 pb-2">Documentos Anexados</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedColab.documents && selectedColab.documents.length > 0 ? (
                        selectedColab.documents.map((doc, i) => (
                          <div key={doc.id || i} className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-700/60 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 rounded-lg shrink-0">
                                <FileText size={16} />
                              </div>
                              <div>
                                <span className="block font-bold text-xs text-slate-800 dark:text-white leading-none">{doc.fileName}</span>
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{doc.category} • Anexado em {new Date(doc.uploadDate).toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer">Visualizar</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 py-4 col-span-2">Nenhum documento regulamentar anexado.</p>
                      )}
                    </div>
                  </div>

                  {/* Termos de Comodato vinculados */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-150 dark:border-slate-700/60 space-y-4">
                    <span className="block text-xs font-black uppercase text-indigo-500 tracking-widest border-b border-slate-100 dark:border-slate-700/40 pb-2">Termos de Comodato Vinculados</span>
                    {(() => {
                      const colabTerms = rhTerms.filter(t => t.collaboratorId === selectedColab.id);
                      if (colabTerms.length === 0) {
                        return <div className="text-slate-400 py-6 text-center font-medium text-xs">Nenhum termo de comodato (entrega/devolução) gerado para este colaborador.</div>;
                      }
                      return (
                        <div className="grid grid-cols-1 gap-3">
                          {colabTerms.map(t => {
                            const isDevolucao = t.type === 'DEVOLUCAO';
                            return (
                              <div key={t.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between group hover:border-indigo-500/40 transition-all">
                                <div className="flex items-center gap-4">
                                  <div className="h-12 w-12 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                    {t.type === 'ENTREGA' ? <FileSignature className="text-indigo-600 dark:text-indigo-400" size={24} /> : <RefreshCw className="text-blue-600 dark:text-sky-400" size={24} />}
                                  </div>
                                  <div>
                                    <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">{t.type === 'ENTREGA' ? 'Termo de Entrega' : 'Termo de Devolução'}</div>
                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex flex-col gap-0.5 mt-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-indigo-500/80">EMITIDO EM: {new Date(t.date).toLocaleDateString('pt-BR')}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-600 dark:text-slate-400 font-medium max-w-sm truncate" title={t.assetDetails}>
                                        {t.assetDetails || '---'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-lg ${
                                      t.isManual 
                                        ? 'bg-orange-600 text-white shadow-orange-500/20' 
                                        : (t.fileUrl || t.hasFile || (t.signatureDate && t.signatureStatus === 'APPROVED')) 
                                          ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                                          : t.signatureStatus === 'WAITING_APPROVAL'
                                            ? 'bg-blue-600 text-white animate-pulse shadow-blue-500/20'
                                            : 'bg-orange-600 text-white shadow-orange-500/20'
                                    }`} title={t.isManual ? `Resolvido Manualmente: ${t.resolutionReason || 'Sem motivo'}` : ''}>
                                      {t.isManual ? 'Manual' : (t.fileUrl || t.hasFile || (t.signatureDate && t.signatureStatus === 'APPROVED') ? 'Assinado' : (t.signatureStatus === 'WAITING_APPROVAL' ? 'Validar' : 'Pendente'))}
                                    </span>
                                    {t.isManual && (
                                      <div className="text-[9px] font-bold text-orange-500/70 mt-0.5 uppercase tracking-tighter">Resolução Manual</div>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    {!!(t.fileUrl || t.hasFile || t.signatureDate) && (
                                      <button 
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewTermFile(t); }}
                                        className="p-2 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:text-emerald-350 dark:hover:text-emerald-300 transition-all border border-emerald-900/40"
                                        title={!!(t.fileUrl || t.hasFile) ? "Visualizar Arquivo Assinado" : "Visualizar Comprovante Digital"}
                                      >
                                        <Eye size={16} />
                                      </button>
                                    )}

                                    {!(t.fileUrl || t.hasFile) && !t.signatureDate && (
                                      <div className="flex gap-2">
                                        <button 
                                          type="button"
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); generateAndPrintRhTerm(t); }}
                                          className="p-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:text-slate-900 dark:text-white transition-all border border-slate-200 dark:border-slate-700"
                                          title="Gerar Termo"
                                        >
                                          <Download size={16} />
                                        </button>

                                        <button 
                                          type="button"
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleGenerateSignatureLink(t.id); }}
                                          className="p-2 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:text-indigo-300 transition-all border border-indigo-350 dark:border-indigo-700/40"
                                          title="Gerar Link de Assinatura"
                                        >
                                          <Share2 size={16} />
                                        </button>
                                      </div>
                                    )}

                                    {t.signatureDate && t.signatureStatus !== 'APPROVED' && (
                                      <div className="flex gap-2">
                                        <button 
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); handleApproveSignature(t.id); }}
                                          className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider border border-emerald-350 dark:border-emerald-700/30"
                                          title="Aprovar Assinatura"
                                        >
                                          <Check size={12} />
                                          Aprovar
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); handleRejectSignature(t.id); }}
                                          className="p-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider border border-rose-350 dark:border-rose-700/30"
                                          title="Rejeitar Assinatura"
                                        >
                                          <X size={12} />
                                          Rejeitar
                                        </button>
                                      </div>
                                    )}

                                    {!!(t.hasSignaturePhoto || t.hasSignatureSelfiePhoto) && (
                                      <div className="flex gap-2">
                                        <button 
                                          type="button"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await handleViewSignatureEvidences(t.id);
                                          }}
                                          className="p-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5"
                                          title="Ver Evidências de Identidade (Doc + Selfie)"
                                        >
                                          <Camera size={14} className="text-indigo-650 dark:text-indigo-400" />
                                          <span className="text-[9px] font-black uppercase tracking-widest px-1">Evidências</span>
                                        </button>
                                      </div>
                                    )}

                                    {!(t.fileUrl || t.hasFile) ? (
                                      <div className="flex gap-2">
                                        {!t.isManual && (
                                          <button 
                                            type="button"
                                            onClick={() => setResolvingManualTerm(t)}
                                            className="p-2 bg-white dark:bg-slate-800 text-orange-400 rounded-lg hover:bg-orange-900/20 transition-all border border-slate-200 dark:border-slate-700"
                                            title="Resolução Manual"
                                          >
                                            <CheckSquare size={16} />
                                          </button>
                                        )}
                                        <label className="p-2 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:bg-emerald-500/20 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer" title="Upload Assinado">
                                          <Upload size={16} />
                                          <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => handleUploadTermFile(t.id, e)} />
                                        </label>
                                      </div>
                                    ) : (
                                      <button 
                                        type="button"
                                        onClick={() => handleDeleteTermFile(t.id)}
                                        className="p-2 bg-white dark:bg-slate-800 text-red-400 rounded-lg hover:bg-red-900/20 transition-all border border-slate-200 dark:border-slate-700"
                                        title="Excluir/Alterar Anexo"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {detailTab === 'ocorrencias' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest border-b border-slate-100 dark:border-slate-700/40 pb-2">Histórico de Ocorrências e Afastamentos</h3>
                  {(() => {
                    const colabOccs = rhOccurrences.filter(o => o.collaboratorId === selectedColab.id);
                    if (colabOccs.length === 0) {
                      return (
                        <div className="text-slate-400 py-8 text-center bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-700 rounded-2xl font-medium text-xs">
                          Nenhuma ocorrência, falta ou atestado médico lançado para este colaborador.
                        </div>
                      );
                    }
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
                        {colabOccs.map(occ => (
                          <div key={occ.id} className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-700/60 flex justify-between items-start">
                            <div className="space-y-1">
                              <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase tracking-wider ${
                                occ.type === 'Férias'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                                  : occ.type === 'Atestado Médico'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400'
                                    : occ.type.includes('Falta')
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400'
                                      : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                              }`}>
                                {occ.type}
                              </span>
                              <p className="text-xs font-black text-slate-800 dark:text-white pt-1">
                                {new Date(occ.startDate).toLocaleDateString('pt-BR')} até {new Date(occ.endDate).toLocaleDateString('pt-BR')}
                              </p>
                              {occ.notes && <p className="text-[11px] text-slate-400 font-medium italic">"{occ.notes}"</p>}
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className="text-xs font-mono font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                                {occ.daysCount} {occ.daysCount === 1 ? 'dia' : 'dias'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {detailTab === 'historico' && selectedColab && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    {(() => {
                      const name = selectedColab.fullName.toLowerCase().trim() || '';
                      const colabLogs = logs.filter(l => {
                        const target = (l.targetName || '').toLowerCase();
                        const notes = (l.notes || '').toLowerCase();
                        return target === name || 
                               target.includes(name) ||
                               notes.includes(name) ||
                               (name.split(' ').length > 1 && notes.includes(name.split(' ')[0]) && notes.includes(name.split(' ').pop() || ''));
                      });
                      return (
                        <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">
                          Total de Eventos: {colabLogs.length}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                    {(() => {
                      const name = selectedColab.fullName.toLowerCase().trim() || '';
                      const colabLogs = logs.filter(l => {
                        const target = (l.targetName || '').toLowerCase();
                        const notes = (l.notes || '').toLowerCase();
                        return target === name || 
                               target.includes(name) ||
                               notes.includes(name) ||
                               (name.split(' ').length > 1 && notes.includes(name.split(' ')[0]) && notes.includes(name.split(' ').pop() || ''));
                      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                      if (colabLogs.length === 0) {
                        return (
                          <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <History className="mx-auto text-slate-800 mb-4" size={48} />
                            <h4 className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Nenhuma atividade registrada</h4>
                          </div>
                        );
                      }

                      return colabLogs.map(log => {
                        const statusClass = log.action.includes('Criação') ? 'bg-indigo-950 text-indigo-400' :
                                           log.action.includes('Atualização') ? 'bg-blue-950 text-blue-400' :
                                           log.action.includes('Exclusão') ? 'bg-red-950 text-red-400' :
                                           log.action.includes('Demitir') ? 'bg-red-950 text-red-400' :
                                           log.action.includes('Resolução Manual') ? 'bg-orange-950 text-orange-400' :
                                           'bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400';
                        return (
                          <div key={log.id} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2 group hover:border-slate-350 dark:hover:border-slate-650 transition-all">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <span className={ "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter " + statusClass }>
                                  {log.action}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{new Date(log.timestamp).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <span className="text-[10px] font-black text-slate-600 uppercase">AUDIT#{log.id.slice(0,5).toUpperCase()}</span>
                            </div>
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{log.notes || 'Sem observações registradas.'}</div>
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

            {/* Modal Actions */}
            <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-between items-center">
              {selectedColab.status !== 'Demitido' && !selectedColab.terminationDate ? (
                <button
                  onClick={() => setIsDismissModalOpen(true)}
                  className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs px-4 py-3 rounded-xl uppercase tracking-wider shadow-sm"
                >
                  <UserMinus size={14} /> Demitir Colaborador
                </button>
              ) : (
                <div className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-lg">
                  <AlertTriangle size={14} /> Colaborador Demitido
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-5 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs rounded-xl uppercase tracking-wider"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setForm(selectedColab);
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-6 py-3 rounded-xl uppercase tracking-wider shadow-md"
                >
                  <Edit2 size={14} /> Editar Dados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE & EDIT MODAL (Full page overlay/90vh centered same as IT module, split into tabs) */}
      {(isCreating || isEditing) && (
        <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200 dark:border-slate-700 animate-scale-up shadow-2xl">
            {/* Form Header */}
            <div className="px-8 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <h2 className="text-sm font-black uppercase text-indigo-600 tracking-wider">
                {isCreating ? 'Novo Colaborador R.H.' : `Editando ${selectedColab?.fullName}`}
              </h2>
              <button 
                onClick={() => { setIsCreating(false); setIsEditing(false); }} 
                className="h-10 w-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-700 dark:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs Control */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20 px-8 shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab('cadastro')}
                className={`py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all -mb-[1px] whitespace-nowrap ${
                  activeTab === 'cadastro'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                1. Dados de Cadastro
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('documentos')}
                className={`py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all -mb-[1px] whitespace-nowrap ${
                  activeTab === 'documentos'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                2. Anexos & Termos
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ocorrencias')}
                className={`py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all -mb-[1px] whitespace-nowrap ${
                  activeTab === 'ocorrencias'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                3. Faltas / Férias / Ocorrências
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 w-full overflow-x-hidden">
              {activeTab === 'cadastro' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Seção 1: Dados Pessoais */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50 pb-2 mb-2">
                      Dados Pessoais
                    </h3>
                    
                    <div className="flex items-center gap-4 mb-4 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-150 dark:border-slate-800">
                      <div className="relative group shrink-0">
                        {form.photo ? (
                          <img 
                            src={form.photo} 
                            alt="Preview" 
                            className="w-16 h-16 rounded-full object-cover border border-slate-350 dark:border-slate-650"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-650 dark:text-indigo-400 flex items-center justify-center font-bold text-xs border border-slate-350 dark:border-slate-650">
                            Sem Foto
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <span className="block text-[10px] font-black uppercase text-slate-400">Foto de Perfil</span>
                        <div className="flex gap-2">
                          <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-755 text-white font-black text-[10px] uppercase rounded-lg cursor-pointer transition-colors shadow-sm">
                            Selecionar
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={handlePhotoChange} 
                            />
                          </label>
                          {form.photo && (
                            <button
                              type="button"
                              onClick={() => setForm(p => ({ ...p, photo: '' }))}
                              className="px-3 py-1.5 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 font-black text-[10px] uppercase rounded-lg border border-red-500/20 transition-all hover:bg-red-100 dark:hover:bg-red-500/30"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        required
                        value={form.fullName || ''}
                        onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nascimento</label>
                        <input
                          type="date"
                          value={form.birthDate || ''}
                          onChange={e => setForm(p => ({ ...p, birthDate: e.target.value }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Gênero</label>
                        <select
                          value={form.gender || 'Masculino'}
                          onChange={e => setForm(p => ({ ...p, gender: e.target.value as any }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        >
                          <option>Masculino</option>
                          <option>Feminino</option>
                          <option>Outro</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Estado Civil</label>
                      <select
                        value={form.maritalStatus || 'Solteiro'}
                        onChange={e => setForm(p => ({ ...p, maritalStatus: e.target.value as any }))}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                      >
                        <option>Solteiro</option>
                        <option>Casado</option>
                        <option>Divorciado</option>
                        <option>Viúvo</option>
                        <option>Outro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nome da Mãe</label>
                      <input
                        type="text"
                        value={form.motherName || ''}
                        onChange={e => setForm(p => ({ ...p, motherName: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tel. Pessoal</label>
                        <input
                          type="text"
                          placeholder="(00) 00000-0000"
                          value={form.personalPhone || ''}
                          onChange={e => setForm(p => ({ ...p, personalPhone: formatPhone(e.target.value) }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tel. Corp.</label>
                        <input
                          type="text"
                          placeholder="(00) 00000-0000"
                          value={form.corporatePhone || ''}
                          onChange={e => setForm(p => ({ ...p, corporatePhone: formatPhone(e.target.value) }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">E-mail Pessoal</label>
                      <input
                        type="email"
                        value={form.emailPersonal || ''}
                        onChange={e => setForm(p => ({ ...p, emailPersonal: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">E-mail Corp.</label>
                      <input
                        type="email"
                        value={form.emailCorporate || ''}
                        onChange={e => setForm(p => ({ ...p, emailCorporate: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Seção 2: Documentos e Endereço */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50 pb-2 mb-2">
                      Documentação e Endereço
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">RG</label>
                        <input
                          type="text"
                          value={form.rg || ''}
                          onChange={e => setForm(p => ({ ...p, rg: e.target.value }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">CPF *</label>
                        <input
                          type="text"
                          required
                          placeholder="000.000.000-00"
                          value={form.cpf || ''}
                          onChange={e => setForm(p => ({ ...p, cpf: formatCPF(e.target.value) }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">PIS/PASEP</label>
                        <input
                          type="text"
                          value={form.pis || ''}
                          onChange={e => setForm(p => ({ ...p, pis: e.target.value }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">CTPS</label>
                        <input
                          type="text"
                          value={form.ctps || ''}
                          onChange={e => setForm(p => ({ ...p, ctps: e.target.value }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">CNH (Nº)</label>
                        <input
                          type="text"
                          value={form.cnhNumber || ''}
                          onChange={e => setForm(p => ({ ...p, cnhNumber: e.target.value }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Cat.</label>
                        <input
                          type="text"
                          placeholder="AB"
                          value={form.cnhCategory || ''}
                          onChange={e => setForm(p => ({ ...p, cnhCategory: e.target.value }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Vencimento CNH</label>
                      <input
                        type="date"
                        value={form.cnhExpiration || ''}
                        onChange={e => setForm(p => ({ ...p, cnhExpiration: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Endereço */}
                    <div className="space-y-3 pt-2">
                      <div className="relative">
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">CEP (Busca automática)</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="00000-000"
                            value={form.cep || ''}
                            onBlur={handleCepBlur}
                            onChange={e => setForm(p => ({ ...p, cep: formatCEP(e.target.value) }))}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white pr-10"
                          />
                          {cepLoading && <Loader2 size={16} className="animate-spin absolute right-3 top-3 text-indigo-500" />}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Rua</label>
                          <input
                            type="text"
                            value={form.street || ''}
                            onChange={e => setForm(p => ({ ...p, street: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nº</label>
                          <input
                            type="text"
                            value={form.number || ''}
                            onChange={e => setForm(p => ({ ...p, number: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Bairro</label>
                          <input
                            type="text"
                            value={form.neighborhood || ''}
                            onChange={e => setForm(p => ({ ...p, neighborhood: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Cidade</label>
                          <input
                            type="text"
                            value={form.city || ''}
                            onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção 3: Dados Contratuais */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50 pb-2 mb-2">
                      Contratação e Cargo
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Setor</label>
                        <select
                          value={form.sectorId || ''}
                          onChange={e => setForm(p => ({ ...p, sectorId: e.target.value }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        >
                          <option value="">Selecione...</option>
                          {sectors.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Cargo / Função</label>
                        <input
                          type="text"
                          value={form.role || ''}
                          onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tipo de Contrato</label>
                        <select
                          value={form.contractType || 'CLT'}
                          onChange={e => setForm(p => ({ ...p, contractType: e.target.value as any }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        >
                          <option value="CLT">CLT</option>
                          <option value="PJ">PJ</option>
                          <option value="Estágio">Estágio</option>
                          <option value="Cooperado">Cooperado</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Carga Horária Semanal</label>
                        <input
                          type="number"
                          value={form.weeklyHours || 44}
                          onChange={e => setForm(p => ({ ...p, weeklyHours: parseInt(e.target.value, 10) }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data de Admissão</label>
                        <input
                          type="date"
                          value={form.hireDate || ''}
                          onChange={e => setForm(p => ({ ...p, hireDate: e.target.value }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Salário Mensal (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.salary || 0}
                          onChange={e => setForm(p => ({ ...p, salary: parseFloat(e.target.value) }))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium font-mono text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'documentos' && (
                <div className="space-y-6">
                  {/* Anexos de documentos */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-150 dark:border-slate-700/60">
                    <span className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-3">Anexos de Documentos Regulamentares ({form.documents?.length || 0})</span>
                    
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={docCategory}
                          onChange={e => setDocCategory(e.target.value as any)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white font-bold outline-none"
                        >
                          <option value="RG">RG</option>
                          <option value="CPF">CPF</option>
                          <option value="Comprovante de Residência">Comprovante de Residência</option>
                          <option value="Contrato de Trabalho">Contrato de Trabalho</option>
                          <option value="Outros">Outros</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Nome amigável do arquivo (ex: RG_Frente)..."
                          value={docFileName}
                          onChange={e => setDocFileName(e.target.value)}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 dark:text-white font-medium"
                        />
                        <button
                          type="button"
                          onClick={handleAddDocument}
                          className="bg-indigo-600 text-white text-xs font-black px-6 py-2.5 rounded-xl uppercase hover:bg-indigo-700 transition-all shadow-sm active:scale-95 shrink-0"
                        >
                          Adicionar Anexo
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
                        {form.documents && form.documents.length > 0 ? (
                          form.documents.map((doc, i) => (
                            <div key={doc.id || i} className="p-3 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs border border-slate-200 dark:border-slate-700">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[9px] font-black rounded uppercase">{doc.category}</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]" title={doc.fileName}>{doc.fileName}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteDoc(doc.id)}
                                className="text-rose-500 hover:text-rose-700 font-bold text-[10px] uppercase tracking-wider pl-2 hover:underline"
                              >
                                Remover
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-400 py-6 text-center col-span-2 font-medium">Nenhum documento regulamentar anexado ainda.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Termos de Comodato vinculados */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-150 dark:border-slate-700/60">
                    <span className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-3">Histórico de Termos de Comodato vinculados</span>
                    
                    <div className="space-y-3">
                      {isCreating ? (
                        <div className="text-slate-400 py-6 text-center font-medium">Os termos de comodato estarão disponíveis após salvar o cadastro do colaborador.</div>
                      ) : (
                        <>
                          {(() => {
                            const colabTerms = rhTerms.filter(t => t.collaboratorId === selectedColab?.id);
                            
                            if (colabTerms.length === 0) {
                              return <div className="text-slate-400 py-6 text-center font-medium">Nenhum termo de comodato (entrega/devolução) gerado para este colaborador.</div>;
                            }

                            return (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {colabTerms.map(t => {
                                  const isDevolucao = t.type === 'DEVOLUCAO';
                                  return (
                                    <div key={t.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 relative">
                                      <div className="flex justify-between items-start">
                                        <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider ${
                                          isDevolucao 
                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400' 
                                            : 'bg-indigo-100 text-indigo-850 dark:bg-indigo-500/20 dark:text-indigo-400'
                                        }`}>
                                          {isDevolucao ? 'DEVOLUÇÃO' : 'ENTREGA'}
                                        </span>
                                        <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider ${
                                          t.status === 'ASSINADO'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                                            : t.status === 'RECUSADO'
                                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400'
                                              : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                                        }`}>
                                          {t.status}
                                        </span>
                                      </div>
                                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate" title={t.assetDetails}>{t.assetDetails}</p>
                                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        <span>Data: {new Date(t.date).toLocaleDateString('pt-BR')}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ocorrencias' && (
                <div className="space-y-6">
                  {isCreating ? (
                    <div className="text-slate-400 py-12 text-center font-medium bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                      As ocorrências de afastamentos, faltas e férias podem ser visualizadas e lançadas após salvar o cadastro do colaborador.
                    </div>
                  ) : (
                    <>
                      {/* Lançamento de Nova Ocorrência Rápida */}
                      <div className="bg-indigo-50/40 dark:bg-slate-900/60 p-6 rounded-2xl border border-indigo-100 dark:indigo-500/10 space-y-4">
                        <span className="block text-xs font-black uppercase text-indigo-750 dark:text-indigo-400">Registrar Nova Ocorrência (Falta / Férias / Atestado)</span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tipo de Ocorrência</label>
                            <select
                              value={quickOccType}
                              onChange={e => setQuickOccType(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-bold"
                            >
                              <option value="Atestado Médico">Atestado Médico</option>
                              <option value="Falta Justificada">Falta Justificada</option>
                              <option value="Falta Injustificada">Falta Injustificada</option>
                              <option value="Licença Maternidade">Licença Maternidade</option>
                              <option value="Licença Paternidade">Licença Paternidade</option>
                              <option value="Afastamento INSS">Afastamento INSS</option>
                              <option value="Férias">Férias</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data de Início</label>
                            <input
                              type="date"
                              value={quickOccStart}
                              onChange={e => setQuickOccStart(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data de Fim</label>
                            <input
                              type="date"
                              value={quickOccEnd}
                              onChange={e => setQuickOccEnd(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end font-medium">
                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Observações / Notas</label>
                            <input
                              type="text"
                              value={quickOccNotes}
                              onChange={e => setQuickOccNotes(e.target.value)}
                              placeholder="Observações complementares ou CID..."
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!quickOccStart || !quickOccEnd) {
                                alert('Por favor, informe a data de início e fim da ocorrência.');
                                return;
                              }

                              const start = new Date(quickOccStart);
                              const end = new Date(quickOccEnd);
                              const diffTime = Math.abs(end.getTime() - start.getTime());
                              const computedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                              if (selectedColab) {
                                const finalOccurrence: RhOccurrence = {
                                  id: 'occ-' + Math.random().toString(36).substr(2, 9),
                                  collaboratorId: selectedColab.id,
                                  type: quickOccType as any,
                                  startDate: quickOccStart,
                                  endDate: quickOccEnd,
                                  daysCount: computedDays,
                                  notes: quickOccNotes || '',
                                  fileUrl: 'mock_cert_url_' + Math.random().toString(36).substr(2, 4)
                                };

                                addRhOccurrence(finalOccurrence, adminName);
                                
                                // Reset
                                setQuickOccStart('');
                                setQuickOccEnd('');
                                setQuickOccNotes('');
                              }
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-2.5 rounded-xl uppercase tracking-wider shadow-sm transition-all active:scale-95 text-center"
                          >
                            Lançar Registro
                          </button>
                        </div>
                      </div>

                      {/* Lista de Ocorrências Atuais */}
                      <div className="space-y-3">
                        <span className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400">Histórico de Ocorrências e Afastamentos</span>
                        {(() => {
                          const colabOccs = rhOccurrences.filter(o => o.collaboratorId === selectedColab?.id);
                          
                          if (colabOccs.length === 0) {
                            return (
                              <div className="text-slate-400 py-8 text-center bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-700 rounded-2xl font-medium">
                                Nenhuma ocorrência, falta ou atestado médico lançado para este colaborador.
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-2">
                              {colabOccs.map(occ => (
                                <div key={occ.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-start">
                                  <div className="space-y-1">
                                    <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase tracking-wider ${
                                      occ.type === 'Férias'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                                        : occ.type === 'Atestado Médico'
                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400'
                                          : occ.type.includes('Falta')
                                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400'
                                            : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                                    }`}>
                                      {occ.type}
                                    </span>
                                    <p className="text-xs font-black text-slate-800 dark:text-white pt-1">
                                      {new Date(occ.startDate).toLocaleDateString('pt-BR')} até {new Date(occ.endDate).toLocaleDateString('pt-BR')}
                                    </p>
                                    {occ.notes && <p className="text-[11px] text-slate-400 font-medium italic">"{occ.notes}"</p>}
                                  </div>
                                  <div className="flex flex-col items-end gap-2 shrink-0">
                                    <span className="text-xs font-mono font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                                      {occ.daysCount} {occ.daysCount === 1 ? 'dia' : 'dias'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm('Excluir este lançamento de ocorrência?')) {
                                          deleteRhOccurrence(occ.id, adminName);
                                        }
                                      }}
                                      className="text-[9px] font-black text-rose-500 hover:text-rose-700 hover:underline uppercase tracking-wider"
                                    >
                                      Excluir
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>
              )}
            </form>

            {/* Form Footer Actions */}
            <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => { setIsCreating(false); setIsEditing(false); }}
                className="px-6 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-black text-xs rounded-xl uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl uppercase tracking-wider hover:shadow-md transition-all"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISMISS COLLABORATOR MODAL */}
      {isDismissModalOpen && selectedColab && (
        <div className="fixed inset-0 bg-slate-900/60 z-[120] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700 animate-scale-up shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle size={20} />
                <h3 className="text-sm font-black uppercase tracking-wider">Demitir Colaborador</h3>
              </div>
              <button 
                onClick={() => {
                  setIsDismissModalOpen(false);
                  setConfirmDismissWithPending(false);
                  setDismissCustomNote('');
                }}
                className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-700 dark:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-150 dark:border-slate-700/40">
                <p className="font-bold text-slate-700 dark:text-slate-300">Você está iniciando o processo de demissão de:</p>
                <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1">{selectedColab.fullName}</p>
                <p className="text-slate-400 mt-1 uppercase text-[10px] font-bold">Cargo: {selectedColab.role || 'Sem Cargo'} • Admissão: {selectedColab.hireDate ? new Date(selectedColab.hireDate).toLocaleDateString('pt-BR') : '---'}</p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Motivo da Demissão</label>
                <select
                  value={dismissReason}
                  onChange={e => setDismissReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-bold"
                >
                  <option value="Demissão sem Justa Causa">Demissão sem Justa Causa</option>
                  <option value="Demissão com Justa Causa">Demissão com Justa Causa</option>
                  <option value="Pedido de Demissão pelo Colaborador">Pedido de Demissão pelo Colaborador</option>
                  <option value="Fim de Contrato de Experiência">Fim de Contrato de Experiência</option>
                  <option value="Rescisão Amigável / Acordo">Rescisão Amigável / Acordo</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Observações / Notas do Desligamento</label>
                <textarea
                  value={dismissCustomNote}
                  onChange={e => setDismissCustomNote(e.target.value)}
                  placeholder="Informe detalhes adicionais ou observações se necessário..."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white"
                />
              </div>

              {/* Verificação de comodatos pendentes */}
              {(() => {
                const colabTerms = rhTerms.filter(t => t.collaboratorId === selectedColab.id);
                const entregas = colabTerms.filter(t => t.type === 'ENTREGA' && (t.status === 'ASSINADO' || t.status === 'PENDENTE'));
                const devolucoesAssinadasIds = colabTerms
                  .filter(t => t.type === 'DEVOLUCAO' && t.status === 'ASSINADO')
                  .map(t => t.originalTermId)
                  .filter(Boolean);

                const entregasSemDevolucao = entregas.filter(e => !devolucoesAssinadasIds.includes(e.id));
                const temPendenciaComodato = entregasSemDevolucao.length > 0;

                if (!temPendenciaComodato) return null;

                return (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
                      <AlertTriangle size={16} />
                      <span className="uppercase tracking-wider font-black">Pendências de Comodato Ativas!</span>
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      Este colaborador possui <strong>{entregasSemDevolucao.length} termo(s) de entrega de ativos</strong> sem o correspondente termo de devolução finalizando o fluxo:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 dark:text-amber-300 font-mono pl-1 max-h-24 overflow-y-auto">
                      {entregasSemDevolucao.map(e => (
                        <li key={e.id} className="truncate">
                          #{e.id} - {e.assetDetails}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 italic">
                      Recomenda-se realizar o fluxo de devolução do comodato para dar baixa no estoque de ativos de R.H. antes de demitir.
                    </p>
                    <label className="flex items-start gap-2 mt-3 p-2 bg-amber-100/50 dark:bg-amber-950/40 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmDismissWithPending}
                        onChange={e => setConfirmDismissWithPending(e.target.checked)}
                        className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-[11px] text-amber-900 dark:text-amber-200 font-bold">
                        Confirmo que estou ciente das pendências de ativos acima e desejo demitir o colaborador mesmo assim.
                      </span>
                    </label>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsDismissModalOpen(false);
                  setConfirmDismissWithPending(false);
                  setDismissCustomNote('');
                }}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-black text-xs rounded-xl uppercase tracking-wider"
              >
                Cancelar
              </button>
              {(() => {
                const colabTerms = rhTerms.filter(t => t.collaboratorId === selectedColab.id);
                const entregas = colabTerms.filter(t => t.type === 'ENTREGA' && (t.status === 'ASSINADO' || t.status === 'PENDENTE'));
                const devolucoesAssinadasIds = colabTerms
                  .filter(t => t.type === 'DEVOLUCAO' && t.status === 'ASSINADO')
                  .map(t => t.originalTermId)
                  .filter(Boolean);

                const entregasSemDevolucao = entregas.filter(e => !devolucoesAssinadasIds.includes(e.id));
                const temPendencia = entregasSemDevolucao.length > 0;
                const canSubmit = !temPendencia || confirmDismissWithPending;

                return (
                  <button
                    disabled={!canSubmit}
                    onClick={() => {
                      handleDismissColab();
                      setConfirmDismissWithPending(false);
                      setDismissCustomNote('');
                    }}
                    className={`px-5 py-2.5 font-black text-xs rounded-xl uppercase tracking-wider shadow-md transition-all ${
                      canSubmit
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-slate-350 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Confirmar Demissão
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Visualizador de Foto Expandida do Colaborador */}
      {isExpandedPhotoOpen && selectedColab?.photo && (
        <div className="fixed inset-0 bg-slate-950/80 z-[150] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg border border-slate-200 dark:border-slate-700 animate-scale-up shadow-2xl p-6 flex flex-col items-center gap-4 relative">
            <button
              onClick={() => setIsExpandedPhotoOpen(false)}
              className="absolute right-4 top-4 h-10 w-10 flex items-center justify-center bg-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-700 hover:bg-slate-200 rounded-full text-slate-400 dark:text-white transition-all shadow-sm"
              title="Fechar"
            >
              <X size={20} />
            </button>

            <h3 className="text-sm font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider text-center pt-2">
              Foto de Perfil - {selectedColab.fullName}
            </h3>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-750 flex items-center justify-center max-h-[60vh] overflow-hidden w-full">
              <img
                src={selectedColab.photo}
                alt={selectedColab.fullName}
                className="max-h-[50vh] max-w-full rounded-xl object-contain shadow-md"
              />
            </div>

            <div className="flex gap-2 w-full pt-2">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(selectedColab.photo || '');
                    const blob = await response.blob();
                    await navigator.clipboard.write([
                      new ClipboardItem({
                        [blob.type]: blob
                      })
                    ]);
                    alert('Imagem copiada para a área de transferência!');
                  } catch (err) {
                    alert('Erro ao copiar imagem: ' + err);
                  }
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-[10px] uppercase rounded-xl border border-slate-200 dark:border-slate-600 transition-all flex items-center justify-center gap-1.5"
              >
                <Copy size={14} /> Copiar Imagem
              </button>
              <a
                href={selectedColab.photo}
                download={`foto_${selectedColab.fullName.toLowerCase().replace(/\s+/g, '_')}.png`}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 text-center shadow-sm"
              >
                <Download size={14} /> Salvar Imagem
              </a>
              <button
                onClick={() => {
                  const win = window.open();
                  if (win) {
                    win.document.write(`<img src="${selectedColab.photo}" style="max-width:100%; height:auto;" onload="window.print(); window.close();"/>`);
                    win.document.close();
                  }
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-[10px] uppercase rounded-xl border border-slate-200 dark:border-slate-600 transition-all flex items-center justify-center gap-1.5"
              >
                <Printer size={14} /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Link de Assinatura */}
      {isLinkModalOpen && generatedSignatureLink && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-md w-full shadow-2xl relative">
            <h3 className="text-sm font-black uppercase text-indigo-500 tracking-wider mb-2">Link de Assinatura Digital</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Envie o link abaixo para o colaborador assinar o termo digitalmente através de geolocalização e fotos de evidência:
            </p>
            <div className="flex gap-2 p-2 bg-black/40 border border-slate-700 rounded-2xl mb-4">
              <input 
                type="text" 
                readOnly 
                value={generatedSignatureLink} 
                className="flex-1 bg-transparent border-0 outline-none text-xs text-slate-200 font-mono select-all truncate pl-2"
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(generatedSignatureLink);
                  showToast("Link copiado com sucesso!", "success");
                }}
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-755 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0"
              >
                <Copy size={12} /> Copiar
              </button>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button 
                onClick={() => { setIsLinkModalOpen(false); setGeneratedSignatureLink(null); }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resolução Manual */}
      {resolvingManualTerm && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-orange-500 font-bold uppercase text-xs tracking-wider">
              <CheckSquare size={18} />
              <span>Resolução Manual de Termo</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Use esta opção se o colaborador assinou o documento físico em papel ou via outro meio e você deseja dar baixa manual sem exigir a assinatura eletrônica.
            </p>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Motivo / Observação da Resolução</label>
              <textarea 
                required
                placeholder="Ex: Assinado fisicamente em papel e arquivado na pasta de prontuário do colaborador."
                value={resolveManualReason}
                onChange={e => setResolveManualReason(e.target.value)}
                className="w-full border border-slate-700 rounded-xl p-3 focus:border-orange-500 outline-none text-xs bg-slate-950 text-slate-100 min-h-[90px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button 
                onClick={() => { setResolvingManualTerm(null); setResolveManualReason(''); }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-355 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button 
                disabled={!resolveManualReason.trim()}
                onClick={handleConfirmResolveManual}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Evidências da Assinatura Digital */}
      {signatureData && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-2xl w-full shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4 shrink-0">
              <h3 className="text-xs font-black uppercase text-indigo-500 tracking-wider flex items-center gap-2">
                <Camera size={16} />
                <span>Evidências de Assinatura Digital (Doc + Selfie)</span>
              </h3>
              <button 
                onClick={() => setSignatureData(null)} 
                className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block text-center">Foto do Documento</span>
                {signatureData.documentPhoto ? (
                  <div className="border border-slate-700 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center min-h-[220px]">
                    <img src={signatureData.documentPhoto} className="max-h-60 object-contain" alt="Documento" />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-xs text-slate-650 min-h-[220px]">Não coletada</div>
                )}
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block text-center">Foto de Selfie</span>
                {signatureData.selfiePhoto ? (
                  <div className="border border-slate-700 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center min-h-[220px]">
                    <img src={signatureData.selfiePhoto} className="max-h-60 object-contain" alt="Selfie" />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-xs text-slate-650 min-h-[220px]">Não coletada</div>
                )}
              </div>
            </div>
            <div className="pt-3 border-t border-slate-800 flex justify-end shrink-0">
              <button 
                onClick={() => setSignatureData(null)}
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-755 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Justificativa de Alteração Cadastral (Obrigatório) */}
      {isReasonModalOpen && pendingSaveData && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-500 font-bold uppercase text-xs tracking-wider">
              <AlertTriangle size={18} className="text-amber-500" />
              <span>Justificativa de Alteração</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-bold">
              Para prosseguir e salvar as alterações cadastrais do colaborador de R.H., por favor, informe brevemente o motivo desta alteração.
            </p>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Motivo da Alteração</label>
              <textarea 
                required
                placeholder="Ex: Ajuste salarial acordado em convenção coletiva / Correção de grafia no nome."
                value={editReasonText}
                onChange={e => setEditReasonText(e.target.value)}
                className="w-full border border-slate-700 rounded-xl p-3 focus:border-indigo-500 outline-none text-xs bg-slate-950 text-slate-100 min-h-[90px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button 
                onClick={() => { setIsReasonModalOpen(false); setPendingSaveData(null); setEditReasonText(''); }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-355 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button 
                disabled={!editReasonText.trim()}
                onClick={handleConfirmEditReason}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Salvar Cadastro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FilePreviewModal */}
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
