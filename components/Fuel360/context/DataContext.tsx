import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { Colaborador, ConfigReembolso, SystemConfig, Ausencia, Grupo } from '../types';
import * as api from '../services/apiService';
import { AuthContext } from './AuthContext';

export interface DataContextType {
    colaboradores: Colaborador[];
    grupos: Grupo[];
    configReembolso: ConfigReembolso;
    systemConfig: SystemConfig;
    ausencias: Ausencia[];
    loading: boolean;
    
    addColaborador: (colaborador: Colaborador) => Promise<void>;
    updateColaborador: (colaborador: Colaborador) => Promise<void>;
    deleteColaborador: (id: number) => Promise<void>;
    moveColaboradores: (ids: number[], newGroup: string) => Promise<void>;
    bulkUpdateColaboradores: (ids: number[], field: 'TipoVeiculo' | 'Ativo', value: any, reason: string) => Promise<void>;
    
    addGroup: (nome: string) => Promise<void>;
    deleteGroup: (id: number) => Promise<void>;

    saveConfigReembolso: (config: ConfigReembolso) => Promise<void>;
    updateSystemConfig: (config: SystemConfig) => Promise<void>;
    
    addAusencia: (ausencia: any) => Promise<void>;
    deleteAusencia: (id: number, motivo: string) => Promise<void>;

    logSystemAction: (acao: string, detalhes: string) => Promise<void>;
    refreshData: () => Promise<void>;
}

export const DataContext = createContext<DataContextType>({} as DataContextType);

const INITIAL_CONFIG: ConfigReembolso = { PrecoCombustivel: 5.89, KmL_Carro: 10, KmL_Moto: 35 };

export const DataProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const { isAuthenticated } = useContext(AuthContext);
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [configReembolso, setConfigReembolso] = useState<ConfigReembolso>(INITIAL_CONFIG);
    const [systemConfig, setSystemConfig] = useState<SystemConfig>({ companyName: 'Fuel360', logoUrl: '' });
    const [ausencias, setAusencias] = useState<Ausencia[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. Carrega configuração PÚBLICA (Logo e Nome)
    useEffect(() => {
        api.getSystemConfig()
            .then(conf => setSystemConfig(conf))
            .catch(e => console.warn("Modo offline ou sem conexão inicial."));
    }, []);

    // 2. Carrega dados PROTEGIDOS apenas após login
    useEffect(() => {
        if (isAuthenticated) {
            loadApiData();
        } else {
            setLoading(false);
            setColaboradores([]);
            setGrupos([]);
            setAusencias([]);
        }
    }, [isAuthenticated]);

    const loadApiData = async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const [colab, grps, fuelConf, abs] = await Promise.allSettled([
                api.getColaboradores(),
                api.getGrupos(),
                api.getFuelConfig(),
                api.getAusencias()
            ]);
            
            if (colab.status === 'fulfilled') setColaboradores(colab.value);
            if (grps.status === 'fulfilled') setGrupos(grps.value);
            if (fuelConf.status === 'fulfilled') setConfigReembolso(fuelConf.value);
            if (abs.status === 'fulfilled') setAusencias(abs.value);

        } catch (e) {
            console.error("Erro ao carregar dados protegidos:", e);
        } finally {
            setLoading(false);
        }
    };

    const addColaborador = async (c: Colaborador) => {
        const created = await api.createColaborador(c);
        setColaboradores(prev => [...prev, created]);
    };

    const updateColaborador = async (c: Colaborador) => {
        const updated = await api.updateColaborador(c.ID_Colaborador, c);
        setColaboradores(prev => prev.map(item => item.ID_Colaborador === c.ID_Colaborador ? updated : item));
    };

    const deleteColaborador = async (id: number) => {
        await api.deleteColaborador(id);
        setColaboradores(prev => prev.filter(c => c.ID_Colaborador !== id));
    };

    const moveColaboradores = async (ids: number[], newGroup: string) => {
        await api.moveColaboradoresToGroup(ids, newGroup);
        await loadApiData(); 
    };

    const bulkUpdateColaboradores = async (ids: number[], field: 'TipoVeiculo' | 'Ativo', value: any, reason: string) => {
        await api.bulkUpdateColaboradores(ids, field, value, reason);
        await loadApiData();
    };

    const addGroup = async (nome: string) => {
        const created = await api.createGrupo(nome);
        setGrupos(prev => [...prev, created]);
    };

    const deleteGroup = async (id: number) => {
        await api.deleteGrupo(id);
        setGrupos(prev => prev.filter(g => g.ID_Grupo !== id));
    };

    const saveConfigReembolso = async (config: ConfigReembolso) => {
        await api.updateFuelConfig(config);
        setConfigReembolso(config);
    };

    const updateSystemConfigHandler = async (config: SystemConfig) => {
        await api.updateSystemConfig(config);
        setSystemConfig(config);
    };

    const addAusencia = async (ausencia: any) => {
        const created = await api.createAusencia(ausencia);
        setAusencias(prev => [created, ...prev]);
    };

    const deleteAusencia = async (id: number, motivo: string) => {
        await api.deleteAusencia(id, motivo);
        setAusencias(prev => prev.filter(a => a.ID_Ausencia !== id));
    };

    const logSystemAction = async (acao: string, detalhes: string) => {
        try {
            await api.logAction(acao, detalhes);
        } catch(e) { console.error("Falha ao logar ação", e); }
    }

    return (
        <DataContext.Provider value={{
            colaboradores,
            grupos,
            configReembolso,
            systemConfig,
            ausencias,
            loading,
            addColaborador,
            updateColaborador,
            deleteColaborador,
            moveColaboradores,
            bulkUpdateColaboradores,
            addGroup,
            deleteGroup,
            saveConfigReembolso,
            updateSystemConfig: updateSystemConfigHandler,
            addAusencia,
            deleteAusencia,
            logSystemAction,
            refreshData: loadApiData
        }}>
            {children}
        </DataContext.Provider>
    );
};