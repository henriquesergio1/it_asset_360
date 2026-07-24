
import React, { useContext, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DataContext } from './context/DataContext';
import { CalculoReembolso } from './types';

interface ReportPrintProps {
    dados: CalculoReembolso[];
    periodo: string;
    source: 'CSV' | 'ROTEIRIZADOR' | 'CICLO';
    onClose: () => void;
}

const ReportPrint: React.FC<ReportPrintProps> = ({ dados, periodo, source, onClose }) => {
    const { configReembolso, systemConfig } = useContext(DataContext);
    
    // NOVO (v1.15.5): Criamos o container do portal
    const modalRoot = typeof document !== 'undefined' ? document.body : null;

    useEffect(() => {
        // Prevenir scroll do body quando o modal está aberto
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);
    
    const handlePrint = () => window.print();
    
    const dadosProcessados = useMemo(() => {
        if (source !== 'CICLO') return dados;
        
        return dados.map(item => {
            const registrosCiclo = item.Registros.filter(r => r.isCiclo === true);
            if (registrosCiclo.length === 0) return null;

            const totalKmCiclo = registrosCiclo.reduce((acc, r) => acc + r.KM, 0);
            const valorTotalCiclo = registrosCiclo.reduce((acc, r) => acc + r.ValorCalculado, 0);
            
            return {
                ...item,
                TotalKM: totalKmCiclo,
                ValorPagar: valorTotalCiclo,
                Registros: registrosCiclo,
                Ajuste: 0 
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null);
    }, [dados, source]);

    const totalPagar = dadosProcessados.reduce((acc, item) => acc + item.ValorPagar + (item.Ajuste || 0), 0);
    const totalKM = dadosProcessados.reduce((acc, item) => acc + item.TotalKM, 0);

    const content = (
        <div className="fixed inset-0 z-[9999] bg-white text-black overflow-auto print:static print:inset-auto print:overflow-visible print:block print:bg-white portal-print-container">
            <style>{`
                @media print {
                    @page { 
                        margin: 12mm !important; 
                        size: A4 portrait !important; 
                    }
                    
                    #root, .ais-app-container { 
                        display: none !important; 
                        height: 0 !important;
                        overflow: hidden !important;
                    }
                    
                    body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        height: auto !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .portal-print-container {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        display: block !important;
                        overflow: visible !important;
                        z-index: 99999 !important;
                        background: white !important;
                    }

                    .no-print { display: none !important; }
                    
                    /* Tabela Otimizada A4 */
                    table { 
                        page-break-inside: auto !important; 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        margin-top: 5mm !important;
                    }
                    tr { page-break-inside: avoid !important; page-break-after: auto !important; }
                    thead { display: table-header-group !important; }
                    
                    th, td {
                        padding: 10px 8px !important;
                        border: 1px solid #000 !important;
                    }

                    .text-slate-900 { color: #000 !important; }
                    .text-slate-600 { color: #333 !important; }
                    .bg-slate-50 { background-color: #f8fafc !important; }
                    .bg-slate-800 { background-color: #1e293b !important; color: white !important; }
                }
            `}</style>

            <div className="p-4 bg-slate-900 flex justify-between items-center print:hidden sticky top-0 border-b border-slate-800 shadow-md no-print z-[10001]">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                    </div>
                    <h2 className="text-white font-bold text-lg">Visualização de Impressão</h2>
                </div>
                <div className="space-x-3">
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-blue-500 transition shadow-lg flex items-center gap-2">
                        <span>IMPRIMIR</span>
                    </button>
                    <button onClick={onClose} className="bg-slate-700 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-600 transition">FECHAR</button>
                </div>
            </div>

            <div className="print-area p-8 max-w-5xl mx-auto print:p-0 print:max-w-none font-sans bg-white min-h-screen">
                {/* Cabecalho Compacto v1.16.1 */}
                <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
                    <div className="flex items-center gap-3 w-[35%]">
                        {systemConfig?.logoUrl ? (
                            <img src={systemConfig.logoUrl} alt="Logo" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="h-10 w-10 bg-slate-900 rounded flex items-center justify-center text-white font-black text-xs">F360</div>
                        )}
                        <div className="leading-tight">
                            <p className="text-[10px] font-black uppercase text-slate-900 leading-none mb-1">{systemConfig?.razaoSocial || systemConfig?.companyName || 'Empresa'}</p>
                            {systemConfig?.cnpj && <p className="text-[9px] text-slate-500 font-bold">CNPJ: {systemConfig.cnpj}</p>}
                        </div>
                    </div>

                    <div className="text-center flex-1">
                        <h1 className="text-xl font-black uppercase tracking-tighter text-slate-950 leading-none">
                            {source === 'CICLO' ? 'Recibo de Reembolso e Presença' : 'Relatório de Reembolso'}
                        </h1>
                        {source === 'CICLO' && (
                            <p className="text-[11px] font-bold text-slate-700 mt-1 uppercase bg-slate-100 px-3 py-0.5 rounded-full inline-block">Reunião de Ciclo</p>
                        )}
                        <p className="text-[9px] text-slate-500 mt-1 font-bold">PERÍODO: {periodo || 'GERAL'}</p>
                    </div>

                    <div className="w-[20%] text-right lowercase italic text-[8px] text-slate-400">
                        emissão: {new Date().toLocaleString()} <br/>
                        origem: {source}
                    </div>
                </div>

                {/* Resumo Ultra-Compacto */}
                <div className="flex items-center justify-between gap-4 mb-4 text-[10px] bg-slate-50 p-4 rounded-lg border border-slate-200 print:bg-white print:border-slate-300">
                    <div className="grid grid-cols-3 gap-x-8 text-slate-700">
                        <div>
                            <p className="text-[8px] text-slate-400 uppercase font-black">Combustível</p>
                            <p className="font-bold">R$ {configReembolso.PrecoCombustivel.toFixed(2)}/L</p>
                        </div>
                        <div>
                            <p className="text-[8px] text-slate-400 uppercase font-black">Média (C/M)</p>
                            <p className="font-bold">{configReembolso.KmL_Carro} | {configReembolso.KmL_Moto} km/l</p>
                        </div>
                        <div>
                            <p className="text-[8px] text-slate-400 uppercase font-black">KM Total</p>
                            <p className="font-bold">{totalKM.toFixed(1)} km</p>
                        </div>
                    </div>
                    
                    <div className="text-right border-l border-slate-200 pl-4">
                        <p className="text-[8px] text-slate-400 uppercase font-black">Valor Total Geral</p>
                        <p className="text-2xl font-black text-blue-900 leading-none">
                            {totalPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                </div>

                <table className="w-full text-[10px] border-collapse border border-slate-400">
                    <thead className="print:table-header-group">
                        <tr className="bg-slate-800 text-white uppercase text-[8px] font-black tracking-widest print:bg-slate-100 print:text-black">
                            <th className="border border-slate-400 p-2 text-left w-[30%]">Colaborador</th>
                            <th className="border border-slate-400 p-2 text-left">Setor / Grupo</th>
                            <th className="border border-slate-400 p-2 text-center w-[8%]">Veículo</th>
                            <th className="border border-slate-400 p-2 text-right w-[10%]">KM Total</th>
                            <th className="border border-slate-400 p-2 text-right w-[15%]">Valor Final</th>
                            {source === 'CICLO' && <th className="border border-slate-400 p-2 text-center w-[25%] font-black uppercase">Assinatura</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-400">
                        {dadosProcessados.sort((a,b) => a.Colaborador.Nome.localeCompare(b.Colaborador.Nome)).map((item, idx) => {
                            const valorFinal = item.ValorPagar + (item.Ajuste || 0);
                            return (
                                <tr key={idx} className="hover:bg-slate-50 break-inside-avoid shadow-none">
                                    <td className="border border-slate-400 p-2">
                                        <div className="font-black text-slate-900 uppercase text-[11px] leading-none mb-1">{item.Colaborador.Nome}</div>
                                        <div className="text-[8px] text-slate-500">ID: {item.Colaborador.ID_Pulsus}</div>
                                    </td>
                                    <td className="border border-slate-400 p-2 leading-none">
                                        <div className="uppercase font-bold text-slate-700 text-[9px] mb-1">{item.Colaborador.Grupo}</div>
                                        <div className="text-[8px] text-slate-500 italic">Setor: {item.Colaborador.CodigoSetor}</div>
                                    </td>
                                    <td className="border border-slate-400 p-2 text-center uppercase font-bold text-slate-600">
                                        {item.Colaborador.TipoVeiculo === 'Carro' ? 'CAR' : 'MT'}
                                    </td>
                                    <td className="border border-slate-400 p-2 text-right font-black text-slate-900 whitespace-nowrap">
                                        {item.TotalKM.toFixed(1)}
                                    </td>
                                    <td className="border border-slate-400 p-2 text-right font-black text-blue-900 whitespace-nowrap bg-blue-50/5">
                                        {valorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                    {source === 'CICLO' && (
                                        <td className="border border-slate-400 p-2 align-bottom">
                                            <div className="w-full border-b border-black border-dashed h-4 mb-0.5"></div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {source === 'CICLO' && (
                    <div className="mt-8 text-[9px] text-slate-800 border-2 border-black p-4 bg-slate-50 print:bg-white leading-tight">
                        <p className="font-bold text-[10px] mb-1 uppercase">Termo de Recebimento:</p>
                        <p>Declaro expressamente que participei integralmente da **Reunião de Ciclo** referente ao período citado, fornecendo os dados de quilometragem necessários para o ressarcimento de despesas com locomoção. Confirmo o recebimento do valor aqui discriminado e atesto a veracidade das informações apresentadas.</p>
                        
                        <div className="mt-8 grid grid-cols-2 gap-12 px-6">
                            <div className="text-center">
                                <div className="border-b-2 border-black w-full mb-1"></div>
                                <p className="font-black uppercase text-[8px]">RESPONSÁVEL ENTREGA / RH</p>
                            </div>
                            <div className="text-center">
                                <div className="border-b-2 border-black w-full mb-1"></div>
                                <p className="font-black uppercase text-[8px]">CONFERÊNCIA DIRETORIA</p>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="mt-6 pt-4 border-t border-slate-300 flex justify-between text-[7px] text-slate-300 font-bold uppercase tracking-widest">
                    <span>FUEL360 SYSTEM - DOCUMENTO INTERNO</span>
                    <span>PÁGINA 1 DE 1</span>
                </div>
            </div>
        </div>
    );

    return modalRoot ? createPortal(content, modalRoot) : null;
};

export default ReportPrint;
