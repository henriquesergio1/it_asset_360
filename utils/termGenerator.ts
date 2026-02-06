
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

// Layout Fixo Profissional Otimizado para A4
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
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #000000; line-height: 1.2; max-width: 100%; margin: 0 auto; padding: 10px 20px; background-color: #fff;">
        
        <!-- HEADER -->
        <table style="width: 100%; border-bottom: 2px solid #000; margin-bottom: 8px; padding-bottom: 5px;">
            <tr>
                <td style="width: 25%; vertical-align: middle;">
                     <img src="${settings.logoUrl}" alt="Logo" style="max-height: 50px; max-width: 140px; object-fit: contain;" onerror="this.style.display='none'"/>
                </td>
                <td style="width: 75%; text-align: right; vertical-align: middle;">
                    <h1 style="margin: 0; font-size: 16px; font-weight: bold; color: #000;">${settings.appName || 'Minha Empresa'}</h1>
                    <p style="margin: 0; font-size: 10px; color: #000;">CNPJ: ${settings.cnpj || 'Não Informado'}</p>
                    <h2 style="margin: 3px 0 0 0; text-transform: uppercase; font-size: 13px; color: #000;">${content.headerTitle}</h2>
                    <p style="margin: 0; font-size: 9px; color: #000; text-transform: uppercase; font-weight: bold;">CONTROLE DE ATIVO DE TI</p>
                </td>
            </tr>
        </table>

        <!-- DADOS DO COLABORADOR -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px; margin-bottom: 10px; color: #000;">
            ${content.userTable}
        </div>

        <!-- DECLARAÇÃO -->
        <p style="text-align: justify; font-size: 10.5px; margin-bottom: 10px; color: #000;">
            ${content.declaration}
        </p>

        <!-- TABELA DE ITENS -->
        ${content.assetTable}

        <!-- OBSERVAÇÕES -->
        <div style="margin-bottom: 10px; font-size: 10px; color: #000; background-color: #fffbeb; padding: 6px; border: 1px solid #fcd34d; border-radius: 4px;">
            <strong>Observações:</strong> ${content.observations}
        </div>

        <!-- CLÁUSULAS -->
        <div style="font-size: 9.5px; color: #000; margin-bottom: 15px; line-height: 1.3; white-space: pre-line; text-align: justify;">
            ${content.clauses}
        </div>

        <!-- ASSINATURAS -->
        ${content.signatures}

        <div style="margin-top: 10px; text-align: center; font-size: 8px; color: #000; border-top: 1px solid #f1f5f9; padding-top: 3px;">
            Documento gerado digitalmente pelo sistema IT Asset 360 • ${new Date().toLocaleString()}
        </div>
    </div>
    `;
};

export const generateAndPrintTerm = ({ 
  user, asset, settings, model, brand, type, actionType, linkedSim, sectorName, checklist, notes 
}: GenerateTermProps) => {
  
  let config = {
      delivery: { declaration: '', clauses: '' },
      return: { declaration: '', clauses: '' }
  };

  try {
      if (settings.termTemplate && settings.termTemplate.trim().startsWith('{')) {
          config = JSON.parse(settings.termTemplate);
      } else {
          config.delivery.declaration = "Declaro ter recebido os itens abaixo em perfeitas condições de uso.";
          config.delivery.clauses = "Comprometo-me a zelar pelo equipamento e devolvê-lo em caso de desligamento.";
          config.return.declaration = "Declaro ter devolvido os itens abaixo na presente data.";
          config.return.clauses = "Equipamento devolvido e conferido pelo setor de T.I.";
      }
  } catch (e) {
      console.error("Erro ao analisar template de termo", e);
  }

  let rawDeclaration = actionType === 'ENTREGA' ? config.delivery.declaration : config.return.declaration;
  let rawClauses = actionType === 'ENTREGA' ? config.delivery.clauses : config.return.clauses;

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

  // 1. Tabela do Usuário (Compacta)
  const userTable = `
    <table style="width: 100%; font-size: 10.5px; color: #000;">
        <tr>
            <td style="font-weight: bold; width: 15%;">Colaborador:</td>
            <td style="width: 45%;">${user.fullName}</td>
            <td style="font-weight: bold; width: 10%;">CPF:</td>
            <td style="width: 30%; font-family: monospace;">${user.cpf}</td>
        </tr>
        <tr>
            <td style="font-weight: bold;">Cargo / Função:</td>
            <td>${sectorName || 'Não Informado'}</td>
            <td style="font-weight: bold;">Setor:</td>
            <td>${user.internalCode || '-'}</td>
        </tr>
    </table>
  `;

  // 2. Identificação do Ativo
  let assetName = '';
  let serial = '';
  let idCode = '';
  let accessories = 'Nenhum';

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
    accessories = 'Chip Físico';
  }

  let assetTableRows = `
    <tr>
        <td style="border: 1px solid #cbd5e1; padding: 5px; color: #000;">
            <strong style="font-size: 11px;">${assetName}</strong><br>
            <span style="font-size: 9px;">Acessórios: ${accessories}</span>
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 5px; color: #000; font-size: 10px;">
            ${idCode}<br>
            <strong>Serial:</strong> ${serial}
        </td>
    </tr>
  `;

  if (linkedSim) {
      assetTableRows += `
        <tr>
          <td style="padding: 4px; border: 1px solid #d1d5db; background-color: #f9fafb; color: #000;" colspan="2">
            <strong style="font-size: 10px;">Item Vinculado: Chip / SIM Card</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 4px; border: 1px solid #d1d5db; color: #000; font-size: 10px;"><strong>Número:</strong> ${linkedSim.phoneNumber} (${linkedSim.operator})</td>
          <td style="padding: 4px; border: 1px solid #d1d5db; color: #000; font-size: 10px;"><strong>ICCID:</strong> ${linkedSim.iccid}</td>
        </tr>
      `;
  }

  if (actionType === 'DEVOLUCAO' && checklist) {
      const missingItems = Object.entries(checklist).filter(([_, v]) => !v).map(([k]) => k);
      let checkRows = '';
      Object.entries(checklist).forEach(([itemName, isReturned]) => {
          checkRows += `
            <tr>
                <td style="border: 1px solid #cbd5e1; padding: 4px; width: 70%; font-size: 10px; color: #000;">${itemName}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-weight: bold; font-size: 9px; color: ${isReturned ? '#166534' : '#991b1b'};">
                    ${isReturned ? 'OK' : 'PENDENTE'}
                </td>
            </tr>
          `;
      });

      assetTableRows += `
        <tr><td colspan="2" style="padding: 8px 0 4px 0;"><strong style="font-size: 10px; text-transform:uppercase; color: #000;">Checklist de Conferência</strong></td></tr>
        ${checkRows}
      `;

      if (missingItems.length > 0) {
          assetTableRows += `
            <tr>
                <td colspan="2" style="background-color: #fee2e2; padding: 6px; border: 1px solid #fca5a5; color: #991b1b; font-size: 10px;">
                    <strong>PENDÊNCIAS:</strong> Colaborador ciente da não devolução de: ${missingItems.join(', ')}.
                </td>
            </tr>
          `;
      }
  }

  const assetTable = `
    <h3 style="font-size: 11px; border-bottom: 1px solid #000; margin-bottom: 5px; padding-bottom: 2px; color: #000; text-transform: uppercase;">1. Detalhes do Equipamento</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
        <thead>
            <tr style="background-color: #f1f5f9;">
                <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: left; width: 65%; color: #000;">Descrição do Item</th>
                <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: left; width: 35%; color: #000;">Identificação</th>
            </tr>
        </thead>
        <tbody>
            ${assetTableRows}
        </tbody>
    </table>
  `;

  // 3. Assinaturas (Compactas)
  const signatures = `
    <div style="margin-top: 20px; page-break-inside: avoid; color: #000;">
        <p style="text-align: center; margin-bottom: 25px; font-size: 10.5px;">São Paulo, ${today}</p>
        
        <div style="width: 55%; margin: 0 auto; text-align: center;">
            <div style="border-top: 1.5px solid #000; padding-top: 4px;">
                <strong style="font-size: 11px; color: #000; text-transform: uppercase;">${user.fullName}</strong><br>
                <span style="font-size: 9px; color: #000;">Assinatura do Colaborador</span><br>
                <span style="font-size: 9px; color: #000; font-family: monospace;">CPF: ${user.cpf}</span>
            </div>
        </div>
    </div>
  `;

  const finalHtml = getFixedLayout(settings, {
      headerTitle: actionType === 'ENTREGA' ? 'Termo de Responsabilidade' : 'Termo de Devolução',
      userTable,
      declaration: rawDeclaration,
      assetTable,
      observations: notes || 'Nenhuma observação registrada.',
      clauses: rawClauses,
      signatures
  });

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
      alert('Permita popups para imprimir o termo.');
      return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Termo IT Asset 360</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; background-color: #fff; color: #000; }
        @media print {
            body { padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
            @page { margin: 8mm; size: A4 portrait; }
        }
      </style>
    </head>
    <body>
      ${finalHtml}
      <script>
        window.onload = function() { setTimeout(function(){ window.print(); window.close(); }, 700); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
