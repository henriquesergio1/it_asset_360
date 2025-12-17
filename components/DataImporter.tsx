
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
    existingId?: string;
    diffs?: DiffItem[];
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

  const downloadTemplate = () => {
      let headers = '';
      if (importType === 'USERS') headers = 'Nome Completo,Email,CPF,PIS,Funcao (Dropdown),Setor/Codigo (Texto),RG,Endereco';
      else if (importType === 'DEVICES') headers = 'Patrimonio(Tag),Serial,Modelo,Marca,Tipo,Status,Valor Compra,Data Compra(AAAA-MM-DD),IMEI';
      else headers = 'Numero,Operadora,ICCID,Plano';

      const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
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
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return alert('Arquivo inválido.');
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
          const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
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
              const email = row['Email'];
              const cpf = row['CPF'];
              if (!email && !cpf) throw new Error('Email ou CPF obrigatório');
              const existing = users.find(u => (email && u.email.toLowerCase() === email.toLowerCase()) || (cpf && u.cpf.replace(/\D/g,'') === cpf.replace(/\D/g,'')));
              if (!existing) return { status: 'NEW', row, selected: true };
              return { status: 'CONFLICT', row, existingId: existing.id, selected: true, diffs: [] }; // Simplificado para o exemplo
          } else if (importType === 'DEVICES') {
              const tag = row['Patrimonio(Tag)'];
              const imei = row['IMEI'];
              if (!tag && !imei) throw new Error('Patrimônio ou IMEI obrigatório');
              // Busca inteligente: tenta achar por Tag ou por IMEI
              const existing = devices.find(d => (tag && d.assetTag.toLowerCase() === tag.toLowerCase()) || (imei && d.imei === imei));
              if (!existing) return { status: 'NEW', row, selected: true };
              return { status: 'CONFLICT', row, existingId: existing.id, selected: true, diffs: [] };
          }
          return { status: 'NEW', row, selected: true };
      } catch (e: any) {
          return { status: 'ERROR', row, errorMsg: e.message, selected: false };
      }
  };

  const executeImport = async () => {
      const toProcess = analyzedData.filter(i => i.selected && i.status !== 'ERROR');
      setStep('PROCESSING');
      setProgress({ current: 0, total: toProcess.length, created: 0, updated: 0, errors: 0 });

      // Caches locais para evitar duplicação em lote (ex: 60 vendedores)
      const sectorCache = new Map<string, string>();
      const brandCache = new Map<string, string>();
      const modelCache = new Map<string, string>();

      for (let i = 0; i < toProcess.length; i++) {
          const item = toProcess[i];
          try {
              if (importType === 'USERS') {
                  // Resolve Cargo (Sector) com Cache
                  const sName = item.row['Funcao (Dropdown)'];
                  let sId = '';
                  if (sName) {
                      const norm = sName.trim().toLowerCase();
                      const existing = sectors.find(s => s.name.toLowerCase() === norm);
                      if (existing) sId = existing.id;
                      else if (sectorCache.has(norm)) sId = sectorCache.get(norm)!;
                      else {
                          sId = Math.random().toString(36).substr(2, 9);
                          addSector({ id: sId, name: sName }, adminName);
                          sectorCache.set(norm, sId);
                      }
                  }
                  if (item.status === 'NEW') {
                      addUser({
                          id: Math.random().toString(36).substr(2, 9),
                          fullName: item.row['Nome Completo'],
                          email: item.row['Email'],
                          cpf: item.row['CPF'],
                          sectorId: sId,
                          jobTitle: item.row['Setor/Codigo (Texto)'],
                          active: true, rg: item.row['RG'] || '', address: item.row['Endereco'] || ''
                      }, adminName);
                      setProgress(p => ({ ...p, created: p.created + 1 }));
                  }
              } else if (importType === 'DEVICES') {
                  const bName = item.row['Marca'] || 'Genérica';
                  const mName = item.row['Modelo'] || 'Genérico';
                  
                  // Resolve Marca com Cache
                  let bId = brands.find(b => b.name.toLowerCase() === bName.toLowerCase())?.id;
                  if (!bId && brandCache.has(bName.toLowerCase())) bId = brandCache.get(bName.toLowerCase());
                  if (!bId) {
                      bId = Math.random().toString(36).substr(2, 9);
                      addBrand({ id: bId, name: bName }, adminName);
                      brandCache.set(bName.toLowerCase(), bId);
                  }

                  // Resolve Modelo com Cache
                  let mId = models.find(m => m.name.toLowerCase() === mName.toLowerCase() && m.brandId === bId)?.id;
                  if (!mId && modelCache.has(mName.toLowerCase() + bId)) mId = modelCache.get(mName.toLowerCase() + bId);
                  if (!mId) {
                      mId = Math.random().toString(36).substr(2, 9);
                      addModel({ id: mId, name: mName, brandId: bId, typeId: 't1', imageUrl: '' }, adminName);
                      modelCache.set(mName.toLowerCase() + bId, mId);
                  }

                  if (item.status === 'NEW') {
                      const finalTag = item.row['Patrimonio(Tag)'] || item.row['IMEI'];
                      addDevice({
                          id: Math.random().toString(36).substr(2, 9),
                          modelId: mId,
                          assetTag: finalTag,
                          serialNumber: item.row['Serial'] || finalTag,
                          status: DeviceStatus.AVAILABLE,
                          imei: item.row['IMEI'] || undefined,
                          purchaseCost: parseFloat(item.row['Valor Compra']) || 0,
                          purchaseDate: item.row['Data Compra(AAAA-MM-DD)'] || new Date().toISOString().split('T')[0]
                      }, adminName);
                      setProgress(p => ({ ...p, created: p.created + 1 }));
                  }
              }
              setProgress(p => ({ ...p, current: i + 1 }));
          } catch (e: any) {
              setLogs(prev => [...prev, `Erro: ${e.message}`]);
              setProgress(p => ({ ...p, errors: p.errors + 1, current: i + 1 }));
          }
      }
      setStep('DONE');
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        {step === 'UPLOAD' && (
            <div className="space-y-6">
                <div className="flex gap-4">
                    {['USERS', 'DEVICES'].map(t => (
                        <button key={t} onClick={() => setImportType(t as ImportType)} className={`flex-1 py-3 border rounded-lg font-bold ${importType === t ? 'bg-blue-50 border-blue-500 text-blue-700' : ''}`}>
                            {t === 'USERS' ? 'Colaboradores' : 'Dispositivos'}
                        </button>
                    ))}
                </div>
                <div className="bg-gray-50 border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-4">
                    <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm bg-white border px-4 py-2 rounded-lg"><Download size={16}/> Baixar Modelo CSV</button>
                    <label className="bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 flex items-center gap-2">
                        <Upload size={18}/> Selecionar Arquivo
                        <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>
        )}

        {step === 'ANALYSIS' && (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Análise do Arquivo</h3>
                    <div className="flex gap-2">
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">{analyzedData.filter(i => i.status === 'NEW').length} Novos</span>
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">{analyzedData.filter(i => i.status === 'CONFLICT').length} Atualizações</span>
                    </div>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr><th className="p-2">Identificador</th><th className="p-2">Ação</th></tr>
                        </thead>
                        <tbody>
                            {analyzedData.map((item, idx) => (
                                <tr key={idx} className="border-t">
                                    <td className="p-2">{importType === 'USERS' ? item.row['Email'] : (item.row['Patrimonio(Tag)'] || item.row['IMEI'])}</td>
                                    <td className="p-2">
                                        <span className={`px-2 py-0.5 rounded ${item.status === 'NEW' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {item.status === 'NEW' ? 'CRIAR' : 'ATUALIZAR'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={executeImport} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg">Confirmar Importação</button>
            </div>
        )}

        {step === 'PROCESSING' && (
            <div className="py-10 text-center space-y-4">
                <Loader2 className="mx-auto animate-spin text-blue-600" size={40}/>
                <p className="font-bold">Processando {progress.current} de {progress.total}...</p>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-600 h-full transition-all" style={{width: `${(progress.current/progress.total)*100}%`}}></div>
                </div>
            </div>
        )}

        {step === 'DONE' && (
            <div className="text-center py-10 space-y-4">
                <CheckCircle className="mx-auto text-green-500" size={60}/>
                <h3 className="text-2xl font-bold">Importação Concluída</h3>
                <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto text-sm">
                    <div><p className="font-bold text-green-600">{progress.created}</p><p>Criados</p></div>
                    <div><p className="font-bold text-orange-600">{progress.updated}</p><p>Atualizados</p></div>
                    <div><p className="font-bold text-red-600">{progress.errors}</p><p>Erros</p></div>
                </div>
                <button onClick={() => setStep('UPLOAD')} className="text-blue-600 underline">Fazer nova importação</button>
            </div>
        )}
    </div>
  );
};

export default DataImporter;
