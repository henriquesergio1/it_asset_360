
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

// Layout Fixo Profissional Otimizado para A4 (Versão 2.10.12 - Balanced Vertical Fill)
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
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #000000; line-height: 1.4; max-width: 100%; margin: 0 auto; padding: 20px 40px; background-color: #fff;">
        
        <!-- HEADER -->
        <table style="width: 100%; border-bottom: 2px solid #000; margin-bottom: 25px; padding-bottom: 10px;">
            <tr>
                <td style="width: 25%; vertical-align: middle;">
                     <img src="${settings.logoUrl}" alt="Logo" style="max-height: 60px; max-width: 160px; object-fit: contain;" onerror="this.style.display='none'"/>
                </td>
                <td style="width: 75%; text-align: right; vertical-align: middle;">
                    <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #000;">${settings.appName || 'Minha Empresa'}</h1>
                    <p style="margin: 0; font-size: 11px; color: #000;">CNPJ: ${settings.cnpj || 'Não Informado'}</p>
                    <h2 style="margin: 5px 0 0 0; text-transform: uppercase; font-size: 14px; color: #000; letter-spacing: 1px;">${content.headerTitle}</h2>
                    <p style="margin: 0; font-size: 10px; color: #000; text-transform: uppercase; font-weight: bold;">CONTROLE DE ATIVO DE TI</p>
                </td>
            </tr>
        </table>

        <!-- DADOS DO COLABORADOR -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 25px; color: #000;">
            ${content.userTable}
        </div>

        <!-- DECLARAÇÃO -->
        <div style="text-align: justify; font-size: 11.5px; margin-bottom: 25px; color: #000; line-height: 1.6;">
            ${content.declaration}
        </div>

        <!-- TABELA DE ITENS -->
        <div style="margin-bottom: 25px;">
            ${content.assetTable}
        </div>

        <!-- OBSERVAÇÕES -->
        <div style="margin-bottom: 25px; font-size: 11px; color: #000; background-color: #fffbeb; padding: 12px; border: 1px solid #fcd34d; border-radius: 6px;">
            <strong>Observações:</strong> ${content.observations}
        </div>

        <!-- CLÁUSULAS -->
        <div style="font-size: 11px; color: #000; margin-bottom: 30px; line-height: 1.5; white-space: pre-line; text-align: justify;">
            ${content.clauses}
        </div>

        <!-- ASSINATURAS -->
        <div style="margin-top: 40px;">
            ${content.signatures}
        </div>

        <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 10px;">
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

  // 1. Tabela do Usuário
  const userTable = `
    <table style="width: 100%; font-size: 11.5px; color: #000; border-collapse: collapse;">
        <tr>
            <td style="font-weight: bold; width: 18%; padding: 4px 0;">Colaborador:</td>
            <td style="width: 42%; padding: 4px 0;">${user.fullName}</td>
            <td style="font-weight: bold; width: 10%; padding: 4px 0;">CPF:</td>
            <td style="width: 30%; font-family: monospace; padding: 4px 0;">${user.cpf}</td>
        </tr>
        <tr>
            <td style="font-weight: bold; padding: 4px 0;">Cargo / Função:</td>
            <td style="padding: 4px 0;">${sectorName || 'Não Informado'}</td>
            <td style="font-weight: bold; padding: 4px 0;">Setor:</td>
            <td style="padding: 4px 0;">${user.internalCode || '-'}</td>
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
        <td style="border: 1px solid #cbd5e1; padding: 10px; color: #000;">
            <strong style="font-size: 12px;">${assetName}</strong><br>
            <span style="font-size: 10px; color: #475569;">Acessórios: ${accessories}</span>
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; color: #000; font-size: 11px;">
            ${idCode}<br>
            <strong>Serial:</strong> ${serial}
        </td>
    </tr>
  `;

  if (linkedSim) {
      assetTableRows += `
        <tr>
          <td style="padding: 8px; border: 1px solid #d1d5db; background-color: #f1f5f9; color: #000;" colspan="2">
            <strong style="font-size: 11px;">Item Vinculado: Chip / SIM Card</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #d1d5db; color: #000; font-size: 11px;"><strong>Número:</strong> ${linkedSim.phoneNumber} (${linkedSim.operator})</td>
          <td style="padding: 8px; border: 1px solid #d1d5db; color: #000; font-size: 11px;"><strong>ICCID:</strong> ${linkedSim.iccid}</td>
        </tr>
      `;
  }

  if (actionType === 'DEVOLUCAO' && checklist) {
      const missingItems = Object.entries(checklist).filter(([_, v]) => !v).map(([k]) => k);
      let checkRows = '';
      Object.entries(checklist).forEach(([itemName, isReturned]) => {
          checkRows += `
            <tr>
                <td style="border: 1px solid #cbd5e1; padding: 6px; width: 70%; font-size: 11px; color: #000;">${itemName}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold; font-size: 10px; color: ${isReturned ? '#166534' : '#991b1b'};">
                    ${isReturned ? 'OK' : 'PENDENTE'}
                </td>
            </tr>
          `;
      });

      assetTableRows += `
        <tr><td colspan="2" style="padding: 15px 0 8px 0;"><strong style="font-size: 11px; text-transform:uppercase; color: #000; border-bottom: 1px solid #e2e8f0; display: block;">Checklist de Conferência</strong></td></tr>
        ${checkRows}
      `;

      if (missingItems.length > 0) {
          assetTableRows += `
            <tr>
                <td colspan="2" style="background-color: #fee2e2; padding: 10px; border: 1px solid #fca5a5; color: #991b1b; font-size: 11px; margin-top: 5px;">
                    <strong>PENDÊNCIAS:</strong> O colaborador declara estar ciente da não devolução imediata dos itens: ${missingItems.join(', ')}.
                </td>
            </tr>
          `;
      }
  }

  const assetTable = `
    <h3 style="font-size: 12px; border-left: 4px solid #2563eb; padding-left: 10px; margin-bottom: 10px; color: #000; text-transform: uppercase; font-weight: bold;">1. Detalhes do Equipamento</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px;">
        <thead>
            <tr style="background-color: #f1f5f9;">
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 65%; color: #000;">Descrição do Item</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 35%; color: #000;">Identificação</th>
            </tr>
        </thead>
        <tbody>
            ${assetTableRows}
        </tbody>
    </table>
  `;

  // 3. Assinaturas (Espaçadas)
  const signatures = `
    <div style="margin-top: 40px; page-break-inside: avoid; color: #000;">
        <p style="text-align: center; margin-bottom: 45px; font-size: 12px;">São Paulo, ${today}</p>
        
        <div style="width: 60%; margin: 0 auto; text-align: center;">
            <div style="border-top: 2px solid #000; padding-top: 8px;">
                <strong style="font-size: 12px; color: #000; text-transform: uppercase;">${user.fullName}</strong><br>
                <span style="font-size: 10px; color: #000; font-weight: bold;">Assinatura do Colaborador</span><br>
                <span style="font-size: 10px; color: #475569; font-family: monospace;">Documento de Identificação (CPF): ${user.cpf}</span>
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

  const printWindow = window.open('', '_blank', 'width=1000,height=900');
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
            @page { margin: 12mm; size: A4 portrait; }
        }
      </style>
    </head>
    <body>
      ${finalHtml}
      <script>
        window.onload = function() { 
            setTimeout(function(){ 
                window.print(); 
                // Remoção do window.close() para manter a aba aberta após a impressão
            }, 800); 
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
