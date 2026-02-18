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

// Helper para normalizar identificadores (remover formatação)
const cleanId = (v: string): string => {
    return v ? v.toString().replace(/\D/g, "").trim() : "";
};

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

  const downloadTemplate = () => {
      let headers = '';
      switch(importType) {
          case 'USERS': headers = 'Nome Completo;CPF;RG;PIS;Email;Codigo de Setor;Cargo ou Funcao;Endereco'; break;
          case 'DEVICES': headers = 'Patrimonio;Serial;IMEI;ID Pulsus;Codigo de Setor;Cargo ou Funcao;Modelo;Marca;Tipo;Status;Valor Pago;Data Compra;Fornecedor;CPF Colaborador;Numero da Linha'; break;
          case 'SIMS': headers = 'Numero;Operadora;ICCID;Plano'; break;
      }
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

      const batchSeen = { cpfs: new Set<string>(), rgs: new Set<string>(), piss: new Set<string>(), tags: new Set<string>(), imeis: new Set<string>(), numbers: new Set<string>() };
      const results = rows.map(row => analyzeRow(row, batchSeen));
      setAnalyzedData(results);
      setStep('ANALYSIS');
  };

  const analyzeRow = (row: any, batchSeen: any): AnalysisResult => {
      try {
          if (importType === 'USERS') {
              const rawCpf = row['CPF']?.trim();
              if (!rawCpf) throw new Error('CPF obrigatório');
              const cpf = formatCPF(rawCpf);
              const cpfClean = cleanId(cpf);
              const rawRg = formatRG(row['RG'] || '');
              const rgClean = rawRg;
              const rawPis = formatPIS(row['PIS'] || '');
              const pisClean = cleanId(rawPis);

              if (batchSeen.cpfs.has(cpfClean)) throw new Error(`CPF duplicado no arquivo: ${cpf}`);
              const existingByCpf = users.find(u => cleanId(u.cpf) === cpfClean);
              if (existingByCpf) {
                  if (rgClean && users.some(u => u.id !== existingByCpf.id && formatRG(u.rg) === rgClean)) throw new Error(`RG ${rawRg} já pertence a outro.`);
                  batchSeen.cpfs.add(cpfClean);
                  return { status: 'CONFLICT', row, existingId: existingByCpf.id, selected: true };
              }
              batchSeen.cpfs.add(cpfClean);
              return { status: 'NEW', row, selected: true };
          } else if (importType === 'DEVICES') {
              const tag = row['Patrimonio']?.trim();
              const imei = row['IMEI']?.trim();
              if (!tag && !imei) throw new Error('Patrimônio ou IMEI obrigatório');
              if (tag && batchSeen.tags.has(tag)) throw new Error(`Patrimônio duplicado no arquivo: ${tag}`);
              const existing = tag ? devices.find(d => d.assetTag === tag) : (imei ? devices.find(d => d.imei === imei) : null);
              if (existing) {
                  if (tag) batchSeen.tags.add(tag);
                  return { status: 'CONFLICT', row, existingId: existing.id, selected: true };
              }
              if (tag) batchSeen.tags.add(tag);
              return { status: 'NEW', row, selected: true };
          } else if (importType === 'SIMS') {
              const numRaw = row['Numero']?.trim();
              if (!numRaw) throw new Error('Número é obrigatório');
              const numClean = cleanId(numRaw);
              if (batchSeen.numbers.has(numClean)) throw new Error(`Número duplicado: ${numRaw}`);
              const existing = sims.find(s => cleanId(s.phoneNumber) === numClean);
              batchSeen.numbers.add(numClean);
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
      
      const sectorMap = new Map(); sectors.forEach(s => sectorMap.set(toSlug(s.name), s.id));
      const brandMap = new Map(); brands.forEach(b => brandMap.set(toSlug(b.name), b.id));
      const typeMap = new Map(); assetTypes.forEach(t => typeMap.set(toSlug(t.name), t.id));
      const modelMap = new Map(); models.forEach(m => modelMap.set(`${m.brandId}_${toSlug(m.name)}`, m.id));

      const resolveSector = async (name: string): Promise<string> => {
          if (!name) return '';
          const slug = toSlug(name);
          if (sectorMap.has(slug)) return sectorMap.get(slug)!;
          const newId = Math.random().toString(36).substr(2, 9);
          await addSector({ id: newId, name: name.trim() }, adminName);
          sectorMap.set(slug, newId);
          return newId;
      };

      for (let i = 0; i < toProcess.length; i++) {
          const item = toProcess[i];
          const r = item.row;
          try {
              if (importType === 'USERS') {
                  const sId = await resolveSector(r['Cargo ou Funcao'] || '');
                  const userData: User = {
                      id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                      fullName: r['Nome Completo'],
                      email: r['Email'] || '',
                      cpf: formatCPF(r['CPF']), 
                      rg: formatRG(r['RG'] || ''),
                      pis: formatPIS(r['PIS'] || ''), 
                      sectorId: sId,
                      active: true,
                      address: r['Endereco'] || ''
                  };
                  item.status === 'NEW' ? await addUser(userData, adminName) : await updateUser(userData, adminName);
              } else if (importType === 'DEVICES') {
                  // Mapeamento simplificado para exemplo
                  const deviceData: Device = {
                      id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                      modelId: '', // Resolver logicamente
                      assetTag: r['Patrimonio'] || '',
                      serialNumber: r['Serial'] || r['Patrimonio'],
                      status: DeviceStatus.AVAILABLE,
                      purchaseCost: 0,
                      purchaseDate: new Date().toISOString()
                  };
                  item.status === 'NEW' ? await addDevice(deviceData, adminName) : await updateDevice(deviceData, adminName);
              } else if (importType === 'SIMS') {
                  const simData: SimCard = {
                      id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                      phoneNumber: r['Numero'],
                      operator: r['Operadora'] || 'Outra',
                      iccid: r['ICCID'] || '',
                      status: DeviceStatus.AVAILABLE,
                      currentUserId: null
                  };
                  item.status === 'NEW' ? await addSim(simData, adminName) : await updateSim(simData, adminName);
              }
              setProgress(p => ({ ...p, current: i + 1, created: item.status === 'NEW' ? p.created + 1 : p.created, updated: item.status === 'CONFLICT' ? p.updated + 1 : p.updated }));
          } catch (e: any) {
              setLogs(prev => [...prev, `Erro na linha ${i+2}: ${e.message}`]);
              setProgress(p => ({ ...p, errors: p.errors + 1, current: i + 1 }));
          }
      }
      setStep('DONE');
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col h-full animate-fade-in transition-colors">
        <div className="mb-6 flex justify-between items-start">
            <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                    <Database className="text-blue-600"/> Importador de Dados
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">Mapeamento inteligente de cargos, funções e identificadores.</p>
            </div>
            {step !== 'UPLOAD' && (
                <button onClick={() => setStep('UPLOAD')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold">
                    <RefreshCw size={14}/> Recomeçar
                </button>
            )}
        </div>

        {step === 'UPLOAD' && (
            <div className="space-y-6">
                <div className="flex gap-4">
                    {(['USERS', 'DEVICES', 'SIMS'] as ImportType[]).map(t => (
                        <button key={t} onClick={() => setImportType(t)} className={`flex-1 py-5 border rounded-2xl flex flex-col items-center gap-2 transition-all ${importType === t ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-md' : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-500'}`}>
                            <span className="font-black text-lg uppercase tracking-tighter">{t === 'USERS' ? 'Colaboradores' : t === 'DEVICES' ? 'Dispositivos' : 'Chips'}</span>
                        </button>
                    ))}
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-6">
                    <div className="flex gap-4">
                        <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 px-6 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 shadow-sm font-bold text-gray-700 dark:text-slate-300 transition-all">
                            <Download size={18} className="text-blue-600"/> Baixar Modelo
                        </button>
                        <label className="flex items-center gap-2 text-sm bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 cursor-pointer shadow-lg transition-all font-bold">
                            <Upload size={18}/> Selecionar CSV
                            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                </div>
            </div>
        )}

        {step === 'ANALYSIS' && (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                <div className="flex gap-4 mb-4">
                    <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm">{analyzedData.filter(i => i.status === 'NEW').length} Novos</div>
                    <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm">{analyzedData.filter(i => i.status === 'CONFLICT').length} Existentes</div>
                </div>
                <div className="flex-1 overflow-y-auto border dark:border-slate-800 rounded-xl shadow-inner bg-white dark:bg-slate-950 transition-colors">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="px-6 py-4 font-black text-slate-600 dark:text-slate-400 uppercase">Identificador</th>
                                <th className="px-6 py-4 font-black text-slate-600 dark:text-slate-400 uppercase">Ação</th>
                                <th className="px-6 py-4 font-black text-slate-600 dark:text-slate-400 uppercase">Resumo / Erro</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-800">
                            {analyzedData.map((item, idx) => (
                                <tr key={idx} className={`hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors ${item.status === 'ERROR' ? 'bg-red-50/20 dark:bg-red-900/10' : 'bg-white dark:bg-slate-950'}`}>
                                    <td className="px-6 py-3 font-mono font-bold text-blue-900 dark:text-blue-400">
                                        {importType === 'USERS' ? item.row['CPF'] : (importType === 'DEVICES' ? (item.row['Patrimonio'] || item.row['IMEI']) : item.row['Numero'])}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2.5 py-1 rounded font-black text-[10px] ${item.status === 'NEW' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : item.status === 'CONFLICT' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                                            {item.status === 'NEW' ? 'CRIAR' : item.status === 'CONFLICT' ? 'ATUALIZAR' : 'ERRO'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-gray-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                                        {item.status === 'ERROR' ? <span className="text-red-600 flex items-center gap-1"><AlertCircle size={12}/> {item.errorMsg}</span> : (importType === 'USERS' ? item.row['Nome Completo'] : (importType === 'DEVICES' ? `${item.row['Marca']} ${item.row['Modelo']}` : `${item.row['Operadora']}`))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={executeImport} className="mt-4 bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all">Iniciar Importação</button>
            </div>
        )}

        {step === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-8">
                <Loader2 size={64} className="text-blue-600 animate-spin"/>
                <div className="text-center">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Processando {progress.current} de {progress.total}</h3>
                    <div className="w-64 bg-gray-100 dark:bg-slate-800 h-2 rounded-full mt-4 overflow-hidden border dark:border-slate-700">
                        <div className="bg-blue-600 h-full transition-all duration-300" style={{width: `${(progress.current/progress.total)*100}%`}}></div>
                    </div>
                </div>
            </div>
        )}

        {step === 'DONE' && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-6 text-center animate-scale-up">
                <CheckCircle size={80} className="text-green-500"/>
                <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Importação Concluída</h3>
                <button onClick={() => setStep('UPLOAD')} className="bg-slate-900 dark:bg-slate-700 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl">Nova Importação</button>
            </div>
        )}
    </div>
  );
};

export default DataImporter;