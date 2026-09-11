import React, { useState } from 'react';
import { Copy, Check, ExternalLink, XCircle, Send, CheckCircle2 } from 'lucide-react';
import { UI_BUTTON_PRIMARY, UI_BUTTON_SECONDARY, UI_BUTTON_SUCCESS, UI_INPUT_BASE } from '../../constants';

export const ShareSimulationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    simId: number;
    periodo: string;
    totalKm?: number;
}> = ({ isOpen, onClose, simId, periodo, totalKm }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const shareUrl = `${window.location.origin}${window.location.pathname}#/fuel360/revisao/${simId}`;
    const whatsappMsg = encodeURIComponent(
        `Olá Supervisor!\n\nSegue o link para conferência e validação das rotas da sua equipe no Fuel360:\n\n📌 *${periodo}*\n🚗 *KM Total:* ${Math.round(totalKm || 0)} km\n🔗 *Acesse para conferir no mapa e enviar suas sugestões:*\n${shareUrl}`
    );

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white">
                                Simulação Salva com Sucesso!
                            </h3>
                            <p className="text-xs text-slate-500">
                                Link de revisão para o supervisor gerado
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Roteiro Salvo</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{periodo}</div>
                    {totalKm ? <div className="text-[11px] text-slate-500">KM Total: <b>{Math.round(totalKm)} km</b></div> : null}
                </div>

                <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Link Compartilhável do Supervisor
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            className={`${UI_INPUT_BASE} text-xs py-2 font-mono text-slate-600 dark:text-slate-300 select-all`}
                        />
                        <button
                            onClick={handleCopy}
                            className={`${UI_BUTTON_SECONDARY} text-xs py-2 px-3 flex items-center gap-1.5 shrink-0`}
                        >
                            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                        O supervisor poderá visualizar os setores no mapa, tempos de atendimento e enviar sugestões de alteração de dias/semanas.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <a
                        href={`https://wa.me/?text=${whatsappMsg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${UI_BUTTON_SUCCESS} w-full sm:w-auto flex-1 text-xs py-2.5 px-4 flex items-center justify-center gap-2 shadow-md`}
                    >
                        <Send size={14} />
                        Enviar no WhatsApp
                    </a>

                    <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${UI_BUTTON_PRIMARY} w-full sm:w-auto text-xs py-2.5 px-4 flex items-center justify-center gap-1.5`}
                    >
                        <ExternalLink size={14} />
                        Abrir Revisão
                    </a>

                    <button
                        onClick={onClose}
                        className={`${UI_BUTTON_SECONDARY} w-full sm:w-auto text-xs py-2.5 px-4`}
                    >
                        Concluir
                    </button>
                </div>
            </div>
        </div>
    );
};
