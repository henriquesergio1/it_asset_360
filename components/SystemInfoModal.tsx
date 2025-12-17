import React from 'react';
import { X, GitCommit, Calendar, Tag, User } from 'lucide-react';

interface SystemInfoModalProps {
  onClose: () => void;
}

const versions = [
    {
    version: '1.8.0',
    date: 'Atual',
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
    version: '1.7.6',
    date: '14/11/2023',
    title: 'Ajuste Legal e Layout',
    changes: [
      'Adicionado campo CNPJ nas configurações globais do sistema.',
      'Inclusão automática do CNPJ no cabeçalho do Termo de Responsabilidade.',
      'Otimização vertical do Termo para garantir impressão em uma única página A4.'
    ]
  },
    {
    version: '1.7.5',
    date: '14/11/2023',
    title: 'Personalização Avançada de Termos',
    changes: [
      'Inclusão automática do Logo da Empresa no cabeçalho do Termo de Responsabilidade.',
      'Exibição destacada do Nome da Empresa no topo do documento.',
      'Ajuste final de layout para garantir formatação correta na impressão.'
    ]
  },
    {
    version: '1.7.4',
    date: '14/11/2023',
    title: 'Simplificação de Assinaturas',
    changes: [
      'Remoção do campo de assinatura da empresa/TI no Termo de Responsabilidade.',
      'Centralização da assinatura do colaborador para layout mais limpo.',
      'Inclusão do CPF do colaborador logo abaixo da assinatura.'
    ]
  },
    {
    version: '1.7.3',
    date: '14/11/2023',
    title: 'Ajuste de Template',
    changes: [
      'Restauração das cláusulas jurídicas completas no Termo de Responsabilidade.',
      'Ajuste fino de margens e fontes para manter o documento em uma única página A4.',
      'Manutenção da exibição do "Setor" no cabeçalho do termo.'
    ]
  },
  {
    version: '1.7.2',
    date: '14/11/2023',
    title: 'Otimização de Documentos',
    changes: [
      'Substituição do campo "Empresa" por "Setor" no Termo de Responsabilidade.',
      'Refinamento do layout de impressão para ajuste perfeito em folha A4.',
      'Melhoria na organização visual das cláusulas e assinaturas.'
    ]
  },
  {
    version: '1.7.1',
    date: '14/11/2023',
    title: 'Atualização de Compliance',
    changes: [
      'Novo layout Profissional para o Termo de Responsabilidade.',
      'Inclusão de cláusulas LGPD e segurança de contas (iCloud/Google) no termo padrão.',
      'Melhoria na formatação de impressão dos termos.'
    ]
  },
  {
    version: '1.7.0',
    date: '14/11/2023',
    title: 'Melhorias de Usabilidade',
    changes: [
      'Nova interface de lista (tabela) para Colaboradores.',
      'Busca inteligente (Dropdown com pesquisa) na tela de Entrega/Devolução.',
      'Novo editor de Termos de Responsabilidade com barra de ferramentas e variáveis rápidas.'
    ]
  },
  {
    version: '1.6.2',
    date: '14/11/2023',
    title: 'Integração Visual Pulsus',
    changes: [
      'Adicionado botão de ação rápida na lista de dispositivos para abrir o MDM Pulsus.',
      'Melhoria na visualização de dispositivos vinculados.'
    ]
  },
  {
    version: '1.6.1',
    date: '12/11/2023',
    title: 'Otimização de Cadastro de Dispositivos',
    changes: [
      'Unificação dos campos Patrimônio (TAG) e IMEI em uma única interface inteligente.',
      'Seletor de Tipo de Identificação (Tag vs IMEI).',
      'Validação automática de 15 dígitos numéricos quando o tipo IMEI é selecionado.'
    ]
  },
  {
    version: '1.6.0',
    date: '12/11/2023',
    title: 'Expansão de Dados de Dispositivo',
    changes: [
      'Adicionado campo IMEI para dispositivos móveis.',
      'Adicionado campo ID PULSUS para integração com MDM.',
      'Adicionado campos de Setor e Código do Setor (Centro de Custo) diretamente no cadastro do dispositivo.'
    ]
  },
  {
    version: '1.5.1',
    date: '12/11/2023',
    title: 'Melhorias em Termos & Documentos',
    changes: [
      'Otimização na geração de termos: Chips vinculados a dispositivos agora são impressos automaticamente no termo do dispositivo principal.',
      'Ocultação do botão de termo individual para chips vinculados no perfil do colaborador.'
    ]
  },
  {
    version: '1.5.0',
    date: '10/11/2023',
    title: 'Automação de Documentos',
    changes: [
      'Gerador de Termos de Responsabilidade dinâmico.',
      'Editor de Templates HTML no Painel Admin.',
      'Impressão automática de termos na Entrega e Devolução.',
      'Botões de reimpressão de termos no perfil do colaborador.'
    ]
  },
  {
    version: '1.4.0',
    date: '15/10/2023',
    title: 'Gestão Avançada de Usuários',
    changes: [
      'Refatoração do módulo de Colaboradores.',
      'Gestão dinâmica de Setores.',
      'Lógica de inativação segura (bloqueio se houver ativos vinculados).',
      'Abas de Ativos, Termos e Logs no detalhe do usuário.'
    ]
  },
  {
    version: '1.3.0',
    date: '01/10/2023',
    title: 'Financeiro & Manutenção',
    changes: [
      'Módulo de controle de Manutenções e Custos.',
      'Cadastro de dados fiscais (NF, Valor, Fornecedor).',
      'Upload (simulado) de notas fiscais.',
      'Dashboards financeiros básicos.'
    ]
  },
  {
    version: '1.2.0',
    date: '10/09/2023',
    title: 'Configurações Dinâmicas',
    changes: [
      'Cadastro de Modelos, Marcas e Tipos de Ativo.',
      'Vínculo de Chips (SIM) com Aparelhos.',
      'Melhoria na busca e filtros de inventário.'
    ]
  },
  {
    version: '1.1.0',
    date: '20/08/2023',
    title: 'Operações & Auditoria',
    changes: [
      'Implementação do fluxo de Entrega (Checkout) e Devolução (Checkin).',
      'Sistema de Logs de Auditoria global.',
      'Rastreamento de histórico por ativo.'
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