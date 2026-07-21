import React from 'react';

export const RH_AND_TI_FIELD_LABELS: Record<string, string> = {
  // RH
  fullName: 'Nome Completo',
  birthDate: 'Data de Nascimento',
  gender: 'Gênero',
  maritalStatus: 'Estado Civil',
  motherName: 'Nome da Mãe',
  fatherName: 'Nome do Pai',
  personalPhone: 'Telefone Pessoal',
  corporatePhone: 'Telefone Corporativo',
  emailPersonal: 'E-mail Pessoal',
  emailCorporate: 'E-mail Corporativo',
  cep: 'CEP',
  street: 'Rua',
  number: 'Número',
  complement: 'Complemento',
  neighborhood: 'Bairro',
  city: 'Cidade',
  state: 'Estado',
  rg: 'RG',
  cpf: 'CPF',
  pis: 'PIS',
  electorTitle: 'Título de Eleitor',
  ctps: 'CTPS',
  cnhNumber: 'Nº CNH',
  cnhCategory: 'Categoria CNH',
  cnhExpiration: 'Validade CNH',
  role: 'Cargo / Função',
  sectorId: 'Setor / Departamento',
  contractType: 'Tipo de Contrato',
  hireDate: 'Data de Admissão',
  terminationDate: 'Data de Demissão',
  salary: 'Salário (R$)',
  weeklyHours: 'Carga Horária Semanal',
  documents: 'Documentos Anexados',
  status: 'Status',
  terminationReason: 'Motivo da Demissão',
  photo: 'Foto de Perfil',

  // TI (Dispositivos)
  assetTag: 'Patrimônio / Tag',
  serialNumber: 'Número de Série',
  model: 'Modelo do Ativo',
  brand: 'Marca / Fabricante',
  category: 'Categoria de Ativo',
  assignedUserCpf: 'Usuário Atribuído',
  location: 'Localização / Unidade',
  purchaseDate: 'Data de Compra',
  purchaseValue: 'Valor de Compra',
  warrantyEndDate: 'Fim da Garantia',
  notes: 'Observações / Anotações',
  hostname: 'Nome de Host (Hostname)',
  ipAddress: 'Endereço IP',
  macAddress: 'Endereço MAC'
};

export const formatLogValue = (val: string): { formatted: string; isVoid: boolean } => {
  if (!val || val === 'undefined' || val === 'null' || val === "''" || val === '""' || val === '[]' || val === '{}') {
    return { formatted: '[Nenhum]', isVoid: true };
  }
  
  const cleanVal = val.trim().replace(/^'|'$/g, '').replace(/^"|"$/g, '');

  if (!cleanVal || cleanVal === '[]' || cleanVal === '{}') {
    return { formatted: '[Nenhum]', isVoid: true };
  }

  // Sanitiza Base64
  if (cleanVal.includes('data:image/') || cleanVal.includes('base64,') || cleanVal.length > 150) {
    if (cleanVal.includes('doc-') || cleanVal.includes('fileName')) {
      try {
        const parsed = JSON.parse(cleanVal);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) return { formatted: '[Nenhum documento]', isVoid: true };
          return { formatted: `${parsed.length} anexo(s): ` + parsed.map((d: any) => d.fileName || d.category || 'Anexo').join(', '), isVoid: false };
        }
      } catch (e) {
        // ignora erro e trata como anexo genérico
      }
      return { formatted: '[Anexos de Documentos]', isVoid: false };
    }
    return { formatted: '[Imagem Anexada]', isVoid: false };
  }

  // Verifica datas zeradas ou nulas de fuso horário
  if (cleanVal.includes('1900-01-01') || cleanVal.includes('1899-12-31') || cleanVal.includes('Jan 01 1900') || cleanVal.includes('Dec 31 1899')) {
    return { formatted: '[Não informada / Zerada]', isVoid: true };
  }

  // Formatação estrita de Datas (apenas DD/MM/AAAA)
  if (cleanVal.includes('GMT') || cleanVal.match(/^\d{4}-\d{2}-\d{2}/) || cleanVal.match(/^[A-Z][a-z]{2}\s[A-Z][a-z]{2}/)) {
    const d = new Date(cleanVal);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() <= 1900) return { formatted: '[Não informada / Zerada]', isVoid: true };
      return { formatted: d.toLocaleDateString('pt-BR'), isVoid: false };
    }
  }

  // Parse de JSON estruturado (ex: array de documentos)
  if (cleanVal.startsWith('[') || cleanVal.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleanVal);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return { formatted: '[Nenhum documento]', isVoid: true };
        return { 
          formatted: `${parsed.length} anexo(s): ` + parsed.map((d: any) => d.fileName || d.category || 'Anexo').join(', '), 
          isVoid: false 
        };
      }
    } catch (e) {
      return { formatted: '[Dados Estruturados]', isVoid: false };
    }
  }

  return { formatted: cleanVal, isVoid: false };
};

export const renderFriendlyAuditLog = (notes: string) => {
  if (!notes) return <span className="text-slate-400 italic text-xs">Sem observações registradas.</span>;

  let cleanNotes = notes.replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, '[Imagem Base64]');
  
  // Caso 1: Logs com motivo/justificativa (ex: Exclusão de ocorrência ou documento)
  if (cleanNotes.includes('Motivo:') || cleanNotes.includes('Justificativa:')) {
    const parts = cleanNotes.split(/(?:Motivo|Justificativa):/i);
    const mainDesc = parts[0].trim().replace(/\.$/, '');
    const reasonText = parts.slice(1).join('Motivo:').trim();
    return (
      <div className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs space-y-2 shadow-xs">
        <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{mainDesc}</p>
        <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg flex items-start gap-2 text-amber-900 dark:text-amber-300 font-medium">
          <span className="font-black text-[9px] uppercase tracking-wider bg-amber-200/60 dark:bg-amber-500/30 px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-200 shrink-0 mt-0.5">Motivo</span>
          <span className="text-[11px] leading-relaxed break-words">{reasonText}</span>
        </div>
      </div>
    );
  }

  // Caso 2: Alteração de campos de cadastro (formato key: old ➔ new)
  const knownKeys = Object.keys(RH_AND_TI_FIELD_LABELS);
  const keyPattern = new RegExp(`(?:^|\\s)(${knownKeys.join('|')}):`, 'g');
  
  const matches: { key: string; index: number }[] = [];
  let match;
  while ((match = keyPattern.exec(cleanNotes)) !== null) {
    matches.push({ key: match[1], index: match.index });
  }

  if (matches.length > 0) {
    const parsedChanges: { label: string; oldValObj: { formatted: string; isVoid: boolean }; newValObj: { formatted: string; isVoid: boolean } }[] = [];

    for (let i = 0; i < matches.length; i++) {
      const key = matches[i].key;
      const colonPos = cleanNotes.indexOf(':', matches[i].index);
      const start = colonPos + 1;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : cleanNotes.length;
      const segment = cleanNotes.substring(start, end).trim();

      const arrowSplit = segment.split(/➔|->/);
      if (arrowSplit.length >= 2) {
        const rawOld = arrowSplit[0].trim();
        const rawNew = arrowSplit.slice(1).join('->').trim();

        const oldValObj = formatLogValue(rawOld);
        const newValObj = formatLogValue(rawNew);

        // Suprimir se ambos os valores forem nulos/zerados (ex: datas 1900 de banco) ou sem alteração real
        const isBothVoid = (oldValObj.isVoid && newValObj.isVoid) || (oldValObj.formatted === newValObj.formatted);

        if (!isBothVoid) {
          parsedChanges.push({
            label: RH_AND_TI_FIELD_LABELS[key] || key,
            oldValObj,
            newValObj
          });
        }
      }
    }

    if (parsedChanges.length > 0) {
      return (
        <div className="space-y-2 pt-1">
          {parsedChanges.map((change, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 gap-2 shadow-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                {change.label}:
              </span>
              <div className="flex items-center gap-2 flex-wrap text-[11px] min-w-0">
                {!change.oldValObj.isVoid && (
                  <>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold line-through border border-rose-200 dark:border-rose-500/20 max-w-[220px] truncate" title={change.oldValObj.formatted}>
                      {change.oldValObj.formatted}
                    </span>
                    <span className="text-slate-400 font-bold text-xs">➔</span>
                  </>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/20 max-w-[280px] truncate" title={change.newValObj.formatted}>
                  {change.newValObj.formatted}
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-500 dark:text-slate-400 italic">
        Atualização de dados cadastrais (campos padrão mantidos).
      </div>
    );
  }

  return (
    <div className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed shadow-xs break-words">
      {cleanNotes}
    </div>
  );
};
