
import React, { useState, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Device, User, SimCard, DeviceStatus, ActionType } from '../types';
import { Download, Upload, CheckCircle, AlertTriangle, AlertCircle, Loader2, Database, RefreshCw, X } from 'lucide-react';

type ImportType = 'USERS' | 'DEVICES' | 'SIMS';

interface AnalysisResult {
    status: 'NEW' | 'UNCHANGED' | 'CONFLICT' | 'ERROR';
    row: any;
    existingId?: string;
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

  const mapStatus = (raw: string, hasUser: boolean): DeviceStatus => {
      if (hasUser) return DeviceStatus.IN_USE;
      if (!raw) return DeviceStatus.AVAILABLE;
      
      const clean = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      if (['disponivel', 'estoque', 'liberado', 'vago', 'livre'].includes(clean)) return DeviceStatus.AVAILABLE;
      if (['em uso', 'uso', 'atribuido', 'vinculado'].includes(clean)) return DeviceStatus.IN_USE;
      if (['manutencao', 'conserto', 'reparo'].includes(clean)) return DeviceStatus.MAINTENANCE;
      if (['descarte', 'descartado', 'sucata', 'baixado'].includes(clean)) return DeviceStatus.RETIRED;
      
      return DeviceStatus.AVAILABLE;
  };

  const getTemplateHeaders = () => {
      switch(importType) {
          case 'USERS': return 'Nome Completo;Email;CPF;RG;PIS;Codigo de Setor;Cargo ou Funcao;Endereco';
          case 'DEVICES': return 'Patrimonio;Serial;IMEI;ID Pulsus;Codigo de Setor;Cargo ou Funcao;Modelo;Marca;Tipo;Status;Valor Pago;Data Compra;Fornecedor;Email Colaborador';
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
      if (lines.length < 2) return alert('Arquivo vazio ou sem dados.');
      
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
              const imei = row['IMEI']?.trim();
              if (!tag && !imei) throw new Error('Patrimônio ou IMEI obrigatório');
              const existing = devices.find(d => (tag && d.assetTag === tag) || (imei && d.imei === imei));
              if (!existing) return { status: 'NEW', row, selected: true };
              return { status: 'CONFLICT', row, existingId: existing.id, selected: true };
          } else {
              const num = row['Numero']?.trim();
              if (!num) throw new Error('Número é obrigatório');
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
      setStep('PROCESSING');
      setProgress({ current: 0, total: toProcess.length, created: 0, updated: 0, errors: 0 });

      const cache = { sectors: new Map(), brands: new Map(), types: new Map(), models: new Map() };

      const resolveSector = (name: string): string => {
          if (!name) return '';
          const norm = name.trim().toLowerCase();
          const existing = sectors.find(s => s.name.toLowerCase() === norm);
          if (existing) return existing.id;
          if (cache.sectors.has(norm)) return cache.sectors.get(norm);
          const newId = Math.random().toString(36).substr(2, 9);
          addSector({ id: newId, name: name.trim() }, adminName);
          cache.sectors.set(norm, newId);
          return newId;
      };

      for (let i = 0; i < toProcess.length; i++) {
          const item = toProcess[i];
          const r = item.row;
          try {
              if (importType === 'USERS') {
                  const sId = resolveSector(r['Cargo ou Funcao']);
                  const userData: User = {
                      id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                      fullName: r['Nome Completo'],
                      email: r['Email'],
                      cpf: r['CPF'],
                      rg: r['RG'] || '',
                      pis: r['PIS'] || '',
                      internalCode: r['Codigo de Setor'],
                      sectorId: sId,
                      jobTitle: r['Cargo ou Funcao'] || '', // Mantemos por compatibilidade mas o foco é o sectorId
                      address: r['Endereco'] || '',
                      active: true
                  };
                  item.status === 'NEW' ? addUser(userData, adminName) : updateUser(userData, adminName);
                  item.status === 'NEW' ? setProgress(p => ({ ...p, created: p.created + 1 })) : setProgress(p => ({ ...p, updated: p.updated + 1 }));
              } 
              else if (importType === 'DEVICES') {
                  // Resolve Hierarquia do Modelo
                  const bName = r['Marca'] || 'Outros';
                  let bId = brands.find(b => b.name === bName)?.id || cache.brands.get(bName);
                  if (!bId) { bId = Math.random().toString(36).substr(2,9); addBrand({id:bId, name:bName}, adminName); cache.brands.set(bName, bId); }

                  const tName = r['Tipo'] || 'Outros';
                  let tId = assetTypes.find(t => t.name === tName)?.id || cache.types.get(tName);
                  if (!tId) { tId = Math.random().toString(36).substr(2,9); addAssetType({id:tId, name:tName}, adminName); cache.types.set(tName, tId); }

                  const mName = r['Modelo'] || 'Padrão';
                  let mId = models.find(m => m.name === mName && m.brandId === bId)?.id || cache.models.get(mName+bId);
                  if (!mId) { mId = Math.random().toString(36).substr(2,9); addModel({id:mId, name:mName, brandId:bId, typeId:tId}, adminName); cache.models.set(mName+bId, mId); }

                  // Vínculo com Usuário e Herança de Setor
                  const userEmail = r['Email Colaborador']?.trim().toLowerCase();
                  const linkedUser = userEmail ? users.find(u => u.email.toLowerCase() === userEmail) : null;

                  const deviceData: Device = {
                      id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                      modelId: mId,
                      assetTag: r['Patrimonio'],
                      serialNumber: r['Serial'] || r['Patrimonio'],
                      imei: r['IMEI'],
                      pulsusId: r['ID Pulsus'],
                      internalCode: r['Codigo de Setor'],
                      sectorId: resolveSector(r['Cargo ou Funcao']), // Destinação via Cargo/Função
                      status: mapStatus(r['Status'], !!linkedUser),
                      currentUserId: linkedUser?.id || null,
                      purchaseCost: parseFloat(r['Valor Pago']?.replace(',','.')) || 0,
                      purchaseDate: r['Data Compra'] || new Date().toISOString().split('T')[0],
                      supplier: r['Fornecedor'],
                      customData: {}
                  };

                  item.status === 'NEW' ? addDevice(deviceData, adminName) : updateDevice(deviceData, adminName);
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

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in">
        <div className="mb-6 flex justify-between items-start">
            <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Database className="text-blue-600"/> Importador de Dados
                </h3>
                <p className="text-sm text-gray-500">Cadastro de colaboradores e ativos via CSV.</p>
            </div>
            {step !== 'UPLOAD' && (
                <button onClick={() => setStep('UPLOAD')} className="text-sm text-blue-600 hover:underline flex items-center gap-1 font-bold">
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
                        Nota: Utilize ponto e vírgula (;) como separador. O campo "Cargo ou Função" define a categoria organizacional.
                    </p>
                </div>
            </div>
        )}

        {step === 'ANALYSIS' && (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                <div className="flex gap-4 mb-4">
                    <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm">{analyzedData.filter(i => i.status === 'NEW').length} Novos</div>
                    <div className="bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm">{analyzedData.filter(i => i.status === 'CONFLICT').length} Existentes</div>
                </div>
                <div className="flex-1 overflow-y-auto border rounded-xl shadow-inner bg-white">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="px-6 py-4 font-black text-slate-600 uppercase">Identificador</th>
                                <th className="px-6 py-4 font-black text-slate-600 uppercase">Ação</th>
                                <th className="px-6 py-4 font-black text-slate-600 uppercase">Cargo Destino</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analyzedData.map((item, idx) => (
                                <tr key={idx} className="border-b hover:bg-blue-50/30 transition-colors">
                                    <td className="px-6 py-3 font-mono font-bold text-blue-900">
                                        {importType === 'USERS' ? item.row['Email'] : (item.row['Patrimonio'] || item.row['IMEI'])}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2.5 py-1 rounded font-black text-[10px] ${item.status === 'NEW' ? 'bg-green-100 text-green-700' : item.status === 'CONFLICT' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.status === 'NEW' ? 'CRIAR' : item.status === 'CONFLICT' ? 'ATUALIZAR' : 'ERRO'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-gray-500 font-bold uppercase text-[10px]">
                                        {item.errorMsg || item.row['Cargo ou Funcao'] || 'NÃO INFORMADO'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={executeImport} className="mt-4 bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all">
                    Iniciar Processamento
                </button>
            </div>
        )}

        {step === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-8 animate-pulse">
                <Loader2 size={64} className="text-blue-600 animate-spin"/>
                <div className="text-center">
                    <h3 className="text-2xl font-black text-slate-800">Processando {progress.current} de {progress.total}</h3>
                    <div className="w-64 bg-gray-100 h-2 rounded-full mt-4 overflow-hidden">
                        <div className="bg-blue-600 h-full transition-all" style={{width: `${(progress.current/progress.total)*100}%`}}></div>
                    </div>
                </div>
            </div>
        )}

        {step === 'DONE' && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-6 text-center">
                <CheckCircle size={80} className="text-green-500 animate-bounce"/>
                <h3 className="text-3xl font-black text-slate-800">Concluído!</h3>
                <div className="grid grid-cols-3 gap-8 bg-slate-50 p-8 rounded-3xl border">
                    <div><p className="text-3xl font-black text-green-600">{progress.created}</p><p className="text-[10px] font-bold uppercase text-gray-400">Criados</p></div>
                    <div><p className="text-3xl font-black text-orange-500">{progress.updated}</p><p className="text-[10px] font-bold uppercase text-gray-400">Atualizados</p></div>
                    <div><p className="text-3xl font-black text-red-500">{progress.errors}</p><p className="text-[10px] font-bold uppercase text-gray-400">Erros</p></div>
                </div>
                <button onClick={() => setStep('UPLOAD')} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all">Nova Importação</button>
                {logs.length > 0 && (
                    <div className="w-full max-w-xl bg-red-50 p-4 rounded-xl text-left text-xs text-red-700 border border-red-200 overflow-y-auto max-h-40">
                        <p className="font-bold mb-2">Erros encontrados:</p>
                        <ul className="list-disc pl-4">{logs.map((l, i) => <li key={i}>{l}</li>)}</ul>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default DataImporter;
