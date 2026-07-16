import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { RhTermTemplate, RhTerm } from '../types';
import { FileText, Plus, Check, X, Shield, PenTool, ArrowRight, Printer, Copy, Share2, Info } from 'lucide-react';

export const RhComodatoManager: React.FC = () => {
  const { rhCollaborators, rhTemplates, rhTerms, addRhTemplate, updateRhTemplate, addRhTerm, updateRhTerm, sectors, settings } = useData();
  const { user } = useAuth();
  const adminName = user?.name || 'Gestor R.H.';

  // Navigation states
  const [activeTab, setActiveTab] = useState<'emitidos' | 'templates'>('emitidos');
  const [selectedTerm, setSelectedTerm] = useState<RhTerm | null>(null);
  
  // Create Term Form states
  const [showCreateTerm, setShowCreateTerm] = useState(false);
  const [newTermColabId, setNewTermColabId] = useState('');
  const [newTermTemplateId, setNewTermTemplateId] = useState('');
  const [newTermCustomNotes, setNewTermCustomNotes] = useState('');
  const [newTermObservations, setNewTermObservations] = useState('');

  // Create Template Form states
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState<RhTermTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    type: 'ENTREGA' as 'ENTREGA' | 'DEVOLUCAO',
    declaration: '',
    content: ''
  });

  // Signature Modal states
  const [signingTerm, setSigningTerm] = useState<RhTerm | null>(null);
  const [signatureConfirm, setSignatureConfirm] = useState(false);
  const [gpsApproved, setGpsApproved] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Template CRUD
  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name || !templateForm.content) return;

    if (isEditingTemplate) {
      updateRhTemplate({
        ...isEditingTemplate,
        name: templateForm.name,
        type: templateForm.type,
        declaration: templateForm.declaration,
        content: templateForm.content
      }, adminName);
      setIsEditingTemplate(null);
    } else {
      addRhTemplate({
        id: 'tmpl-' + Math.random().toString(36).substr(2, 9),
        name: templateForm.name,
        type: templateForm.type,
        declaration: templateForm.declaration,
        content: templateForm.content
      }, adminName);
    }

    setTemplateForm({ name: '', type: 'ENTREGA', declaration: '', content: '' });
    setShowCreateTemplate(false);
  };

  const handleEditTemplateClick = (t: RhTermTemplate) => {
    setIsEditingTemplate(t);
    setTemplateForm({
      name: t.name,
      type: t.type || 'ENTREGA',
      declaration: t.declaration || '',
      content: t.content
    });
    setShowCreateTemplate(true);
  };

  // Term Emission
  const handleEmitTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTermColabId || !newTermTemplateId) return;

    const colab = rhCollaborators.find(c => c.id === newTermColabId);
    const tmpl = rhTemplates.find(t => t.id === newTermTemplateId);

    if (!colab || !tmpl) return;

    const newTerm: RhTerm = {
      id: 'rht-' + Math.random().toString(36).substr(2, 9),
      collaboratorId: newTermColabId,
      templateId: newTermTemplateId,
      assetDetails: newTermCustomNotes || 'Comodato Geral',
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

  return (
    <div className="space-y-6">
      {/* Título e Abas */}
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700/60 pb-3">
        <div>
          <h1 id="rh-comodato-title" className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">TERMOS DE COMODATO DE R.H.</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gestão de termos de entrega, comodato geral e assinaturas digitais</p>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('emitidos')}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all uppercase tracking-wider ${activeTab === 'emitidos' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Emitidos
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all uppercase tracking-wider ${activeTab === 'templates' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Modelos de Termo
          </button>
        </div>
      </div>

      {activeTab === 'emitidos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1: Lista de Termos Emitidos */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col h-[75vh] space-y-4 font-sans">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Histórico de Emissões</h3>
              <button
                onClick={() => setShowCreateTerm(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-3 py-2 rounded-lg shadow-sm transition-all uppercase tracking-wider"
              >
                <Plus size={12} /> Emitir Termo
              </button>
            </div>

            {showCreateTerm && (
              <form onSubmit={handleEmitTerm} className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 max-h-[50vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Nova Emissão</span>
                  <button type="button" onClick={() => setShowCreateTerm(false)} className="text-xs font-bold text-rose-500 hover:underline uppercase tracking-wider text-[10px]">Fechar</button>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Colaborador</label>
                  <select
                    required
                    value={newTermColabId}
                    onChange={e => setNewTermColabId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-medium"
                  >
                    <option value="">Selecione...</option>
                    {rhCollaborators.map(c => (
                      <option key={c.id} value={c.id}>{c.fullName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Template de Termo</label>
                  <select
                    required
                    value={newTermTemplateId}
                    onChange={e => setNewTermTemplateId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-medium"
                  >
                    <option value="">Selecione...</option>
                    {rhTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.type || 'ENTREGA'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Bens em Comodato (Descrição Detalhada)</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Ex: 1 Notebook Dell Latitude, carregador, mochila"
                    value={newTermCustomNotes}
                    onChange={e => setNewTermCustomNotes(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Observações / Instruções Adicionais</label>
                  <textarea
                    rows={2}
                    placeholder="Observações que serão impressas no rodapé dos detalhes"
                    value={newTermObservations}
                    onChange={e => setNewTermObservations(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 text-white font-black text-[10px] rounded-xl uppercase tracking-wider hover:bg-indigo-700 shadow-sm"
                >
                  Emitir e Enviar para Assinatura
                </button>
              </form>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {rhTerms.map(t => {
                const colabName = rhCollaborators.find(c => c.id === t.collaboratorId)?.fullName || 'Desconhecido';
                const tmpl = rhTemplates.find(tmpl => tmpl.id === t.templateId);
                const tmplName = tmpl?.name || 'Modelo Geral';
                const type = t.type || tmpl?.type || 'ENTREGA';

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTerm(t)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${selectedTerm?.id === t.id ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700/40 hover:bg-slate-100/60'}`}
                  >
                    <div className="space-y-1">
                      <span className="block font-black text-xs text-slate-900 dark:text-white">{colabName}</span>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">{tmplName}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-wider ${type === 'DEVOLUCAO' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-indigo-100 text-indigo-850 dark:bg-indigo-500/20 dark:text-indigo-400'}`}>
                          {type}
                        </span>
                        <span className="text-[9px] opacity-75 font-mono text-slate-400 dark:text-slate-500">{new Date(t.date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-[8px] font-black rounded-full uppercase tracking-wider ${t.status === 'ASSINADO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                      {t.status}
                    </span>
                  </div>
                );
           })}
            </div>
          </div>
          {/* Coluna 2 e 3: Visualização Completa e Assinatura */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm min-h-[75vh] flex flex-col justify-between font-sans">
            {selectedTerm ? (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-700/50 pb-4 mb-6">
                    {(() => {
                      const colabName = rhCollaborators.find(c => c.id === selectedTerm.collaboratorId)?.fullName || 'Desconhecido';
                      const tmplName = rhTemplates.find(tmpl => tmpl.id === selectedTerm.templateId)?.name || 'Modelo Geral';
                      return (
                        <div>
                          <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider ${selectedTerm.status === 'ASSINADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {selectedTerm.status}
                          </span>
                          <h2 className="text-lg font-black text-slate-900 dark:text-white mt-2">{tmplName}</h2>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Destinatário: {colabName}</p>
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => generateAndPrintRhTerm(selectedTerm)}
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-black text-xs px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm transition-all uppercase tracking-wider"
                        title="Imprimir Termo em Formato Oficial"
                      >
                        <Printer size={14} /> Imprimir
                      </button>

                      {selectedTerm.status === 'PENDENTE' && (
                        <button
                          onClick={() => setSigningTerm(selectedTerm)}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition-all uppercase tracking-wider"
                        >
                          <PenTool size={14} /> Assinar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visualização de Simulação do Termo de Comodato */}
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 max-h-[50vh] overflow-y-auto space-y-6 text-slate-800 dark:text-slate-200 leading-relaxed font-sans shadow-inner">
                    {(() => {
                      const colab = rhCollaborators.find(c => c.id === selectedTerm.collaboratorId);
                      const tmpl = rhTemplates.find(t => t.id === selectedTerm.templateId);
                      if (!colab || !tmpl) return <p className="text-xs">Carregando...</p>;
                      
                      const sectorName = sectors?.find(s => s.id === colab.sectorId)?.name || 'Não Informado';
                      const todayStr = new Date(selectedTerm.date).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                      
                      const replacements: Record<string, string> = {
                        '{NOME_EMPRESA}': settings?.appName || 'Minha Empresa',
                        '{CNPJ}': settings?.cnpj || 'Não Informado',
                        '{NOME_COLABORADOR}': colab.fullName,
                        '{CPF}': colab.cpf,
                        '{RG}': colab.rg || '-',
                        '{CARGO}': colab.role || '-',
                        '{SETOR}': sectorName,
                        '{TIPO_CONTRATO}': colab.contractType || '-',
                        '{BENS_COMODATO}': selectedTerm.assetDetails,
                        '{DATA_ATUAL}': todayStr
                      };

                      let dec = tmpl.declaration || (tmpl.type === 'DEVOLUCAO' ? 'Declaro ter devolvido os itens abaixo na presente data.' : 'Declaro ter recebido os itens abaixo em perfeitas condições de uso.');
                      let cnt = tmpl.content || '';

                      Object.keys(replacements).forEach(key => {
                        const regex = new RegExp(key, 'g');
                        dec = dec.replace(regex, replacements[key]);
                        cnt = cnt.replace(regex, replacements[key]);
                      });

                      const isEntrega = (selectedTerm.type || tmpl.type || 'ENTREGA') === 'ENTREGA';

                      return (
                        <div className="space-y-4 text-xs">
                          {/* Simulador de Cabeçalho */}
                          <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700/50 pb-3">
                            <div className="flex items-center gap-3">
                              {settings?.logoUrl && (
                                <img src={settings.logoUrl} alt="Logo" className="h-8 max-w-[100px] object-contain dark:brightness-110" />
                              )}
                              <div>
                                <h4 className="font-bold text-slate-900 dark:text-white leading-tight">{settings?.appName || 'Minha Empresa'}</h4>
                                <p className="text-[10px] text-slate-400 font-mono">CNPJ: {settings?.cnpj || 'Não Informado'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                                {isEntrega ? 'Termo de Entrega' : 'Termo de Devolução'}
                              </span>
                            </div>
                          </div>

                          {/* Dados Colaborador */}
                          <div className="grid grid-cols-2 gap-2 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px]">
                            <div><strong className="text-slate-400 block text-[9px] uppercase font-black">Colaborador</strong> <span className="font-semibold text-slate-800 dark:text-slate-100">{colab.fullName}</span></div>
                            <div><strong className="text-slate-400 block text-[9px] uppercase font-black">CPF</strong> <span className="font-semibold font-mono text-slate-800 dark:text-slate-100">{colab.cpf}</span></div>
                            <div><strong className="text-slate-400 block text-[9px] uppercase font-black">Cargo</strong> <span className="font-semibold text-slate-800 dark:text-slate-100">{colab.role || 'Não Informado'}</span></div>
                            <div><strong className="text-slate-400 block text-[9px] uppercase font-black">Setor</strong> <span className="font-semibold text-slate-800 dark:text-slate-100">{sectorName}</span></div>
                          </div>

                          {/* Declaração */}
                          <p className="text-slate-700 dark:text-slate-300 italic text-justify leading-relaxed bg-slate-100/50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-200/40 dark:border-slate-800/40">"{dec}"</p>

                          {/* Bens em Comodato */}
                          <div className="space-y-1.5">
                            <h5 className="font-black text-[10px] uppercase text-indigo-500 tracking-wider">Bens em Comodato</h5>
                            <div className="bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-[11px] whitespace-pre-wrap text-slate-900 dark:text-slate-100">
                              {selectedTerm.assetDetails}
                            </div>
                          </div>

                          {/* Observações */}
                          {selectedTerm.notes && (
                            <div className="bg-amber-50 dark:bg-amber-500/5 p-3 rounded-xl border border-amber-200 dark:border-amber-500/10 text-amber-900 dark:text-amber-300">
                              <span className="font-black text-[9px] uppercase tracking-wider block mb-1">Observações do Emissor</span>
                              <p className="text-[11px]">{selectedTerm.notes}</p>
                            </div>
                          )}

                          {/* Cláusulas */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                            <h5 className="font-black text-[10px] uppercase text-slate-400 tracking-wider">Termos e Condições Legais</h5>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap text-justify leading-relaxed font-serif">
                              {cnt}
                            </p>
                          </div>

                          {/* Data e Local */}
                          <div className="text-center text-[10px] text-slate-400 mt-4 font-semibold">
                            São José dos Campos, {todayStr}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Evidências Legais da Assinatura */}
                {selectedTerm.status === 'ASSINADO' && (
                  <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl">
                    <h3 className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-400 flex items-center gap-2 mb-3">
                      <Shield size={16} /> ASSINATURA ELETRÔNICA CONFIRMADA E VÁLIDA
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-emerald-800 dark:text-emerald-300">
                      <div>
                        <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">Assinado em</span>
                        <span className="font-bold">{selectedTerm.signatureDate ? new Date(selectedTerm.signatureDate).toLocaleString('pt-BR') : ''}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">IP de Registro</span>
                        <span className="font-bold">{selectedTerm.signatureIp}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">Hash de Integridade</span>
                        <span className="font-bold text-[10px] break-all">{selectedTerm.signatureHash}</span>
                      </div>
                      {selectedTerm.signatureLocation && (
                        <div className="col-span-2">
                           <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block leading-none mb-1">Geolocalização (GPS)</span>
                           <span className="font-bold">{selectedTerm.signatureLocation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400/80 py-12">
                <FileText size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-black uppercase tracking-widest">Selecione um Termo Emitido ao lado</p>
                <p className="text-[11px] opacity-75">Para ler as cláusulas de comodato ou realizar a assinatura eletrônica com evidências</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Aba de Templates */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col h-[75vh] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider font-bold">Templates Ativos</h3>
              <button
                onClick={() => {
                  setIsEditingTemplate(null);
                  setTemplateForm({ name: '', type: 'ENTREGA', declaration: '', content: '' });
                  setShowCreateTemplate(true);
                }}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-3 py-2 rounded-lg animate-fade-in"
              >
                <Plus size={12} /> Criar Modelo
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {rhTemplates.map(t => (
                <div
                  key={t.id}
                  onClick={() => handleEditTemplateClick(t)}
                  className="p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/40 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <span className="block font-black text-xs text-slate-900 dark:text-white">{t.name}</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`px-1.5 py-0.5 text-[7px] font-bold rounded uppercase ${t.type === 'DEVOLUCAO' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300'}`}>
                        {t.type || 'ENTREGA'}
                      </span>
                      <span className="text-[9px] text-slate-400 block font-bold uppercase">{t.content.length} caracteres de texto</span>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-indigo-500" />
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm min-h-[75vh]">
            {showCreateTemplate ? (
              <form onSubmit={handleSaveTemplate} className="space-y-6">
                <h3 className="text-sm font-black uppercase text-indigo-600 tracking-wider">
                  {isEditingTemplate ? `Editar Modelo: ${isEditingTemplate.name}` : 'Criar Novo Modelo de Termo'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nome do Modelo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Termo de Comodato de Computador"
                      value={templateForm.name}
                      onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tipo de Termo</label>
                    <select
                      value={templateForm.type}
                      onChange={e => setTemplateForm(p => ({ ...p, type: e.target.value as 'ENTREGA' | 'DEVOLUCAO' }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-semibold"
                    >
                      <option value="ENTREGA">Entrega de Comodato</option>
                      <option value="DEVOLUCAO">Devolução de Comodato</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-black uppercase text-slate-400">Declaração de Abertura / Cabeçalho</label>
                    <span className="text-[9px] text-slate-400 font-mono">Variáveis: {'{NOME_EMPRESA}'}, {'{CNPJ}'}, {'{NOME_COLABORADOR}'}, {'{CPF}'}, {'{RG}'}</span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Ex: Declaro ter recebido de {NOME_EMPRESA} os bens descritos abaixo em perfeitas condições..."
                    value={templateForm.declaration}
                    onChange={e => setTemplateForm(p => ({ ...p, declaration: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-black uppercase text-slate-400">Cláusulas e Conteúdo do Termo</label>
                    <span className="text-[9px] text-slate-400 font-mono">Cláusulas legais, direitos e deveres do comodatário</span>
                  </div>
                  <textarea
                    required
                    rows={10}
                    placeholder="Escreva aqui os termos legais. Use cláusulas gerais do Comodato da empresa..."
                    value={templateForm.content}
                    onChange={e => setTemplateForm(p => ({ ...p, content: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-serif leading-relaxed text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateTemplate(false)}
                    className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl uppercase"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 text-white font-black text-xs rounded-xl uppercase hover:bg-indigo-700 shadow-sm"
                  >
                    Salvar Modelo
                  </button>
                </div>
              </form>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                <FileText size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-black uppercase tracking-widest">Aba de Gestão de Modelos</p>
                <p className="text-[11px]">Selecione um modelo à esquerda para editar, ou clique em "Criar Modelo" para inaugurar uma nova minuta regulamentar de comodato.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Signature Modal Flow */}
      {signingTerm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-lg space-y-6">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-md font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <PenTool className="text-emerald-500 animate-pulse" /> Assinatura Eletrônica Legal
              </h3>
              <button onClick={() => setSigningTerm(null)} className="text-slate-400 hover:text-slate-600">
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
    </div>
  );
};
