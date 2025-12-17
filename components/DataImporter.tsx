
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
    assetTypes, addAssetType,
    customFields
  } = useData();
  const { user: currentUser } = useAuth();
  
  const [step, setStep] = useState<'UPLOAD' | 'ANALYSIS' | 'PROCESSING' | 'DONE'>('UPLOAD');
  const [importType, setImportType] = useState<ImportType>('USERS');
  const [analyzedData, setAnalyzedData] = useState<AnalysisResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, created: 0, updated: 0, errors: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adminName = currentUser?.name || 'Importador';

  const getTemplateHeaders = () => {
      switch(importType) {
          case 'USERS': return 'Nome Completo;Email;CPF;PIS;Cargo/Funcao (Dropdown);Setor/Codigo (Texto);RG;Endereco';
          case 'DEVICES': return 'Patrimonio;Serial;Modelo;Marca;Tipo;Status;Valor Pago;Data Compra;Fornecedor;IMEI;ID Pulsus;Setor Ativo;Centro de Custo';
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
              const cpf = row['CPF']?.trim();
              if (!email && !cpf) throw new Error('Email ou CPF obrigatório');
              const existing = users.find(u => (email && u.email.toLowerCase() === email.toLowerCase()) || (cpf && u.cpf.replace(/\D/g,'') === cpf.replace(/\D/g,'')));
              if (!existing) return { status: 'NEW', row, selected: true };
              return { status: 'CONFLICT', row, existingId: existing.id, selected: true };
          } else if (importType === 'DEVICES') {
              const tag = row['Patrimonio']?.trim();
              const imei = row['IMEI']?.trim();
              if (!tag && !imei) throw new Error('Identificação (Patrimônio ou IMEI) é obrigatória');
              const existing = devices.find(d => (tag && d.assetTag && d.assetTag.toLowerCase() === tag.toLowerCase()) || (imei && d.imei && d.imei === imei));
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
      if (toProcess.length === 0) return alert('Nada para processar.');

      setStep('PROCESSING');
      setProgress({ current: 0, total: toProcess.length, created: 0, updated: 0, errors: 0 });
      setLogs([]);

      const secCache = new Map<string, string>();
      const brandCache = new Map<string, string>();
      const typeCache = new Map<string, string>();
      const modelCache = new Map<string, string>();

      const resolveSector = (name: string): string => {
          if (!name) return '';
          const norm = name.trim().toLowerCase();
          const existing = sectors.find(s => s.name.toLowerCase() === norm);
          if (existing) return existing.id;
          if (secCache.has(norm)) return secCache.get(norm)!;
          const newId = Math.random().toString(36).substr(2, 9);
          addSector({ id: newId, name: name.trim() }, adminName);
          secCache.set(norm, newId);
          return newId;
      };

      for (let i = 0; i < toProcess.length; i++) {
          const item = toProcess[i];
          try {
              if (importType === 'DEVICES') {
                  const r = item.row;
                  
                  const bName = (r['Marca'] || 'Genérica').trim();
                  let bId = brands.find(b => b.name.toLowerCase() === bName.toLowerCase())?.id || brandCache.get(bName.toLowerCase());
                  if (!bId) {
                      bId = Math.random().toString(36).substr(2, 9);
                      addBrand({ id: bId, name: bName }, adminName);
                      brandCache.set(bName.toLowerCase(), bId);
                  }

                  const tNameRaw = (r['Tipo'] || 'Outros').trim();
                  let tId = assetTypes.find(t => 
                    t.name.toLowerCase() === tNameRaw.toLowerCase() || 
                    (tNameRaw.toLowerCase() === 'celular' && t.name.toLowerCase() === 'smartphone') ||
                    (tNameRaw.toLowerCase() === 'computador' && t.name.toLowerCase() === 'notebook')
                  )?.id || typeCache.get(tNameRaw.toLowerCase());

                  if (!tId) {
                      tId = Math.random().toString(36).substr(2, 9);
                      addAssetType({ id: tId, name: tNameRaw }, adminName);
                      typeCache.set(tNameRaw.toLowerCase(), tId);
                  }

                  const mName = (r['Modelo'] || 'Genérico').trim();
                  let mId = models.find(m => m.name.toLowerCase() === mName.toLowerCase() && m.brandId === bId)?.id || modelCache.get(mName.toLowerCase() + bId);
                  if (!mId) {
                      mId = Math.random().toString(36).substr(2, 9);
                      addModel({ id: mId, name: mName, brandId: bId, typeId: tId, imageUrl: '' }, adminName);
                      modelCache.set(mName.toLowerCase() + bId, mId);
                  }

                  const rawCost = (r['Valor Pago'] || '0').toString();
                  const cleanCost = parseFloat(rawCost.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
                  const rawDate = r['Data Compra'] || new Date().toISOString().split('T')[0];

                  const deviceData: Device = {
                      id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                      modelId: mId,
                      assetTag: r['Patrimonio']?.trim() || r['IMEI']?.trim() || '',
                      serialNumber: (r['Serial']?.trim() || r['Patrimonio']?.trim() || r['IMEI']?.trim() || ''),
                      status: (r['Status'] as DeviceStatus) || DeviceStatus.AVAILABLE,
                      purchaseCost: cleanCost,
                      purchaseDate: rawDate,
                      supplier: (r['Fornecedor'] || '').trim(),
                      // MAPEAMENTO DIRETO SEM FALLBACKS:
                      pulsusId: (r['ID Pulsus'] || '').toString().trim(),
                      costCenter: (r['Centro de Custo'] || '').toString().trim(),
                      imei: r['IMEI']?.trim() || undefined,
                      sectorId: resolveSector(r['Setor Ativo']),
                      currentUserId: null,
                      customData: {}
                  };

                  if (item.status === 'NEW') {
                      addDevice(deviceData, adminName);
                      setProgress(p => ({ ...p, created: p.created + 1 }));
                  } else {
                      updateDevice(deviceData, adminName);
                      setProgress(p => ({ ...p, updated: p.updated + 1 }));
                  }
              } else if (importType === 'USERS') {
                   const r = item.row;
                   const sId = resolveSector(r['Cargo/Funcao (Dropdown)']);
                   const userData: User = {
                       id: item.status === 'NEW' ? Math.random().toString(36).substr(2, 9) : item.existingId!,
                       fullName: r['Nome Completo']?.trim(),
                       email: r['Email']?.trim(),
                       cpf: r['CPF']?.trim(),
                       pis: r['PIS']?.trim() || '',
                       jobTitle: r['Setor/Codigo (Texto)']?.trim() || '',
                       sectorId: sId,
                       rg: r['RG']?.trim() || '',
                       address: r['Endereco']?.trim() || '',
                       active: true
                   };
                   if (item.status === 'NEW') {
                       addUser(userData, adminName);
                       setProgress(p => ({ ...p, created: p.created + 1 }));
                   } else {
                       updateUser(userData, adminName);
                       setProgress(p => ({ ...p, updated: p.updated + 1 }));
                   }
              }
              setProgress(p => ({ ...p, current: i + 1 }));
          } catch (e: any) {
              setLogs(prev => [...prev, `Erro (Linha ${i+1}): ${e.message}`]);
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
                    <Database className="text-blue-600"/> Importador Avançado (v1.8.8)
                </h3>
                <p className="text-sm text-gray-500">Mapeamento estrito de ID Pulsus e Centro de Custo.</p>
            </div>
            {step !== 'UPLOAD' && (
                <button onClick={() => setStep('UPLOAD')} className="text-sm text-blue-600 hover:underline flex items-center gap-1 font-bold">
                    <RefreshCcw size={14}/> Recomeçar
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
                            <Download size={18} className="text-blue-600"/> Baixar CSV Modelo (BR)
                        </button>
                        <label className="flex items-center gap-2 text-sm bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 cursor-pointer shadow-lg transition-all font-bold">
                            <Upload size={18}/> Selecionar Arquivo
                            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                    <div className="text-[11px] text-gray-400 text-center space-y-1">
                        <p className="flex items-center justify-center gap-1 font-bold text-orange-600"><AlertCircle size={12}/> O ID Pulsus e o Centro de Custo devem estar em colunas separadas.</p>
                        <p>O motor de importação agora garante que um dado não sobrescreva o outro indevidamente.</p>
                    </div>
                </div>
            </div>
        )}

        {step === 'ANALYSIS' && (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                <div className="flex gap-4 mb-4">
                    <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm">{analyzedData.filter(i => i.status === 'NEW').length} Novos</div>
                    <div className="bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm">{analyzedData.filter(i => i.status === 'CONFLICT').length} Atualizações</div>
                </div>
                <div className="flex-1 overflow-y-auto border rounded-xl shadow-inner bg-white">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="px-6 py-4 font-black text-slate-600 uppercase">Identificador</th>
                                <th className="px-6 py-4 font-black text-slate-600 uppercase">Ação</th>
                                <th className="px-6 py-4 font-black text-slate-600 uppercase">Dados Lidos</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analyzedData.map((item, idx) => (
                                <tr key={idx} className="border-b hover:bg-blue-50/30 transition-colors">
                                    <td className="px-6 py-3 font-mono font-bold text-blue-900">
                                        {importType === 'USERS' ? item.row['Email'] : (item.row['Patrimonio'] || `IMEI: ${item.row['IMEI']}`)}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2.5 py-1 rounded font-black text-[10px] ${item.status === 'NEW' ? 'bg-green-100 text-green-700' : item.status === 'CONFLICT' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.status === 'NEW' ? 'CRIAR' : item.status === 'CONFLICT' ? 'ATUALIZAR' : 'ERRO'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-gray-500">
                                        {item.errorMsg ? <span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={12}/> {item.errorMsg}</span> : 
                                         item.status === 'CONFLICT' ? `Pulsus: ${item.row['ID Pulsus']} | C.Custo: ${item.row['Centro de Custo']}` : `Pronto para importar como ${item.row['Tipo']}`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={executeImport} className="mt-4 bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all">
                    Processar {analyzedData.filter(x => x.status !== 'ERROR').length} Itens
                </button>
            </div>
        )}

        {step === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-8 animate-pulse">
                <div className="relative">
                    <Loader2 size={64} className="text-blue-600 animate-spin"/>
                </div>
                <div className="text-center">
                    <h3 className="text-2xl font-black text-slate-800">Salvando {progress.current} de {progress.total}</h3>
                    <p className="text-gray-500">Mapeando identidades digitais...</p>
                </div>
                <div className="w-full max-w-md bg-gray-100 rounded-full h-5 overflow-hidden shadow-inner border">
                    <div className="bg-blue-600 h-full transition-all duration-500 shadow-lg" style={{width: `${(progress.current/progress.total)*100}%`}}></div>
                </div>
            </div>
        )}

        {step === 'DONE' && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-6">
                <div className="h-24 w-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-lg animate-bounce"><CheckCircle size={56}/></div>
                <h3 className="text-3xl font-black text-slate-800">Importação Completa!</h3>
                <div className="grid grid-cols-3 gap-6 text-center bg-white p-10 rounded-3xl border shadow-xl w-full max-w-xl">
                    <div className="space-y-1"><p className="text-4xl font-black text-green-600">{progress.created}</p><p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Criados</p></div>
                    <div className="space-y-1"><p className="text-4xl font-black text-orange-500">{progress.updated}</p><p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Atualizados</p></div>
                    <div className="space-y-1"><p className="text-4xl font-black text-red-600">{progress.errors}</p><p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Erros</p></div>
                </div>
                <button onClick={() => setStep('UPLOAD')} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-wider shadow-lg hover:bg-black transition-all">Nova Importação</button>
                {logs.length > 0 && (
                    <div className="w-full max-w-xl bg-red-50 p-6 rounded-2xl text-xs text-red-700 border border-red-200 max-h-48 overflow-y-auto">
                        <strong className="block mb-2 uppercase font-black text-red-800 tracking-tighter">Relatório de Conflitos:</strong>
                        <ul className="space-y-1 list-disc pl-4">{logs.map((l, i) => <li key={i}>{l}</li>)}</ul>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default DataImporter;
