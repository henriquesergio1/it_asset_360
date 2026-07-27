const fs = require('fs');

let content = fs.readFileSync('components/RoteirizadorPromotores.tsx', 'utf8');

// 1. Add Levenshtein function
const levenshteinCode = `
function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}
`;

content = content.replace('export const RoteirizadorPromotores: React.FC = () => {', levenshteinCode + '\nexport const RoteirizadorPromotores: React.FC = () => {');

// 2. Add states
const statesCode = `
    const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
    const [nameMappings, setNameMappings] = useState<Record<string, number>>({});
    const [showMappingModal, setShowMappingModal] = useState(false);
    const [pendingParsedData, setPendingParsedData] = useState<VisitaPrevista[]>([]);
`;
content = content.replace('const [file, setFile] = useState<File | null>(null);', 'const [file, setFile] = useState<File | null>(null);' + statesCode);

// 3. Update handleCalculate
const handleCalculateRegex = /const handleCalculate = async \(\) => \{[\s\S]*?reader\.readAsArrayBuffer\(file\);\n        \} \n        catch \(e: any\) \{ alert\(e\.message\); setLoading\(false\); \}\n    \};/;

const newHandleCalculate = `
    const processParsedData = (parsedData: VisitaPrevista[], mappings: Record<string, number>) => {
        const finalData = parsedData.map(v => {
            if (mappings[v.Nome_Vendedor]) {
                v.Cod_Vend = mappings[v.Nome_Vendedor];
            }
            return v;
        }).filter(v => v.Cod_Vend !== 0); // Remove os que não foram mapeados

        setRawData(finalData); 
        const allIds = new Set(finalData.map(d => d.Cod_Vend));
        setSelectedSellerIds(allIds);
        setShouldAutoCalculate(true);
        setLoading(false);
    };

    const handleCalculate = async () => {
        if (!file) {
            alert("Por favor, selecione um arquivo Excel (.xlsx ou .csv).");
            return;
        }
        setLoading(true); setRawData([]); setRealDistances(new Map()); setExcludedIds(new Set()); setSelectedSupervisor(''); setSelectedSellerIds(new Set());
        try { 
            const clients = await getPromoterClients();
            const clientMap = new Map();
            clients.forEach(c => clientMap.set(String(c.Cod_Cliente), c));

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = (window as any).XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = (window as any).XLSX.utils.sheet_to_json(worksheet);

                    const parsedData: VisitaPrevista[] = [];
                    const uniqueNames = new Set<string>();

                    json.forEach((row: any) => {
                        const nome = row['NOME DO COLABORADOR'] || row['Nome'] || row['Colaborador'];
                        const diaSemana = row['DIA SEMANA'] || row['Dia'] || row['Data'];
                        const codPdv = row['CODIGO PDV'] || row['Cod_Cliente'] || row['Codigo'];

                        if (nome && codPdv) {
                            uniqueNames.add(nome);
                            const clientData = clientMap.get(String(codPdv));
                            parsedData.push({
                                Cod_Vend: 0, 
                                Nome_Vendedor: nome,
                                Cod_Supervisor: 0,
                                Nome_Supervisor: 'Equipe Merchandising',
                                Cod_Cliente: codPdv,
                                Razao_Social: clientData ? clientData.Razao_Social : \`Cliente \${codPdv}\`,
                                Dia_Semana: diaSemana || '',
                                Periodicidade: '',
                                Data_da_Visita: new Date().toISOString().split('T')[0],
                                Endereco: '',
                                Bairro: '',
                                Cidade: '',
                                CEP: '',
                                Lat: clientData ? clientData.Lat : 0,
                                Long: clientData ? clientData.Long : 0
                            });
                        }
                    });

                    // Lógica de Match
                    const newMappings: Record<string, number> = { ...nameMappings };
                    const unmatched: string[] = [];

                    uniqueNames.forEach(nome => {
                        if (newMappings[nome]) return; // Já mapeado

                        const upperNome = nome.toUpperCase();
                        // 1. Match Exato
                        let colab = colaboradores.find(c => c.Nome.toUpperCase() === upperNome && c.Grupo === 'Promotor');
                        if (!colab) colab = colaboradores.find(c => c.Nome.toUpperCase() === upperNome);

                        // 2. Match com até 5 caracteres de diferença
                        if (!colab) {
                            let bestMatch = null;
                            let minDistance = 6; // Máximo 5 de diferença
                            colaboradores.forEach(c => {
                                const dist = levenshteinDistance(upperNome, c.Nome.toUpperCase());
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    bestMatch = c;
                                }
                            });
                            colab = bestMatch || undefined;
                        }

                        if (colab) {
                            newMappings[nome] = colab.CodigoSetor;
                        } else {
                            unmatched.push(nome);
                        }
                    });

                    setNameMappings(newMappings);

                    if (unmatched.length > 0) {
                        setUnmatchedNames(unmatched);
                        setPendingParsedData(parsedData);
                        setShowMappingModal(true);
                        setLoading(false);
                    } else {
                        processParsedData(parsedData, newMappings);
                    }

                } catch (err: any) {
                    alert("Erro ao processar arquivo: " + err.message);
                    setLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } 
        catch (e: any) { alert(e.message); setLoading(false); }
    };
`;
content = content.replace(handleCalculateRegex, newHandleCalculate);

// 4. Update groupedData to remove old match logic
const groupedDataRegex = /            \/\/ LÓGICA DE MATCH \(DUPLICIDADE DE ID\):[\s\S]*?v\.Cod_Vend = v\.Nome_Vendedor\.split\(''\)\.reduce\(\(a,b\)=>\{a=\(\(a<<5\)-a\)\+b\.charCodeAt\(0\);return a&a\},0\);\n            \}/;
content = content.replace(groupedDataRegex, `            let colab = colaboradores.find(c => Number(c.CodigoSetor) === Number(v.Cod_Vend));`);

// 5. Add Mapping Modal UI
const modalUI = `
            {showMappingModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Vincular Promotores</h3>
                                <p className="text-sm text-slate-500 mt-1">Alguns nomes do Excel não foram encontrados no sistema.</p>
                            </div>
                            <button onClick={() => setShowMappingModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircleIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {unmatchedNames.map(nome => (
                                <div key={nome} className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <div className="flex-1 font-bold text-slate-700">{nome}</div>
                                    <div className="flex-1">
                                        <select 
                                            className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setNameMappings(prev => ({...prev, [nome]: Number(val)}));
                                            }}
                                            value={nameMappings[nome] || ''}
                                        >
                                            <option value="">Ignorar este promotor</option>
                                            {colaboradores.map(c => (
                                                <option key={c.CodigoSetor} value={c.CodigoSetor}>{c.Nome} ({c.Grupo})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setShowMappingModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
                            <button 
                                onClick={() => {
                                    setShowMappingModal(false);
                                    setLoading(true);
                                    processParsedData(pendingParsedData, nameMappings);
                                }} 
                                className="px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
                            >
                                Confirmar Vínculos
                            </button>
                        </div>
                    </div>
                </div>
            )}
`;
content = content.replace('return (\n        <div className="space-y-6">', 'return (\n        <div className="space-y-6">\n' + modalUI);

fs.writeFileSync('components/RoteirizadorPromotores.tsx', content);
console.log('Script done');
