
export interface Usuario {
    ID_Usuario: number;
    Nome: string;
    Usuario: string;
    Senha?: string;
    Perfil: 'Admin' | 'Operador';
    Ativo: boolean;
}

export interface AuthResponse {
    token: string;
    user: Usuario;
}

export type TipoVeiculoReembolso = 'Carro' | 'Moto' | 'Sem Veículo / VT';

export interface Grupo {
    ID_Grupo: number;
    Nome: string;
}

export interface Colaborador {
    ID_Colaborador: number;
    ID_Pulsus: number;
    CodigoSetor: number;
    Nome: string;
    Grupo: string;
    TipoVeiculo: TipoVeiculoReembolso;
    Ativo: boolean;
    UsuarioAlteracao?: string;
    MotivoAlteracao?: string;
    LatitudeBase?: number;
    LongitudeBase?: number;
    EnderecoBase?: string;
    EnderecoPendente?: boolean; // NOVO: v1.9.4
}

export interface NovoColaborador {
    id_pulsus: number;
    nome: string;
    matchType: 'NEW' | 'SECTOR_CONFLICT' | 'INVALID_GROUP' | 'PHONE_CHANGE';
    newData: {
        codigo_setor: number;
        grupo: string;
    };
    existingColab?: Colaborador;
}

export interface ColaboradorAlterado {
    id_pulsus: number;
    nome: string;
    matchType: 'ID_MATCH' | 'PHONE_CHANGE';
    existingColab: Colaborador;
    id_colaborador?: number; // Identidade fixa no banco
    needsPulsusTransfer?: boolean;
    isDeviceTransfer?: boolean;
    newData: {
        nome: string;
        codigo_setor: number;
        grupo: string;
    };
    changes: { field: string, oldValue: any, newValue: any }[];
}

export interface DiffItem {
    syncAction: 'INSERT' | 'UPDATE_DATA' | 'UPDATE_ID' | 'DEACTIVATE';
    id_pulsus: number;
    nome?: string;
    id_colaborador?: number;
    newData?: {
        nome?: string;
        codigo_setor: number;
        grupo: string;
    };
    existingColab?: Colaborador;
}

export interface SyncResponse {
    success: boolean;
    count: number;
    errors: { id: number; error: string }[];
}

export interface ImportPreviewResult {
    novos: NovoColaborador[];
    alterados: ColaboradorAlterado[];
    conflitos: ColaboradorAlterado[];
    invalidos: NovoColaborador[];
    iguais: { id_pulsus: number, nome: string }[];
    iguaisCount: number;
    totalExternal: number;
    inativar: { id_pulsus: number, nome: string, id_colaborador: number, codigo_setor: number, grupo: string }[];
}

export interface SalvarCalculoPayload {
    Periodo: string;
    TotalGeral: number;
    OrigemDados: 'CSV' | 'ROTEIRIZADOR' | 'CICLO';
    ID_RotaHist?: number | null;
    Overwrite?: boolean;
    MotivoOverwrite?: string;
    Itens: {
        ID_Pulsus: number;
        Nome: string;
        Grupo: string;
        TipoVeiculo: string;
        TotalKM: number;
        ValorReembolso: number;
        Ajuste?: number;
        ParametroPreco: number;
        ParametroKmL: number;
        Efetividade?: number;
        RegistrosDiarios: {
            Data: string;
            KM: number;
            Valor: number;
            Observacao?: string;
        }[];
    }[];
}

export interface ItemRelatorio {
    ID_Detalhe: number;
    DataGeracao: string;
    PeriodoReferencia: string;
    UsuarioGerador: string;
    ID_Pulsus: number;
    CodigoSetor?: number;
    NomeColaborador: string;
    Grupo: string;
    TipoVeiculo: string;
    TotalKM: number;
    ValorReembolso: number;
    Ajuste?: number;
    ParametroPreco: number;
    ParametroKmL: number;
    OrigemDados?: 'CSV' | 'ROTEIRIZADOR' | 'CICLO';
    MotivoEdicao?: string;
}

export interface ItemRelatorioAnalitico {
    ID_Diario: number;
    DataOcorrencia: string;
    KM_Dia: number;
    Valor_Dia: number;
    Observacao?: string;
    ID_Pulsus: number;
    CodigoSetor?: number;
    NomeColaborador: string;
    Grupo: string;
    TipoVeiculo: string;
    DataGeracao: string;
    PeriodoReferencia: string;
    TemAusencia?: boolean;
    MotivoAusencia?: string;
    OrigemDados?: 'CSV' | 'ROTEIRIZADOR' | 'CICLO';
    MotivoEdicao?: string;
}

export interface VisitaPrevista {
    Cod_Vend: number;
    Nome_Vendedor: string;
    Cod_Supervisor: number;
    Nome_Supervisor: string;
    Cod_Cliente: number;
    Razao_Social: string;
    Dia_Semana: string;
    Periodicidade: string;
    Data_da_Visita: string; 
    Endereco: string;
    Bairro: string;
    Cidade: string;
    CEP: string;
    Lat: number;
    Long: number;
}

export interface RotaCalculada {
    Vendedor: string;
    Data: string;
    Visitas: VisitaPrevista[];
    DistanciaReta: number;
    DistanciaEstimada: number;
}

export interface CalculoReembolso {
    Colaborador: Colaborador;
    TotalKM: number;
    LitrosEstimados: number;
    ValorPagar: number;
    Ajuste: number;
    Efetividade: number;
    Registros: RegistroKM[];
}

export interface RegistroKM {
    ID_Pulsus: number;
    Nome: string;
    Grupo: string;
    Data: string;
    KM: number;
    ValorCalculado: number;
    Observacao: string;
    isCiclo?: boolean; // NOVO: v1.14.6
}

export interface StagingRecord {
    id: string;
    id_pulsus: number;
    nome: string;
    dataOriginal: string;
    dataISO: string;
    kmOriginal: number;
    kmConsiderado: number;
    efetividade: number;
    isLowKm: boolean;
    isBlocked: boolean;
    blockReason: string;
    isEdited: boolean;
    isCiclo?: boolean; // NOVO: v1.14.6
    editReason?: string;
    colaboradorRef?: Colaborador;
    supervisor?: string;
}

export interface ConfigReembolso {
    PrecoCombustivel: number;
    KmL_Carro: number;
    KmL_Moto: number;
    MotivoAlteracao?: string;
}

export interface SystemConfig {
    companyName: string;
    logoUrl: string;
    alertMaxDailyKM?: number;
    alertMaxClientDist?: number;
    headquartersAddress?: string;
    headquartersLat?: number;
    headquartersLong?: number;
    cnpj?: string;
    razaoSocial?: string;
}

export interface Ausencia {
    ID_Ausencia: number;
    ID_Colaborador: number;
    NomeColaborador: string;
    ID_Pulsus: number;
    DataInicio: string;
    DataFim: string;
    Motivo: string;
}

export interface LogSistema {
    ID_Log: number;
    DataHora: string;
    Usuario: string;
    Acao: string;
    Detalhes: string;
}

export interface LicenseStatus {
    status: 'ACTIVE' | 'EXPIRED' | 'INVALID';
    client?: string;
    expiresAt?: string;
}

export interface DbConnectionConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
    database: string;
    query: string;
    type?: string;
}

export interface IntegrationConfig {
    colab: DbConnectionConfig;
    route: DbConnectionConfig;
    promoter: DbConnectionConfig;
}

export interface RotaPrevistaSaved {
    ID_RotaHist: number;
    Periodo: string;
    DataSimulacao: string;
    TotalKM: number;
    UsuarioSimulacao: string;
    JaCalculado?: boolean;
}

export interface RotaPrevistaItem {
    ID_Pulsus: number;
    Nome: string;
    DataVisita: string;
    KM: number;
}

export interface CalculoSaved {
    ID_Historico: number;
    Periodo: string;
    DataFechamento: string;
    TotalGeral: number;
    UsuarioFechamento: string;
    OrigemDados: string;
    MotivoEdicao?: string;
}

export interface CalculoItem {
    ID_Pulsus: number;
    Nome: string;
    ID_Diario: number;
    DataOcorrencia: string;
    KM_Dia: number;
    Valor_Dia: number;
}
