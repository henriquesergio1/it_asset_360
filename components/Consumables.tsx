import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, AlertTriangle, Edit, Trash2, ArrowUpRight, ArrowDownRight, TrendingDown, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Consumable {
    Id: string;
    Name: string;
    Category: string;
    CurrentStock: number;
    MinStock: number;
    Unit: string;
    AvgDailyConsumption: number;
    EstimatedDaysLeft: number | null;
}

const Consumables = () => {
    const { user } = useAuth();
    const [consumables, setConsumables] = useState<Consumable[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    
    const [editingConsumable, setEditingConsumable] = useState<Consumable | null>(null);
    const [transactionConsumable, setTransactionConsumable] = useState<Consumable | null>(null);
    const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('IN');

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        currentStock: 0,
        minStock: 0,
        unit: 'Unidade'
    });
    
    const [transactionData, setTransactionData] = useState({
        quantity: 1,
        notes: ''
    });

    const fetchConsumables = async () => {
        try {
            const res = await fetch('/api/consumables', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setConsumables(data);
            }
        } catch (error) {
            console.error('Erro ao buscar consumíveis:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConsumables();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingConsumable ? `/api/consumables/${editingConsumable.Id}` : '/api/consumables';
            const method = editingConsumable ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchConsumables();
            } else {
                const err = await res.text();
                alert(err);
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar.');
        }
    };

    const handleTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transactionConsumable) return;

        try {
            const res = await fetch(`/api/consumables/${transactionConsumable.Id}/transaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    type: transactionType,
                    quantity: transactionData.quantity,
                    notes: transactionData.notes
                })
            });

            if (res.ok) {
                setIsTransactionModalOpen(false);
                fetchConsumables();
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao registrar transação.');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao registrar transação.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este item? O histórico também será perdido.')) return;
        try {
            const res = await fetch(`/api/consumables/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                fetchConsumables();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const openEditModal = (c: Consumable) => {
        setEditingConsumable(c);
        setFormData({
            name: c.Name,
            category: c.Category,
            currentStock: c.CurrentStock,
            minStock: c.MinStock,
            unit: c.Unit
        });
        setIsModalOpen(true);
    };

    const openNewModal = () => {
        setEditingConsumable(null);
        setFormData({
            name: '',
            category: 'Toner',
            currentStock: 0,
            minStock: 5,
            unit: 'Unidade'
        });
        setIsModalOpen(true);
    };

    const openTransactionModal = (c: Consumable, type: 'IN' | 'OUT') => {
        setTransactionConsumable(c);
        setTransactionType(type);
        setTransactionData({ quantity: 1, notes: '' });
        setIsTransactionModalOpen(true);
    };

    const filteredConsumables = consumables.filter(c => 
        c.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.Category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const lowStockItems = consumables.filter(c => c.CurrentStock <= c.MinStock);

    if (loading) return <div className="p-8 text-center text-slate-400">Carregando consumíveis...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                        <Package className="text-blue-500" /> Gestão de Consumíveis
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">Controle de estoque, toners, etiquetas e insumos.</p>
                </div>
                <button 
                    onClick={openNewModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                >
                    <Plus size={18} /> Novo Item
                </button>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-400">Total de Itens</p>
                            <p className="text-3xl font-bold text-slate-100 mt-2">{consumables.length}</p>
                        </div>
                        <div className="p-3 bg-blue-900/30 rounded-xl">
                            <Package className="text-blue-400" size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-400">Estoque Crítico</p>
                            <p className="text-3xl font-bold text-red-400 mt-2">{lowStockItems.length}</p>
                        </div>
                        <div className="p-3 bg-red-900/30 rounded-xl">
                            <AlertTriangle className="text-red-400" size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por nome ou categoria..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                                <th className="p-4 font-medium">Item</th>
                                <th className="p-4 font-medium">Estoque Atual</th>
                                <th className="p-4 font-medium">Mínimo</th>
                                <th className="p-4 font-medium">Consumo Médio (30d)</th>
                                <th className="p-4 font-medium">Duração Estimada</th>
                                <th className="p-4 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredConsumables.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">Nenhum consumível encontrado.</td>
                                </tr>
                            ) : (
                                filteredConsumables.map(c => {
                                    const isLowStock = c.CurrentStock <= c.MinStock;
                                    return (
                                        <tr key={c.Id} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="p-4">
                                                <div className="font-medium text-slate-200">{c.Name}</div>
                                                <div className="text-xs text-slate-500">{c.Category}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold text-lg ${isLowStock ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {c.CurrentStock}
                                                    </span>
                                                    <span className="text-xs text-slate-500">{c.Unit}</span>
                                                    {isLowStock && <span title="Estoque Crítico"><AlertTriangle size={14} className="text-red-400" /></span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-400">{c.MinStock} {c.Unit}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 text-slate-300">
                                                    <TrendingDown size={14} className="text-amber-500" />
                                                    {c.AvgDailyConsumption > 0 ? `${c.AvgDailyConsumption.toFixed(2)} / dia` : 'Sem dados'}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {c.EstimatedDaysLeft !== null ? (
                                                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${c.EstimatedDaysLeft <= 7 ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/30 text-emerald-400'}`}>
                                                        ~ {c.EstimatedDaysLeft} dias
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">Indeterminado</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => openTransactionModal(c, 'IN')} className="p-2 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40 rounded-lg transition-colors" title="Adicionar Estoque (Compra)">
                                                        <ArrowUpRight size={16} />
                                                    </button>
                                                    <button onClick={() => openTransactionModal(c, 'OUT')} className="p-2 bg-amber-900/20 text-amber-400 hover:bg-amber-900/40 rounded-lg transition-colors" title="Registrar Uso (Saída)">
                                                        <ArrowDownRight size={16} />
                                                    </button>
                                                    <div className="w-px h-6 bg-slate-800 mx-1"></div>
                                                    <button onClick={() => openEditModal(c)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors" title="Editar">
                                                        <Edit size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(c.Id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Add/Edit Consumable */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-100">{editingConsumable ? 'Editar Consumível' : 'Novo Consumível'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome / Descrição</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:border-blue-500 outline-none" placeholder="Ex: Toner HP 85A" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
                                    <input required type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:border-blue-500 outline-none" placeholder="Ex: Toner" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade</label>
                                    <input required type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:border-blue-500 outline-none" placeholder="Ex: Unidade, Rolo" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estoque Mínimo</label>
                                    <input required type="number" min="0" value={formData.minStock} onChange={e => setFormData({...formData, minStock: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:border-blue-500 outline-none" />
                                </div>
                                {!editingConsumable && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estoque Inicial</label>
                                        <input required type="number" min="0" value={formData.currentStock} onChange={e => setFormData({...formData, currentStock: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:border-blue-500 outline-none" />
                                    </div>
                                )}
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-slate-200 font-medium">Cancelar</button>
                                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Transaction */}
            {isTransactionModalOpen && transactionConsumable && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className={`p-6 border-b border-slate-800 flex justify-between items-center ${transactionType === 'IN' ? 'bg-emerald-900/10' : 'bg-amber-900/10'}`}>
                            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                {transactionType === 'IN' ? <ArrowUpRight className="text-emerald-500"/> : <ArrowDownRight className="text-amber-500"/>}
                                {transactionType === 'IN' ? 'Adicionar Estoque' : 'Registrar Uso'}
                            </h2>
                            <button onClick={() => setIsTransactionModalOpen(false)} className="text-slate-400 hover:text-slate-200"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleTransaction} className="p-6 space-y-4">
                            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 mb-4">
                                <p className="text-sm text-slate-400">Item selecionado</p>
                                <p className="font-bold text-slate-200">{transactionConsumable.Name}</p>
                                <p className="text-xs text-slate-500 mt-1">Estoque atual: {transactionConsumable.CurrentStock} {transactionConsumable.Unit}</p>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantidade</label>
                                <input 
                                    required 
                                    type="number" 
                                    min="1" 
                                    max={transactionType === 'OUT' ? transactionConsumable.CurrentStock : undefined}
                                    value={transactionData.quantity} 
                                    onChange={e => setTransactionData({...transactionData, quantity: parseInt(e.target.value)})} 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:border-blue-500 outline-none" 
                                />
                                {transactionType === 'OUT' && transactionData.quantity > transactionConsumable.CurrentStock && (
                                    <p className="text-xs text-red-400 mt-1">Quantidade maior que o estoque disponível.</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações (Opcional)</label>
                                <input 
                                    type="text" 
                                    value={transactionData.notes} 
                                    onChange={e => setTransactionData({...transactionData, notes: e.target.value})} 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:border-blue-500 outline-none" 
                                    placeholder={transactionType === 'IN' ? "Ex: Nota Fiscal 1234" : "Ex: Impressora RH"} 
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsTransactionModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-slate-200 font-medium">Cancelar</button>
                                <button 
                                    type="submit" 
                                    disabled={transactionType === 'OUT' && transactionData.quantity > transactionConsumable.CurrentStock}
                                    className={`px-6 py-2 rounded-xl font-bold shadow-lg transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed ${transactionType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/20'}`}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Consumables;
