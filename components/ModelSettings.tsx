
import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { AssetType, DeviceBrand, DeviceModel, AccessoryType, CustomField, UserSector } from '../types';
import { Plus, Trash2, X, Image as ImageIcon, Save, Tag, Box, Layers, Plug, Edit2, List, RefreshCw, ChevronUp, ChevronDown, Search, Briefcase } from 'lucide-react';

interface ModelSettingsProps {
  onClose: () => void;
}

const ModelSettings: React.FC<ModelSettingsProps> = ({ onClose }) => {
  const { 
    assetTypes, addAssetType, updateAssetType, deleteAssetType,
    brands, addBrand, updateBrand, deleteBrand,
    models, addModel, updateModel, deleteModel,
    accessoryTypes, addAccessoryType, updateAccessoryType, deleteAccessoryType,
    customFields, addCustomField, updateCustomField, deleteCustomField,
    sectors, addSector, deleteSector
  } = useData();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'TYPES' | 'BRANDS' | 'ACCESSORIES' | 'MODELS' | 'FIELDS' | 'SECTORS'>('TYPES');
  const [modelSearchTerm, setModelSearchTerm] = useState('');

  // Edit State
  const [editingType, setEditingType] = useState<Partial<AssetType>>({ name: '', customFieldIds: [] });
  const [editingBrand, setEditingBrand] = useState<Partial<DeviceBrand>>({ name: '' });
  const [editingAccessory, setEditingAccessory] = useState<Partial<AccessoryType>>({ name: '' });
  const [modelForm, setModelForm] = useState<Partial<DeviceModel>>({ imageUrl: '' });
  const [editingField, setEditingField] = useState<Partial<CustomField>>({ name: '' });
  const [editingSector, setEditingSector] = useState<Partial<UserSector>>({ name: '' });
  const [isUploading, setIsUploading] = useState(false);

  const adminName = user?.name || 'Admin';

  // --- Helpers de Ordenação A-Z ---
  const sortedBrands = [...brands].sort((a, b) => a.name.localeCompare(b.name));
  const sortedAssetTypes = [...assetTypes].sort((a, b) => a.name.localeCompare(b.name));
  const sortedSectors = [...sectors].sort((a, b) => a.name.localeCompare(b.name));
  
  const filteredModels = models.filter(m => {
      const brand = brands.find(b => b.id === m.brandId)?.name || '';
      return `${brand} ${m.name}`.toLowerCase().includes(modelSearchTerm.toLowerCase());
  }).sort((a, b) => a.name.localeCompare(b.name));

  const sortedAccessories = [...accessoryTypes].sort((a, b) => a.name.localeCompare(b.name));
  const sortedCustomFields = [...customFields].sort((a, b) => a.name.localeCompare(b.name));

  const handleTypeSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingType.name) return;
      if(editingType.id) updateAssetType(editingType as AssetType, adminName);
      else addAssetType({ id: Math.random().toString(36).substr(2, 9), name: editingType.name, customFieldIds: editingType.customFieldIds || [] }, adminName);
      setEditingType({ name: '', customFieldIds: [] });
  };

  const handleBrandSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingBrand.name) return;
      if(editingBrand.id) updateBrand(editingBrand as DeviceBrand, adminName);
      else addBrand({ id: Math.random().toString(36).substr(2, 9), name: editingBrand.name }, adminName);
      setEditingBrand({ name: '' });
  };

  const handleAccessorySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingAccessory.name) return;
      if(editingAccessory.id) updateAccessoryType(editingAccessory as AccessoryType, adminName);
      else addAccessoryType({ id: Math.random().toString(36).substr(2, 9), name: editingAccessory.name }, adminName);
      setEditingAccessory({ name: '' });
  };

  const handleModelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelForm.name || !modelForm.brandId || !modelForm.typeId) return;
    if (modelForm.id) updateModel(modelForm as DeviceModel, adminName);
    else addModel({ ...modelForm, id: Math.random().toString(36).substr(2, 9) } as DeviceModel, adminName);
    setModelForm({ imageUrl: '' });
  };

  const handleFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField.name?.trim()) return;
    if (editingField.id) updateCustomField(editingField as CustomField, adminName);
    else addCustomField({ id: Math.random().toString(36).substr(2, 9), name: editingField.name }, adminName);
    setEditingField({ name: '' });
  };

  const handleSectorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSector.name?.trim()) return;
    // Note: Sectors currently only have ID and Name in DataContext/API
    addSector({ id: Math.random().toString(36).substr(2, 9), name: editingSector.name }, adminName);
    setEditingSector({ name: '' });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setIsUploading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            setModelForm({ ...modelForm, imageUrl: reader.result as string });
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    }
  };

  const toggleFieldInType = (fieldId: string) => {
      const currentIds = editingType.customFieldIds || [];
      if (currentIds.includes(fieldId)) {
          setEditingType({ ...editingType, customFieldIds: currentIds.filter(id => id !== fieldId) });
      } else {
          setEditingType({ ...editingType, customFieldIds: [...currentIds, fieldId] });
      }
  };

  const moveField = (index: number, direction: 'UP' | 'DOWN') => {
      const currentIds = [...(editingType.customFieldIds || [])];
      if (direction === 'UP' && index > 0) {
          [currentIds[index], currentIds[index - 1]] = [currentIds[index - 1], currentIds[index]];
      } else if (direction === 'DOWN' && index < currentIds.length - 1) {
          [currentIds[index], currentIds[index + 1]] = [currentIds[index + 1], currentIds[index]];
      }
      setEditingType({ ...editingType, customFieldIds: currentIds });
  };

  const confirmDelete = (type: string, id: string, name: string, deleteFn: (id: string, adm: string) => void) => {
      if (window.confirm(`ATENÇÃO: Deseja realmente excluir ${type} "${name}"? Esta ação não pode ser desfeita.`)) {
          deleteFn(id, adminName);
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-fade-in">
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0 border-b border-white/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Layers size={20} /> Configurações de Ativos</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24}/></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 space-y-2 shrink-0">
            <button onClick={() => setActiveTab('TYPES')} className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'TYPES' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><Tag size={18} /> Tipos de Ativo</button>
            <button onClick={() => setActiveTab('FIELDS')} className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'FIELDS' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><List size={18} /> Campos Extras</button>
            <button onClick={() => setActiveTab('SECTORS')} className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'SECTORS' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><Briefcase size={18} /> Cargos e Funções</button>
            <button onClick={() => setActiveTab('BRANDS')} className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'BRANDS' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><Box size={18} /> Marcas</button>
            <button onClick={() => setActiveTab('ACCESSORIES')} className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'ACCESSORIES' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><Plug size={18} /> Acessórios</button>
            <button onClick={() => setActiveTab('MODELS')} className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'MODELS' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><Layers size={18} /> Catálogo / Fotos</button>
          </div>

          <div className="flex-1 p-8 overflow-y-auto bg-white">
            {activeTab === 'MODELS' && (
              <div className="space-y-6">
                <h4 className="text-xl font-bold text-gray-800">Catálogo de Modelos</h4>
                <form onSubmit={handleModelSubmit} className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                    <h5 className="font-bold text-gray-700 mb-4">{modelForm.id ? 'Editando Modelo' : 'Cadastrar Novo Modelo'}</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome do Modelo</label><input required type="text" className="w-full border rounded-lg p-2 text-sm" value={modelForm.name || ''} onChange={e => setModelForm({...modelForm, name: e.target.value})}/></div>
                        <div>
                           <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Marca</label>
                           <select required className="w-full border rounded-lg p-2 text-sm bg-white" value={modelForm.brandId || ''} onChange={e => setModelForm({...modelForm, brandId: e.target.value})}>
                              <option value="">Selecione...</option>
                              {sortedBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tipo</label>
                           <select required className="w-full border rounded-lg p-2 text-sm bg-white" value={modelForm.typeId || ''} onChange={e => setModelForm({...modelForm, typeId: e.target.value})}>
                              <option value="">Selecione...</option>
                              {sortedAssetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                           </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Foto do Equipamento</label>
                            <div className="flex items-center gap-3">
                                <div className="h-14 w-14 bg-white rounded-lg flex items-center justify-center overflow-hidden border-2 border-slate-200 shrink-0 shadow-inner">
                                    {modelForm.imageUrl ? <img src={modelForm.imageUrl} className="h-full w-full object-cover" /> : <ImageIcon className="text-gray-300" size={24}/>}
                                </div>
                                {modelForm.imageUrl ? (
                                    <button type="button" onClick={() => setModelForm({...modelForm, imageUrl: ''})} className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 font-bold flex items-center gap-1"><Trash2 size={14}/> Remover Foto</button>
                                ) : (
                                    <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 font-bold flex items-center gap-2 shadow-sm">
                                        {isUploading ? <RefreshCw size={16} className="animate-spin"/> : <ImageIcon size={16}/>} Carregar Arquivo
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                        <button type="submit" className="bg-blue-600 text-white px-8 py-2.5 rounded-xl hover:bg-blue-700 flex items-center gap-2 font-bold shadow-lg"><Save size={18}/> Salvar Modelo</button>
                    </div>
                </form>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Pesquisar por modelo ou marca..." 
                        className="pl-10 w-full border rounded-xl py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={modelSearchTerm}
                        onChange={(e) => setModelSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    {filteredModels.map(m => {
                        const brand = brands.find(b => b.id === m.brandId);
                        const type = assetTypes.find(t => t.id === m.typeId);
                        return (
                            <div key={m.id} className="flex items-center gap-4 bg-white border border-gray-100 p-4 rounded-xl hover:shadow-md transition-all group">
                                <div className="h-16 w-16 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border">
                                    {m.imageUrl ? <img src={m.imageUrl} className="h-full w-full object-cover" /> : <ImageIcon className="text-gray-200" size={28}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-900 truncate">{m.name}</h4>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{brand?.name}</span>
                                        <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{type?.name}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => setModelForm(m)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={18}/></button>
                                    <button onClick={() => confirmDelete('Modelo', m.id, m.name, deleteModel)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </div>
            )}
            {activeTab === 'SECTORS' && (
                <div className="max-w-2xl">
                    <h4 className="text-xl font-bold text-gray-800 mb-4">Cargos e Funções</h4>
                    <form onSubmit={handleSectorSubmit} className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mb-6 shadow-sm">
                       <h5 className="font-black text-emerald-900 mb-4 uppercase text-xs tracking-widest">Adicionar Novo Cargo</h5>
                       <div className="flex gap-3">
                           <input required type="text" placeholder="Ex: Analista de RH, Gerente de Vendas..." className="flex-1 border-2 border-emerald-200 rounded-xl p-3 focus:ring-4 focus:ring-emerald-100 outline-none font-bold" value={editingSector.name || ''} onChange={e => setEditingSector({...editingSector, name: e.target.value})} />
                           <button type="submit" className="bg-emerald-600 text-white px-8 py-3 rounded-xl hover:bg-emerald-700 font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95">Adicionar</button>
                       </div>
                    </form>
                    
                    <div className="space-y-2">
                       {sortedSectors.map(s => (
                          <div key={s.id} className="flex justify-between items-center p-4 bg-white rounded-xl border-2 border-slate-100 hover:border-emerald-200 transition-all group shadow-sm">
                             <div className="flex items-center gap-3">
                                <div className="h-8 w-8 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600"><Briefcase size={16}/></div>
                                <span className="font-bold text-slate-700">{s.name}</span>
                             </div>
                             <button onClick={() => confirmDelete('Cargo', s.id, s.name, deleteSector)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18}/></button>
                          </div>
                       ))}
                    </div>
                </div>
            )}
            {activeTab === 'TYPES' && (
                <div className="max-w-2xl">
                    <h4 className="text-xl font-bold text-gray-800 mb-4">Tipos de Equipamento</h4>
                    <form onSubmit={handleTypeSubmit} className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-6 shadow-sm">
                       <h5 className="font-black text-blue-900 mb-4 uppercase text-xs tracking-widest">{editingType.id ? 'Editar Tipo' : 'Novo Tipo'}</h5>
                       <div className="flex gap-3 mb-6">
                           <input required type="text" placeholder="Ex: Notebook, Smartphone..." className="flex-1 border-2 border-blue-200 rounded-xl p-3 focus:ring-4 focus:ring-blue-100 outline-none font-bold" value={editingType.name || ''} onChange={e => setEditingType({...editingType, name: e.target.value})} />
                           <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 font-black uppercase text-xs tracking-widest shadow-lg">Salvar</button>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="bg-white p-4 rounded-xl border-2 border-blue-100">
                               <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest border-b pb-1">Campos Extras (A-Z)</label>
                               <div className="space-y-1 max-h-48 overflow-y-auto">
                                   {sortedCustomFields.map(f => (
                                       <label key={f.id} className="flex items-center gap-3 text-xs font-bold p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                           <input type="checkbox" checked={(editingType.customFieldIds || []).includes(f.id)} onChange={() => toggleFieldInType(f.id)} className="h-4 w-4 rounded text-blue-600"/>
                                           {f.name}
                                       </label>
                                   ))}
                               </div>
                           </div>
                           
                           <div className="bg-white p-4 rounded-xl border-2 border-emerald-100">
                               <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 border-b pb-1">Ordem de Exibição</label>
                               <div className="space-y-2 max-h-48 overflow-y-auto">
                                   {(editingType.customFieldIds || []).map((id, index) => {
                                       const field = customFields.find(f => f.id === id);
                                       return (
                                           <div key={id} className="flex items-center justify-between bg-emerald-50 p-2 rounded-lg">
                                               <span className="text-xs font-black text-emerald-700">{field?.name}</span>
                                               <div className="flex gap-1">
                                                   <button type="button" onClick={() => moveField(index, 'UP')} disabled={index === 0} className="p-1"><ChevronUp size={14}/></button>
                                                   <button type="button" onClick={() => moveField(index, 'DOWN')} disabled={index === (editingType.customFieldIds || []).length - 1} className="p-1"><ChevronDown size={14}/></button>
                                               </div>
                                           </div>
                                       );
                                   })}
                               </div>
                           </div>
                       </div>
                    </form>
                    <div className="space-y-2">
                       {sortedAssetTypes.map(t => (
                          <div key={t.id} className="flex justify-between items-center p-4 bg-white rounded-xl border border-slate-200 group">
                             <span className="font-bold text-slate-700">{t.name}</span>
                             <div className="flex gap-1">
                                 <button onClick={() => setEditingType(t)} className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button>
                                 <button onClick={() => confirmDelete('Tipo', t.id, t.name, deleteAssetType)} className="p-2 text-red-300 hover:text-red-500 rounded-lg"><Trash2 size={16}/></button>
                             </div>
                          </div>
                       ))}
                    </div>
                </div>
            )}
            {activeTab === 'FIELDS' && (
                <div className="max-w-xl">
                    <h4 className="text-xl font-bold text-gray-800 mb-4">Campos Personalizados</h4>
                    <form onSubmit={handleFieldSubmit} className="bg-indigo-50 p-5 rounded-lg border border-indigo-100 mb-6">
                       <div className="flex gap-2">
                          <input required type="text" placeholder="Nome do Campo (ex: Memória RAM)" className="flex-1 border rounded-lg p-2" value={editingField.name || ''} onChange={e => setEditingField({...editingField, name: e.target.value})} />
                          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow-md">Adicionar</button>
                       </div>
                    </form>
                    <div className="space-y-2">
                        {sortedCustomFields.map(f => (
                            <div key={f.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                                <span className="font-medium">{f.name}</span>
                                <button onClick={() => confirmDelete('Campo', f.id, f.name, deleteCustomField)} className="text-red-300 hover:text-red-500 p-1"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {activeTab === 'BRANDS' && (
                <div className="max-w-xl">
                    <h4 className="text-xl font-bold text-gray-800 mb-4">Marcas e Fabricantes</h4>
                    <form onSubmit={handleBrandSubmit} className="flex gap-2 mb-6">
                       <input required type="text" placeholder="Ex: Dell, Apple, Samsung..." className="flex-1 border rounded-lg p-2" value={editingBrand.name || ''} onChange={e => setEditingBrand({...editingBrand, name: e.target.value})}/>
                       <button type="submit" className="bg-blue-600 text-white px-6 rounded-lg font-bold">Adicionar</button>
                    </form>
                    <div className="space-y-2">
                       {sortedBrands.map(b => (
                          <div key={b.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                             <span className="font-medium">{b.name}</span>
                             <button onClick={() => confirmDelete('Marca', b.id, b.name, deleteBrand)} className="text-red-300 p-1"><Trash2 size={16}/></button>
                          </div>
                       ))}
                    </div>
                </div>
            )}
            {activeTab === 'ACCESSORIES' && (
                <div className="max-w-xl">
                    <h4 className="text-xl font-bold text-gray-800 mb-4">Tipos de Acessórios</h4>
                    <form onSubmit={handleAccessorySubmit} className="flex gap-2 mb-6">
                       <input required type="text" placeholder="Ex: Carregador, Cabo USB, Mouse..." className="flex-1 border rounded-lg p-2" value={editingAccessory.name || ''} onChange={e => setEditingAccessory({...editingAccessory, name: e.target.value})}/>
                       <button type="submit" className="bg-blue-600 text-white px-6 rounded-lg font-bold">Adicionar</button>
                    </form>
                    <div className="space-y-2">
                       {sortedAccessories.map(acc => (
                          <div key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                             <span className="font-medium">{acc.name}</span>
                             <button onClick={() => confirmDelete('Acessório', acc.id, acc.name, deleteAccessoryType)} className="text-red-300 p-1"><Trash2 size={16}/></button>
                          </div>
                       ))}
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelSettings;
