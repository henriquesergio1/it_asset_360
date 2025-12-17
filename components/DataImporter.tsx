
import React, { useState, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, User, SimCard, DeviceStatus, UserSector, DeviceModel, DeviceBrand, AssetType } from '../types';
import { Download, Upload, FileText, CheckCircle, AlertTriangle, Loader2, Database, ArrowRight, RefreshCcw, X, CheckSquare, ChevronRight, ChevronDown } from 'lucide-react';

type ImportType = 'USERS' | 'DEVICES' | 'SIMS';

interface DiffItem {
    field: string;
    oldValue: string;
    newValue: string;
}

interface AnalysisResult {
    status: 'NEW' | 'UNCHANGED' | 'CONFLICT' | 'ERROR';
    row: any;
    existingId?: string; // ID se existir
    diffs?: DiffItem[];
    errorMsg?: string;
    selected: boolean; // Se deve ser processado
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
  
  // UI State
  const [step, setStep] = useState<'UPLOAD' | 'ANALYSIS' | 'PROCESSING' | 'DONE'>('UPLOAD');
  const [importType, setImportType] = useState<ImportType>('USERS');
  const [analyzedData, setAnalyzedData] = useState<AnalysisResult[]>([]);
  
  // Processing State
  const [progress, setProgress] = useState({ current: 0, total: 0, created: 0, updated: 0, errors: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adminName = currentUser?.name || 'Importador';

  // --- CSV TEMPLATES ---
  const getTemplateHeaders = () => {
      switch(importType) {
          case 'USERS': return 'Nome Completo,Email,CPF,PIS,Funcao (Dropdown),Setor/Codigo (Texto),RG,Endereco';
          case 'DEVICES': return 'Patrimonio(Tag),Serial,Modelo,Marca,Tipo,Status,Valor Compra,Data Compra(AAAA-MM-DD),IMEI';
          case 'SIMS': return 'Numero,Operadora,ICCID,Plano';
          default: return '';
      }
  };

  const downloadTemplate = () => {
      const headers = getTemplateHeaders();
      const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `template_importacao_${importType.toLowerCase()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- PARSER & ANALYSIS ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          const text = evt.target?.result as string;
          parseAndAnalyze(text);
      };
      reader.readAsText(file);
  };

  const parseAndAnalyze = (text: string) => {
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
          alert('Arquivo vazio ou sem dados.');
          return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
          const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
          return headers.reduce((obj: any, header, index) => {
              obj[header] = values[index] || '';
              return obj;
          }, {});
      });

      const analysis = rows.map(row => analyzeRow(row));
      setAnalyzedData(analysis);
      setStep('ANALYSIS');
  };

  // --- CORE LOGIC: COMPARE EXISTING VS NEW ---
  const analyzeRow = (row: any): AnalysisResult => {
      try {
          if (importType === 'USERS') {
              return compareUser(row);
          } else if (importType === 'DEVICES') {
              return compareDevice(row);
          } else {
              return compareSim(row);
          }
      } catch (e: any) {
          return { status: 'ERROR', row, errorMsg: e.message, selected: false };
      }
  };

  // 1. COMPARAÇÃO DE USUÁRIOS
  const compareUser = (row: any): AnalysisResult => {
      const email = row['Email'];
      const cpf = row['CPF'];
      if (!email && !cpf) throw new Error('Email ou CPF obrigatório');

      // Busca existente
      const existing = users.find(u => 
          (email && u.email.toLowerCase() === email.toLowerCase()) || 
          (cpf && u.cpf.replace(/\D/g,'') === cpf.replace(/\D/g,''))
      );

      if (!existing) return { status: 'NEW', row, selected: true };

      // Verifica Diferenças
      const diffs: DiffItem[] = [];
      
      if (row['Nome Completo'] && existing.fullName !== row['Nome Completo']) {
          diffs.push({ field: 'Nome', oldValue: existing.fullName, newValue: row['Nome Completo'] });
      }
      if (row['RG'] && existing.rg !== row['RG']) {
          diffs.push({ field: 'RG', oldValue: existing.rg || 'Vazio', newValue: row['RG'] });
      }
      if (row['PIS'] && existing.pis !== row['PIS']) {
          diffs.push({ field: 'PIS', oldValue: existing.pis || 'Vazio', newValue: row['PIS'] });
      }
      if (row['Endereco'] && existing.address !== row['Endereco']) {
          diffs.push({ field: 'Endereço', oldValue: existing.address || 'Vazio', newValue: row['Endereco'] });
      }
      // Setor (Função Dropdown)
      const newSectorName = row['Funcao (Dropdown)'];
      if (newSectorName) {
          const currentSectorName = sectors.find(s => s.id === existing.sectorId)?.name;
          if (currentSectorName?.toLowerCase() !== newSectorName.toLowerCase()) {
              diffs.push({ field: 'Função', oldValue: currentSectorName || 'Vazio', newValue: newSectorName });
          }
      }
      // JobTitle (Texto Livre)
      if (row['Setor/Codigo (Texto)'] && existing.jobTitle !== row['Setor/Codigo (Texto)']) {
          diffs.push({ field: 'Cód. Interno', oldValue: existing.jobTitle || 'Vazio', newValue: row['Setor/Codigo (Texto)'] });
      }

      if (diffs.length > 0) {
          return { status: 'CONFLICT', row, existingId: existing.id, diffs, selected: true };
      }

      return { status: 'UNCHANGED', row, selected: false };
  };

  // 2. COMPARAÇÃO DE DISPOSITIVOS (ATUALIZADO PARA IMEI INTELIGENTE)
  const compareDevice = (row: any): AnalysisResult => {
      const tag = row['Patrimonio(Tag)'];
      const imei = row['IMEI'];
      
      // Validação: Pelo menos um dos dois deve estar preenchido
      if (!tag && !imei) throw new Error('Identificação insuficiente: Preencha Patrimônio ou IMEI');

      // Busca existente por Tag OU por IMEI (Se preenchidos)
      const existing = devices.find(d => 
          (tag && d.assetTag.toLowerCase() === tag.toLowerCase()) || 
          (imei && d.imei === imei)
      );

      if (!existing) return { status: 'NEW', row, selected: true };

      const diffs: DiffItem[] = [];
      
      if (row['Serial'] && existing.serialNumber !== row['Serial']) {
          diffs.push({ field: 'Serial', oldValue: existing.serialNumber, newValue: row['Serial'] });
      }
      if (imei && existing.imei !== imei) {
          diffs.push({ field: 'IMEI', oldValue: existing.imei || 'Vazio', newValue: imei });
      }
      const statusCSV = row['Status'] as DeviceStatus;
      if (statusCSV && existing.status !== statusCSV) {
          diffs.push({ field: 'Status', oldValue: existing.status, newValue: statusCSV });
      }
      
      if (diffs.length > 0) {
          return { status: 'CONFLICT', row, existingId: existing.id, diffs, selected: true };
      }

      return { status: 'UNCHANGED', row, selected: false };
  };

  // 3. COMPARAÇÃO DE SIMS
  const compareSim = (row: any): AnalysisResult => {
      const num = row['Numero'];
      if (!num) throw new Error('Número é obrigatório');

      const existing = sims.find(s => s.phoneNumber === num);

      if (!existing) return { status: 'NEW', row, selected: true };

      const diffs: DiffItem[] = [];
      
      if (row['Operadora'] && existing.operator !== row['Operadora']) {
          diffs.push({ field: 'Operadora', oldValue: existing.operator, newValue: row['Operadora'] });
      }
      if (row['ICCID'] && existing.iccid !== row['ICCID']) {
          diffs.push({ field: 'ICCID', oldValue: existing.iccid, newValue: row['ICCID'] });
      }
      if (row['Plano'] && existing.planDetails !== row['Plano']) {
          diffs.push({ field: 'Plano', oldValue: existing.planDetails || 'Vazio', newValue: row['Plano'] });
      }

      if (diffs.length > 0) {
          return { status: 'CONFLICT', row, existingId: existing.id, diffs, selected: true };
      }

      return { status: 'UNCHANGED', row, selected: false };
  };

  // --- EXECUTION ---
  const executeImport = async () => {
      const toProcess = analyzedData.filter(i => i.selected && i.status !== 'ERROR' && i.status !== 'UNCHANGED');
      if (toProcess.length === 0) {
          alert('Nenhum item selecionado para processar.');
          return;
      }

      if (!window.confirm(`Processar ${toProcess.length} registros? (Novos e Atualizações)`)) return;

      setStep('PROCESSING');
      setProgress({ current: 0, total: toProcess.length, created: 0, updated: 0, errors: 0 });
      setLogs([]);

      // --- LOCAL CACHES FOR BATCH EXECUTION ---
      const tempSectors = new Map<string, string>();
      const tempBrands = new Map<string, string>();
      const tempAssetTypes = new Map<string, string>();
      const tempModels = new Map<string, string>();

      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      for (let i = 0; i < toProcess.length; i++) {
          const item = toProcess[i];
          try {
              if (item.status === 'NEW') {
                  await createRecord(item.row, tempSectors, tempBrands, tempAssetTypes, tempModels);
                  setProgress(p => ({ ...p, current: i + 1, created: p.created + 1 }));
              } else if (item.status === 'CONFLICT' && item.existingId) {
                  await updateRecord(item.existingId, item.row, tempSectors);
                  setProgress(p => ({ ...p, current: i + 1, updated: p.updated + 1 }));
              }
          } catch (e: any) {
              console.error(e);
              setProgress(p => ({ ...p, current: i + 1, errors: p.errors + 1 }));
              setLogs(prev => [...prev, `Erro (Linha ${i + 1}): ${e.message}`]);
          }
          await sleep(50);
      }

      setStep('DONE');
  };

  // --- HELPERS CREATE/UPDATE (WITH CACHING) ---
  
  const resolveSector = (name: string, cache: Map<string, string>): string => {
      const normalized = name.trim().toLowerCase();
      const existing = sectors.find(s => s.name.toLowerCase() === normalized);
      if (existing) return existing.id;
      if (cache.has(normalized)) return cache.get(normalized)!;
      const newId = Math.random().toString(36).substr(2, 9);
      addSector({ id: newId, name }, adminName);
      cache.set(normalized, newId);
      return newId;
  };

  const resolveBrand = (name: string, cache: Map<string, string>): string => {
      const normalized = name.trim().toLowerCase();
      const existing = brands.find(b => b.name.toLowerCase() === normalized);
      if (existing) return existing.id;
      if (cache.has(normalized)) return cache.get(normalized)!;
      const newId = Math.random().toString(36).substr(2, 9);
      addBrand({ id: newId, name }, adminName);
      cache.set(normalized, newId);
      return newId;
  };

  const resolveType = (name: string, cache: Map<string, string>): string => {
      const normalized = name.trim().toLowerCase();
      const existing = assetTypes.find(t => t.name.toLowerCase() === normalized);
      if (existing) return existing.id;
      if (cache.has(normalized)) return cache.get(normalized)!;
      const newId = Math.random().toString(36).substr(2, 9);
      addAssetType({ id: newId, name }, adminName);
      cache.set(normalized, newId);
      return newId;
  };

  const resolveModel = (name: string, brandId: string, typeId: string, cache: Map<string, string>): string => {
      const normalized = name.trim().toLowerCase();
      const existing = models.find(m => m.name.toLowerCase() === normalized && m.brandId === brandId);
      if (existing) return existing.id;
      const cacheKey = `${normalized}_${brandId}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey)!;
      const newId = Math.random().toString(36).substr(2, 9);
      addModel({ id: newId, name, brandId, typeId, imageUrl: '' }, adminName);
      cache.set(cacheKey, newId);
      return newId;
  };

  const createRecord = async (
      row: any, 
      secCache: Map<string, string>,
      brandCache: Map<string, string>,
      typeCache: Map<string, string>,
      modelCache: Map<string, string>
  ) => {
      if (importType === 'USERS') {
          const secId = row['Funcao (Dropdown)'] ? resolveSector(row['Funcao (Dropdown)'], secCache) : '';
          addUser({
              id: Math.random().toString(36).substr(2, 9),
              fullName: row['Nome Completo'],
              email: row['Email'],
              cpf: row['CPF'],
              pis: row['PIS'] || '',
              jobTitle: row['Setor/Codigo (Texto)'] || '',
              sectorId: secId,
              rg: row['RG'] || '',
              address: row['Endereco'] || '',
              active: true,
              terms: []
          }, adminName);
      } 
      else if (importType === 'DEVICES') {
          const bName = row['Marca'] || 'Genérica';
          const brandId = resolveBrand(bName, brandCache);
          const tName = row['Tipo'] || 'Outros';
          const typeId = resolveType(tName, typeCache);
          const mName = row['Modelo'] || 'Genérico';
          const modelId = resolveModel(mName, brandId, typeId, modelCache);

          const tag = row['Patrimonio(Tag)'];
          const imei = row['IMEI'];
          
          // Lógica de fallback: Se a Tag está vazia, assume o IMEI como Tag
          const finalTag = tag || imei;

          addDevice({
              id: Math.random().toString(36).substr(2, 9),
              modelId,
              assetTag: finalTag,
              serialNumber: row['Serial'] || 'N/A',
              status: (row['Status'] as DeviceStatus) || DeviceStatus.AVAILABLE,
              purchaseCost: parseFloat(row['Valor Compra']) || 0,
              purchaseDate: row['Data Compra(AAAA-MM-DD)'] || new Date().toISOString().split('T')[0],
              imei: imei || undefined,
              currentUserId: null
          }, adminName);
      }
      else if (importType === 'SIMS') {
          addSim({
              id: Math.random().toString(36).substr(2, 9),
              phoneNumber: row['Numero'],
              operator: row['Operadora'],
              iccid: row['ICCID'],
              planDetails: row['Plano'],
              status: DeviceStatus.AVAILABLE,
              currentUserId: null
          }, adminName);
      }
  };

  const updateRecord = async (id: string, row: any, secCache: Map<string, string>) => {
      if (importType === 'USERS') {
          const oldUser = users.find(u => u.id === id);
          if (!oldUser) return;
          
          const updated: User = { ...oldUser };
          if(row['Nome Completo']) updated.fullName = row['Nome Completo'];
          if(row['RG']) updated.rg = row['RG'];
          if(row['PIS']) updated.pis = row['PIS'];
          if(row['Endereco']) updated.address = row['Endereco'];
          if(row['Setor/Codigo (Texto)']) updated.jobTitle = row['Setor/Codigo (Texto)'];
          if(row['Funcao (Dropdown)']) updated.sectorId = resolveSector(row['Funcao (Dropdown)'], secCache);

          updateUser(updated, adminName);
      }
      else if (importType === 'DEVICES') {
          const oldDev = devices.find(d => d.id === id);
          if (!oldDev) return;
          const updated: Device = { ...oldDev };
          
          if(row['Serial']) updated.serialNumber = row['Serial'];
          if(row['IMEI']) updated.imei = row['IMEI'];
          if(row['Status']) updated.status = row['Status'] as DeviceStatus;
          
          updateDevice(updated, adminName);
      }
      else if (importType === 'SIMS') {
          const oldSim = sims.find(s => s.id === id);
          if (!oldSim) return;
          const updated: SimCard = { ...oldSim };

          if(row['Operadora']) updated.operator = row['Operadora'];
          if(row['ICCID']) updated.iccid = row['ICCID'];
          if(row['Plano']) updated.planDetails = row['Plano'];

          updateSim(updated, adminName);
      }
  };

  const toggleSelection = (index: number) => {
      setAnalyzedData(prev => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
  };

  // --- RENDER ---
  const newCount = analyzedData.filter(i => i.status === 'NEW').length;
  const conflictCount = analyzedData.filter(i => i.status === 'CONFLICT').length;
  const unchangedCount = analyzedData.filter(i => i.status === 'UNCHANGED').length;
  const errorCount = analyzedData.filter(i => i.status === 'ERROR').length;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-fade-in flex flex-col h-full">
        <div className="mb-6 flex justify-between items-start">
            <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Database className="text-blue-600"/> Importação e Atualização Inteligente
                </h3>
                <p className="text-sm text-gray-500">
                    Importe novos registros ou atualize existentes via CSV. O sistema detectará duplicidades e sugerirá atualizações.
                </p>
            </div>
            {step !== 'UPLOAD' && step !== 'PROCESSING' && (
                <button onClick={() => { setStep('UPLOAD'); setAnalyzedData([]); if(fileInputRef.current) fileInputRef.current.value=''; }} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <RefreshCcw size={14}/> Reiniciar
                </button>
            )}
        </div>

        {/* STEP 1: UPLOAD */}
        {step === 'UPLOAD' && (
            <div className="space-y-6">
                <div className="flex gap-4">
                    {(['USERS', 'DEVICES', 'SIMS'] as ImportType[]).map(t => (
                        <button key={t} onClick={() => setImportType(t)} className={`flex-1 py-3 border rounded-lg flex flex-col items-center gap-2 transition-colors ${importType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>
                            <span className="font-bold text-sm">{t === 'USERS' ? 'Colaboradores' : t === 'DEVICES' ? 'Dispositivos' : 'Chips'}</span>
                        </button>
                    ))}
                </div>

                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center gap-4">
                    <div className="flex gap-4">
                        <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                            <Download size={16}/> Baixar Modelo CSV
                        </button>
                        <label className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer transition-colors shadow-sm">
                            <Upload size={16}/> Carregar Arquivo
                            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                    <div className="text-[10px] text-gray-400 text-center max-w-sm">
                        Dica: Na importação de celulares, se o Patrimônio estiver vazio o sistema usará o IMEI como identificador principal.
                    </div>
                </div>
            </div>
        )}

        {/* STEP 2: ANALYSIS & REVIEW */}
        {step === 'ANALYSIS' && (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex gap-4 mb-4 text-sm font-medium">
                    <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center gap-2">
                        <CheckCircle size={16}/> {newCount} Novos
                    </div>
                    <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full flex items-center gap-2">
                        <RefreshCcw size={16}/> {conflictCount} Para Atualizar
                    </div>
                    <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                        {unchangedCount} Sem Alteração
                    </div>
                    {errorCount > 0 && (
                        <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full flex items-center gap-2">
                            <AlertTriangle size={16}/> {errorCount} Erros
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto border rounded-lg bg-gray-50">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white border-b sticky top-0 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input type="checkbox" checked={analyzedData.every(i => i.selected)} onChange={e => setAnalyzedData(prev => prev.map(i => i.status !== 'ERROR' && i.status !== 'UNCHANGED' ? {...i, selected: e.target.checked} : i))} />
                                </th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Identificador</th>
                                <th className="px-4 py-3">Detalhes da Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analyzedData.map((item, idx) => (
                                <tr key={idx} className={`border-b ${item.status === 'CONFLICT' ? 'bg-orange-50' : item.status === 'NEW' ? 'bg-green-50' : item.status === 'ERROR' ? 'bg-red-50' : 'bg-white opacity-60'}`}>
                                    <td className="px-4 py-3 align-top">
                                        {(item.status === 'NEW' || item.status === 'CONFLICT') && (
                                            <input type="checkbox" checked={item.selected} onChange={() => toggleSelection(idx)} className="rounded text-blue-600"/>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                                            item.status === 'NEW' ? 'bg-green-200 text-green-800' :
                                            item.status === 'CONFLICT' ? 'bg-orange-200 text-orange-800' :
                                            item.status === 'ERROR' ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-700'
                                        }`}>
                                            {item.status === 'NEW' ? 'CRIAR' : item.status === 'CONFLICT' ? 'ATUALIZAR' : item.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top font-medium">
                                        {importType === 'USERS' ? (item.row['Nome Completo'] || item.row['Email']) : 
                                         importType === 'DEVICES' ? (item.row['Patrimonio(Tag)'] || `IMEI: ${item.row['IMEI']}`) : item.row['Numero']}
                                        {item.errorMsg && <div className="text-xs text-red-600 mt-1">{item.errorMsg}</div>}
                                    </td>
                                    <td className="px-4 py-3">
                                        {item.status === 'CONFLICT' && item.diffs ? (
                                            <div className="text-xs space-y-1">
                                                <p className="font-bold text-gray-600 mb-1">Diferenças encontradas:</p>
                                                {item.diffs.map((d, dIdx) => (
                                                    <div key={dIdx} className="grid grid-cols-[80px_1fr_20px_1fr] gap-1 items-center bg-white p-1 rounded border border-orange-200">
                                                        <span className="text-gray-500 font-semibold">{d.field}:</span>
                                                        <span className="text-red-500 line-through truncate" title={d.oldValue}>{d.oldValue}</span>
                                                        <ArrowRight size={12} className="text-gray-400"/>
                                                        <span className="text-green-600 font-bold truncate" title={d.newValue}>{d.newValue}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : item.status === 'NEW' ? (
                                            <span className="text-xs text-green-700">Novo registro será criado.</span>
                                        ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex justify-end">
                    <button onClick={executeImport} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg">
                        <CheckCircle size={20}/> Confirmar Processamento
                    </button>
                </div>
            </div>
        )}

        {/* STEP 3: PROCESSING / DONE */}
        {(step === 'PROCESSING' || step === 'DONE') && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-6">
                {step === 'PROCESSING' ? (
                    <Loader2 size={48} className="text-blue-600 animate-spin"/>
                ) : (
                    <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2 animate-bounce">
                        <CheckCircle size={40} />
                    </div>
                )}
                
                <h3 className="text-2xl font-bold text-gray-800">{step === 'PROCESSING' ? 'Importando Dados...' : 'Importação Concluída!'}</h3>
                
                <div className="w-full max-w-md bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div className="bg-blue-600 h-full transition-all duration-300" style={{width: `${(progress.current / progress.total) * 100}%`}}></div>
                </div>
                
                <div className="grid grid-cols-3 gap-8 text-center">
                    <div>
                        <p className="text-2xl font-bold text-green-600">{progress.created}</p>
                        <p className="text-xs text-gray-500 uppercase">Criados</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-orange-600">{progress.updated}</p>
                        <p className="text-xs text-gray-500 uppercase">Atualizados</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-red-600">{progress.errors}</p>
                        <p className="text-xs text-gray-500 uppercase">Erros</p>
                    </div>
                </div>

                {step === 'DONE' && (
                    <button onClick={() => { setStep('UPLOAD'); setAnalyzedData([]); if(fileInputRef.current) fileInputRef.current.value=''; }} className="mt-4 text-blue-600 hover:underline">
                        Nova Importação
                    </button>
                )}

                {logs.length > 0 && (
                    <div className="w-full max-w-lg bg-red-50 border border-red-100 rounded-lg p-4 mt-4 max-h-40 overflow-y-auto text-left">
                        <h5 className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1"><AlertTriangle size={12}/> Detalhes dos Erros:</h5>
                        <ul className="list-disc pl-4 text-xs text-red-600 space-y-1">
                            {logs.map((log, i) => <li key={i}>{log}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default DataImporter;
