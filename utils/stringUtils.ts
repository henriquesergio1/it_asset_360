export const normalizeString = (str: string | null | undefined): string => {
 if (!str) return '';
 return str
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .toLowerCase();
};

export const phoneticEncode = (str: string | null | undefined): string => {
  if (!str) return '';
  
  let result = normalizeString(str);

  // Regras de Fonética Simplificada (PT-BR)
  result = result
    .replace(/h/g, '') // H mudo
    .replace(/ph/g, 'f') // PH -> F
    .replace(/sh/g, 'x') // SH -> X
    .replace(/ch/g, 'x') // CH -> X
    .replace(/w/g, 'v') // W -> V (exceto em sons de U, mas aqui simplificamos para V)
    .replace(/y/g, 'i') // Y -> I
    .replace(/ç/g, 's') // Ç -> S (já tratado pelo normalize mas garantimos)
    .replace(/z$/g, 's') // Z no final -> S
    .replace(/z/g, 's') // Z interno -> S (simplificado)
    .replace(/x/g, 's') // X com som de S (Wanderley vs Vanderlei) -> Simplificamos
    .replace(/([^a-z])\1+/g, '$1'); // Remove letras dobradas (ll, nn, tt)

  return result;
};
