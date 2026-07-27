
# ⛽ Fuel360 - Gestão Corporativa de Reembolso
> **Auditoria, precisão e controle financeiro de quilometragem.**

![Version](https://img.shields.io/badge/version-1.9.2-blue.svg?style=for-the-badge)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Node.js%20%7C%20SQL%20Server-slate.svg?style=for-the-badge)
![Status](https://img.shields.io/badge/status-Production-emerald.svg?style=for-the-badge)

---

## 🚀 Sobre o Projeto

**Fuel360** é um sistema especializado na gestão, cálculo e auditoria de reembolso de quilometragem para equipes externas. 

Diferente de planilhas manuais, o sistema processa arquivos de telemetria/rastreamento (CSV Pulsus), cruza com parâmetros financeiros configuráveis e valida automaticamente regras de absenteísmo (férias, atestados), garantindo que a empresa pague apenas o que foi realmente rodado em dias úteis.

### 🎯 Pilares da Solução
1.  **Conformidade:** Auditoria de todas as alterações cadastrais e financeiras.
2.  **Automação:** Cálculo massivo de centenas de colaboradores em segundos.
3.  **Transparência:** Relatórios detalhados (Sintético e Analítico Dia-a-Dia).

---

## ✨ Funcionalidades Principais

### 💰 Cálculo Automático (Importação)
*   Importação de arquivos CSV (Padrão Pulsus).
*   Detecção automática do período de referência.
*   Cálculo baseado em parâmetros dinâmicos (R$/Litro, KM/L Carro vs Moto).
*   **Smart Blocking:** Detecção automática de registros conflitantes com Férias/Ausências.

### 👥 Gestão de Equipe
*   Cadastro completo de colaboradores (Setores, Grupos, Veículos).
*   Separação por perfil de veículo (Carro/Moto) para cálculo de eficiência diferenciado.
*   Histórico de auditoria em alterações de cadastro.

### 📅 Gestão de Ausências
*   Controle de Férias, Atestados e Faltas.
*   Impacto direto no cálculo financeiro (zera o reembolso dos dias marcados).
*   Auditoria de inclusão e exclusão de afastamentos.

### 📊 Relatórios Inteligentes
*   **Visão Sintética:** Resumo financeiro por colaborador no período.
*   **Visão Analítica:** Detalhamento dia a dia ("Drill-down") com tags de observação para dias não pagos (ex: "Férias").
*   Histórico imutável de cálculos fechados.

### ⚙️ Parametrização & Segurança
*   Configuração auditada de preço de combustível e média de consumo.
*   Controle de Licença de Software.
*   Logs de sistema para rastreabilidade de ações críticas (Sobrescrita de cálculo, exclusões).

---

## 🛠️ Tech Stack

O projeto utiliza uma arquitetura moderna e escalável, focada em performance e manutenibilidade.

### Frontend
*   **Core:** React 18 + TypeScript.
*   **UI/UX:** Tailwind CSS (Corporate Blue/Slate Theme).
*   **State:** Context API.
*   **Build:** ESBuild + Vite (Implicit).

### Backend (API)
*   **Runtime:** Node.js + Express.
*   **Database:** SQL Server (Driver Nativo `tedious`).
*   **Auth:** JWT (JSON Web Tokens) com rotação.
*   **Security:** Hashing de senhas (Bcrypt), Sanitização de Inputs.

---

## 📂 Estrutura do Projeto

```text
fuel360/
├── api/                 # Backend Node.js
│   ├── index.js         # API Gateway e Regras de Negócio
│   └── mockData.ts      # Camada de Simulação (LocalStorage)
├── components/          # Interface do Usuário (UI)
│   ├── Importacao.tsx   # Motor de Cálculo
│   ├── Relatorios.tsx   # BI e Visualização
│   ├── GestaoAusencias  # Controle de Afastamentos
│   └── ...
├── context/             # Estado Global (Auth e Dados)
├── services/            # Camada de Comunicação HTTP
└── types.ts             # Tipagem Estática (TypeScript)
```

---

## 🚀 Como Rodar

### Pré-requisitos
*   Node.js 18+
*   SQL Server (Para modo Produção) ou Navegador Moderno (Para modo Mock)

### Instalação

1.  **Clone o repositório**
    ```bash
    git clone https://github.com/seu-repo/fuel360.git
    cd fuel360
    ```

2.  **Instale as dependências**
    ```bash
    npm install
    cd api && npm install && cd ..
    ```

3.  **Rodar (Modo Desenvolvimento)**
    ```bash
    npm run dev
    ```

### Modos de Operação
O sistema possui um switch dinâmico entre **API Real** e **Mock (Simulação)** acessível via Menu Admin.
*   **Mock:** Roda 100% no navegador usando LocalStorage (Ideal para testes).
*   **Produção:** Conecta ao SQL Server via API Node.js.

---

## 🔒 Licença

Este software é proprietário e protegido por leis de direitos autorais.
**Fuel360 Enterprise © 2025** - Todos os direitos reservados.
