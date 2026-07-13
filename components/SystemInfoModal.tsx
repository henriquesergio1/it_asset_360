
import React from 'react';
import packageJson from '../package.json';
import { X, GitCommit, Calendar, Tag, User } from 'lucide-react';

interface SystemInfoModalProps {
 onClose: () => void;
}

const versions = [
  {
    version: '3.49.0',
    date: 'Hoje',
    title: 'Gráfico de Consumo Diário & Relatório de Impressoras',
    changes: [
      'Gráfico de Consumo: Integração de histórico local de consumo de páginas com gráfico de barras SVG dinâmico na aba de monitoramento Zabbix.',
      'Relatórios: Criação de nova aba "Impressoras" em relatórios com filtros avançados por data, leitura de contadores e exportação (CSV, Excel, PDF).',
      'Banco de Dados: Sincronização inteligente e persistência diária automática dos contadores lidos do Zabbix no banco local.'
    ]
  },
  {
    version: '3.48.1',
    date: 'Hoje',
    title: 'Monitoramento de Impressoras & Links Interativos',
    changes: [
      'Navegação: Clique no card de impressoras no Dashboard agora redireciona e abre automaticamente o modal do ativo com a aba Monitor focada.',
      'Aprimoramento Visual: Barra de toner do dashboard configurada para ficar verde quando o nível atinge exatamente 100%.'
    ]
  },
  {
    version: '3.48.0',
    date: 'Hoje',
    title: 'Monitoramento de Impressoras & Refinamento Zabbix',
    changes: [
      'Visual: Refinamento das métricas do Zabbix (labels simplificados, uptime formatado em horas/minutos, e status ping simplificado em verde).',
      'Dashboard: Remoção dos cards antigos (Novo Empréstimo, Relatórios) e criação de um novo widget centralizado de Monitoramento de Impressoras.',
      'Integração: Sincronização inteligente em tempo real com barra de progresso de toner dinâmica e indicação de status ICMP.'
    ]
  },
  {
    version: '3.47.0',
    date: 'Hoje',
    title: 'Integração Zabbix Refinada & Exibição Dinâmica',
    changes: [
      'Zabbix: Resolvido o erro "unexpected parameter auth" adaptando o proxy para se comunicar nativamente tanto com versões antigas quanto recentes (Zabbix 6.4/7.0+) através de cabeçalho de autenticação Bearer.',
      'Configuração: Adicionado controle dinâmico de exibição do Zabbix Host ID parametrizado por tipo de ativo.',
      'Interface: Condicionamento inteligente do input Zabbix Host ID e da aba de Monitor nos detalhes do ativo.'
    ]
  },
  {
    version: '3.40.0',
    date: 'Hoje',
    title: 'Gestão Inteligente de Tarefas Recorrentes',
    changes: [
      'Recorrente: Cálculo automático do prazo de vigência correspondente ao criar a tarefa no painel.',
      'Status: Tarefa recorrente agora inicia automaticamente como "Em Curso".',
      'Confirmação: Mini painel interativo para confirmação prática e objetiva de execução individual.',
      'Histórico: Registro transparente de logs na timeline e avanço dinâmico para a próxima ocorrência.'
    ]
  },
  {
    version: '3.35.0',
    date: 'Hoje',
    title: 'Auditoria Técnica & Verificações Locais',
    changes: [
      'Funcionalidade: Nova seção de Auditoria Técnica dentro da aba de Manutenção dos dispositivos.',
      'Recurso: Registro de verificações de software, hardware, atualizações e inspeções físicas.',
      'Histórico: Separação visual entre manutenções externas corporativas e intervenções técnicas internas.',
      'Gestão: Acompanhamento de estado de conservação e conformidade de software sem fluxo de custos.'
    ]
  },
  {
    version: '3.34.0',
    date: 'Hoje',
    title: 'Visualização de Documentos',
    changes: [
      'Funcionalidade: Implementada visualização rápida de arquivos (PDF e Imagens) diretamente no sistema.',
      'Melhoria: Adicionado suporte a pré-visualização para Termos, Notas Fiscais e Registros de Manutenção.',
      'UX: Otimização do fluxo de conferência de documentos sem a necessidade de download obrigatório.'
    ]
  },
  {
    version: '3.33.18',
    date: 'Hoje',
    title: 'Correção de UI: Licenças e Contas',
    changes: [
      'UI: Corrigida a sincronização entre o seletor de colunas e o cabeçalho da tabela no menu Licenças.',
      'Ajuste: Aumentado o z-index do seletor de colunas para evitar sobreposição por outros elementos.'
    ]
  },
  {
    version: '3.33.17',
    date: 'Hoje',
    title: 'Correção de UI: Sobreposição de Menus',
    changes: [
      'UI: Corrigido problema onde o seletor de colunas aparecia atrás da tabela nos menus de Colaboradores e Dispositivos.',
      'Ajuste: Aumentado o nível de sobreposição (z-index) do seletor de colunas.'
    ]
  },
  {
    version: '3.33.16',
    date: 'Hoje',
    title: 'Ajuste de UI',
    changes: [
      'UI: Renomeado o campo "Código Interno (Folha)" para "Código Interno" no cadastro de colaboradores.'
    ]
  },
  {
    version: '3.33.15',
    date: 'Hoje',
    title: 'Sincronização de Código Interno',
    changes: [
      'Correção: Restaurada a lógica de sincronização automática do Código Interno (Folha) do dispositivo para o colaborador durante a entrega.',
      'UI: Campo "Código Interno (Folha)" agora está visível e editável no cadastro de colaboradores.'
    ]
  },
  {
    version: '3.33.14',
    date: 'Hoje',
    title: 'Ajuste no Formulário de Colaborador',
    changes: [
      'Refinamento: Removidos campos extras de informações complementares, mantendo apenas o campo de Endereço Residencial conforme solicitado pelo usuário.'
    ]
  },
  {
    version: '3.33.13',
    date: 'Hoje',
    title: 'Restauração de Campos de Colaboradores',
    changes: [
      'Bugfix: Restaurado o campo de Endereço e demais informações complementares (Cidade, Estado, CEP, Telefones, Gênero e Nascimento) que estavam ocultos no formulário de detalhes do colaborador.'
    ]
  },
  {
    version: '3.33.12',
    date: 'Hoje',
    title: 'Exibição de Status de Alertas',
    changes: [
      'Feature: Quando não há nenhum alerta de Expediente Falso ou Estoque Crítico de Consumíveis, o Dashboard passa a exibir cartões confirmando "0 alertas" ou "Tudo Certo" para evitar confusão sobre o funcionamento da área.'
    ]
  },
  {
    version: '3.33.11',
    date: 'Hoje',
    title: 'Correção nos Alertas de Expediente',
    changes: [
      'Bugfix: Restaurada a funcionalidade de leitura do ERP para alertas de expediente falso que havia sido bloqueada por uma rota fantasma.'
    ]
  },
  {
    version: '3.33.10',
    date: 'Hoje',
    title: 'Ajuste de Dispositivos Compartilhados',
    changes: [
      'Bugfix: Ao entregar dispositivo compartilhado para um novo usuário, o sistema não desvincula mais o usuário anterior, mantendo no AdditionalUserIds',
      'Feature: O termo de entrega gerado para entregas compartilhadas ganha a observação automática "(Uso Compartilhado)" na listagem de ativos.'
    ]
  },
  {
    version: '3.33.9',
    date: 'Hoje',
    title: 'Ajuste no Painel de Termos Pendentes do Dashboard',
    changes: [
      'Feature: Agora, clicar em "Ver mais pendências" expande a lista via scrollbar direto no Dashboard sem precisar sair da tela'
    ]
  },
  {
    version: '3.33.8',
    date: 'Hoje',
    title: 'Correção Adicional de Compartilhados e Copiar Senhas',
    changes: [
      'Fix: Adicionado e.preventDefault() nos botões de cópia para garantir que evitem navegação/abertura de outras telas acidentalmente',
      'Fix: Aprimorada a lista de entrega para exibir dispositivos compartilhados mesclando disponibilidade mesmo quando atrelados',
      'Fix: Corrigida a prop type="button" nos botões de cópia para prevenir recarregamentos default'
    ]
  },
  {
    version: '3.33.7',
    date: 'Hoje',
    title: 'Correções de Fluxo e Funcionalidades',
    changes: [
      'Fix: Botão de copiar senhas em Gestão de Contas e Perfil do Colaborador restabelecido, agora inclui modo fallback via document.execCommand para funcionar com consistência',
      'Fix: Clicar em Dispositivos, Chips ou Licenças na aba do colaborador agora abre corretamente os detalhes daquele item abrindo sua edição/view'
    ]
  },
  {
    version: '3.33.6',
    date: 'Hoje',
    title: 'Correção Visual da Coluna Ações',
    changes: [
      'UI: Corrigido o estilo (cor de fundo e tamanho) da coluna "Ações" nas telas de Consumíveis, Gestão de Tarefas e Chips.'
    ]
  },
  {
    version: '3.33.5',
    date: 'Hoje',
    title: 'Visibilidade de Ações nas Telas de Chip e Consumíveis',
    changes: [
      'UX: Removido o comportamento de "hover" (passar o mouse) das ações de edição e exclusão na lista de Chips/SIMs e Consumíveis, mantendo-os sempre visíveis como nas demais telas do sistema.',
    ]
  },
  {
    version: '3.33.4',
    date: 'Hoje',
    title: 'Botão Copiar Senha na Gestão de Contas',
    changes: [
      'UX: Adicionado botão "Copiar Senha" diretamente na tabela raiz de Licenças/Contas (Gestão de Contas).'
    ]
  },
  {
    version: '3.33.3',
    date: 'Hoje',
    title: 'Adicionado Botão Copiar Senha',
    changes: [
      'UX: Adicionado botão "Copiar Senha" na aba de "Licenças e Contas" do Colaborador para facilitar o fluxo do Service Desk.',
      'Fix: Adicionado stopPropagation nas ações de exibição de senha para não acionar a navegação do card acidentalmente.'
    ]
  },
  {
    version: '3.33.2',
    date: 'Hoje',
    title: 'Navegação Reativa e Exibição de Senhas',
    changes: [
      'UX: Agora é possível navegar diretamente para os Detalhes de um Ativo (Dispositivo/Linha) a partir da aba "Ativos em Posse" do Colaborador.',
      'UX: A aba de "Licenças e Contas" agora permite visualizar a senha (com toggle de ocultar/mostrar) e navegar direto para a Conta em questão.',
      'Fix: O modal do Colaborador agora se fecha automaticamente ao navegar para os painéis de origens das vinculações.'
    ]
  },
  {
    version: '3.33.0',
    date: 'Hoje',
    title: 'Performance & Network Optimization',
    changes: [
      'Infra: Reduzido drasticamente o tamanho do payload e a frequência de requisições de /sync e /bootstrap.',
      'Infra: React Query configurado com staleTime e intervalo de refetch inteligentes para evitar spam na rede (causa comum de lentidão no frontend).',
      'Infra: Os logs de auditoria retornam limitados da DB no load.'
    ]
  },
  {
    version: '3.32.2',
    date: 'Hoje',
    title: 'Fix: Multiformat Term Support (PDF/JPG/PNG)',
    changes: [
      'Bugfix: Corrigido o download de termos que são imagens (JPG/PNG). Agora o sistema detecta o formato e salva com a extensão correta.',
      'UX: Removido o erro que forçava .pdf em arquivos que originalmente eram fotos.',
      'Stability: Melhorada a detecção de Content-Type durante a reconstrução de Blobs para download.'
    ]
  },
  {
    version: '3.32.1',
    date: 'Hoje',
    title: 'Fix: Term File Upload & Versioning',
    changes: [
      'Bugfix: Corrigido o fluxo de upload de termos assinado na ficha do colaborador.',
      'Stability: Migrada a lógica de salvamento de arquivos para função especializada `updateTermFile`.',
      'Mock: Implementado suporte a persistência simulada de upload de termos em modo desenvolvimento.'
    ]
  },
  {
    version: '3.32.0',
    date: 'Hoje',
    title: 'UX Improvements & Manual Terms Status',
    changes: [
      'UI: Substituído ícone genérico de colaborador por Avatares coloridos com iniciais dos nomes.',
      'Terms: Implementada distinção visual para "Resolução Manual". Agora exibe badge "Manual" com motivo em vez de "Assinado".',
      'Bugfix: Corrigida a função de remover anexo do termo. Agora limpa corretamente os arquivos no banco e reseta o status para "Pendente".',
      'Infra: Ajustado endpoint de deleção de termos para resetar flags de contingência manual.'
    ]
  },
  {
    version: '3.31.2',
    date: 'Hoje',
    title: 'Hotfix: Auditoria de Logs e Download de Arquivos',
    changes: [
      'Histórico: Filtro expandido para buscar colaborador no campo Notas e Alvo (Correção de logs vazios).',
      'Auditoria: Integrada tabela AuditLogs real no histórico do colaborador.',
      'Downloads: Nova rotina de conversão Blob para garantir downloads de Base64 grandes sem falhas.',
      'Fidelidade: Refinamento da reconstrução de ativos para termos legados (Fallback inteligente).',
      'Infra: Sincronização de nomes de campos entre SQL e Frontend para acessórios e chips.'
    ]
  },
  {
    version: '3.30.5',
    date: 'Hoje',
    title: 'Term Fidelity & Sync Fix',
    changes: [
      'Fix: Garantida a re-impressão fiel de termos incluindo acessórios e chips vinculados mesmo após mudanças no inventário;',
      'Fix: Implementada busca automática de termos assinados (hasFile) quando a URL não está presente no estado inicial;',
      'Fix: Habilitada funcionalidade de download de termos em modo Mock para testes de desenvolvimento.'
    ]
  },
  {
    version: '3.30.4',
    date: 'Hoje',
    title: 'Audit Consistency Fix',
    changes: [
      'Fix: Corrigido ReferenceError: logs is not defined ao acessar a aba de histórico do colaborador;',
      'Fix: Garantida a provisão de dados de auditoria tanto em ambiente Mock quanto em Produção.'
    ]
  },
  {
    version: '3.30.3',
    date: 'Hoje',
    title: 'Audit & Reprint Synchrony',
    changes: [
      'Fix: Restaurada a visualização do Histórico (Logs) no cadastro de colaboradores;',
      'Fix: Adicionado suporte a exibição de Chip Vinculado na re-impressão de termos já gerados;',
      'Stability: Correção de aninhamento de componentes que causava tela em branco em fluxos específicos.'
    ]
  },
  {
    version: '3.30.2',
    date: 'Hoje',
    title: 'Rich Term Details',
    changes: [
      'UI: Substituído o ID técnico do termo pelos detalhes reais do dispositivo (Modelo/TAG/IMEI) na lista de termos do colaborador.',
      'UX: Melhorada a legibilidade das informações de emissão de documento.'
    ]
  },
  {
    version: '3.30.1',
    date: 'Hoje',
    title: 'Smart Asset Identification (Term)',
    changes: [
      'UI: Campo "Patrimônio" renomeado para "Patrimônio / IMEI" (em negrito) no termo impresso;',
      'Fix: Lógica inteligente para exibir apenas o identificador preenchido (TAG ou IMEI), ocultando "S/T" ou "S/I".'
    ]
  },
  {
    version: '3.30.0',
    date: 'Hoje',
    title: 'Critical Fix - Provider Methods',
    changes: [
      'Fix: Restaurados métodos ausentes no MockDataProvider que causavam erro no Dashboard;',
      'Stability: Garantida compatibilidade total do modo Mock com as telas do sistema.'
    ]
  },
  {
    version: '3.29.9',
    date: 'Hoje',
    title: 'Force Mock Data & License Reset',
    changes: [
      'Data: Forçado o carregamento de dados Mock em ambiente de desenvolvimento;',
      'Data: Reset automático de cache de licença para evitar a barra de "Modo Consulta";',
      'Data: Garantida a visualização de Chips e Dispositivos de teste.'
    ]
  },
  {
    version: '3.29.8',
    date: 'Hoje',
    title: 'Renew Mock License & Data Refresh',
    changes: [
      'Data: Renovação da licença de demonstração (expira em Dez/2026);',
      'Data: Forçada atualização das configurações mock para evitar cache de licenças expiradas;',
      'Data: Vinculo de campos personalizados e acessórios reestabelecido no ambiente mock.'
    ]
  },
  {
    version: '3.29.7',
    date: 'Hoje',
    title: 'Atualização de Dados para Testes',
    changes: [
      'Data: Dados mock regenerados com novos formatos de etiquetas;',
      'Data: Inclusão de termos históricos com suporte a filebinary legacy e assetId;',
      'Dev: Melhoria na cobertura de acessórios para validação de termos.'
    ]
  },
  {
    version: '3.29.6',
    date: 'Hoje',
    title: 'Correção de Download e Identificação de Ativos',
    changes: [
      'Fix: Recuperado suporte ao campo legado de arquivos (filebinary);',
      'Fix: Parsing detalhado de etiquetas [TAG] e [CHIP] para recuperar IMEI/Serial/Número separadamente;',
      'UX: Garantida exibição de Número e ICCID em termos de SIM card solo.'
    ]
  },
  {
    version: '3.29.5',
    date: 'Hoje',
    title: 'Recuperação Visual de Patrimônio e Acessórios',
    changes: [
      'Fix: Restaurada leitura de AssetID legado ignorado nos termos;',
      'UX: Acessórios, patrimônio condensado e Seriais voltam a ser populados perfeitamente no PDF.'
    ]
  },
  {
    version: '3.29.4',
    date: 'Hoje',
    title: 'Estabilização de Geração de Termos',
    changes: [
      'Fix: Remapeado a geração de termos pendentes.',
      'Fix: Otimizado o download de Base64 para contornar o React Router usando URL.createObjectURL e fetch().'
    ]
  },
  {
    version: '3.29.3',
    date: 'Hoje',
    title: 'Correção de Download e Navegação',
    changes: [
      'Fix: Adicionado type="button" aos botões de termos para evitar recarregamento da página.',
      'Fix: Melhorada a lógica de download de termos assinados (Base64) para forçar o download.',
      'Fix: Corrigida geração de PDF de termos pendentes.'
    ]
  },
  {
    version: '3.29.2',
    date: 'Hoje',
    title: 'Correção de Dependência Ausente',
    changes: [
      'Fix: Restaurada importação do componente DataTable em UserManager.',
      'Sinc: Alinhamento de versão global.'
    ]
  },
  {
    version: '3.29.1',
    date: 'Hoje',
    title: 'Correção de Inicialização Crítica',
    changes: [
      'Fix: Corrigida ordem de declaração dos hooks em UserManager para evitar erro de referência (TDZ).',
      'UX: Sincronização de versionamento em todo o sistema.'
    ]
  },
  {
    version: '3.29.0',
    date: 'Hoje',
    title: 'Restauração de Funcionalidades Críticas',
    changes: [
      'UserManager: Restaurada a navegação dos ativos (dispositivos/chips) diretamente para o cadastro.',
      'UserManager: Corrigida a gestão de termos (Download, Upload e funcionalidade de Excluir/Alterar).',
      'UserManager: Botão de edição de termo agora restrito apenas a termos pendentes.',
      'Dashboard: Corrigido link de detalhes do termo para abrir a aba correta do colaborador.',
      'Dashboard: Botão "Ver mais pendências" agora filtra corretamente na tela de Colaboradores.',
      'Nav: Implementada navegação via parâmetros de URL (userId, tab, showPendingOnly).'
    ]
  },
  {
    version: '3.28.1',
    date: 'Hoje',
    title: 'Correção de Layout Crítico',
    changes: [
      'UI: Forçada a permanência dos botões em linha única (flex-nowrap).',
      'UI: Título da página agora é flexível (flex-1) e trunca para dar prioridade aos botões de ação.',
      'UI: Ajuste dos pontos de interrupção (breakpoints) para melhor suporte em notebooks de 13/14 polegadas.',
      'UI: Refinamento de paddings internos para eliminar espaços mortos.'
    ]
  },
  {
    version: '3.28.0',
    date: 'Hoje',
    title: 'Melhoria de UI Responsiva',
    changes: [
      'UI: Ajuste na escala tipográfica e espaçamentos dos cabeçalhos para evitar quebra de linha em resoluções menores.',
      'UI: Botões de ação agora possuem paddings e tamanhos de fonte adaptativos.',
      'UX: Títulos de seção agora utilizam truncamento inteligente e tamanhos dinâmicos.',
      'Fix: Otimização de containers flexíveis para melhor aproveitamento de espaço em tablets.'
    ]
  },
  {
    version: '3.27.9',
    date: 'Hoje',
    title: 'Correção de Infra Docker',
    changes: [
      'Infra: Porta da API agora é dinâmica (process.env.PORT), permitindo execução correta em containers (PORT 5000/5001).',
      'Infra: Ajuste de porta sincronizado com docker-compose e nginx.conf.',
      'Fix: Removido hardcode de porta 3000 que causava falha no proxy reverso do Nginx.'
    ]
  },
  {
    version: '3.27.8',
    date: 'Hoje',
    title: 'Estabilidade e Fallback Mock',
    changes: [
      'Engine: Servidor Express agora inicializa mesmo com falha no banco de dados (fallback preventivo).',
      'Engine: DataProvider agora força redetecção de ambiente para evitar travamento em modo Production sem API.',
      'API: Adicionado endpoint ausente para alertas de expediente.',
      'Fix: Correção de 404 em diversos endpoints auxiliares.'
    ]
  },
  {
    version: '3.27.7',
    date: 'Hoje',
    title: 'Correção Crítica: API em Produção',
    changes: [
      'Fix: Correção de roteamento de API no servidor Express para ambientes de produção.',
      'Fix: Ajuste de conectividade e remoção de portas fixas nas requisições do frontend.',
      'Versão: Sincronização global para v3.27.7.'
    ]
  },
  {
    version: '3.27.6',
    date: 'Hoje',
    title: 'Filtro Fonético de Colaboradores',
    changes: [
      'UI: Implementação de busca fonética inteligente no módulo de colaboradores (ex: Wanderley encontrará Vanderlei).',
      'UI: Suporte a variações fonéticas PT-BR como PH/F, CH/X, W/V e letras dobradas.',
      'Versão: Sincronização global para v3.27.6.'
    ]
  },
  {
    version: '3.27.5',
    date: 'Hoje',
    title: 'Melhorias na Pesquisa Inteligente',
    changes: [
      'UI: Pesquisa de colaboradores agora ignora acentos e maiúsculas (ex: pesquisar Sérgio encontrará Sergio).',
      'UI: Implementação de busca insensível a acentos no módulo de Consumíveis.',
      'Versão: Sincronização global para v3.27.5.'
    ]
  },
  {
    version: '3.27.4',
    date: 'Hoje',
    title: 'Resiliência de Inicialização e Preview',
    changes: [
      'Infra: Servidor Express agora é resiliente a falhas de conexão com o banco de dados MSSQL, permitindo a execução do frontend com dados mock sem travamentos.',
      'Infra: Remoção de process.exit(1) em falhas de DB para garantir disponibilidade do Preview.',
      'Versão: Sincronização global para v3.27.4.'
    ]
  },
  {
    version: '3.27.3',
    date: 'Hoje',
    title: 'Correções de Infraestrutura e Interface',
    changes: [
      'Infra: Integração do servidor Express com Vite (Middleware Mode) para resolver erros de proxy e conexão ECONNREFUSED.',
      'Bug: Correção de ReferenceError no módulo de Chips SIM.',
      'UI: Alteração da paleta de cores secundária de Rosa para Azul no módulo de Relatórios.',
      'Versão: Sincronização global para v3.27.3.'
    ]
  },
  {
    version: '3.27.2',
    date: '22/04/2026',
    title: 'Padronização Visual Final & Versionamento',
    changes: [
      'UI: Unificação total do layout de cabeçalhos e cards de resumo em todos os módulos (Dispositivos, Consumíveis, Tarefas e Relatórios).',
      'UI: Reposicionamento de widgets de indicadores no módulo de Relatórios para alinhar com o padrão sistêmico.',
      'Versão: Sincronização global para v3.27.2.'
    ]
  },
  {
    version: '3.27.1',
    date: 'Hoje',
    title: 'Padronização Global de Cabeçalhos e Relatórios',
    changes: [
      'UI: Extensão da padronização de cabeçalhos para Dispositivos, Consumíveis, Tarefas e Relatórios.',
      'UI: Unificação de ícones, tipografia e cards de resumo em todos os módulos.',
      'Funcionalidade: Adição de exportação (CSV/Excel/PDF) e seletor de colunas nos módulos restantes.',
      'Versão: Sincronização global para v3.27.1.'
    ]
  },
  {
    version: '3.26.8',
    date: 'Hoje',
    title: 'Restauração de Fluxos de Auditoria e Feedback',
    changes: [
      'Auditoria: Restaurada a obrigatoriedade do motivo de alteração na edição de colaboradores.',
      'UX/UI: Reativadas as notificações (Toasts) de sucesso no canto inferior direito para todas as operações CRUD.',
      'UX/UI: Padronização do componente de justificativa entre os módulos de Usuários e Dispositivos.',
      'Sincronização global para v3.26.8.'
    ]
  },
  {
    version: '3.26.7',
    date: 'Hoje',
    title: 'Correção Crítica: Cadastro e Edição de Colaboradores/Ativos',
    changes: [
      'Backend: Correção de Erro 500 ao atualizar colaboradores e dispositivos (campos virtuais ignorados no CRUD).',
      'Frontend: Refatoração da abertura de modais para limpeza de dados calculados antes do envio à API.',
      'Banco de Dados: Garantida a presença de todos os novos campos de perfil (Gênero, Nascimento, Endereço, etc).',
      'Segurança: Melhoria na sanitização das chaves enviadas às rotas genéricas de banco de dados.',
      'Versão: Atualizado para v3.26.7.'
    ]
  },
  {
    version: '3.5.7',
 date: '27/03/2026',
 title: 'Revisão Global do Tema Escuro - Final',
 changes: [
 'UI: Revisão completa e aprimoramento do Modo Escuro (Dark Mode) em toda a aplicação.',
 'UI: Correção de cores, contrastes e bordas em modais, tabelas, formulários e badges.',
 'UI: Melhorias visuais nos componentes DeviceManager, Operations, UserManager, AccountManager e ModelSettings.',
 'Versão: Atualizado para v3.5.7.'
 ]
 },
 {
 version: '3.5.6',
 date: '27/03/2026',
 title: 'Revisão Global do Tema Escuro',
 changes: [
 'UI: Revisão completa de todos os componentes para garantir suporte total ao modo escuro.',
 'UI: Ajuste de cores de fundo, bordas e textos em modais, tabelas e formulários.',
 'Versão: Atualizado para v3.5.6.'
 ]
 },
 {
 version: '3.5.5',
 date: '26/03/2026',
 title: 'Polimento Final do Tema Escuro',
 changes: [
 'UX: Correção de cores de texto em campos de input e selects no modo escuro.',
 'UX: Ajustes finais de contraste em botões de ação e paginação.',
 'Versão: Atualizado para v3.5.5.'
 ]
 },
 {
 version: '3.5.4',
 date: '26/03/2026',
 title: 'Polimento Final do Tema Escuro',
 changes: [
 'UX: Revisão final e correção de cores em botões de ação e modais para garantir contraste e consistência no tema escuro.',
 'UX: Ajuste de contrastes em estados de hover em todos os componentes.',
 'Versão: Atualizado para v3.5.4.'
 ]
 },
 {
 version: '3.5.3',
 date: '26/03/2026',
 title: 'Correções do Tema Escuro',
 changes: [
 'UX: Revisão e correção de cores de ícones (como a lixeira) e elementos em diversos componentes para garantir contraste e consistência no tema escuro.',
 'UX: Ajuste visual na seção de tarefas pendentes do dashboard para alinhar com o padrão das demais seções.',
 'Versão: Atualizado para v3.5.3.'
 ]
 },
 {
 version: '3.4.0',
 date: '26/03/2026',
 title: 'Sistema Global de Notificações (Toasts)',
 changes: [
 'UX: Implementação de notificações flutuantes em todo o sistema para feedback imediato de ações.',
 'UX: Notificações para criação, edição, exclusão e movimentação de ativos e colaboradores.',
 'UX: Padronização de mensagens de sucesso e erro em todos os módulos.',
 'Versão: Atualizado para v3.4.0.'
 ]
 },
 {
 version: '3.3.0',
 date: '24/03/2026',
 description: 'Refatoração e Modularização do Backend para melhor escalabilidade e manutenção.',
 changes: [
 'Arquitetura: Modularização das rotas do servidor em arquivos separados (crud, devices, tasks, logs, terms, etc.).',
 'Arquitetura: Centralização da lógica de banco de dados e funções utilitárias em server/utils/db.js.',
 'Manutenibilidade: Código do servidor mais limpo, organizado e fácil de expandir.',
 'Performance: Redução do tamanho do arquivo principal do servidor (server.js).'
 ]
 },
 {
 version: '3.2.0',
 date: '24/03/2026',
 description: 'Implementação de paginação server-side para logs de auditoria e histórico de ativos/usuários.',
 changes: [
 'Performance: Paginação real no backend para a aba de Auditoria, reduzindo o tempo de carregamento inicial.',
 'Performance: Otimização da busca de histórico de ativos e usuários usando rotas específicas.',
 'UX: Adição de indicadores de carregamento e controles de paginação na tabela de logs.',
 'Correção: O histórico de ativos e usuários agora exibe todos os eventos, sem limite de 200 registros.'
 ]
 },
 {
 version: '3.1.0',
 date: '24/03/2026',
 title: 'Performance do Frontend com React Query',
 changes: [
 'Performance: Implementação do React Query para cache inteligente e redução de tráfego de rede.',
 'UX: Telas carregam mais rápido e dados são atualizados automaticamente em background.'
 ]
 },
 {
 version: '3.0.0',
 date: '24/03/2026',
 title: 'Major Release: Estabilidade e Fundação',
 changes: [
 'Marco: O sistema atinge sua primeira versão Major (3.0.0), marcando estabilidade e maturidade.',
 'Performance: Criação de índices no banco de dados para otimização de consultas e velocidade.',
 'Arquitetura: Modularização do backend para facilitar a manutenção e escalabilidade futura.'
 ]
 },
 {
 version: '2.20.11',
 date: '24/03/2026',
 title: 'Correção de Quebra de Linha',
 changes: [
 'Correção: O campo de histórico de ações das tarefas agora respeita as quebras de linha (enter) digitadas pelo usuário.',
 'Versão: Atualizado para v2.20.11.'
 ]
 },
 {
 version: '2.20.10',
 date: '23/03/2026',
 title: 'Correção no Alerta de Expediente',
 changes: [
 'Correção: Resolvido erro 500 (Validation failed for parameter Codigo) ao salvar o motivo/observação no alerta de expediente.',
 'Versão: Atualizado para v2.20.10.'
 ]
 },
 {
 version: '2.20.9',
 date: '23/03/2026',
 title: 'Correção na Edição de Tarefas e Prazos',
 changes: [
 'Correção: Resolvido erro 500 ao salvar a edição de uma tarefa (campos auxiliares ignorados no backend).',
 'Correção: A lista de tarefas agora exibe corretamente os prazos definidos (corrigido mapeamento do"Sem prazo").',
 'Correção: Ajustado o formato da data no formulário de edição para evitar avisos no console.',
 'Versão: Atualizado para v2.20.9.'
 ]
 },
 {
 version: '2.20.8',
 date: '23/03/2026',
 title: 'Correção de Erro no Alerta de Expediente',
 changes: [
 'Correção: Resolvido erro 500 ao salvar a desativação temporária do alerta de expediente.',
 'Melhoria: Adicionado tratamento de erro no frontend para exibir mensagens reais do servidor.',
 'Versão: Atualizado para v2.20.8.'
 ]
 },
 {
 version: '2.20.7',
 date: '23/03/2026',
 title: 'Desativação Temporária de Alertas de Expediente',
 changes: [
 'Funcionalidade: Adicionada opção para desativar temporariamente alertas de expediente (ERP).',
 'UX: Alertas desativados vão para o final da lista com cor diferenciada (âmbar).',
 'Versão: Atualizado para v2.20.7.'
 ]
 },
 {
 version: '2.20.6',
 date: '23/03/2026',
 title: 'Ajuste de Layout da Tela de Tarefas',
 changes: [
 'UX: Ajuste do layout da tela de tarefas para utilizar a largura total da tela, padronizando com o restante do sistema.',
 'Versão: Atualizado para v2.20.6.'
 ]
 },
 {
 version: '2.20.5',
 date: '23/03/2026',
 title: 'Múltiplos Vínculos em Contas e Licenças',
 changes: [
 'Funcionalidade: Suporte a múltiplos vínculos de colaboradores e dispositivos em uma única conta/licença.',
 'UX: Nova interface de gerenciamento de vínculos no modal de edição de contas.',
 'Versão: Atualizado para v2.20.5.'
 ]
 },
 {
 version: '2.20.4',
 date: '23/03/2026',
 title: 'Edição Geral de Tarefas e Correção de Recorrência',
 changes: [
 'Funcionalidade: Implementada edição geral de tarefas (título, descrição, prazo, responsável, recorrência).',
 'Funcionalidade: Adição e remoção de dispositivos em tarefas de manutenção em lote.',
 'Fix: Corrigido bug onde o campo"Dia Fixo"não aparecia na criação de tarefas recorrentes.',
 'Versão: Atualizado para v2.20.4.'
 ]
 },
 {
 version: '2.20.3',
 date: '23/03/2026',
 title: 'Refinamento do Modal de Tarefas (Checklist)',
 changes: [
 'UX: Checklist de dispositivos movido para o final do modal.',
 'UX: Formulário de conclusão de item agora é exibido inline (abaixo do item).',
 'Funcionalidade: Adicionado campo de observação/nota individual para cada item concluído.',
 'Versão: Atualizado para v2.20.3.'
 ]
 },
 {
 version: '2.20.2',
 date: '23/03/2026',
 title: 'Correção de Banco de Dados (Manutenção em Lote)',
 changes: [
 'Fix: Adicionada migração automática para a coluna MaintenanceItems na tabela Tasks.',
 'Fix: Atualizado script database.sql.txt com as novas colunas da tabela Tasks.',
 'Versão: Atualizado para v2.20.2.'
 ]
 },
 {
 version: '2.20.1',
 date: '23/03/2026',
 title: 'Refinamento de Manutenção em Lote',
 changes: [
 'Funcionalidade: Adicionado botão"Iniciar"individual para itens de manutenção em lote.',
 'UX: Status"Em Andamento"individual para cada dispositivo no checklist.',
 'UX: Feedback visual (ícone pulsante) para itens em execução.',
 'Integração: Iniciar um item altera automaticamente o status da tarefa principal para"Em Andamento".',
 'Versão: Atualizado para v2.20.1.'
 ]
 },
 {
 version: '2.20.0',
 date: '23/03/2026',
 title: 'Manutenção em Lote (Checklist)',
 changes: [
 'Funcionalidade: Implementação de Manutenção em Lote (Checklist).',
 'Funcionalidade: Criação de tarefa única para múltiplos dispositivos.',
 'Funcionalidade: Conclusão individual de itens com custo e NF por dispositivo.',
 'Filtro: Seleção de dispositivos por tipo na criação de tarefas.',
 'Integração: Geração automática de registros de manutenção individuais ao concluir cada item.',
 'Versão: Atualizado para v2.20.0.'
 ]
 },
 {
 version: '2.19.20',
 date: '23/03/2026',
 title: 'Gestão de Manutenção Avançada',
 changes: [
 'Funcionalidade: Ajuste de custo final na conclusão de tarefas de manutenção.',
 'Funcionalidade: Upload de nota fiscal (PDF/Imagem) na conclusão de manutenção.',
 'Integração: Registro automático no histórico do dispositivo com custo real e nota fiscal.',
 'UX: Novo fluxo de confirmação de dados ao encerrar manutenções.',
 'Versão: Atualizado para v2.19.20.'
 ]
 },
 {
 version: '2.19.19',
 date: '23/03/2026',
 title: 'Melhorias no Módulo de Tarefas',
 changes: [
 'Funcionalidade: Adicionado suporte a dispositivos em tarefas de manutenção.',
 'Funcionalidade: Suporte a tipos de manutenção (Preventiva/Corretiva).',
 'Versão: Atualizado para v2.19.19.'
 ]
 },
 {
 version: '2.19.18',
 date: '23/03/2026',
 title: 'Integração de Manutenção',
 changes: [
 'Funcionalidade: Criação automática de histórico de manutenção ao concluir tarefas.',
 'Versão: Atualizado para v2.19.18.'
 ]
 },
 { 
 version: '2.19.17', 
 date: '16/03/2026',
 title: 'Conformidade Legal no Afastamento',
 changes: [
 'Segurança: Implementada geração automática de Termo de Devolução Administrativa ao afastar colaborador.',
 'Conformidade: Termos gerados por afastamento são marcados como"Resolvido Manulmente"com justificativa legal.',
 'Auditoria: Adicionada observação"Funcionário em afastamento"nos logs e termos de devolução.',
 'Versão: Atualizado para v2.19.17.'
 ] 
 },
 { 
 version: '2.19.16', 
 date: '16/03/2026',
 title: 'Automação de Inventário e Correções',
 changes: [
 'Funcionalidade: Adicionada opção de liberação automática de equipamentos ao afastar colaborador.',
 'Correção: Corrigido formato de data no campo de retorno de afastamento.',
 'UX: Checkbox de liberação rápida integrado ao fluxo de alteração de status.',
 'Versão: Atualizado para v2.19.16.'
 ] 
 },
 { 
 version: '2.19.15', 
 date: '16/03/2026',
 title: 'Gestão de Afastamentos e Substituições',
 changes: [
 'Funcionalidade: Implementado status"Afastado"para colaboradores (INSS/Licença).',
 'Funcionalidade: Adicionado campo"Data de Retorno"para controle de afastamento.',
 'UX: Novos filtros na gestão de usuários (Ativos, Inativos, Afastados).',
 'Integração: Sincronização automática de status global ao ativar/inativar usuários.',
 'Versão: Atualizado para v2.19.15.'
 ] 
 },
 { 
 version: '2.19.14', 
 date: '16/03/2026',
 title: 'Validações, Auditoria e Notificações',
 changes: [
 'Segurança: Impedido cancelamento de tarefas já concluídas.',
 'Auditoria: Agora é obrigatório informar o motivo ao cancelar uma tarefa.',
 'UX: Adicionado sistema de notificações flutuantes (Toasts) para feedback de ações.',
 'Validação: Impedida conclusão direta de tarefas canceladas.',
 'Versão: Atualizado para v2.19.14.'
 ] 
 },
 { 
 version: '2.19.13', 
 date: '16/03/2026',
 title: 'Sincronização em Tempo Real do Modal',
 changes: [
 'Correção: Modal de detalhes agora reflete mudanças de status imediatamente sem recarregar a página.',
 'Melhoria: Refatorada gestão de estado do modal para derivar dados da fonte única da verdade.',
 'Versão: Atualizado para v2.19.13.'
 ] 
 },
 { 
 version: '2.19.12', 
 date: '16/03/2026',
 title: 'Correção Definitiva de Persistência de Tarefas',
 changes: [
 'Correção: Implementada atualização parcial (PATCH) real no backend para tarefas.',
 'Correção: Corrigido mapeamento de campos no histórico de ações (Timestamp -> timestamp).',
 'Correção: Resolvido erro de"Data inválida"e perda de dados ao adicionar comentários.',
 'Versão: Atualizado para v2.19.12.'
 ] 
 },
 { 
 version: '2.19.11', 
 date: 'Hoje',
 title: 'Correção Crítica de Persistência de Dados',
 changes: [
 'Correção: Corrigido erro de perda de dados ao adicionar comentários.',
 'Correção: Backend agora realiza atualizações parciais (patch) e ignora campos nulos.',
 'Versão: Atualizado para v2.19.11.'
 ] 
 },
 { 
 version: '2.19.10', 
 date: 'Hoje',
 title: 'Correção de Persistência de Dados e Histórico',
 changes: [
 'Correção: Corrigido erro de perda de dados ao adicionar comentários.',
 'Correção: Corrigido erro"Invalid Date"no histórico de ações.',
 'Versão: Atualizado para v2.19.10.'
 ] 
 },
 { 
 version: '2.19.09', 
 date: 'Hoje',
 title: 'Correção de Atualização de Tarefas',
 changes: [
 'Correção: Corrigido erro"Invalid Date"ao atualizar tarefas.',
 'Correção: Status da tarefa agora só é alterado via botão específico.',
 'Versão: Atualizado para v2.19.09.'
 ] 
 },
 { 
 version: '2.19.08', 
 date: 'Hoje',
 title: 'Correção de Erro na Tela de Tarefas',
 changes: [
 'Correção: Corrigido erro que impedia o carregamento da tela de tarefas ao enviar informações.',
 'Versão: Atualizado para v2.19.08.'
 ] 
 },
 { 
 version: packageJson.version, 
 date: 'Hoje',
 title: 'Módulo de Gestão de Tarefas (Agenda/To-Do)',
 changes: [
 'Módulo: Lançamento do novo módulo de Gestão de Tarefas para controle de rotinas do setor.',
 'Dashboard: Novo widget de tarefas pendentes com alertas de prazos (Atrasado/Próximo do Vencimento).',
 'Gestão: Tela completa de gerenciamento com filtros por status, tipo, responsável e data.',
 'Auditoria: Histórico imutável de ações (quem, o que e quando) para cada tarefa.',
 'Evidências: Suporte a comentários e anexos de arquivos na conclusão de tarefas.',
 'Versão: Atualizado para v2.19.00 (Major Update).'
 ] 
 },
 { 
 version: '2.18.33', 
 date: 'Hoje',
 title: 'Layout de Evidências Dinâmico',
 changes: [
 'Impressão: Novo layout dinâmico que prioriza o tamanho das fotos (1 grande + 2 menores).',
 'Versão: Atualizado para v2.18.33.',
 'Sincronização global para v2.18.33.'
 ] 
 },
 { 
 version: '2.18.32', 
 date: 'Hoje',
 title: 'Otimização de Impressão',
 changes: [
 'Impressão: Novo layout de evidências que permite até 3 fotos na mesma página.',
 'Versão: Atualizado para v2.18.32.',
 'Sincronização global para v2.18.32.'
 ] 
 },
 { 
 version: '2.18.31', 
 date: 'Hoje',
 title: 'Correção na Edição de Termos',
 changes: [
 'Termos: Corrigido erro 404 ao salvar edições de termos (URL malformada).',
 'Versão: Atualizado para v2.18.31.',
 'Sincronização global para v2.18.31.'
 ] 
 },
 { 
 version: '2.18.30', 
 date: 'Hoje',
 title: 'Gestão de Termos e Devoluções - Melhorias',
 changes: [
 'Edição de Termos: Campo"Dados do Dispositivo"agora é apenas leitura para evitar quebras de integridade.',
 'Devolução: Adicionado suporte para até 3 evidências (fotos/PDF) no ato da devolução.',
 'Sincronização global para v2.18.30.'
 ] 
 },
 { 
 version: '2.18.29', 
 date: 'Hoje',
 title: 'Edição de Termos de Responsabilidade - Melhorias',
 changes: [
 'Termos: Restrição de edição apenas para termos pendentes (sem arquivo digitalizado).',
 'Termos: Suporte para até 3 evidências (imagens/PDF) por termo editado.',
 'Versão: Atualizado para v2.18.29.',
 'Sincronização global para v2.18.29.'
 ] 
 },
 { 
 version: '2.18.27', 
 date: 'Hoje',
 title: 'Edição de Termos de Responsabilidade',
 changes: [
 'Termos: Adicionada a opção de editar os detalhes de um termo gerado (Condição, Avaria, Observações e Evidência) diretamente no perfil do colaborador.',
 'Versão: Atualizado para v2.18.27.',
 'Sincronização global para v2.18.27.'
 ] 
 },
 { 
 version: '2.18.26', 
 date: 'Hoje',
 title: 'Reimpressão de Termos com Evidência',
 changes: [
 'Termos: A funcionalidade de reimprimir termo no painel do colaborador agora inclui a imagem de evidência de dano, caso exista.',
 'Versão: Atualizado para v2.18.26.',
 'Sincronização global para v2.18.26.'
 ] 
 },
 { 
 version: '2.18.25', 
 date: 'Hoje',
 title: 'Correção na Visualização de Termos',
 changes: [
 'Usuários: Corrigido um erro que causava tela branca ao acessar a aba de Termos no perfil do colaborador.',
 'Versão: Atualizado para v2.18.25.',
 'Sincronização global para v2.18.25.'
 ] 
 },
 { 
 version: '2.18.24', 
 date: 'Ontem',
 title: 'Evidência de Danos no Termo de Devolução',
 changes: [
 'Termos: Adicionado campo para registrar a condição do equipamento no momento da devolução.',
 'Termos: Adicionado campo para descrever avarias (se houver).',
 'Termos: Adicionado upload de evidência (foto/B.O.) em caso de dano.',
 'Termos: O termo gerado agora inclui a condição, descrição do dano e a imagem da evidência.',
 'Usuários: A aba de Termos no perfil do usuário agora exibe a condição e a descrição do dano, além de um botão para visualizar a evidência.',
 'Versão: Atualizado para v2.18.24.',
 'Sincronização global para v2.18.24.'
 ] 
 },
 { 
 version: '2.18.23', 
 date: 'Hoje',
 title: 'Filtro de Múltiplos Setores',
 changes: [
 'Relatórios: O filtro de Cargos/Setores agora permite a seleção múltipla.',
 'Relatórios: Interface do filtro atualizada para um dropdown com checkboxes, padronizando com o filtro de Tipos de Dispositivo.',
 'Versão: Atualizado para v2.18.23.',
 'Sincronização global para v2.18.23.'
 ] 
 },
 { 
 version: '2.18.22', 
 date: 'Hoje',
 title: 'Filtro de Tipo de Dispositivo no Relatório',
 changes: [
 'Relatórios: Adicionado filtro por Tipo de Dispositivo no Relatório de Colaboradores.',
 'Relatórios: Por padrão, o relatório agora exibe apenas colaboradores com dispositivos do tipo"Smartphone"ou"Celular", ou com chips avulsos.',
 'Relatórios: A lista de contatos foi otimizada para focar em dispositivos móveis, com a flexibilidade de incluir outros tipos via filtro.',
 'Versão: Atualizado para v2.18.22.',
 'Sincronização global para v2.18.22.'
 ] 
 },
 { 
 version: '2.18.21', 
 date: 'Hoje',
 title: 'Relatório de Colaboradores Personalizável',
 changes: [
 'Relatórios: Adicionado seletor de colunas para personalizar a visualização e exportação do relatório.',
 'Relatórios: Agora é possível escolher exibir ou ocultar: Cargo/Setor, Cód. Setor, E-mail, Linha(s) e ID Pulsus.',
 'Relatórios: A exportação para Excel respeita exatamente as colunas selecionadas em tela.',
 'Versão: Atualizado para v2.18.21.',
 'Sincronização global para v2.18.21.'
 ] 
 },
 { 
 version: '2.18.20', 
 date: 'Hoje',
 title: 'Relatório de Colaboradores e Pulsus ID',
 changes: [
 'Relatórios: O antigo relatório"Lista de Contatos"foi aprimorado e renomeado para"Relatório de Colaboradores".',
 'Relatórios: Adicionada a opção de exibir a coluna"ID Pulsus", que busca o ID do dispositivo vinculado ao colaborador.',
 'Relatórios: O filtro"Apenas com linha"agora vem desmarcado por padrão para facilitar a visualização de todos os colaboradores.',
 'Versão: Atualizado para v2.18.20.',
 'Sincronização global para v2.18.20.'
 ] 
 },
 { 
 version: '2.18.19', 
 date: 'Hoje',
 title: 'Substituição de Termos Manuais',
 changes: [
 'Termos: Agora é possível anexar um arquivo digitalizado mesmo em termos que foram"Resolvidos Manualmente".',
 'Termos: Ao fazer o upload, a marcação de"Resolvido Manualmente"é removida e o termo passa a constar como digitalizado.',
 'Versão: Atualizado para v2.18.19.',
 'Sincronização global para v2.18.19.'
 ] 
 },
 { 
 version: '2.18.18', 
 date: 'Hoje',
 title: 'Dashboard: Código do Setor em Termos Pendentes',
 changes: [
 'Dashboard: Adicionado o código do setor do dispositivo na lista de termos pendentes.',
 'Dashboard: Agora exibe"Setor: [Nome] Código: [Código]"para facilitar a identificação.',
 'Versão: Atualizado para v2.18.18.',
 'Sincronização global para v2.18.18.'
 ] 
 },
 { 
 version: '2.18.17', 
 date: 'Hoje',
 title: 'Correção na Impressão de Termos',
 changes: [
 'Termos: Corrigido o campo"Setor"no cabeçalho dos termos de entrega/devolução.',
 'Termos: Agora o sistema prioriza o código do setor vinculado ao DISPOSITIVO, evitando campos em branco para novos colaboradores ou dados incorretos.',
 'Versão: Atualizado para v2.18.17.',
 'Sincronização global para v2.18.17.'
 ] 
 },
 { 
 version: '2.18.16', 
 date: 'Hoje',
 title: 'Busca Inteligente & Normalização',
 changes: [
 'Busca: Implementada busca case-insensitive e ignorando acentos em todo o sistema (Colaboradores, Dispositivos, Chips, Contas, Modelos, Relatórios, Logs).',
 'UX: Melhoria na experiência de busca, permitindo encontrar"André"buscando por"andre"ou"Caçapava"por"cacapava".',
 'Versão: Atualizado para v2.18.16.',
 'Sincronização global para v2.18.16.'
 ] 
 },
 { 
 version: '2.18.15', 
 date: 'Ontem',
 title: 'Resolução Manual de Pendências',
 changes: [
 'Adicionada opção para resolver pendências de termos sem anexo diretamente no dashboard.',
 'Registro de justificativa obrigatória para resoluções manuais.',
 'Auditoria detalhada no colaborador, dispositivo e sistema para resoluções manuais.',
 'Restaurada exibição detalhada de dispositivos nos termos pendentes (modelo, patrimônio, serial, IMEI e data do termo).',
 'Atualizados ícones dos botões de ação nos termos pendentes para maior clareza.'
 ] 
 },
 { 
 version: '2.12.52', 
 date: 'Hoje',
 title: 'Resolução Manual de Pendências', 
 changes: [
 'Adicionada opção para resolver pendências de termos sem anexo diretamente no dashboard.',
 'Registro de justificativa obrigatória para resoluções manuais.',
 'Auditoria detalhada no colaborador, dispositivo e sistema para resoluções manuais.'
 ] 
 },
 {
 version: '2.12.51',
 date: 'Hoje',
 title: 'LCC Dashboard Redesign & Global Financials',
 changes: [
 'Dashboard: Redesign completo da seção de LCC para maior clareza e impacto visual.',
 'Dashboard: Agrupamento de métricas financeiras globais (Aquisição vs Manutenção).',
 'Dashboard: Tabela de alertas de saúde integrada com indicadores de obsolescência.',
 'Versão: Atualizado para v2.12.51.',
 'Sincronização global para v2.12.51.'
 ]
 },
 {
 version: '2.12.49',
 date: 'Hoje',
 title: 'Advanced LCC Dashboard & Financial Insights',
 changes: [
 'Dashboard: Nova seção"Saúde Financeira & LCC"com métricas globais de investimento.',
 'Dashboard: Visualização de alertas críticos de manutenção (>60%) e obsolescência (>4 anos).',
 'Dashboard: Gráfico de distribuição de custos (Aquisição vs Manutenção).',
 'Versão: Atualizado para v2.12.49.',
 'Sincronização global para v2.12.49.'
 ]
 },
 {
 version: '2.12.48',
 date: 'Hoje',
 title: 'LCC Breakdown & UI Refinement',
 changes: [
 'Financeiro: Detalhamento do LCC com separação de custos de aquisição e manutenção.',
 'UI: Melhoria visual no card de Custo do Ciclo de Vida para maior clareza.',
 'Versão: Atualizado para v2.12.48.',
 'Sincronização global para v2.12.48.'
 ]
 },
 {
 version: '2.12.47',
 date: 'Hoje',
 title: 'LCC (Life Cycle Cost) & Asset Health',
 changes: [
 'Financeiro: Implementado cálculo de LCC (Custo do Ciclo de Vida) na aba financeira dos dispositivos.',
 'Alertas: Adicionados alertas visuais para dispositivos com gastos de manutenção > 60% do valor de compra.',
 'Alertas: Adicionados alertas para dispositivos com mais de 4 anos de uso.',
 'Dashboard: Nova seção de"Saúde dos Ativos"com indicadores de LCC e obsolescência.',
 'Versão: Atualizado para v2.12.47.',
 'Sincronização global para v2.12.47.'
 ]
 },
 {
 version: '2.12.46',
 date: 'Hoje',
 title: 'Enhanced Device Search',
 changes: [
 'Busca: Agora é possível pesquisar dispositivos pelo nome do colaborador responsável.',
 'Busca: Adicionada pesquisa pelo número do chip (linha) vinculado ao dispositivo.',
 'Versão: Atualizado para v2.12.46.',
 'Sincronização global para v2.12.46.'
 ]
 },
 {
 version: '2.12.45',
 date: 'Hoje',
 title: 'Infrastructure Renaming & Port Updates',
 changes: [
 'Docker: Renomeados containers para it-asset-new-api e it-asset-new-app.',
 'Portas: Alterada porta da API para 5002 e do App para 8084 no docker-compose.',
 'Versão: Atualizado para v2.12.45.',
 'Sincronização global para v2.12.45.'
 ]
 },
 {
 version: '2.12.44',
 date: 'Hoje',
 title: 'Vite Build & Docker Optimization',
 changes: [
 'Build: Removido tsc do processo de build para garantir sucesso na compilação do Docker.',
 'Docker: Simplificado Dockerfile removendo lógica legada do CRA e adaptando para Vite.',
 'Configuração: Definido outDir para"build"no vite.config.ts para manter compatibilidade com Nginx.',
 'Versão: Atualizado para v2.12.44.',
 'Sincronização global para v2.12.44.'
 ]
 },
 {
 version: '2.12.43',
 date: 'Hoje',
 title: 'Deployment Optimization & Dependency Cleanup',
 changes: [
 'Infraestrutura: Removido react-scripts e dependências legadas para resolver erro de build no Portainer.',
 'Dependências: Organizado devDependencies e atualizado TypeScript/Vite para versões estáveis.',
 'Versão: Atualizado para v2.12.43.',
 'Sincronização global para v2.12.43.'
 ]
 },
 {
 version: '2.12.42',
 date: 'Hoje',
 title: 'Vite Environment & Sync Stability',
 changes: [
 'Ambiente: Configurado proxy do Vite para evitar conflitos de rotas API/SPA.',
 'Estabilidade: Corrigido erro de"Unexpected token <"na detecção de ambiente.',
 'Versão: Atualizado para v2.12.42 em todos os componentes.',
 'Sincronização global para v2.12.42.'
 ]
 },
 {
 version: '2.12.41',
 date: 'Hoje',
 title: 'Admin Panel Restoration & Visual Consistency',
 changes: [
 'Administração: Restauradas as abas"Acesso","Geral"e"Editor de Termos"com CRUD funcional.',
 'Acesso: Implementado gerenciamento de operadores e administradores do sistema.',
 'Geral: Adicionado formulário para edição de nome do app, logo e CNPJ.',
 'Editor de Termos: Novo editor dinâmico para personalização de cláusulas e declarações (Entrega/Devolução).',
 'Importação: Adicionado suporte completo ao Dark Mode (Modo Escuro).',
 'Sincronização global para v2.12.41.'
 ]
 },
 {
 version: '2.12.40',
 date: 'Ontem',
 title: 'TypeScript Stability & Missing Properties',
 changes: [
 'Correção de Tipos: Adicionadas as propriedades hasFile e hasInvoice às interfaces globais no types.ts.',
 'Estabilidade: Resolvidos erros de compilação nos módulos Dashboard, DeviceManager e UserManager.',
 'Sincronização global para v2.12.40.'
 ]
 },
 {
 version: '2.12.39',
 date: '02/2025',
 title: 'Visual Standardization & Column Fixes',
 changes: [
 'Colaboradores: Adicionados contadores de itens ao lado dos títulos das abas no modal de detalhes.',
 'Correção de Lista: Ativadas as colunas dinâmicas"Número de Chip"e"Detalhes do Aparelho"na listagem de colaboradores.',
 'Lógica de Chips: A coluna de chip vinculado agora exibe chips diretos E chips vinculados via dispositivo em posse.',
 'Dispositivos: Indicador visual (bolinha verde/amarela) na aba Financeiro para monitoramento rápido de Nota Fiscal e Anexo.',
 'Sincronização global para v2.12.39.'
 ]
 }
];

const SystemInfoModal: React.FC<SystemInfoModalProps> = ({ onClose }) => {
 return (
 <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
 <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors duration-300">
 <div className="bg-white dark:bg-slate-800 px-8 py-6 flex justify-between items-start shrink-0 relative border-b border-slate-200 dark:border-slate-700">
 <div className="relative z-10"><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Sobre o Sistema</h2><p className="text-sm">IT Asset 360 - Gestão Inteligente de Ativos</p></div>
 <button onClick={onClose} className="hover:text-slate-900 dark:text-white transition-colors relative z-10"><X size={24} /></button>
 <div className="absolute -right-10 -top-10 opacity-50"><GitCommit size={150} /></div>
 </div>
 <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-800">
 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2"><GitCommit className=""size={20}/> Histórico de Versões</h3>
 <div className="relative border-l-2 border-slate-300 dark:border-slate-600 ml-3 space-y-8 pb-4">
 {versions.map((ver, index) => (
 <div key={index} className="relative pl-8">
 <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white border-slate-900 ${index === 0 ? ' ring-4 ring-blue-100 ring-blue-900/20' : 'bg-slate-300 bg-slate-600'}`}></div>
 <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
 <span className={`px-2 py-0.5 rounded text-xs font-bold border ${index === 0 ? ' text-slate-900 dark:text-white border-blue-600' : ' bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>v{ver.version}</span>
 <span className="text-xs flex items-center gap-1"><Calendar size={12}/> {ver.date}</span>
 </div>
 <h4 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-2">{ver.title}</h4>
 <ul className="space-y-1">{ver.changes.map((change, i) => (<li key={i} className="text-sm flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 bg-slate-600 shrink-0"></span>{change}</li>))}</ul>
 </div>
 ))}
 </div>
 </div>
 <div className="bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-600 px-8 py-4 text-center"><p className="text-xs">© 2025 IT Asset 360. Todos os direitos reservados.</p></div>
 </div>
 </div>
 );
};

export default SystemInfoModal;
