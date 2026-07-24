
import { VisitaPrevista } from '../types';

// --- ROTEIRIZADOR (MOCK) ---
export const getMockVisitasPrevistas = (): VisitaPrevista[] => {
    // Gera algumas visitas fakes em SP para o dia atual
    const baseLat = -23.55052;
    const baseLng = -46.633308;
    const today = new Date().toISOString(); // Garante que apareça no filtro de data 'Hoje'
    
    return [
        {
            Cod_Vend: 101, // ID do Alexandre Silva (Setor 101)
            Nome_Vendedor: "ALEXANDRE SILVA", 
            Cod_Supervisor: 3, 
            Nome_Supervisor: "Supervisor Mock",
            Cod_Cliente: 1001, 
            Razao_Social: "Mercado Central", 
            Dia_Semana: "Segunda", 
            Periodicidade: "Semanal",
            Data_da_Visita: today, 
            Endereco: "Av Paulista 1000", 
            Bairro: "Bela Vista", 
            Cidade: "São Paulo", 
            CEP: "01310-100",
            Lat: baseLat, 
            Long: baseLng
        },
        {
            Cod_Vend: 101, 
            Nome_Vendedor: "ALEXANDRE SILVA", 
            Cod_Supervisor: 3, 
            Nome_Supervisor: "Supervisor Mock",
            Cod_Cliente: 1002, 
            Razao_Social: "Padaria do Zé", 
            Dia_Semana: "Segunda", 
            Periodicidade: "Semanal",
            Data_da_Visita: today, 
            Endereco: "Rua Augusta 500", 
            Bairro: "Consolação", 
            Cidade: "São Paulo", 
            CEP: "01305-000",
            Lat: baseLat + 0.01, 
            Long: baseLng + 0.01
        },
        {
            Cod_Vend: 101, 
            Nome_Vendedor: "ALEXANDRE SILVA", 
            Cod_Supervisor: 3, 
            Nome_Supervisor: "Supervisor Mock",
            Cod_Cliente: 1003, 
            Razao_Social: "Supermercado Extra", 
            Dia_Semana: "Segunda", 
            Periodicidade: "Semanal",
            Data_da_Visita: today, 
            Endereco: "Rua da Consolação 2000", 
            Bairro: "Consolação", 
            Cidade: "São Paulo", 
            CEP: "01301-000",
            Lat: baseLat - 0.01, 
            Long: baseLng - 0.005
        }
    ];
};
