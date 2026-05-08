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

                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => setLocation(`${pos.coords.latitude}, ${pos.coords.longitude}`),
                        () => setLocation('Não autorizado'),
                        { timeout: 5000 }
                    );
                } else {
                    setLocation('Não suportado');
                }

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

    if (loading) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></motion.div><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Autenticando vínculo...</p></div>;
    
    if (error) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center"><div className="bg-white p-8 rounded-3xl border border-slate-200 max-w-md shadow-xl"><AlertTriangle className="text-amber-500 mx-auto mb-4" size={40} /><h2 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">Acesso Restrito</h2><p className="text-slate-500 text-sm leading-relaxed">{error}</p><div className="mt-6 pt-6 border-t border-slate-100"><p className="text-[10px] font-bold text-slate-400">Se você já assinou este termo, aguarde a validação do administrador. Para novas assinaturas, solicite um novo link caso tenha sido rejeitado.</p></div></div></div>;
    
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
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ref: {termData.id || 'Draft'}</p>
                                    </div>
                                    <div className="p-2 bg-blue-600/10 text-blue-600 rounded-xl">
                                        <Smartphone size={20} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-6 h-[50vh] overflow-y-auto custom-scrollbar space-y-8 bg-white">
                                <div className="space-y-4">
                                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                        <h3 className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Colaborador</h3>
                                        <p className="text-sm font-bold text-slate-900">{termData.userName}</p>
                                        <p className="text-[11px] text-slate-500">CPF: {termData.userCpf} | Matrícula: {termData.userCode}</p>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Declaração de Recebimento</h3>
                                        <div 
                                            className="text-xs text-slate-600 leading-relaxed italic"
                                            dangerouslySetInnerHTML={{ __html: termData.template?.declaration }}
                                        />
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                        <h3 className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-3 border-b border-blue-100 pb-2">1. Detalhes do Ativo</h3>
                                        <p className="text-sm font-black text-slate-900 mb-1">{termData.assetDetails}</p>
                                        <p className="text-[10px] text-slate-500 font-medium">Equipamento conferido e testado conforme padrões da companhia.</p>
                                        
                                        {termData.accessories && termData.accessories.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-slate-200">
                                                <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">Acessórios Co-entregues:</h4>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {termData.accessories.map((a:any, i:number) => (
                                                        <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                            <span className="text-[10px] text-slate-700 font-bold uppercase tracking-tight">{a}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cláusulas e Condições</h3>
                                        <div 
                                            className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap font-medium html-content"
                                            dangerouslySetInnerHTML={{ __html: termData.template?.clauses }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100">
                                <label className="flex items-start gap-4 cursor-pointer group">
                                    <div className={`mt-0.5 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${acceptedTerms ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/30' : 'bg-white border-slate-300'}`}>
                                        {acceptedTerms && <X className="text-white rotate-45" size={16} strokeWidth={4} />}
                                        <input type="checkbox" className="hidden" checked={acceptedTerms} onChange={() => setAcceptedTerms(!acceptedTerms)} />
                                    </div>
                                    <span className="text-xs text-slate-500 font-bold leading-relaxed group-hover:text-slate-900 transition-colors">
                                        Li integralmente e aceito todas as condições e termos de responsabilidade descritos.
                                    </span>
                                </label>
                                <button 
                                    disabled={!acceptedTerms}
                                    onClick={() => setStep(2)}
                                    className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] disabled:opacity-30 shadow-xl shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
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
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Capture uma foto nítida do seu documento (RG/CNH)</p>
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
                                <button onClick={() => startCamera('document')} className="w-full aspect-[4/3] border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center gap-4 text-slate-400 group hover:border-blue-500/50 hover:text-blue-500 transition-all">
                                    <div className="p-6 bg-slate-50 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                                        <Camera size={40} />
                                    </div>
                                    <span className="font-black uppercase tracking-[0.2em] text-[10px]">Tirar Foto do Documento</span>
                                </button>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep(1)} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-500 shadow-sm">Voltar</button>
                            <button disabled={!documentPhoto} onClick={() => setStep(3)} className="flex-[2] py-4 bg-blue-600 rounded-2xl font-black uppercase text-xs tracking-[0.2em] disabled:opacity-30 shadow-lg shadow-blue-600/30 active:scale-95 transition-all text-white">Continuar</button>
                        </div>
                    </motion.div>
                )}

                {/* ETAPA 3: SELFIE (ROSTO) */}
                {step === 3 && (
                    <motion.div key="step3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                        <div className="text-center mb-4">
                            <h2 className="text-lg font-black text-slate-900">Prova de Vida</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Posicione seu rosto frontalmente para a selfie</p>
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
                                <button onClick={() => startCamera('selfie')} className="w-full aspect-[3/4] border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center gap-4 text-slate-400 group hover:border-purple-500/50 hover:text-purple-500 transition-all max-w-xs">
                                    <div className="p-6 bg-slate-50 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-all shadow-inner">
                                        <UserCheck size={40} />
                                    </div>
                                    <span className="font-black uppercase tracking-[0.2em] text-[10px]">Capturar meu Rosto</span>
                                </button>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep(2)} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-500 shadow-sm">Voltar</button>
                            <button disabled={!selfiePhoto} onClick={() => setStep(4)} className="flex-[2] py-4 bg-blue-600 rounded-2xl font-black uppercase text-xs tracking-[0.2em] disabled:opacity-30 shadow-lg shadow-blue-600/30 active:scale-95 transition-all text-white">Ir para Assinatura</button>
                        </div>
                    </motion.div>
                )}

                {/* ETAPA 4: ASSINATURA E OBSERVAÇÕES */}
                {step === 4 && (
                    <motion.div key="step4" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                        <div className="bg-white rounded-[32px] border border-slate-200 p-6 space-y-6 shadow-2xl">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
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
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
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
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-relaxed">
                                Ao finalizar, você assina eletronicamente este termo com validade jurídica, integrando localização, IP, fotos e biometria facial ao registro de IT Asset 360.
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep(3)} className="flex-1 py-5 bg-white border border-slate-200 rounded-3xl font-black uppercase text-xs tracking-widest text-slate-500 shadow-sm">Voltar</button>
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
                            <h3 className="text-white font-black uppercase tracking-[0.3em] text-[10px]">Capturando {cameraMode === 'document' ? 'Documento' : 'Selfie'}</h3>
                            <button onClick={() => setCameraMode(null)} className="p-2 bg-white/10 rounded-full text-white"><X size={24}/></button>
                        </div>
                        <div className="flex-1 relative flex items-center justify-center rounded-[40px] overflow-hidden border-2 border-white/10">
                            <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${cameraMode === 'selfie' ? 'scale-x-[-1]' : ''}`} />
                            <div className="absolute inset-x-8 inset-y-16 border-2 border-white/20 border-dashed rounded-[32px] flex items-center justify-center pointer-events-none">
                                <p className="text-white/20 text-[9px] font-black uppercase tracking-[0.5em] rotate-90 whitespace-nowrap">Centralize Aqui</p>
                            </div>
                        </div>
                        <div className="py-12 flex justify-center">
                            <button 
                                onClick={handleCapturePhoto}
                                className="h-20 w-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all-slow border-[6px] border-white/30 p-1"
                            >
                                <div className="h-full w-full bg-slate-900 rounded-full flex items-center justify-center text-white">
                                    <Camera size={24} />
                                </div>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Metadados visíveis (Estilo Segurança) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md flex justify-around text-[8px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 pointer-events-none">
                <div className="flex items-center gap-1"><Clock size={10} /> {new Date().toLocaleTimeString()}</div>
                <div className="flex items-center gap-1"><Hash size={10} /> {ip}</div>
                <div className="flex items-center gap-1"><MapPin size={10} /> {location.substring(0, 15)}...</div>
            </div>
        </div>
    );
};

export default DigitalSignature;
