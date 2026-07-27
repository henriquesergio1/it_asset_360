
import { VisitaPrevista } from '../types';

// --- ROTEIRIZADOR (MOCK) ---
export const getMockVisitasPrevistas = (startDateStr?: string, endDateStr?: string): VisitaPrevista[] => {
    const baseLat = -23.55052;
    const baseLng = -46.633308;

    const start = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date();
    const end = endDateStr ? new Date(endDateStr + 'T23:59:59') : new Date();

    const dates: string[] = [];
    const current = new Date(start);
    
    let count = 0;
    while (current <= end && count < 31) {
        if (current.getDay() !== 0) {
            dates.push(current.toISOString().split('T')[0]);
        }
        current.setDate(current.getDate() + 1);
        count++;
    }

    if (dates.length === 0) {
        dates.push(new Date().toISOString().split('T')[0]);
    }

    const sellers = [
        { id: 101, name: 'ALEXANDRE SILVA', supId: 3, supName: 'SUPERVISOR SP', lat: baseLat, lng: baseLng },
        { id: 102, name: 'CARLOS SANTOS', supId: 3, supName: 'SUPERVISOR SP', lat: -23.5615, lng: -46.6558 },
        { id: 103, name: 'BRUNO COSTA', supId: 4, supName: 'SUPERVISOR INTERIOR', lat: -22.9056, lng: -47.0608 }
    ];

    const dayNames = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
    const visits: VisitaPrevista[] = [];

    sellers.forEach(s => {
        dates.forEach(dt => {
            const dateObj = new Date(dt + 'T00:00:00');
            const dayName = dayNames[dateObj.getDay()];

            visits.push(
                {
                    Cod_Vend: s.id,
                    Nome_Vendedor: s.name,
                    Cod_Supervisor: s.supId,
                    Nome_Supervisor: s.supName,
                    Cod_Cliente: 1001 + s.id,
                    Razao_Social: `Mercado Central - ${s.name.split(' ')[0]}`,
                    Dia_Semana: dayName,
                    Periodicidade: 'Semanal',
                    Data_da_Visita: dt,
                    Endereco: 'Av Paulista 1000',
                    Bairro: 'Bela Vista',
                    Cidade: 'São Paulo',
                    CEP: '01310-100',
                    Lat: s.lat + 0.005,
                    Long: s.lng + 0.005
                },
                {
                    Cod_Vend: s.id,
                    Nome_Vendedor: s.name,
                    Cod_Supervisor: s.supId,
                    Nome_Supervisor: s.supName,
                    Cod_Cliente: 2002 + s.id,
                    Razao_Social: `Padaria e Confeitaria - ${s.name.split(' ')[0]}`,
                    Dia_Semana: dayName,
                    Periodicidade: 'Semanal',
                    Data_da_Visita: dt,
                    Endereco: 'Rua Augusta 500',
                    Bairro: 'Consolação',
                    Cidade: 'São Paulo',
                    CEP: '01305-000',
                    Lat: s.lat + 0.012,
                    Long: s.lng + 0.015
                },
                {
                    Cod_Vend: s.id,
                    Nome_Vendedor: s.name,
                    Cod_Supervisor: s.supId,
                    Nome_Supervisor: s.supName,
                    Cod_Cliente: 3003 + s.id,
                    Razao_Social: `Supermercado Extra - ${s.name.split(' ')[0]}`,
                    Dia_Semana: dayName,
                    Periodicidade: 'Semanal',
                    Data_da_Visita: dt,
                    Endereco: 'Rua da Consolação 2000',
                    Bairro: 'Consolação',
                    Cidade: 'São Paulo',
                    CEP: '01301-000',
                    Lat: s.lat - 0.008,
                    Long: s.lng - 0.007
                }
            );
        });
    });

    return visits;
};
