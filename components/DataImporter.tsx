
import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, User, SimCard, DeviceStatus, ActionType, DeviceBrand, AssetType, DeviceModel } from '../types';
import { Download, Upload, CheckCircle, AlertTriangle, AlertCircle, Loader2, Database, RefreshCw, X } from 'lucide-react';

type ImportType = 'USERS' | 'DEVICES' | 'SIMS';

interface AnalysisResult {
    status: 'NEW' | 'UNCHANGED' | 'CONFLICT' | 'ERROR';
    row: any;
    existingId?: string;
    errorMsg?: string;
    selected: boolean;
}

// Funções de Formatação Reutilizáveis
const formatCPF = (v: string): string => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length < 11) return v;
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const formatPIS = (v: string): string => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length < 11) return v;
    // Padrão PIS: 000.00000.00-0
    return v.replace(/(\d{3})(\d{5})(\d{2})(\d{1})/, "$1.$2.$3-$4");
};

const formatRG = (v: string): string => {
    return v.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
};

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

  useEffect(() => {
    setAnalyzedData([]);
    setLogs([]);
    setStep('UPLOAD');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [importType]);

  const normalizeDate = (rawDate: string): string => {
      if (!rawDate) return new Date().toISOString().split('T')[0];
      const trimmed = rawDate.trim();
      if (new RegExp('^\\d{4}-\\d{2}-\\d{2}$').test(trimmed)) return trimmed;
      const separator = trimmed.includes('/') ? '/' : trimmed.includes('-') ? '-' : null;
      if (separator) {
          const parts = trimmed.split(separator);
          if (parts.length === 3) {
              if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
      }
      return trimmed;
  };

  const toSlug = (text: string): string => {
      if (!text) return '';
      return text.toString()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "")
          .trim();
  };

  const mapStatus = (raw: string, hasUser: boolean): DeviceStatus => {
      if (hasUser) return DeviceStatus.IN_USE;
      if (!raw) return DeviceStatus.AVAILABLE;
      const clean = raw.normalize("NFD").replace(new RegExp('[\\u0300-\\u036f]', 'g'), "").toLowerCase().trim();
      if (['disponivel', 'estoque', 'liberado', 'vago', 'livre'].includes(clean)) return DeviceStatus.AVAILABLE;
      if (['em uso', 'uso', 'atribuido', 'vinculado'].includes(clean)) return DeviceStatus.IN_USE;
      if (['manutencao', 'conserto', 'reparo'].includes(clean)) return DeviceStatus.MAINTENANCE;
      if (['descarte', 'descartado', 'sucata', 'baixado'].includes(clean)) return DeviceStatus.RETIRED;
      return DeviceStatus.AVAILABLE;
  };

  const getTemplateHeaders = () => {
      switch(importType) {
          case 'USERS': return 'Nome Completo;CPF;RG;PIS;Email;Codigo de Setor;Cargo ou Funcao;Endereco';
          case 'DEVICES': return 'Patrimonio;Serial;IMEI;ID Pulsus;Codigo de Setor;Cargo ou Funcao;Modelo;Marca;Tipo;Status;Valor Pago;Data Compra;Fornecedor;CPF Colaborador';
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
      const lines = text.split(new RegExp('\\r?\\n')).filter(l => l.trim());
      if (lines.length < 2) return alert('Arquivo vazio ou sem dados.');
      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';
      const headers = firstLine.split(separator).map(h => h.trim().replace(new RegExp('^"|"$', 'g'), ''));
      const rows = lines.slice(1).map(line => {
          const regex = new RegExp(`${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
          const values = line.split(regex).map(v => v.trim().replace(new RegExp('^"|"$', 'g'), ''));
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
              const rawCpf = row['CPF']?.trim();
              if (!rawCpf) throw new Error('CPF obrigatório');
              const cpf = formatCPF(rawCpf);
              const existing = users.find(u => u.cpf === cpf);
              if (!existing) return { status: 'NEW', row, selected: true };
              return { status: 'CONFLICT', row, existingId: existing.id, selected: true };
          } else if (importType === 'DEVICES') {
              const tag = row['Patrimonio']?.trim();
              const imei = row['IMEI']?.trim();
              if (!tag && !imei) throw new Error('Patrimônio ou IMEI obrigatório');
              const existing = devices.find(d => (tag && d.assetTag === tag) || (imei && d.imei === imei));
              if (!existing) return { status: 'NEW', row, selected: true };
              return { status: 'CONFLICT', row, existingId: existing.id, selected: true };
          } else if (importType === 'SIMS') {
              const num = row['Numero']?.trim();
              if (!num) throw new Error('Número é obrigatório');
              const existing = sims.find(s => s.phoneNumber === num);
              if (!existing) return { status: 'NEW', row, selected: true };
              return { status: 'CONFLICT', row, existingId: existing.id, selected: true };
          }
          return { status: 'ERROR', row, errorMsg: 'Tipo desconhecido', selected: false };
      } catch (e: any) {
          return { status: 'ERROR', row, errorMsg: e.message, selected: false };
      }
  };

  const executeImport = async () => {
      const toProcess = analyzedData.filter(i => i.selected && i.status !== 'ERROR');
      setStep('PROCESSING');
      setProgress({ current: 0, total: toProcess.length, created: 0, updated: 0, errors: 0 });
      setLogs([]);

      // RESOLUTION CACHES (MAPS) - Garantia definitiva de unicidade
      const sectorMap = new Map<string, string>(); // slug -> id
      sectors.forEach(s => sectorMap.set(toSlug(s.name), s.id));

      const brandMap = new Map<string, string>(); // slug -> id
      brands.forEach(b => brandMap.set(toSlug(b.name), b.id));

      const typeMap = new Map<string, string>(); // slug -> id
      assetTypes.forEach(t => typeMap.set(toSlug(t.name), t.id));

      const modelMap = new Map<string, string>(); // brandId_slug -> id
      models.forEach(m => modelMap.set(`${m.brandId}_${toSlug(m.name)}`, m.id));

      const resolveSector = async (name: string): Promise<string> => {
          if (!name) return '';
          const slug = toSlug(name);
          if (sectorMap.has(slug)) return sectorMap.get(slug)!;
          const newId = Math.random().toString(36).substr(2, 9);
          await addSector({ id: newId, name: name.trim() }, adminName);
          sectorMap.set(slug, newId);
          return newId;
      };

      const resolveBrand = async (name: string): Promise<string> => {
          const cleanName = (name || 'Outros').trim();
          const slug = toSlug(cleanName);
          if (brandMap.has(slug)) return brandMap.get(slug)!;
          const newId = Math.random().toString(36).substr(2, 9);
          await addBrand({ id: newId, name: cleanName }, adminName);
          brandMap.set(slug, newId);
          return newId;
      };

      const resolveType = async (name: string): Promise<string> => {
          const cleanName = (name || 'Outros').trim();
          const slug = toSlug(cleanName);
          if (typeMap.has(slug)) return typeMap.get(slug)!;
          const newId = Math.random().toString(36).substr(2, 9);
          await addAssetType({ id: newId, name: cleanName, customFieldIds: [] }, adminName);
          typeMap.set(slug, newId);
          return newId;
      };

      const resolveModel = async (name: string, bId: string, tId: string): Promise<string> => {
          const cleanName = (name || 'Padrão').trim();
          const slugKey = `${bId}_${toSlug(cleanName)}`;
          if (modelMap.has(slugKey)) return modelMap.get(slugKey)!;
          const newId = Math.random().toString(36).substr(2, 9);
          await addModel({ id: newId, name: cleanName, brandId: bId, typeId: tId }, adminName);
          modelMap.set(slugKey, newId);
          return newId;
      };

      for (let i = 0; i < toProcess.length; i++) {
          const item = toProcess[i];
          const r = item.row;
          try {
              if (importType === 'USERS') {
                  const sId = await resolveSector(r['Cargo ou Funcao']);
                  const userData: User = {
                      id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                      fullName: r['Nome Completo'],
                      email: r['Email'] || '',
                      cpf: formatCPF(r['CPF']), 
                      rg: formatRG(r['RG'] || ''),
                      pis: formatPIS(r['PIS'] || ''), 
                      internalCode: r['Codigo de Setor'],
                      sectorId: sId,
                      jobTitle: r['Cargo ou Funcao'] || '', 
                      address: r['Endereco'] || '',
                      active: true
                  };
                  item.status === 'NEW' ? await addUser(userData, adminName) : await updateUser(userData, adminName);
                  item.status === 'NEW' ? setProgress(p => ({ ...p, created: p.created + 1 })) : setProgress(p => ({ ...p, updated: p.updated + 1 }));
              } 
              else if (importType === 'DEVICES') {
                  const bId = await resolveBrand(r['Marca']);
                  const tId = await resolveType(r['Tipo']);
                  const mId = await resolveModel(r['Modelo'], bId, tId);

                  const userCpfRaw = r['CPF Colaborador']?.trim();
                  const userCpfFormatted = userCpfRaw ? formatCPF(userCpfRaw) : null;
                  const linkedUser = userCpfFormatted ? users.find(u => u.cpf === userCpfFormatted) : null;
                  const sId = await resolveSector(r['Codigo de Setor']);

                  const deviceData: Device = {
                      id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                      modelId: mId,
                      assetTag: r['Patrimonio'],
                      serialNumber: r['Serial'] || r['Patrimonio'],
                      imei: r['IMEI'],
                      pulsusId: r['ID Pulsus'],
                      internalCode: r['Codigo de Setor'],
                      sectorId: sId || linkedUser?.sectorId || null, 
                      status: mapStatus(r['Status'], !!linkedUser),
                      currentUserId: linkedUser?.id || null,
                      purchaseCost: parseFloat(r['Valor Pago']?.toString().replace(',','.')) || 0,
                      purchaseDate: normalizeDate(r['Data Compra']),
                      supplier: r['Fornecedor'],
                      customData: {}
                  };
                  item.status === 'NEW' ? await addDevice(deviceData, adminName) : await updateDevice(deviceData, adminName);
                  item.status === 'NEW' ? setProgress(p => ({ ...p, created: p.created + 1 })) : setProgress(p => ({ ...p, updated: p.updated + 1 }));
              }
              else if (importType === 'SIMS') {
                  const simData: SimCard = {
                      id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                      phoneNumber: r['Numero'],
                      operator: r['Operadora'] || 'Outra',
                      iccid: r['ICCID'] || '',
                      planDetails: r['Plano'] || '',
                      status: DeviceStatus.AVAILABLE,
                      currentUserId: null
                  };
                  item.status === 'NEW' ? await addSim(simData, adminName) : await updateSim(simData, adminName);
                  item.status === 'NEW' ? setProgress(p => ({ ...p, created: p.created + 1 })) : setProgress(p => ({ ...p, updated: p.updated + 1 }));
              }
              setProgress(p => ({ ...p, current: i + 1 }));
          } catch (e: any) {
              setLogs(prev => [...prev, `Erro na linha ${i+2}: ${e.message}`]);
              setProgress(p => ({ ...p, errors: p.errors + 1, current: i + 1 }));
          }
      }
      setStep('DONE');
  };

  const handleStartNew = () => {
      setAnalyzedData([]);
      setLogs([]);
      setProgress({ current: 0, total: 0, created: 0, updated: 0, errors: 0 });
      setStep('UPLOAD');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in">
        <div className="mb-6 flex justify-between items-start">
            <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Database className="text-blue-600"/> Importador de Dados
                </h3>
                <p className="text-sm text-gray-500">Unificação inteligente de modelos e marcas via Slugs.</p>
            </div>
            {step !== 'UPLOAD' && (
                <button onClick={handleStartNew} className="text-sm text-blue-600 hover:underline flex items-center gap-1 font-bold">
                    <RefreshCw size={14}/> Recomeçar
                </button>
            )}
        </div>

        {step === 'UPLOAD' && (
            <div className="space-y-6">
                <div className="flex gap-4">
                    {(['USERS', 'DEVICES', 'SIMS'] as ImportType[]).map(t => (
                        <button key={t} onClick={() => setImportType(t)} className={`flex-1 py-5 border rounded-2xl flex flex-col items-center gap-2 transition-all ${importType === t ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md scale-[1.02]' : 'hover:bg-gray-50 text-gray-500'}`}>
                            <span className="font-black text-lg uppercase tracking-tighter">{t === 'USERS' ? 'Colaboradores' : t === 'DEVICES' ? 'Dispositivos' : 'Chips'}</span>
                        </button>
                    ))}
                </div>
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center justify-center gap-6">
                    <div className="flex gap-4">
                        <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm bg-white border border-gray-300 px-6 py-3 rounded-xl hover:bg-gray-100 shadow-sm font-bold text-gray-700 transition-all">
                            <Download size={18} className="text-blue-600"/> Baixar Planilha Modelo
                        </button>
                        <label className="flex items-center gap-2 text-sm bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 cursor-pointer shadow-lg transition-all font-bold">
                            <Upload size={18}/> Selecionar Arquivo CSV
                            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                    <p className="text-[11px] text-gray-400 text-center max-w-md italic">
                        {importType === 'USERS' ? 'Nota: Identificação via CPF. Campos RG, PIS e Endereço agora são importados e formatados.' : 
                         importType === 'DEVICES' ? 'Nota: O sistema agrupa modelos e marcas ignorando acentos, espaços e maiúsculas (Deduplicação Definitiva).' :
                         'Nota: Identificação via Número do Chip.'}
                    </p>
                </div>
            </div>
        )}

        {step === 'ANALYSIS' && (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                <div className="flex gap-4 mb-4">
                    <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm">{analyzedData.filter(i => i.status === 'NEW').length} Novos</div>
                    <div className="bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm">{analyzedData.filter(i => i.status === 'CONFLICT').length} Existentes</div>
                    {analyzedData.some(i => i.status === 'ERROR') && (
                        <div className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm">{analyzedData.filter(i => i.status === 'ERROR').length} Com Erro</div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto border rounded-xl shadow-inner bg-white">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="px-6 py-4 font-black text-slate-600 uppercase">Identificador</th>
                                <th className="px-6 py-4 font-black text-slate-600 uppercase">Ação</th>
                                <th className="px-6 py-4 font-black text-slate-600 uppercase">Resumo / Erro</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analyzedData.map((item, idx) => (
                                <tr key={idx} className="border-b hover:bg-blue-50/30 transition-colors">
                                    <td className="px-6 py-3 font-mono font-bold text-blue-900">
                                        {importType === 'USERS' ? item.row['CPF'] : 
                                         importType === 'DEVICES' ? (item.row['Patrimonio'] || item.row['IMEI']) : 
                                         item.row['Numero']}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2.5 py-1 rounded font-black text-[10px] ${item.status === 'NEW' ? 'bg-green-100 text-green-700' : item.status === 'CONFLICT' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.status === 'NEW' ? 'CRIAR' : item.status === 'CONFLICT' ? 'ATUALIZAR' : 'ERRO'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-gray-500 font-bold uppercase text-[10px]">
                                        {item.status === 'ERROR' ? (
                                            <span className="text-red-500">{item.errorMsg}</span>
                                        ) : (
                                            importType === 'USERS' ? item.row['Nome Completo'] :
                                            importType === 'DEVICES' ? `${item.row['Marca']} ${item.row['Modelo']}` :
                                            `${item.row['Operadora']} - ${item.row['Plano']}`
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={executeImport} className="mt-4 bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all">
                    Iniciar Processamento ({analyzedData.filter(i => i.selected && i.status !== 'ERROR').length} itens)
                </button>
            </div>
        )}

        {step === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-8">
                <Loader2 size={64} className="text-blue-600 animate-spin"/>
                <div className="text-center">
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Processando {progress.current} de {progress.total}</h3>
                    <div className="w-64 bg-gray-100 h-2 rounded-full mt-4 overflow-hidden border">
                        <div className="bg-blue-600 h-full transition-all duration-300" style={{width: `${(progress.current/progress.total)*100}%`}}></div>
                    </div>
                </div>
            </div>
        )}

        {step === 'DONE' && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-6 text-center">
                <CheckCircle size={80} className="text-green-500 animate-bounce"/>
                <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none">Importação Concluída</h3>
                <div className="grid grid-cols-3 gap-8 bg-slate-50 p-8 rounded-3xl border shadow-inner">
                    <div><p className="text-3xl font-black text-green-600">{progress.created}</p><p className="text-[10px] font-bold uppercase text-gray-400">Criados</p></div>
                    <div><p className="text-3xl font-black text-orange-500">{progress.updated}</p><p className="text-[10px] font-bold uppercase text-gray-400">Atualizados</p></div>
                    <div><p className="text-3xl font-black text-red-500">{progress.errors}</p><p className="text-[10px] font-bold uppercase text-gray-400">Erros</p></div>
                </div>
                <button onClick={handleStartNew} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95">Nova Importação</button>
                {logs.length > 0 && (
                    <div className="w-full max-w-xl bg-red-50 p-4 rounded-xl text-left text-xs text-red-700 border border-red-200 overflow-y-auto max-h-40 shadow-sm font-mono">
                        <p className="font-bold mb-2 uppercase text-[10px]">Logs de Erro:</p>
                        <ul className="list-decimal pl-6 space-y-1">{logs.map((l, i) => <li key={i}>{l}</li>)}</ul>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default DataImporter;
