
import React from 'react';
import { X, GitCommit, Calendar, Tag, User } from 'lucide-react';

interface SystemInfoModalProps {
  onClose: () => void;
}

const versions = [
    {
    version: '2.9.5',
    date: 'Hoje',
    title: 'Melhoria na Visibilidade de Ativos',
    changes: [
      'Aba de Ativos do Colaborador agora exibe chips atrelados aos dispositivos em posse.',
      'Contagem de chips na tabela principal de Colaboradores agora reflete chips atrelados e diretos.',
      'Sincronização global da versão para 2.9.5.'
    ]
  },
    {
    version: '2.9.4',
    date: 'Hoje',
    title: 'Correção de Persistência de Acessórios',
    changes: [
      'Correção no Provedor de Dados de Produção para enviar acessórios selecionados durante o Checkout.',
      'Sincronização global da versão para 2.9.4.'
    ]
  },
    {
    version: '2.9.3',
    date: 'Hoje',
    title: 'Correção de Sintaxe e Estabilidade',
    changes: [
      'Correção de erro de fechamento de tag na rota administrativa (App.tsx).',
      'Sincronização global da versão para 2.9.3.'
    ]
  },
    {
    version: '2.9.2',
    date: 'Hoje',
    title: 'Ajuste de Interface Operacional',
    changes: [
      'Remoção da exibição literal "null" quando o patrimônio de um ativo está vazio na tela de Operações.',
      'Melhoria na legibilidade da lista de busca por IMEI/Modelo.',
      'Sincronização global da versão para 2.9.2.'
    ]
  },
    {
    version: '2.9.1',
    date: '31/01/2025',
    title: 'Restauração de API & Estabilidade',
    changes: [
      'Correção total de rotas API no servidor Node.js (CRUD completo para todos os módulos).',
      'Implementação de rotas para Manutenções, Acessórios e Campos Extras no Backend.',
      'Melhoria na resiliência do modo Produção (Correção de erros 404 de sincronização).',
      'Sincronização global da versão para 2.9.1.'
    ]
  }
];

const SystemInfoModal: React.FC<SystemInfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        <div className="bg-slate-900 px-8 py-6 flex justify-between items-start shrink-0 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-1">Sobre o Sistema</h2>
            <p className="text-slate-400 text-sm">IT Asset 360 - Gestão Inteligente de Ativos</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors relative z-10">
            <X size={24} />
          </button>
          <div className="absolute -right-10 -top-10 text-slate-800 opacity-50">
             <GitCommit size={150} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
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
        <div className="bg-slate-50 border-t px-8 py-4 text-center">
             <p className="text-xs text-slate-400">© 2025 IT Asset 360. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default SystemInfoModal;
