/**
 * Utilitários de validação e normalização para o módulo de RH
 */

/**
 * Normaliza uma string para Title Case (Primeira letra maiúscula)
 * Remove espaços extras no início, fim e entre palavras.
 */
export const normalizeName = (name: string): string => {
  if (!name) return '';
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Remove caracteres não numéricos de uma string
 */
export const cleanDocument = (value: string): string => {
  if (!value) return '';
  return value.replace(/\D/g, '');
};

/**
 * Valida CPF (Algoritmo oficial)
 */
export const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cleanDocument(cpf);
  if (cleanCPF.length !== 11 || /^(\d)\1+$/.test(cleanCPF)) return false;
  
  let sum = 0;
  let rest;
  
  for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cleanCPF.substring(9, 10))) return false;
  
  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cleanCPF.substring(10, 11))) return false;
  
  return true;
};

/**
 * Valida Email (Regex padrão)
 */
export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Valida Telefone (Mínimo 10 dígitos)
 */
export const validatePhone = (phone: string): boolean => {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 10 && cleanPhone.length <= 11;
};

/**
 * Valida CEP (8 dígitos)
 */
export const validateCEP = (cep: string): boolean => {
  const cleanCEP = cep.replace(/\D/g, '');
  return cleanCEP.length === 8;
};

/**
 * Formata CPF (XXX.XXX.XXX-XX)
 */
export const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

/**
 * Formata Telefone ((XX) XXXXX-XXXX)
 */
export const formatPhone = (value: string) => {
  const r = value.replace(/\D/g, '');
  if (r.length > 10) {
    return r.replace(/^(\d\d)(\d{5})(\d{4}).*/, '($1) $2-$3');
  } else if (r.length > 5) {
    return r.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, '($1) $2-$3');
  } else if (r.length > 2) {
    return r.replace(/^(\d\d)(\d{0,5})/, '($1) $2');
  } else {
    return r.replace(/^(\d*)/, '($1');
  }
};

/**
 * Formata CEP (XXXXX-XXX)
 */
export const formatCEP = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{3})\d+?$/, '$1');
};

/**
 * Extrai dia, mês e ano de qualquer string de data (ISO 8601, YYYY-MM-DD, DD/MM/YYYY)
 * sem sofrer alteração de fuso horário nem contaminação por sufixos "T00:00:00.000Z".
 */
export const parseLocalDateParts = (dateStr: string | null | undefined): { day: number; month: number; year: number; dayStr: string; monthStr: string; yearStr: string } | null => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const clean = str.split('T')[0].split(' ')[0];

  let year = 0, month = 0, day = 0;

  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length >= 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
  } else if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length >= 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
  }

  if (isNaN(year) || isNaN(month) || isNaN(day) || day === 0 || month === 0) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      year = d.getUTCFullYear();
      month = d.getUTCMonth() + 1;
      day = d.getUTCDate();
    } else {
      return null;
    }
  }

  return {
    day,
    month,
    year,
    dayStr: String(day).padStart(2, '0'),
    monthStr: String(month).padStart(2, '0'),
    yearStr: String(year)
  };
};

/**
 * Formata a data no padrão brasileiro DD/MM/YYYY imune a fuso horário.
 */
export const formatDateBR = (dateStr: string | null | undefined): string => {
  const parts = parseLocalDateParts(dateStr);
  if (!parts) return dateStr || '---';
  return `${parts.dayStr}/${parts.monthStr}/${parts.yearStr}`;
};

/**
 * Formata aniversário (ex: "Dia 30 de julho").
 */
export const formatBirthdayDisplay = (dateStr: string | null | undefined): string => {
  const parts = parseLocalDateParts(dateStr);
  if (!parts) return dateStr || '---';
  const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const monthName = monthNames[parts.month - 1] || 'mês';
  return `Dia ${parts.dayStr} de ${monthName}`;
};

/**
 * Formata Placa de Veículo no padrão Mercosul (ABC1D23) ou Tradicional (ABC-1234)
 */
export const formatVehiclePlate = (val: string): string => {
  if (!val) return '';
  // Remove caracteres que não são letras ou números e converte para maiúsculas (máximo 7 alfanuméricos)
  const clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 7);
  if (clean.length <= 3) {
    return clean;
  }

  // Verifica se o 5º caractere (índice 4) é uma letra (Padrão Mercosul: 3 letras, 1 número, 1 letra, 2 números)
  const isMercosul = clean.length >= 5 && /[A-Z]/.test(clean[4]);

  if (isMercosul) {
    // Padrão Mercosul sem hífen (ex: ABC1D23)
    return clean;
  } else {
    // Padrão Tradicional com hífen (ex: ABC-1234)
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
};
