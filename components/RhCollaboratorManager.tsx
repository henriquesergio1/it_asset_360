import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { RhCollaborator, RhDocument } from '../types';
import { Search, Plus, Edit2, Trash2, Eye, EyeOff, MapPin, FileText, Upload, Calendar, ArrowLeft, ArrowRight, UserPlus, Info, Check, X, Loader2 } from 'lucide-react';

export const RhCollaboratorManager: React.FC = () => {
  const { rhCollaborators, sectors, addRhCollaborator, updateRhCollaborator, deleteRhCollaborator } = useData();
  const { user } = useAuth();
  const adminName = user?.name || 'Gestor R.H.';

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColab, setSelectedColab] = useState<RhCollaborator | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [revealSalaries, setRevealSalaries] = useState<Record<string, boolean>>({});
  const [cepLoading, setCepLoading] = useState(false);

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
    documents: []
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
    if (!form.fullName || !form.cpf) return;

    if (isCreating) {
      const newColab: RhCollaborator = {
        ...form as RhCollaborator,
        id: 'colab-' + Math.random().toString(36).substr(2, 9),
        documents: form.documents || []
      };
      addRhCollaborator(newColab, adminName);
      setSelectedColab(newColab);
    } else if (isEditing && selectedColab) {
      const updated: RhCollaborator = {
        ...selectedColab,
        ...form as RhCollaborator
      };
      updateRhCollaborator(updated, adminName);
      setSelectedColab(updated);
    }

    setIsCreating(false);
    setIsEditing(false);
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
    }
  };

  const filtered = rhCollaborators.filter(c => 
    c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cpf.includes(searchTerm)
  );

  const toggleSalary = (colabId: string) => {
    setRevealSalaries(p => ({ ...p, [colabId]: !p[colabId] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 id="rh-collaborators-title" className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">CADASTRO DE COLABORADORES (R.H.)</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gestão integral de dados pessoais, contratos e documentos</p>
        </div>
        {!isCreating && !isEditing && (
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
        )}
      </div>

      {isCreating || isEditing ? (
        <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-8">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700/60 pb-4">
            <h2 className="text-md font-black uppercase text-indigo-600 tracking-wider">
              {isCreating ? 'Novo Colaborador' : `Editando ${selectedColab?.fullName}`}
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setIsEditing(false);
              }}
              className="text-xs font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Seção 1: Dados Pessoais */}
            <div className="space-y-4 border-r border-slate-100 dark:border-slate-700/40 pr-6">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px]">1</span>
                Dados Pessoais
              </h3>
              
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
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data de Nascimento</label>
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
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Telefone Pessoal</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={form.personalPhone || ''}
                    onChange={e => setForm(p => ({ ...p, personalPhone: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Telefone Corp.</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={form.corporatePhone || ''}
                    onChange={e => setForm(p => ({ ...p, corporatePhone: e.target.value }))}
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
            <div className="space-y-4 border-r border-slate-100 dark:border-slate-700/40 pr-6">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px]">2</span>
                Documentos e Endereço
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
                    onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))}
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

              <div className="border-t border-slate-100 dark:border-slate-700/40 my-4 pt-4 space-y-3">
                <div className="relative">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">CEP (Busca automática)</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={form.cep || ''}
                      onBlur={handleCepBlur}
                      onChange={e => setForm(p => ({ ...p, cep: e.target.value }))}
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

            {/* Seção 3: Dados Contratuais e Anexos */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px]">3</span>
                Dados Contratuais e Anexos
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
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Cargo/Função</label>
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
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={form.salary || 0}
                      onChange={e => setForm(p => ({ ...p, salary: parseFloat(e.target.value) }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white pr-10 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Anexos de documentos */}
              <div className="border-t border-slate-100 dark:border-slate-700/40 pt-4">
                <span className="block text-[11px] font-black uppercase text-slate-400 mb-2">Anexos do Colaborador ({form.documents?.length || 0})</span>
                
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <select
                      value={docCategory}
                      onChange={e => setDocCategory(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-bold"
                    >
                      <option value="RG">RG</option>
                      <option value="CPF">CPF</option>
                      <option value="Comprovante de Residência">Residência</option>
                      <option value="Contrato de Trabalho">Contrato</option>
                      <option value="Outros">Outros</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Nome do arquivo..."
                      value={docFileName}
                      onChange={e => setDocFileName(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddDocument}
                      className="bg-indigo-600 text-white text-xs font-black px-4 rounded-xl uppercase hover:bg-indigo-700"
                    >
                      Anexar
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {form.documents?.map((doc, i) => (
                      <div key={doc.id || i} className="p-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg flex items-center justify-between text-xs border border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[9px] font-black rounded uppercase mr-2">{doc.category}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{doc.fileName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="text-rose-500 hover:text-rose-700 font-bold"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700/60 pt-6">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setIsEditing(false);
              }}
              className="px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs rounded-xl uppercase tracking-wider hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-indigo-600 text-white font-black text-xs rounded-xl uppercase tracking-wider hover:bg-indigo-700 shadow-md"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grid de colaboradores cadastrados */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4 flex flex-col h-[75vh]">
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nome ou CPF..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-3 text-xs focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedColab(c);
                    setForm(c);
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${selectedColab?.id === c.id ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700/40 hover:bg-slate-100/60'}`}
                >
                  <div>
                    <span className="block font-black text-xs text-slate-900 dark:text-white">{c.fullName}</span>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">{c.role || 'Sem Cargo'} • {c.contractType}</span>
                    <span className="text-[9px] font-mono text-slate-400 block">{c.cpf}</span>
                  </div>
                  <ChevronRight c={c} />
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-slate-400 py-6 text-center">Nenhum colaborador encontrado.</p>
              )}
            </div>
          </div>

          {/* Painel de detalhes do colaborador selecionado */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm min-h-[75vh] flex flex-col justify-between">
            {selectedColab ? (
              <div className="space-y-8 flex-1">
                {/* Header do detalhe */}
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-700/50 pb-6">
                  <div>
                    <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-black rounded-lg uppercase tracking-wider">{selectedColab.contractType}</span>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white mt-2">{selectedColab.fullName}</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{selectedColab.role || 'Cargo não cadastrado'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setForm(selectedColab);
                        setIsEditing(true);
                      }}
                      className="p-3 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <Edit2 size={16} className="text-indigo-600 dark:text-indigo-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(selectedColab.id)}
                      className="p-3 bg-slate-50 dark:bg-slate-900 hover:bg-rose-100 rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <Trash2 size={16} className="text-rose-500" />
                    </button>
                  </div>
                </div>

                {/* Grid de Informações completas em abas ou seções */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Bloco 1: Informações Pessoais */}
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
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">E-mail Corporativo</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.emailCorporate || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Tel. Corporativo</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{selectedColab.corporatePhone || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Tel. Pessoal</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{selectedColab.personalPhone || '---'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Documentos e Endereço */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest border-b border-slate-100 dark:border-slate-700/40 pb-2">2. Documentação Regulamentar</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">CPF</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedColab.cpf}</span>
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
                      <div className="col-span-2">
                        <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">CNH</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-sans">
                          {selectedColab.cnhNumber ? `${selectedColab.cnhNumber} (Cat: ${selectedColab.cnhCategory || ''}) - Vence em ${selectedColab.cnhExpiration ? new Date(selectedColab.cnhExpiration).toLocaleDateString('pt-BR') : ''}` : 'Não cadastrada'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 3: Endereço Residencial */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest border-b border-slate-100 dark:border-slate-700/40 pb-2">3. Endereço Residencial</h3>
                    <div className="text-xs space-y-2 flex items-start gap-3">
                      <MapPin size={20} className="text-slate-400 mt-1 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {selectedColab.street || 'Endereço não cadastrado'}, nº {selectedColab.number || 'S/N'}
                        </span>
                        <span className="text-slate-400 block text-[10px] font-bold">
                          {selectedColab.neighborhood || ''} • {selectedColab.city || ''} - {selectedColab.state || ''}
                        </span>
                        <span className="text-slate-400 block text-[10px] font-mono">CEP: {selectedColab.cep || '---'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 4: Dados Contratuais SENSÍVEIS com máscara de salário */}
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

                {/* Bloco 5: Histórico de Documentos Anexados */}
                <div className="border-t border-slate-100 dark:border-slate-700/40 pt-6 space-y-3">
                  <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest">Documentos Anexados</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedColab.documents && selectedColab.documents.length > 0 ? (
                      selectedColab.documents.map((doc, i) => (
                        <div key={doc.id || i} className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
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
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400/80 py-12">
                <UserPlus size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-black uppercase tracking-widest">Selecione um colaborador ao lado</p>
                <p className="text-[11px] opacity-75">Para visualizar detalhes, editar dados ou gerenciar documentos regulamentares</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ChevronRight = ({ c }: { c: any }) => (
  <svg className="w-5 h-5 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
  </svg>
);
