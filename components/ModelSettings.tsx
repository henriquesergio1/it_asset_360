
import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { AssetType, DeviceBrand, DeviceModel, AccessoryType, CustomField } from '../types';
import { Plus, Trash2, X, Image as ImageIcon, Save, Tag, Box, Layers, Plug, Edit2, List, CheckSquare } from 'lucide-react';

interface ModelSettingsProps {
  onClose: () => void;
}

const ModelSettings: React.FC<ModelSettingsProps> = ({ onClose }) => {
  const { 
    assetTypes, addAssetType, updateAssetType, deleteAssetType,
    brands, addBrand, updateBrand, deleteBrand,
    models, addModel, updateModel, deleteModel,
    accessoryTypes, addAccessoryType, updateAccessoryType, deleteAccessoryType,
    customFields, addCustomField, deleteCustomField
  } = useData();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'TYPES' | 'BRANDS' | 'ACCESSORIES' | 'MODELS' | 'FIELDS'>('TYPES');

  // Edit State
  const [editingType, setEditingType] = useState<Partial<AssetType>>({ name: '', customFieldIds: [] });
  const [editingBrand, setEditingBrand] = useState<Partial<DeviceBrand>>({ name: '' });
  const [editingAccessory, setEditingAccessory] = useState<Partial<AccessoryType>>({ name: '' });
  const [modelForm, setModelForm] = useState<Partial<DeviceModel>>({ imageUrl: '' });
  const [newCustomField, setNewCustomField] = useState('');

  const adminName = user?.name || 'Admin';

  // --- HANDLERS ---

  const handleTypeSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingType.name) return;

      if(editingType.id) {
          updateAssetType(editingType as AssetType, adminName);
      } else {
          addAssetType({
              id: Math.random().toString(36).substr(2, 9),
              name: editingType.name,
              customFieldIds: editingType.customFieldIds || []
          }, adminName);
      }
      setEditingType({ name: '', customFieldIds: [] });
  };

  const handleBrandSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingBrand.name) return;
      if(editingBrand.id) {
          updateBrand(editingBrand as DeviceBrand, adminName);
      } else {
          addBrand({ id: Math.random().toString(36).substr(2, 9), name: editingBrand.name }, adminName);
      }
      setEditingBrand({ name: '' });
  };

  const handleAccessorySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingAccessory.name) return;
      if(editingAccessory.id) {
          updateAccessoryType(editingAccessory as AccessoryType, adminName);
      } else {
          addAccessoryType({ id: Math.random().toString(36).substr(2, 9), name: editingAccessory.name }, adminName);
      }
      setEditingAccessory({ name: '' });
  };

  const handleCustomFieldAdd = () => {
      if(!newCustomField.trim()) return;
      addCustomField({ id: Math.random().toString(36).substr(2, 9), name: newCustomField }, adminName);
      setNewCustomField('');
  };

  const handleModelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelForm.name || !modelForm.brandId || !modelForm.typeId) return;

    if (modelForm.id) {
       updateModel(modelForm as DeviceModel, adminName);
    } else {
       addModel({ 
         ...modelForm, 
         id: Math.random().toString(36).substr(2, 9) 
       } as DeviceModel, adminName);
    }
    setModelForm({ imageUrl: '' });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const objectUrl = URL.createObjectURL(file);
        setModelForm({ ...modelForm, imageUrl: objectUrl });
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers size={20} /> Configurações de Ativos
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24}/></button>
        </div>

        {/* Tabs & Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 space-y-2 shrink-0">
            <button onClick={() => setActiveTab('TYPES')} className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'TYPES' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><Tag size={18} /> Tipos de Dispositivo</button>
            <button onClick={() => setActiveTab('FIELDS')} className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'FIELDS' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><List size={18} /> Campos Personalizados</button>
            <button onClick={() => setActiveTab('BRANDS')} className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'BRANDS' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><Box size={18} /> Marcas / Fabricantes</button>
            <button onClick={() => setActiveTab('ACCESSORIES')} className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'ACCESSORIES' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><Plug size={18} /> Tipos de Acessórios</button>
            <button onClick={() => setActiveTab('MODELS')} className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'MODELS' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><Layers size={18} /> Modelos & Fotos</button>
          </div>

          {/* Main Panel */}
          <div className="flex-1 p-8 overflow-y-auto">
            
            {/* --- TYPES --- */}
            {activeTab === 'TYPES' && (
              <div className="max-w-2xl">
                <h4 className="text-xl font-bold text-gray-800 mb-4">Tipos de Equipamento</h4>
                <form onSubmit={handleTypeSubmit} className="bg-blue-50 p-5 rounded-lg border border-blue-100 mb-6">
                   <h5 className="font-bold text-blue-900 mb-3">{editingType.id ? 'Editar Tipo' : 'Novo Tipo'}</h5>
                   <div className="flex gap-2 mb-4">
                       <input required type="text" placeholder="Nome do Tipo (ex: Projetor)" className="flex-1 border rounded-lg p-2" value={editingType.name || ''} onChange={e => setEditingType({...editingType, name: e.target.value})} />
                       {editingType.id && <button type="button" onClick={() => setEditingType({ name: '', customFieldIds: [] })} className="text-gray-500 text-sm px-3 hover:underline">Cancelar</button>}
                       <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-bold">{editingType.id ? 'Salvar' : 'Adicionar'}</button>
                   </div>
                   
                   <div className="bg-white p-3 rounded border">
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Campos Habilitados</label>
                       <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                           {customFields.map(f => (
                               <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                   <input 
                                     type="checkbox" 
                                     checked={(editingType.customFieldIds || []).includes(f.id)} 
                                     onChange={() => toggleFieldInType(f.id)}
                                     className="rounded text-blue-600"
                                   />
                                   {f.name}
                               </label>
                           ))}
                           {customFields.length === 0 && <span className="text-xs text-gray-400">Nenhum campo personalizado criado. Vá em "Campos Personalizados" primeiro.</span>}
                       </div>
                   </div>
                </form>

                <div className="space-y-2">
                   {assetTypes.map(t => (
                      <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                         <div>
                             <span className="font-medium block">{t.name}</span>
                             <div className="text-xs text-gray-500 mt-1">
                                Campos: {t.customFieldIds && t.customFieldIds.length > 0 
                                    ? t.customFieldIds.map(fid => customFields.find(f => f.id === fid)?.name).filter(Boolean).join(', ') 
                                    : 'Nenhum'}
                             </div>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={() => setEditingType(t)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit2 size={16}/></button>
                             <button onClick={() => deleteAssetType(t.id, adminName)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                         </div>
                      </div>
                   ))}
                </div>
              </div>
            )}

            {/* --- CUSTOM FIELDS --- */}
            {activeTab === 'FIELDS' && (
                <div className="max-w-xl">
                    <h4 className="text-xl font-bold text-gray-800 mb-4">Campos Personalizados</h4>
                    <p className="text-sm text-gray-500 mb-4">Crie campos extras (ex: Memória RAM, ID Flexx) e depois habilite-os nos Tipos de Dispositivo.</p>
                    
                    <div className="flex gap-2 mb-6">
                        <input 
                            type="text" 
                            placeholder="Nome do Campo (ex: Armazenamento SSD)" 
                            className="flex-1 border rounded-lg p-2"
                            value={newCustomField}
                            onChange={e => setNewCustomField(e.target.value)}
                        />
                        <button onClick={handleCustomFieldAdd} className="bg-green-600 text-white px-4 rounded-lg hover:bg-green-700 font-bold"><Plus/></button>
                    </div>

                    <div className="space-y-2">
                        {customFields.map(f => (
                            <div key={f.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                                <span className="font-medium text-gray-700">{f.name}</span>
                                <button onClick={() => deleteCustomField(f.id, adminName)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                            </div>
                        ))}
                        {customFields.length === 0 && <p className="text-gray-400 italic">Nenhum campo cadastrado.</p>}
                    </div>
                </div>
            )}

            {/* --- BRANDS --- */}
            {activeTab === 'BRANDS' && (
              <div className="max-w-xl">
                <h4 className="text-xl font-bold text-gray-800 mb-4">Marcas e Fabricantes</h4>
                <form onSubmit={handleBrandSubmit} className="flex gap-2 mb-6">
                   <input required type="text" placeholder="Nova Marca" className="flex-1 border rounded-lg p-2" value={editingBrand.name || ''} onChange={e => setEditingBrand({...editingBrand, name: e.target.value})}/>
                   {editingBrand.id && <button type="button" onClick={() => setEditingBrand({ name: '' })} className="text-gray-500">Cancelar</button>}
                   <button type="submit" className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700"><Plus/></button>
                </form>
                <div className="space-y-2">
                   {brands.map(b => (
                      <div key={b.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                         <span className="font-medium">{b.name}</span>
                         <div className="flex gap-2">
                             <button onClick={() => setEditingBrand(b)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit2 size={16}/></button>
                             <button onClick={() => deleteBrand(b.id, adminName)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                         </div>
                      </div>
                   ))}
                </div>
              </div>
            )}

            {/* --- ACCESSORIES --- */}
            {activeTab === 'ACCESSORIES' && (
              <div className="max-w-xl">
                <h4 className="text-xl font-bold text-gray-800 mb-4">Tipos de Acessórios</h4>
                <form onSubmit={handleAccessorySubmit} className="flex gap-2 mb-6">
                   <input required type="text" placeholder="Novo Acessório" className="flex-1 border rounded-lg p-2" value={editingAccessory.name || ''} onChange={e => setEditingAccessory({...editingAccessory, name: e.target.value})}/>
                   {editingAccessory.id && <button type="button" onClick={() => setEditingAccessory({ name: '' })} className="text-gray-500">Cancelar</button>}
                   <button type="submit" className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700"><Plus/></button>
                </form>
                <div className="space-y-2">
                   {accessoryTypes.map(acc => (
                      <div key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                         <span className="font-medium">{acc.name}</span>
                         <div className="flex gap-2">
                             <button onClick={() => setEditingAccessory(acc)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit2 size={16}/></button>
                             <button onClick={() => deleteAccessoryType(acc.id, adminName)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                         </div>
                      </div>
                   ))}
                </div>
              </div>
            )}

            {/* --- MODELS --- */}
            {activeTab === 'MODELS' && (
              <div className="space-y-6">
                <h4 className="text-xl font-bold text-gray-800">Catálogo de Modelos</h4>
                <form onSubmit={handleModelSubmit} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <h5 className="font-semibold text-gray-700 mb-4">{modelForm.id ? 'Editar Modelo' : 'Cadastrar Novo Modelo'}</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium mb-1">Nome</label><input required type="text" className="w-full border rounded-lg p-2" value={modelForm.name || ''} onChange={e => setModelForm({...modelForm, name: e.target.value})}/></div>
                        <div>
                           <label className="block text-sm font-medium mb-1">Marca</label>
                           <select required className="w-full border rounded-lg p-2" value={modelForm.brandId || ''} onChange={e => setModelForm({...modelForm, brandId: e.target.value})}>
                              <option value="">Selecione...</option>
                              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="block text-sm font-medium mb-1">Tipo</label>
                           <select required className="w-full border rounded-lg p-2" value={modelForm.typeId || ''} onChange={e => setModelForm({...modelForm, typeId: e.target.value})}>
                              <option value="">Selecione...</option>
                              {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                           </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Imagem</label>
                            <div className="flex items-center gap-3">
                                {modelForm.imageUrl ? <img src={modelForm.imageUrl} className="h-10 w-10 object-cover rounded bg-white border" /> : <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center text-gray-400"><ImageIcon size={20}/></div>}
                                <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-50">Escolher<input type="file" accept="image/*" className="hidden" onChange={handleImageChange} /></label>
                                <input type="text" placeholder="URL..." className="flex-1 border rounded-lg p-2 text-sm" value={modelForm.imageUrl || ''} onChange={e => setModelForm({...modelForm, imageUrl: e.target.value})}/>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        {modelForm.id && <button type="button" onClick={() => setModelForm({ imageUrl: '' })} className="text-gray-500 px-4 py-2">Cancelar</button>}
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save size={18}/> Salvar</button>
                    </div>
                </form>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {models.map(m => {
                        const brand = brands.find(b => b.id === m.brandId);
                        const type = assetTypes.find(t => t.id === m.typeId);
                        return (
                            <div key={m.id} className="flex items-center gap-4 bg-white border p-4 rounded-lg hover:shadow-sm">
                                <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0 border">
                                    {m.imageUrl ? <img src={m.imageUrl} className="h-full w-full object-cover" /> : <ImageIcon className="text-gray-300"/>}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-gray-800">{m.name}</h4>
                                    <p className="text-xs text-gray-500">{brand?.name} • {type?.name}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setModelForm(m)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16}/></button>
                                    <button onClick={() => deleteModel(m.id, adminName)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        );
                    })}
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
