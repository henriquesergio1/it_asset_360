import React, { useState } from 'react';
import { RoteirizadorVendedores } from './RoteirizadorVendedores';
import { RoteirizadorPromotores } from './RoteirizadorPromotores';
import { LocationMarkerIcon, UsersIcon } from './icons';

export const Roteirizador: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'vendedores' | 'promotores'>('vendedores');

    return (
        <div className="space-y-6">
            <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200 w-fit">
                <button
                    onClick={() => setActiveTab('vendedores')}
                    className={`flex items-center px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        activeTab === 'vendedores' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                >
                    <LocationMarkerIcon className="w-4 h-4 mr-2" />
                    Equipe de Vendas
                </button>
                <button
                    onClick={() => setActiveTab('promotores')}
                    className={`flex items-center px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        activeTab === 'promotores' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                >
                    <UsersIcon className="w-4 h-4 mr-2" />
                    Equipe Merchandising (Promotores)
                </button>
            </div>

            {activeTab === 'vendedores' ? <RoteirizadorVendedores /> : <RoteirizadorPromotores />}
        </div>
    );
};
