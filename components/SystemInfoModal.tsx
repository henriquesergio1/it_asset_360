
import React from 'react';
import { X, GitCommit, Calendar, Tag, User } from 'lucide-react';

interface SystemInfoModalProps {
  onClose: () => void;
}

const versions = [
    {
    version: '1.8.1',
    date: 'Atual',
    title: 'Importação Inteligente & Sincronização',
    changes: [
      'Correção na importação CSV: O campo Patrimônio agora é opcional se o IMEI for fornecido (soberania do IMEI para dispositivos móveis).',
      'Detecção de duplicados aprimorada no importador (Tag OU IMEI).',
      'Adicionada opção "Sincronizar Cadastro" no fluxo de entrega: permite que o ativo herde automaticamente o Setor/Cód. do colaborador.',
      'Ajuste visual na lista de dispositivos para alertar divergências de setor entre Ativo e Usuário.'
    ]
  },
  {
    version: '1.8.0',
    date: '10/01/2025',
    title: 'Reestruturação de Dados de Colaborador',
    changes: [
      'Inversão semântica nos campos de colaborador.',
      'O campo "Setor" (Dropdown) agora representa o "Cargo / Função" (Ex: Vendedor, TI).',
      'O campo "Cargo" (Texto) agora representa o "Setor / Código Interno" digitável.',
      'Ajustes nos filtros e labels para refletir a nova organização.'
    ]
  },
    {
    version: '1.7.7',
    date: '15/11/2023',
    title: 'Refinamento Jurídico',
    changes: [
      'Restauração das cláusulas completas e profissionais no Termo de Responsabilidade.',
      'Melhoria na redação das condições de uso, segurança e devolução.',
      'Manutenção da formatação compacta para impressão em página única.'
    ]
  },
  {
    version: '1.0.0',
    date: '01/08/2023',
    title: 'MVP - Lançamento Inicial',
    changes: [
      'CRUD básico de Dispositivos.',
      'CRUD básico de Chips/SIMs.',
      'CRUD básico de Usuários.',
      'Autenticação de sistema.',
      'Dashboard geral.'
    ]
  }
];

const SystemInfoModal: React.FC<SystemInfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-slate-900 px-8 py-6 flex justify-between items-start shrink-0 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-1">Sobre o Sistema</h2>
            <p className="text-slate-400 text-sm">IT Asset 360 - Gestão Inteligente de Ativos</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors relative z-10">
            <X size={24} />
          </button>
          
          {/* Decorative background element */}
          <div className="absolute -right-10 -top-10 text-slate-800 opacity-50">
             <GitCommit size={150} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* Developer Credit */}
          <div className="mb-8 bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-center gap-4">
             <div className="bg-white p-3 rounded-full shadow-sm border border-blue-100">
                <User size={24} className="text-blue-600"/>
             </div>
             <div>
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Desenvolvido por</p>
                <h3 className="text-xl font-bold text-slate-800">Sergio Oliveira</h3>
                <p className="text-sm text-slate-500">Engenheiro de Software Sênior</p>
             </div>
          </div>

          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <GitCommit className="text-blue-600"/> Histórico de Versões
          </h3>

          <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 pb-4">
            {versions.map((ver, index) => (
              <div key={index} className="relative pl-8">
                {/* Timeline Dot */}
                <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-sm 
                    ${index === 0 ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300'}`}>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${index === 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        v{ver.version}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar size={12}/> {ver.date}
                    </span>
                </div>
                
                <h4 className="text-base font-bold text-slate-800 mb-2">{ver.title}</h4>
                
                <ul className="space-y-1">
                    {ver.changes.map((change, i) => (
                        <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span>
                            {change}
                        </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>

        </div>
        
        {/* Footer */}
        <div className="bg-slate-50 border-t px-8 py-4 text-center">
             <p className="text-xs text-slate-400">© 2025 IT Asset 360. Todos os direitos reservados.</p>
        </div>

      </div>
    </div>
  );
};

export default SystemInfoModal;
