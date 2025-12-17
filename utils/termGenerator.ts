
import { User, Device, SimCard, SystemSettings, DeviceModel, DeviceBrand, AssetType, ReturnChecklist } from '../types';

interface GenerateTermProps {
  user: User;
  asset: Device | SimCard;
  settings: SystemSettings;
  model?: DeviceModel;
  brand?: DeviceBrand;
  type?: AssetType;
  actionType: 'ENTREGA' | 'DEVOLUCAO';
  linkedSim?: SimCard;
  sectorName?: string;
  checklist?: ReturnChecklist;
  notes?: string;
}

// Layout Fixo Profissional
const getFixedLayout = (
    settings: SystemSettings, 
    content: {
        headerTitle: string;
        userTable: string;
        declaration: string;
        assetTable: string;
        observations: string;
        clauses: string;
        signatures: string;
    }
) => {
    return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; line-height: 1.4; max-width: 100%; margin: 0 auto; padding: 20px 30px; background-color: #fff;">
        
        <!-- HEADER (FIXO) -->
        <table style="width: 100%; border-bottom: 2px solid #1f2937; margin-bottom: 15px; padding-bottom: 5px;">
            <tr>
                <td style="width: 25%; vertical-align: middle;">
                     <img src="${settings.logoUrl}" alt="Logo" style="max-height: 60px; max-width: 150px; object-fit: contain;" onerror="this.style.display='none'"/>
                </td>
                <td style="width: 75%; text-align: right; vertical-align: middle;">
                    <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">${settings.appName || 'Minha Empresa'}</h1>
                    <p style="margin: 0; font-size: 11px; color: #4b5563;">CNPJ: ${settings.cnpj || 'Não Informado'}</p>
                    <h2 style="margin: 5px 0 0 0; text-transform: uppercase; font-size: 14px; color: #4b5563;">${content.headerTitle}</h2>
                    <p style="margin: 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">CONTROLE DE ATIVO DE TI</p>
                </td>
            </tr>
        </table>

        <!-- DADOS DO COLABORADOR (FIXO) -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; margin-bottom: 15px;">
            ${content.userTable}
        </div>

        <!-- DECLARAÇÃO (EDITÁVEL) -->
        <p style="text-align: justify; font-size: 11px; margin-bottom: 15px; color: #333;">
            ${content.declaration}
        </p>

        <!-- TABELA DE ITENS (FIXO) -->
        ${content.assetTable}

        <!-- OBSERVAÇÕES (FIXO) -->
        <div style="margin-bottom: 20px; font-size: 11px; color: #333; background-color: #fffbeb; padding: 8px; border: 1px solid #fcd34d; border-radius: 4px;">
            <strong>Observações:</strong> ${content.observations}
        </div>

        <!-- CLÁUSULAS (EDITÁVEL) -->
        <div style="font-size: 10.5px; color: #334155; margin-bottom: 20px; line-height: 1.5; white-space: pre-line;">
            ${content.clauses}
        </div>

        <!-- ASSINATURAS (FIXO) -->
        ${content.signatures}

        <div style="margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 5px;">
            Documento gerado digitalmente pelo sistema IT Asset 360 • ${new Date().toLocaleString()}
        </div>
    </div>
    `;
};

export const generateAndPrintTerm = ({ 
  user, asset, settings, model, brand, type, actionType, linkedSim, sectorName, checklist, notes 
}: GenerateTermProps) => {
  
  // 1. Tentar ler configurações de texto (JSON ou Fallback)
  let config = {
      delivery: { declaration: '', clauses: '' },
      return: { declaration: '', clauses: '' }
  };

  try {
      if (settings.termTemplate && settings.termTemplate.trim().startsWith('{')) {
          config = JSON.parse(settings.termTemplate);
      } else {
          // Fallback para string antiga (Legado) ou vazio
          config.delivery.declaration = "Declaro ter recebido os itens abaixo.";
          config.delivery.clauses = "Comprometo-me a zelar pelo equipamento.";
          config.return.declaration = "Declaro ter devolvido os itens abaixo.";
          config.return.clauses = "Equipamento devolvido e conferido.";
      }
  } catch (e) {
      console.error("Erro ao analisar template de termo", e);
  }

  // Selecionar textos baseados na ação
  let rawDeclaration = actionType === 'ENTREGA' ? config.delivery.declaration : config.return.declaration;
  let rawClauses = actionType === 'ENTREGA' ? config.delivery.clauses : config.return.clauses;

  // Substituir variáveis NOS TEXTOS (Permitindo {NOME_EMPRESA} etc no texto editável)
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const commonReplacements: Record<string, string> = {
      '{NOME_EMPRESA}': settings.appName || 'Minha Empresa',
      '{CNPJ}': settings.cnpj || 'Não Informado',
      '{NOME_COLABORADOR}': user.fullName,
      '{CPF}': user.cpf,
      '{RG}': user.rg || '-'
  };

  Object.keys(commonReplacements).forEach(key => {
      const regex = new RegExp(key, 'g');
      rawDeclaration = rawDeclaration.replace(regex, commonReplacements[key]);
      rawClauses = rawClauses.replace(regex, commonReplacements[key]);
  });

  // --- MONTAGEM DOS BLOCOS FIXOS ---

  // 1. Tabela do Usuário
  const userTable = `
    <table style="width: 100%; font-size: 11px;">
        <tr>
            <td style="font-weight: bold; width: 15%; color: #475569;">Colaborador:</td>
            <td style="width: 45%;">${user.fullName}</td>
            <td style="font-weight: bold; width: 10%; color: #475569;">CPF:</td>
            <td style="width: 30%;">${user.cpf}</td>
        </tr>
        <tr>
            <td style="font-weight: bold; color: #475569;">Cargo / Função:</td>
            <td>${sectorName || 'Não Informado'}</td>
            <td style="font-weight: bold; color: #475569;">Setor (Cód):</td>
            <td>${user.jobTitle || '-'}</td>
        </tr>
    </table>
  `;

  // 2. Identificação do Ativo
  let assetName = '';
  let serial = '';
  let idCode = '';
  let accessories = 'Padrão (Carregador)';

  if ('serialNumber' in asset) {
    assetName = `${type?.name || 'Equipamento'} ${brand?.name || ''} ${model?.name || ''}`.trim();
    serial = asset.serialNumber;
    idCode = `Patrimônio: ${asset.assetTag}` + (asset.imei ? ` / IMEI: ${asset.imei}` : '');
    if (asset.accessories && asset.accessories.length > 0) {
        accessories = asset.accessories.map(a => a.name).join(', ');
    }
  } else {
    assetName = `Chip SIM Card - ${asset.operator}`;
    serial = 'N/A';
    idCode = `ICCID: ${asset.iccid}`;
    accessories = 'Cartão (PIN/PUK)';
  }

  let assetTableRows = `
    <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">
            <strong style="font-size: 12px; color: #1e293b;">${assetName}</strong><br>
            <span style="color: #64748b;">Acessórios: ${accessories}</span>
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">
            ${idCode}<br>
            <strong>Serial:</strong> ${serial}
        </td>
    </tr>
  `;

  // Chip Vinculado
  if (linkedSim) {
      assetTableRows += `
        <tr>
          <td style="padding: 6px; border: 1px solid #d1d5db; background-color: #f9fafb;" colspan="2">
            <strong style="font-size: 11px;">Item Vinculado: Chip / SIM Card</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #d1d5db;"><strong>Número:</strong> ${linkedSim.phoneNumber} (${linkedSim.operator})</td>
          <td style="padding: 6px; border: 1px solid #d1d5db;"><strong>ICCID:</strong> ${linkedSim.iccid}</td>
        </tr>
      `;
  }

  // Checklist de Devolução (Se aplicável)
  if (actionType === 'DEVOLUCAO' && checklist) {
      const missingItems = Object.entries(checklist).filter(([_, v]) => !v).map(([k]) => k);
      
      let checkRows = '';
      Object.entries(checklist).forEach(([itemName, isReturned]) => {
          checkRows += `
            <tr>
                <td style="border: 1px solid #cbd5e1; padding: 6px; width: 60%;">${itemName}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold; color: ${isReturned ? 'green' : 'red'};">
                    ${isReturned ? 'DEVOLVIDO' : 'PENDENTE'}
                </td>
            </tr>
          `;
      });

      assetTableRows += `
        <tr><td colspan="2" style="padding: 10px 0 5px 0;"><strong style="font-size: 11px; text-transform:uppercase;">Checklist de Conferência</strong></td></tr>
        ${checkRows}
      `;

      if (missingItems.length > 0) {
          assetTableRows += `
            <tr>
                <td colspan="2" style="background-color: #fee2e2; padding: 8px; border: 1px solid #fca5a5; color: #991b1b; font-size: 11px;">
                    <strong>PENDÊNCIAS:</strong> O colaborador está ciente que os itens (${missingItems.join(', ')}) não foram devolvidos.
                </td>
            </tr>
          `;
      }
  }

  const assetTable = `
    <h3 style="font-size: 12px; border-bottom: 1px solid #cbd5e1; margin-bottom: 8px; padding-bottom: 2px; color: #0f172a; text-transform: uppercase;">1. Detalhes do Equipamento</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
        <thead>
            <tr style="background-color: #f1f5f9;">
                <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 60%;">Descrição</th>
                <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 40%;">Identificação</th>
            </tr>
        </thead>
        <tbody>
            ${assetTableRows}
        </tbody>
    </table>
  `;

  // 3. Assinaturas
  const signatures = `
    <div style="margin-top: 30px; page-break-inside: avoid;">
        <p style="text-align: center; margin-bottom: 35px; font-size: 11px;">São Paulo, ${today}</p>
        
        <div style="width: 50%; margin: 0 auto; text-align: center;">
            <div style="border-top: 1px solid #000; padding-top: 5px;">
                <strong style="font-size: 12px; color: #000; text-transform: uppercase;">${user.fullName}</strong><br>
                <span style="font-size: 10px; color: #64748b;">Assinatura do Colaborador</span><br>
                <span style="font-size: 10px; color: #94a3b8;">CPF: ${user.cpf}</span>
            </div>
        </div>
        ${actionType === 'DEVOLUCAO' ? `
        <div style="width: 50%; margin: 30px auto 0 auto; text-align: center;">
            <div style="border-top: 1px solid #000; padding-top: 5px;">
                <strong style="font-size: 12px; color: #000; text-transform: uppercase;">DEPARTAMENTO DE T.I.</strong><br>
                <span style="font-size: 10px; color: #64748b;">Responsável pelo Recebimento</span>
            </div>
        </div>
        ` : ''}
    </div>
  `;

  // --- GERAÇÃO FINAL DO HTML ---
  const finalHtml = getFixedLayout(settings, {
      headerTitle: actionType === 'ENTREGA' ? 'Termo de Responsabilidade' : 'Termo de Devolução',
      userTable,
      declaration: rawDeclaration,
      assetTable,
      observations: notes || 'Nenhuma observação registrada.',
      clauses: rawClauses,
      signatures
  });

  // Create Print Window
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
      alert('Permita popups para imprimir o termo.');
      return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Termo de ${actionType === 'ENTREGA' ? 'Entrega' : 'Devolução'}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; padding: 20px; margin: 0; background-color: #fff; }
        @media print {
            body { padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
            @page { margin: 10mm; size: A4 portrait; }
        }
      </style>
    </head>
    <body>
      ${finalHtml}
      <script>
        window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
