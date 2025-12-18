
import React, { useState, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, User, SimCard, DeviceStatus, UserSector, DeviceModel, DeviceBrand, AssetType } from '../types';
import { Download, Upload, FileText, CheckCircle, AlertTriangle, AlertCircle, Loader2, Database, ArrowRight, RefreshCcw, X, CheckSquare, ChevronRight, ChevronDown } from 'lucide-react';

type ImportType = 'USERS' | 'DEVICES' | 'SIMS';

interface AnalysisResult {
    status: 'NEW' | 'UNCHANGED' | 'CONFLICT' | 'ERROR';
    row: any;
    existingId?: string;
    diffs?: any[];
    errorMsg?: string;
    selected: boolean;
}

const DataImporter = () => {
  const { 
    users, addUser, updateUser,
    devices, addDevice, updateDevice,
    sims, addSim, updateSim,
    sectors, addSector,
    models, addModel,
    brands, addBrand,
    assetTypes, addAssetType
  } = useData();
  const { user: currentUser } = useAuth();
  
  const [step, setStep] = useState<'UPLOAD' | 'ANALYSIS' | 'PROCESSING' | 'DONE'>('UPLOAD');
  const [importType, setImportType] = useState<ImportType>('USERS');
  const [analyzedData, setAnalyzedData] = useState<AnalysisResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, created: 0, updated: 0, errors: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adminName = currentUser?.name || 'Importador';

  const mapStatus = (raw: string): DeviceStatus => {
      if (!raw) return DeviceStatus.AVAILABLE;
      const clean = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      if (['disponivel', 'estoque', 'liberado', 'vago', 'livre'].includes(clean)) return DeviceStatus.AVAILABLE;
      if (['em uso', 'uso', 'atribuido', 'vinculado', 'utilizacao'].includes(clean)) return DeviceStatus.IN_USE;
      if (['manutencao', 'conserto', 'reparo', 'assistencia', 'estragado', 'defeito'].includes(clean)) return DeviceStatus.MAINTENANCE;
      if (['descarte', 'descartado', 'sucata', 'baixado', 'excluido', 'lixo', 'quebrado'].includes(clean)) return DeviceStatus.RETIRED;
      return DeviceStatus.AVAILABLE;
  };

  const getTemplateHeaders = () => {
      switch(importType) {
          case 'USERS': return 'Nome Completo;Email;CPF;PIS;Setor;RG;Endereco;Codigo de Setor';
          case 'DEVICES': return 'Patrimonio;Serial;Modelo;Marca;Tipo;Status;Valor Pago;Data Compra;Fornecedor;IMEI;ID Pulsus;Codigo de Setor;Email Responsavel;Setor Ativo;Centro de Custo';
          case 'SIMS': return 'Numero;Operadora;ICCID;Plano';
          default: return '';
      }
  };

  const downloadTemplate = () => {
      const headers = getTemplateHeaders();
      const blob = new Blob(["\uFEFF" + headers], { type: 'text/csv;charset=utf-8;' }); 
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `template_${importType.toLowerCase()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => parseAndAnalyze(evt.target?.result as string);
      reader.readAsText(file);
  };

  const parseAndAnalyze = (text: string) => {
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return alert('Arquivo vazio.');
      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';
      const headers = firstLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map(line => {
          const regex = new RegExp(`${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
          const values = line.split(regex).map(v => v.trim().replace(/^"|"$/g, ''));
          return headers.reduce((obj: any, header, index) => {
              obj[header] = values[index] || '';
              return obj;
          }, {});
      });
      setAnalyzedData(rows.map(row => analyzeRow(row)));
      setStep('ANALYSIS');
  };

  const analyzeRow = (row: any): AnalysisResult => {
      try {
          if (importType === 'USERS') {
              const email = row['Email']?.trim();
              if (!email) throw new Error('Email obrigatório');
              const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
              if (!existing) return { status: 'NEW', row, selected: true };
              return { status: 'CONFLICT', row, existingId: existing.id, selected: true };
          } else if (importType === 'DEVICES') {
              const tag = row['Patrimonio']?.trim();
              if (!tag) throw new Error('Patrimônio obrigatório');
              const existing = devices.find(d => d.assetTag.toLowerCase() === tag.toLowerCase());
              if (!existing) return { status: 'NEW', row, selected: true };
              return { status: 'CONFLICT', row, existingId: existing.id, selected: true };
          } else {
              const num = row['Numero']?.trim();
              if (!num) throw new Error('Número obrigatório');
              const existing = sims.find(s => s.phoneNumber === num);
              if (!existing) return { status: 'NEW', row, selected: true };
              return { status: 'CONFLICT', row, existingId: existing.id, selected: true };
          }
      } catch (e: any) {
          return { status: 'ERROR', row, errorMsg: e.message, selected: false };
      }
  };

  const executeImport = async () => {
      const toProcess = analyzedData.filter(i => i.selected && i.status !== 'ERROR');
      if (toProcess.length === 0) return;
      setStep('PROCESSING');
      setProgress({ current: 0, total: toProcess.length, created: 0, updated: 0, errors: 0 });
      
      const brandCache = new Map();
      const typeCache = new Map();
      const modelCache = new Map();
      const sectorCache = new Map();

      for (let i = 0; i < toProcess.length; i++) {
          const item = toProcess[i];
          try {
              if (importType === 'DEVICES') {
                  const r = item.row;
                  
                  // 1. Marca
                  const bName = (r['Marca'] || 'Genérica').trim();
                  let bId = brands.find(b => b.name.toLowerCase() === bName.toLowerCase())?.id || brandCache.get(bName.toLowerCase());
                  if (!bId) {
                      bId = Math.random().toString(36).substr(2, 9);
                      addBrand({ id: bId, name: bName }, adminName);
                      brandCache.set(bName.toLowerCase(), bId);
                  }

                  // 2. Tipo
                  const tName = (r['Tipo'] || 'Outros').trim();
                  let tId = assetTypes.find(t => t.name.toLowerCase() === tName.toLowerCase())?.id || typeCache.get(tName.toLowerCase());
                  if (!tId) {
                      tId = Math.random().toString(36).substr(2, 9);
                      addAssetType({ id: tId, name: tName }, adminName);
                      typeCache.set(tName.toLowerCase(), tId);
                  }

                  // 3. Modelo
                  const mName = (r['Modelo'] || 'Genérico').trim();
                  let mId = models.find(m => m.name.toLowerCase() === mName.toLowerCase() && m.brandId === bId)?.id || modelCache.get(mName.toLowerCase() + bId);
                  if (!mId) {
                      mId = Math.random().toString(36).substr(2, 9);
                      addModel({ id: mId, name: mName, brandId: bId, typeId: tId }, adminName);
                      modelCache.set(mName.toLowerCase() + bId, mId);
                  }

                  // 4. Setor do Ativo
                  const sName = (r['Setor Ativo'] || '').trim();
                  let sId = '';
                  if (sName) {
                      sId = sectors.find(s => s.name.toLowerCase() === sName.toLowerCase())?.id || sectorCache.get(sName.toLowerCase());
                      if (!sId) {
                          sId = Math.random().toString(36).substr(2, 9);
                          addSector({ id: sId, name: sName }, adminName);
                          sectorCache.set(sName.toLowerCase(), sId);
                      }
                  }

                  const respEmail = r['Email Responsavel']?.trim().toLowerCase();
                  const foundUser = respEmail ? users.find(u => u.email.toLowerCase() === respEmail) : null;
                  const targetStatus = foundUser ? DeviceStatus.IN_USE : mapStatus(r['Status']);

                  const deviceData: Device = {
                      id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                      modelId: mId,
                      assetTag: r['Patrimonio'],
                      serialNumber: r['Serial'] || r['Patrimonio'],
                      status: targetStatus,
                      currentUserId: foundUser?.id || null,
                      pulsusId: r['ID Pulsus'],
                      sectorCode: r['Codigo de Setor'], 
                      imei: r['IMEI'],
                      sectorId: sId || undefined,
                      costCenter: r['Centro de Custo'],
                      purchaseCost: parseFloat(r['Valor Pago']?.replace(',', '.') || '0'),
                      purchaseDate: r['Data Compra'] || new Date().toISOString().split('T')[0],
                      supplier: r['Fornecedor'],
                      customData: {}
                  };

                  if (item.status === 'NEW') { addDevice(deviceData, adminName); setProgress(p => ({ ...p, created: p.created + 1 })); }
                  else { updateDevice(deviceData, adminName); setProgress(p => ({ ...p, updated: p.updated + 1 })); }

              } else if (importType === 'USERS') {
                  const r = item.row;

                  // Setor do Usuário
                  const uSectorName = (r['Setor'] || '').trim();
                  let uSectorId = '';
                  if (uSectorName) {
                      uSectorId = sectors.find(s => s.name.toLowerCase() === uSectorName.toLowerCase())?.id || sectorCache.get(uSectorName.toLowerCase());
                      if (!uSectorId) {
                          uSectorId = Math.random().toString(36).substr(2, 9);
                          addSector({ id: uSectorId, name: uSectorName }, adminName);
                          sectorCache.set(uSectorName.toLowerCase(), uSectorId);
                      }
                  }

                  const userData: User = {
                      id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                      fullName: r['Nome Completo'],
                      email: r['Email'],
                      cpf: r['CPF'],
                      pis: r['PIS'],
                      jobTitle: r['Cargo/Funcao'] || '', // Fallback para compatibilidade se vier do CSV antigo
                      sectorCode: r['Codigo de Setor'], 
                      rg: r['RG'],
                      address: r['Endereco'],
                      sectorId: uSectorId, 
                      active: true
                  };
                  if (item.status === 'NEW') { addUser(userData, adminName); setProgress(p => ({ ...p, created: p.created + 1 })); }
                  else { updateUser(userData, adminName); setProgress(p => ({ ...p, updated: p.updated + 1 })); }
              }
              setProgress(p => ({ ...p, current: i + 1 }));
          } catch (e: any) {
              setProgress(p => ({ ...p, errors: p.errors + 1, current: i + 1 }));
              setLogs(prev => [...prev, `Erro: ${e.message}`]);
          }
      }
      setStep('DONE');
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in">
        <div className="mb-8">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <Database className="text-blue-600"/> Importador de Dados Completo
            </h3>
            <p className="text-slate-500 font-medium">Migre Colaboradores, Dispositivos e Vínculos sem perda de informação.</p>
        </div>

        {step === 'UPLOAD' && (
            <div className="space-y-8">
                <div className="grid grid-cols-3 gap-4">
                    {(['USERS', 'DEVICES', 'SIMS'] as ImportType[]).map(t => (
                        <button key={t} onClick={() => setImportType(t)} className={`py-6 border-2 rounded-2xl flex flex-col items-center gap-3 transition-all ${importType === t ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-xl' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}>
                            <span className="font-black text-lg uppercase tracking-widest">{t === 'USERS' ? 'Colaboradores' : t === 'DEVICES' ? 'Dispositivos' : 'Chips'}</span>
                            <div className={`h-2 w-2 rounded-full ${importType === t ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                        </button>
                    ))}
                </div>
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-16 flex flex-col items-center justify-center gap-8 group hover:border-blue-300 transition-colors">
                    <div className="flex gap-4">
                        <button onClick={downloadTemplate} className="flex items-center gap-3 px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-50 font-black uppercase text-xs tracking-widest transition-all">
                            <Download size={20} className="text-blue-600"/> Baixar Planilha Modelo
                        </button>
                        <label className="flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 cursor-pointer shadow-xl font-black uppercase text-xs tracking-widest transition-all hover:scale-105 active:scale-95">
                            <Upload size={20}/> Carregar CSV
                            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-sm font-bold text-slate-400">Suporte completo para <span className="text-blue-600">Setores, ID Pulsus, Código de Setor, IMEI</span> e vínculos automáticos por e-mail.</p>
                    </div>
                </div>
            </div>
        )}

        {step === 'ANALYSIS' && (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex gap-3">
                        <div className="bg-green-100 text-green-700 px-6 py-2 rounded-xl text-xs font-black uppercase shadow-sm border border-green-200">{analyzedData.filter(i => i.status === 'NEW').length} Novos</div>
                        <div className="bg-orange-100 text-orange-700 px-6 py-2 rounded-xl text-xs font-black uppercase shadow-sm border border-orange-200">{analyzedData.filter(i => i.status === 'CONFLICT').length} Atualizações</div>
                    </div>
                    <button onClick={() => setStep('UPLOAD')} className="text-xs font-black text-slate-400 hover:text-slate-600 uppercase flex items-center gap-2 transition-colors"><RefreshCcw size={14}/> Trocar Arquivo</button>
                </div>
                <div className="flex-1 overflow-y-auto border-2 border-slate-100 rounded-2xl shadow-inner bg-white">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 sticky top-0 shadow-sm z-10 border-b">
                            <tr>
                                <th className="px-8 py-4 font-black text-slate-400 uppercase tracking-widest">Identificador</th>
                                <th className="px-8 py-4 font-black text-slate-400 uppercase tracking-widest">Operação</th>
                                <th className="px-8 py-4 font-black text-slate-400 uppercase tracking-widest">Setor / Responsável</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analyzedData.map((item, idx) => (
                                <tr key={idx} className="border-b hover:bg-blue-50/50 transition-colors">
                                    <td className="px-8 py-4 font-mono font-bold text-slate-700">
                                        {importType === 'USERS' ? item.row['Email'] : item.row['Patrimonio']}
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className={`px-4 py-1.5 rounded-lg font-black text-[10px] tracking-tighter shadow-sm border ${item.status === 'NEW' ? 'bg-green-50 text-green-600 border-green-200' : item.status === 'CONFLICT' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                                            {item.status === 'NEW' ? 'CRIAR' : item.status === 'CONFLICT' ? 'ATUALIZAR' : 'ERRO'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4">
                                        <div className="flex flex-col gap-1">
                                            {item.row['Setor'] || item.row['Setor Ativo'] ? <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black w-fit uppercase">SETOR: {item.row['Setor'] || item.row['Setor Ativo']}</span> : null}
                                            {importType === 'DEVICES' && item.row['Email Responsavel'] && <span className="text-emerald-600 font-bold text-[10px] flex items-center gap-1"><CheckCircle size={10}/> Vínculo: {item.row['Email Responsavel']}</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={executeImport} className="mt-8 bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-700 transition-all hover:scale-[1.01] active:scale-95">
                    Processar {analyzedData.filter(x => x.status !== 'ERROR').length} Itens
                </button>
            </div>
        )}

        {step === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-10 animate-fade-in">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-30"></div>
                    <Loader2 size={80} className="text-blue-600 animate-spin relative z-10"/>
                </div>
                <div className="text-center">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Sincronizando Banco de Dados SQL Server</h3>
                    <p className="text-slate-500 font-bold mt-2">Item {progress.current} de {progress.total}...</p>
                </div>
                <div className="w-full max-w-lg bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner border border-slate-200">
                    <div className="bg-blue-600 h-full transition-all duration-300 shadow-lg" style={{width: `${(progress.current/progress.total)*100}%`}}></div>
                </div>
            </div>
        )}

        {step === 'DONE' && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-10 animate-fade-in">
                <div className="h-28 w-28 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                    <CheckCircle size={64} strokeWidth={2.5}/>
                </div>
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Sincronização Finalizada!</h3>
                <div className="grid grid-cols-3 gap-8 text-center bg-white p-12 rounded-[2.5rem] border-2 border-slate-100 shadow-2xl w-full max-w-2xl">
                    <div className="space-y-1"><p className="text-5xl font-black text-green-600">{progress.created}</p><p className="text-xs uppercase font-black text-slate-400 tracking-widest">Novos</p></div>
                    <div className="space-y-1"><p className="text-5xl font-black text-blue-500">{progress.updated}</p><p className="text-xs uppercase font-black text-slate-400 tracking-widest">Atualizados</p></div>
                    <div className="space-y-1"><p className="text-5xl font-black text-red-500">{progress.errors}</p><p className="text-xs uppercase font-black text-slate-400 tracking-widest">Falhas</p></div>
                </div>
                <button onClick={() => setStep('UPLOAD')} className="bg-slate-900 text-white px-16 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all hover:scale-105">Nova Importação</button>
            </div>
        )}
    </div>
  );
};

export default DataImporter;
