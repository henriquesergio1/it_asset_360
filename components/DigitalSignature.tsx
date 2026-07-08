import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, MapPin, Clock, Calendar, Hash, CheckCircle2, AlertTriangle, ShieldCheck, UserCheck, Smartphone, X, Info, ChevronRight, Save } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { motion, AnimatePresence } from 'framer-motion';

const DigitalSignature = () => {
    const { token } = useParams<{ token: string }>();
    const [termData, setTermData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [signed, setSigned] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [location, setLocation] = useState<string>('Capturando...');
    const [geoStatus, setGeoStatus] = useState<'pending' | 'granted' | 'denied' | 'unsupported'>('pending');
    const [ip, setIp] = useState<string>('Capturando...');
    
    // Evidências
    const [documentPhoto, setDocumentPhoto] = useState<string | null>(null);
    const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
    const [observations, setObservations] = useState('');
    
    // Controle de fluxo
    const [cameraMode, setCameraMode] = useState<'document' | 'selfie' | null>(null);
    const [step, setStep] = useState(1); // 1: Termo integral, 2: Documento, 3: Selfie, 4: Assinatura
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    
    const sigCanvas = useRef<SignatureCanvas>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost';

    const requestLocation = () => {
        setGeoStatus('pending');
        setLocation('Capturando...');
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setLocation(`${pos.coords.latitude}, ${pos.coords.longitude}`);
                    setGeoStatus('granted');
                },
                (err) => {
                    console.error('[Geolocalização] Erro do navegador:', err);
                    setGeoStatus('denied');
                    if (err.code === err.PERMISSION_DENIED) {
                        setLocation('Não autorizado');
                    } else if (err.code === err.POSITION_UNAVAILABLE) {
                        setLocation('Indisponível');
                    } else if (err.code === err.TIMEOUT) {
                        setLocation('Tempo limite esgotado');
                    } else {
                        setLocation('Erro na captura');
                    }
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
        } else {
            setGeoStatus('unsupported');
            setLocation('Não suportado');
        }
    };

    useEffect(() => {
        const fetchTermData = async () => {
            try {
                const res = await fetch(`/api/public/terms-to-sign/${token}`);
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text);
                }
                const data = await res.json();
                setTermData(data);

                // Capturar metadados do assinante
                fetch('https://api.ipify.org?format=json')
                    .then(r => r.json())
                    .then(j => setIp(j.ip))
                    .catch(() => setIp('IP Oculto/Privado'));

                // Requisitar localização
                requestLocation();

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchTermData();
    }, [token]);

    const handleCapturePhoto = async () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg', 0.6); // Compressão equilibrada
            
            if (cameraMode === 'document') setDocumentPhoto(base64);
            else if (cameraMode === 'selfie') setSelfiePhoto(base64);
            
            setCameraMode(null);
            const stream = videoRef.current.srcObject as MediaStream;
            stream?.getTracks().forEach(track => track.stop());
        }
    };

    const startCamera = async (mode: 'document' | 'selfie') => {
        if (!isSecureContext) {
            setCameraMode(mode);
            fileInputRef.current?.click();
            return;
        }

        try {
            setCameraMode(mode);
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: mode === 'document' ? 'environment' : 'user' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            // Em caso de erro ou negação manual, permitir o upload de arquivo como fallback
            console.warn('Câmera direta falhou, usando fallback de arquivo');
            fileInputRef.current?.click();
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (cameraMode === 'document') setDocumentPhoto(base64);
            else if (cameraMode === 'selfie') setSelfiePhoto(base64);
            setCameraMode(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (geoStatus !== 'granted' || !location || location.startsWith('Capturando') || location.includes('não') || location.includes('Erro') || location.includes('suportado') || location.includes('negado') || location.includes('Indisponível')) {
            alert('A coleta da sua geolocalização exata é um requisito de segurança obrigatório para assinar o termo com validade jurídica.');
            return;
        }
        if (!documentPhoto || !selfiePhoto) { 
            alert('Fotos de evidência (Documento e Selfie) são obrigatórias para validade jurídica.'); 
            return; 
        }
        if (sigCanvas.current?.isEmpty()) { 
            alert('A assinatura eletrônica é obrigatória.'); 
            return; 
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/public/terms-to-sign/${token}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signatureCanvas: sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png'),
                    documentPhoto,
                    selfiePhoto,
                    location,
                    ip,
                    observations
                })
            });

            if (!res.ok) throw new Error('Falha ao processar assinatura.');
            setSigned(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></motion.div><p className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Autenticando vínculo...</p></div>;
    
    if (error) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center"><div className="bg-white p-8 rounded-3xl border border-slate-200 max-w-md shadow-xl"><AlertTriangle className="text-amber-500 mx-auto mb-4" size={40} /><h2 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">Acesso Restrito</h2><p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{error}</p><div className="mt-6 pt-6 border-t border-slate-100"><p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Se você já assinou este termo, aguarde a validação do administrador. Para novas assinaturas, solicite um novo link caso tenha sido rejeitado.</p></div></div></div>;
    
    if (signed) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center"><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-10 rounded-[40px] border border-slate-200 max-w-md shadow-2xl relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-5 text-slate-900"><ShieldCheck size={120} /></div><div className="bg-emerald-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20"><CheckCircle2 className="text-white" size={32} /></div><h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tighter">Assinatura Digital Concluída</h2><p className="text-slate-600 text-sm font-medium leading-relaxed mb-8">O termo foi registrado com sucesso. O selo de integridade e fotos de evidência foram anexados ao seu log jurídico.</p><div className="pt-6 border-t border-slate-100"><p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-600">Sistema IT Asset 360 Secure Signature</p></div></motion.div></div>;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center p-4">
            <div className="w-full max-w-xl space-y-6 pt-4 pb-20">
                
                {/* Header Contexto */}
                <style dangerouslySetInnerHTML={{ __html: `
                    .html-content h3 { font-size: 13px; font-weight: 900; color: #1e293b; margin-top: 16px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
                    .html-content strong { color: #0f172a; font-weight: 700; }
                    .html-content br { margin-bottom: 8px; }
                `}} />
                <div className="text-center mb-8">
                    {termData.company?.logoUrl && (
                        <div className="flex justify-center mb-6">
                            <img src={termData.company.logoUrl} alt={termData.company.name} className="h-12 object-contain" />
                        </div>
                    )}
                    <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Segurança Jurídica IT 360</p>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900">{step === 1 ? 'Leia o Contrato' : step === 2 ? 'Foto do Documento' : step === 3 ? 'Sua Selfie' : 'Assinatura'}</h1>
                </div>

                {/* Wizard Steps */}
                <div className="flex gap-2 mb-8">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-700 ${step >= s ? 'bg-blue-600' : 'bg-slate-200'}`} />
                    ))}
                </div>

                {/* Inputs de Fallback (Invisíveis) */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    capture={cameraMode === 'document' ? 'environment' : 'user'}
                    onChange={handleFileUpload}
                />

                {/* ETAPA 1: TERMO INTEGRAL */}
                <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div key="step1" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-2xl">
                            <div className="p-6 bg-slate-50 border-b border-slate-100">
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <h2 className="text-lg font-black text-slate-900 leading-tight">Termo de {termData.type}</h2>
                                        <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Ref: {termData.id || 'Draft'}</p>
                                    </div>
                                    <div className="p-2 bg-blue-600/10 text-blue-600 rounded-xl">
                                        <Smartphone size={20} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-6 h-[50vh] overflow-y-auto custom-scrollbar space-y-8 bg-white">
                                <div className="space-y-4">
                                    <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/85">
                                        <h3 className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-3 border-b border-blue-100 pb-1.5">Identificação do Colaborador</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
                                            <div className="md:col-span-2">
                                                <span className="font-bold text-slate-500 dark:text-slate-400">Colaborador:</span>{' '}
                                                <span className="font-black text-slate-900 block sm:inline">{termData.userName}</span>
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-500 dark:text-slate-400">CPF:</span>{' '}
                                                <span className="font-mono font-bold text-slate-900 block sm:inline">{termData.userCpf}</span>
                                            </div>
                                            <div className="md:col-span-2">
                                                <span className="font-bold text-slate-500 dark:text-slate-400">Cargo / Função:</span>{' '}
                                                <span className="font-bold text-slate-900 block sm:inline">{termData.sectorName || 'Não Informado'}</span>
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-500 dark:text-slate-400">Setor:</span>{' '}
                                                <span className="font-bold text-slate-900 block sm:inline">{termData.userCode || '-'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Declaração de Recebimento</h3>
                                        <div 
                                            className="text-xs text-slate-600 leading-relaxed italic"
                                            dangerouslySetInnerHTML={{ __html: termData.template?.declaration }}
                                        />
                                    </div>

                                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="bg-slate-50 border-b border-slate-100 p-4">
                                            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">1. Detalhes do Equipamento</h3>
                                            <p className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">Especificações técnicas e identificação jurídica do ativo.</p>
                                        </div>
                                        
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                        <th className="p-4 w-7/12">Descrição do Item</th>
                                                        <th className="p-4 w-5/12">Identificação</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                                    {(() => {
                                                        const details = termData.assetDetails || '';
                                                        const bracketsMatch = details.match(/^\[(.*?)\]\s*(.*)$/);

                                                        let assetName = details;
                                                        let serial = 'N/A';
                                                        let displayId = 'Não Informado';
                                                        let tag = '';
                                                        let imei = '';
                                                        let isSim = false;
                                                        let phone = '';
                                                        let iccid = '';

                                                        if (bracketsMatch) {
                                                            const [_, content, modelName] = bracketsMatch;
                                                            const parts = content.split('|').map(p => p.trim());
                                                            
                                                            if (content.toUpperCase().includes('CHIP:')) {
                                                                isSim = true;
                                                                parts.forEach(p => {
                                                                    if (p.toUpperCase().startsWith('CHIP:')) {
                                                                        phone = p.substring(5).trim();
                                                                    } else if (p.toUpperCase().startsWith('ICCID:')) {
                                                                        iccid = p.substring(6).trim();
                                                                    }
                                                                });
                                                                assetName = modelName.trim() || 'Chip SIM Card';
                                                            } else {
                                                                parts.forEach(p => {
                                                                    if (p.toUpperCase().startsWith('TAG:')) {
                                                                        tag = p.substring(4).trim();
                                                                    } else if (p.toUpperCase().startsWith('S/N:') || p.toUpperCase().startsWith('SERIAL:')) {
                                                                        serial = p.substring(p.indexOf(':') + 1).trim();
                                                                    } else if (p.toUpperCase().startsWith('IMEI:')) {
                                                                        imei = p.substring(5).trim();
                                                                    }
                                                                });
                                                                assetName = modelName.trim();
                                                                
                                                                const isTagValid = tag && !['S/T', 'S/I', 'N/A', '---', '', 'DESCONHECIDO', 'S/S'].includes(tag.toUpperCase());
                                                                const isImeiValid = imei && !['S/I', 'S/T', 'N/A', '---', '', 'DESCONHECIDO'].includes(imei.toUpperCase());
                                                                
                                                                if (isTagValid) {
                                                                    displayId = tag;
                                                                } else if (isImeiValid) {
                                                                    displayId = imei;
                                                                } else {
                                                                    displayId = tag || imei || 'Não Informado';
                                                                }
                                                            }
                                                        }

                                                        return (
                                                            <tr>
                                                                <td className="p-4 text-xs">
                                                                    <p className="font-bold text-slate-900 text-sm">{assetName}</p>
                                                                    {isSim ? (
                                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic mt-1">Chip Físico</p>
                                                                    ) : (
                                                                        termData.accessories && termData.accessories.length > 0 ? (
                                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic mt-1">
                                                                                Acessórios: {termData.accessories.map(a => typeof a === 'object' && a !== null ? (a.name || a.Name) : a).join(', ')}
                                                                            </p>
                                                                        ) : (
                                                                            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium italic mt-1">Nenhum acessório vinculado</p>
                                                                        )
                                                                    )}
                                                                </td>
                                                                <td className="p-4 space-y-1">
                                                                    {isSim ? (
                                                                        <>
                                                                            <p className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Número: <span className="font-mono text-slate-900 font-bold block sm:inline">{phone}</span></p>
                                                                            <p className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">ICCID: <span className="font-mono text-slate-700 block sm:inline">{iccid}</span></p>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <p className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Patrimônio / IMEI: <span className="font-mono text-slate-900 font-bold block sm:inline">{displayId}</span></p>
                                                                            <p className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Serial: <span className="font-mono text-slate-700 block sm:inline">{serial || 'N/A'}</span></p>
                                                                        </>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })()}

                                                    {termData.linkedSim && (
                                                        <>
                                                            <tr className="bg-blue-50/30">
                                                                <td colSpan={2} className="p-3 border-y border-blue-100/60">
                                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block pl-1">
                                                                        Item Vinculado: Chip / SIM Card
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                            <tr className="bg-slate-50/20 text-xs text-slate-700">
                                                                <td className="p-4">
                                                                    <p className="font-bold text-slate-900">Chip SIM Card - {termData.linkedSim.operator || termData.linkedSim.Operator}</p>
                                                                    <p className="text-[10px] text-blue-500 font-medium italic mt-1">Chip Vinculado ao Dispositivo</p>
                                                                </td>
                                                                <td className="p-4 space-y-1">
                                                                    <p className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Número: <span className="font-mono font-bold text-slate-900 block sm:inline">{termData.linkedSim.phoneNumber || termData.linkedSim.PhoneNumber}</span></p>
                                                                    <p className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">ICCID: <span className="font-mono text-slate-700 block sm:inline">{termData.linkedSim.iccid || termData.linkedSim.Iccid}</span></p>
                                                                </td>
                                                            </tr>
                                                        </>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {termData.notes && (
                                            <div className="p-4 bg-amber-50/50 border-t border-slate-100">
                                                <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1.5">Observações / Ressalvas do Termo:</h4>
                                                <div className="bg-white border border-amber-100/80 p-3 rounded-xl text-xs text-amber-900/90 font-medium whitespace-pre-wrap leading-relaxed shadow-sm">
                                                    {termData.notes}
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Equipamento conferido e testado conforme padrões da companhia.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <h3 className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cláusulas e Condições</h3>
                                        <div 
                                            className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap font-medium html-content"
                                            dangerouslySetInnerHTML={{ __html: termData.template?.clauses }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
                                {geoStatus === 'pending' && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-blue-700">
                                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full font-bold uppercase" />
                                            <span className="font-bold text-xs uppercase tracking-wider">Obtendo Geolocalização Obrigatória...</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Por favor, se o seu navegador solicitar, permita o acesso à localização em tempo real para fins de validade jurídica.</p>
                                    </div>
                                )}

                                {geoStatus !== 'granted' && geoStatus !== 'pending' && (
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-red-700">
                                            <AlertTriangle size={18} />
                                            <span className="font-black text-xs uppercase tracking-wider">Localização Bloqueada ou Indisponível</span>
                                        </div>
                                        <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider leading-relaxed">
                                            A coleta da sua geolocalização exata é um requisito de segurança obrigatório para conferência e assinatura jurídica deste termo.
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                            Para resolver, certifique-se de que a localização do seu dispositivo está ativa e que o acesso está permitido nas permissões do site ou pelo cadeado 🔒 na barra de endereços do navegador.
                                        </p>
                                        <button 
                                            onClick={requestLocation}
                                            className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-colors shadow-md shadow-red-600/20 active:scale-95"
                                        >
                                            Autorizar e Tentar Novamente
                                        </button>
                                    </div>
                                )}

                                {geoStatus === 'granted' && (
                                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                                        <div className="p-2 bg-emerald-500 text-white rounded-xl">
                                            <MapPin size={16} />
                                        </div>
                                        <div>
                                            <span className="font-black text-[10px] text-emerald-800 uppercase tracking-widest block">Geolocalização Ativa e Validada</span>
                                            <span className="text-[10px] font-mono font-bold text-slate-600">{location}</span>
                                        </div>
                                    </div>
                                )}

                                <label className={`flex items-start gap-4 cursor-pointer group pt-2 ${geoStatus !== 'granted' ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <div className={`mt-0.5 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${acceptedTerms ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/30' : 'bg-white border-slate-300'}`}>
                                        {acceptedTerms && <X className="text-slate-900 dark:text-white rotate-45" size={16} strokeWidth={4} />}
                                        <input 
                                            type="checkbox" 
                                            className="hidden" 
                                            checked={acceptedTerms} 
                                            disabled={geoStatus !== 'granted'} 
                                            onChange={() => setAcceptedTerms(!acceptedTerms)} 
                                        />
                                    </div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed group-hover:text-slate-900 transition-colors">
                                        Li integralmente e aceito todas as condições e termos de responsabilidade descritos.
                                    </span>
                                </label>
                                <button 
                                    disabled={!acceptedTerms || geoStatus !== 'granted'}
                                    onClick={() => setStep(2)}
                                    className="w-full mt-2 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] disabled:opacity-30 shadow-xl shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    Prosseguir para Evidências <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ETAPA 2: FOTO DO DOCUMENTO */}
                {step === 2 && (
                    <motion.div key="step2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                        <div className="text-center mb-4">
                            <h2 className="text-lg font-black text-slate-900">Validar Identidade</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Capture uma foto nítida do seu documento (RG/CNH)</p>
                        </div>
                        
                        <div className="bg-white p-6 rounded-[40px] border border-slate-200 flex flex-col items-center shadow-xl">
                            {documentPhoto ? (
                                <div className="space-y-6 w-full">
                                    <div className="aspect-[4/3] w-full rounded-[32px] overflow-hidden border-4 border-slate-100 shadow-2xl">
                                        <img src={documentPhoto} className="w-full h-full object-cover" alt="Documento" />
                                    </div>
                                    <button onClick={() => setDocumentPhoto(null)} className="w-full py-4 text-xs font-black text-red-600 uppercase tracking-widest border-2 border-red-500/10 rounded-2xl hover:bg-red-50 transition-all">Refazer Foto</button>
                                </div>
                            ) : (
                                <button onClick={() => startCamera('document')} className="w-full aspect-[4/3] border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center gap-4 text-slate-600 dark:text-slate-400 group hover:border-blue-500/50 hover:text-blue-500 transition-all">
                                    <div className="p-6 bg-slate-50 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                                        <Camera size={40} />
                                    </div>
                                    <span className="font-black uppercase tracking-[0.2em] text-[10px]">Tirar Foto do Documento</span>
                                </button>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep(1)} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-500 dark:text-slate-400 shadow-sm">Voltar</button>
                            <button disabled={!documentPhoto} onClick={() => setStep(3)} className="flex-[2] py-4 bg-blue-600 rounded-2xl font-black uppercase text-xs tracking-[0.2em] disabled:opacity-30 shadow-lg shadow-blue-600/30 active:scale-95 transition-all text-white">Continuar</button>
                        </div>
                    </motion.div>
                )}

                {/* ETAPA 3: SELFIE (ROSTO) */}
                {step === 3 && (
                    <motion.div key="step3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                        <div className="text-center mb-4">
                            <h2 className="text-lg font-black text-slate-900">Prova de Vida</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Posicione seu rosto frontalmente para a selfie</p>
                        </div>
                        
                        <div className="bg-white p-6 rounded-[40px] border border-slate-200 flex flex-col items-center shadow-xl">
                            {selfiePhoto ? (
                                <div className="space-y-6 w-full">
                                    <div className="aspect-[3/4] w-full rounded-[32px] overflow-hidden border-4 border-slate-100 shadow-2xl max-w-xs mx-auto">
                                        <img src={selfiePhoto} className="w-full h-full object-cover scale-x-[-1]" alt="Selfie" />
                                    </div>
                                    <button onClick={() => setSelfiePhoto(null)} className="w-full py-4 text-xs font-black text-red-600 uppercase tracking-widest border-2 border-red-500/10 rounded-2xl hover:bg-red-50 transition-all">Regravar Selfie</button>
                                </div>
                            ) : (
                                <button onClick={() => startCamera('selfie')} className="w-full aspect-[3/4] border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center gap-4 text-slate-600 dark:text-slate-400 group hover:border-purple-500/50 hover:text-purple-500 transition-all max-w-xs">
                                    <div className="p-6 bg-slate-50 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-all shadow-inner">
                                        <UserCheck size={40} />
                                    </div>
                                    <span className="font-black uppercase tracking-[0.2em] text-[10px]">Capturar meu Rosto</span>
                                </button>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep(2)} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-500 dark:text-slate-400 shadow-sm">Voltar</button>
                            <button disabled={!selfiePhoto} onClick={() => setStep(4)} className="flex-[2] py-4 bg-blue-600 rounded-2xl font-black uppercase text-xs tracking-[0.2em] disabled:opacity-30 shadow-lg shadow-blue-600/30 active:scale-95 transition-all text-white">Ir para Assinatura</button>
                        </div>
                    </motion.div>
                )}

                {/* ETAPA 4: ASSINATURA E OBSERVAÇÕES */}
                {step === 4 && (
                    <motion.div key="step4" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                        <div className="bg-white rounded-[32px] border border-slate-200 p-6 space-y-6 shadow-2xl">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Info size={14} className="text-blue-500" /> Alguma observação ou ressalva?
                                </h3>
                                <textarea 
                                    placeholder="Ex: O equipamento apresenta um pequeno risco na carcaça..."
                                    value={observations}
                                    onChange={(e) => setObservations(e.target.value)}
                                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 transition-all resize-none shadow-sm"
                                />
                            </div>
                            
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                    Assinatura Digital OBRIGATÓRIA
                                    <button onClick={() => sigCanvas.current?.clear()} className="text-red-500 hover:text-red-600 transition-colors">Limpar</button>
                                </h3>
                                <div 
                                    className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden h-40 shadow-inner cursor-crosshair"
                                    onClick={(e) => e.currentTarget.focus()}
                                    onBlur={(e) => e.currentTarget.blur()}
                                    tabIndex={-1}
                                    style={{ touchAction: 'none' }}
                                >
                                    <SignatureCanvas 
                                        ref={sigCanvas} 
                                        penColor='black' 
                                        canvasProps={{ 
                                            className: 'w-full h-full touch-none',
                                            onMouseDown: (e: any) => e.preventDefault(),
                                            onTouchStart: (e: any) => {
                                                if (e.cancelable) e.preventDefault();
                                                // Prevenir foco em qualquer input que possa abrir teclado
                                                if (document.activeElement instanceof HTMLElement) {
                                                    document.activeElement.blur();
                                                }
                                            }
                                        }} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
                            <ShieldCheck className="text-blue-600 shrink-0 mt-0.5" size={20} />
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
                                Ao finalizar, você assina eletronicamente este termo com validade jurídica, integrando localização, IP, fotos e biometria facial ao registro de IT Asset 360.
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep(3)} className="flex-1 py-5 bg-white border border-slate-200 rounded-3xl font-black uppercase text-xs tracking-widest text-slate-500 dark:text-slate-400 shadow-sm">Voltar</button>
                            <button 
                                disabled={submitting}
                                onClick={handleSubmit}
                                className="flex-[2] py-5 bg-emerald-600 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-3 active:scale-95 transition-all"
                            >
                                {submitting ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full shadow-lg" /> : <Save size={20} />}
                                Finalizar e Enviar
                            </button>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>

            {/* CÂMERA FULLSCREEN MODAL (Apenas Contexto Seguro) */}
            <AnimatePresence>
                {cameraMode && isSecureContext && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black flex flex-col p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-[0.3em] text-[10px]">Capturando {cameraMode === 'document' ? 'Documento' : 'Selfie'}</h3>
                            <button onClick={() => setCameraMode(null)} className="p-2 bg-white/10 rounded-full text-slate-900 dark:text-white"><X size={24}/></button>
                        </div>
                        <div className="flex-1 relative flex items-center justify-center rounded-[40px] overflow-hidden border-2 border-white/10">
                            <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${cameraMode === 'selfie' ? 'scale-x-[-1]' : ''}`} />
                            <div className="absolute inset-x-8 inset-y-16 border-2 border-white/20 border-dashed rounded-[32px] flex items-center justify-center pointer-events-none">
                                <p className="text-slate-900 dark:text-white/20 text-[9px] font-black uppercase tracking-[0.5em] rotate-90 whitespace-nowrap">Centralize Aqui</p>
                            </div>
                        </div>
                        <div className="py-12 flex justify-center">
                            <button 
                                onClick={handleCapturePhoto}
                                className="h-20 w-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all-slow border-[6px] border-white/30 p-1"
                            >
                                <div className="h-full w-full bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-900 dark:text-white">
                                    <Camera size={24} />
                                </div>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Metadados visíveis (Estilo Segurança) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md flex justify-around text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest border-t border-slate-100 pointer-events-none">
                <div className="flex items-center gap-1"><Clock size={10} /> {new Date().toLocaleTimeString()}</div>
                <div className="flex items-center gap-1"><Hash size={10} /> {ip}</div>
                <div className="flex items-center gap-1"><MapPin size={10} /> {location.substring(0, 15)}...</div>
            </div>
        </div>
    );
};

export default DigitalSignature;
