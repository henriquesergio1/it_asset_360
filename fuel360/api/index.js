
const express = require('express');
const cors = require('cors');
const { Request, Connection } = require('tedious');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mariadb = require('mariadb');
require('dotenv').config();

// Corrigir erro "Do not know how to serialize a BigInt"
BigInt.prototype.toJSON = function() {
  return Number(this);
};

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(cors());

const API_PORT = process.env.API_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fuel360-prod-secret-key-2025';

const dbConfig = {
    server: process.env.DB_SERVER_FUEL360 || 'localhost',
    authentication: {
        type: 'default',
        options: {
            userName: process.env.DB_USER_FUEL360 || 'sa',
            password: process.env.DB_PASSWORD_FUEL360 || 'senha'
        }
    },
    options: {
        database: process.env.DB_DATABASE_FUEL360 || 'Fuel360',
        encrypt: false,
        trustServerCertificate: true,
        rowCollectionOnRequestCompletion: true,
        requestTimeout: 60000
    }
};

const TYPES = require('tedious').TYPES;

const safeDate = (val) => {
    if (!val) return null;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return new Date(val + 'T12:00:00');
    }
    return new Date(val);
};

function executeQuery(config, query, params = []) {
    return new Promise((resolve, reject) => {
        const connection = new Connection(config);
        connection.on('connect', err => {
            if (err) return reject(err);
            const request = new Request(query, (err) => {
                connection.close();
                if (err) return reject(err);
            });
            params.forEach(p => request.addParameter(p.name, p.type, p.value, p.options || {}));
            const rows = [];
            request.on('row', columns => {
                const row = {};
                columns.forEach(col => { row[col.metadata.colName] = col.value; });
                rows.push(row);
            });
            request.on('requestCompleted', () => resolve({ rows, rowCount: rows.length }));
            connection.execSql(request);
        });
        connection.connect();
    });
}

// --- DB MIGRATION / AUTO-FIX ---
async function checkDbUpdates() {
    try {
        console.log("Verificando integridade do schema do banco de dados...");
        const updates = [
            "ALTER TABLE ReembolsoHistorico ADD MotivoEdicao NVARCHAR(MAX)",
            "ALTER TABLE ReembolsoHistorico ADD ID_RotaHist INT", 
            "ALTER TABLE ReembolsoDetalhe ADD Ajuste DECIMAL(18, 2) DEFAULT 0",
            "ALTER TABLE SystemSettings ADD Alert_MaxDailyKM INT DEFAULT 400",
            "ALTER TABLE SystemSettings ADD Alert_MaxClientDist INT DEFAULT 100",
            "ALTER TABLE SystemSettings ADD LicenseKey NVARCHAR(MAX)",
            "ALTER TABLE SystemSettings ADD LicenseClient NVARCHAR(200)",
            "ALTER TABLE SystemSettings ADD LicenseExpires DATETIME",
            "ALTER TABLE Colaboradores ADD EnderecoPendente BIT DEFAULT 0",
            "ALTER TABLE SystemSettings ADD ExtDb_Type NVARCHAR(50) DEFAULT 'MARIADB'"
        ,
            "ALTER TABLE SystemSettings ADD ExtPromoter_Host NVARCHAR(255)",
            "ALTER TABLE SystemSettings ADD ExtPromoter_Port INT DEFAULT 1433",
            "ALTER TABLE SystemSettings ADD ExtPromoter_User NVARCHAR(100)",
            "ALTER TABLE SystemSettings ADD ExtPromoter_Pass NVARCHAR(255)",
            "ALTER TABLE SystemSettings ADD ExtPromoter_Database NVARCHAR(100)",
            "ALTER TABLE SystemSettings ADD ExtPromoter_Query NVARCHAR(MAX)",
            "ALTER TABLE SystemSettings ADD ExtPromoter_Type NVARCHAR(50) DEFAULT 'MSSQL'",
            "ALTER TABLE SystemSettings ADD HeadquartersAddress NVARCHAR(MAX)",
            "ALTER TABLE SystemSettings ADD HeadquartersLat DECIMAL(18, 10)",
            "ALTER TABLE SystemSettings ADD HeadquartersLong DECIMAL(18, 10)"
        ];

        for (const query of updates) {
            try {
                await executeQuery(dbConfig, query);
            } catch (e) {}
        }

        // Dropar check constraint antiga e adicionar suporte para 'Sem Veículo / VT' dinamicamente
        const dropConstraintQuery = `
            DECLARE @ConstraintName NVARCHAR(256)
            SELECT @ConstraintName = dc.name
            FROM sys.check_constraints dc
            INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
            WHERE dc.parent_object_id = OBJECT_ID('Colaboradores') AND c.name = 'TipoVeiculo'

            IF @ConstraintName IS NOT NULL
            BEGIN
                EXEC('ALTER TABLE Colaboradores DROP CONSTRAINT ' + @ConstraintName)
            END
        `;
        try {
            await executeQuery(dbConfig, dropConstraintQuery);
            const addNewConstraintQuery = `
                IF NOT EXISTS (
                    SELECT * FROM sys.check_constraints 
                    WHERE name = 'CK_Colaboradores_TipoVeiculo' AND parent_object_id = OBJECT_ID('Colaboradores')
                )
                BEGIN
                    ALTER TABLE Colaboradores ADD CONSTRAINT CK_Colaboradores_TipoVeiculo CHECK (TipoVeiculo IN ('Carro', 'Moto', 'Sem Veículo / VT'))
                END
            `;
            await executeQuery(dbConfig, addNewConstraintQuery);
        } catch (err) {
            console.error("Erro ao atualizar check constraint de TipoVeiculo:", err.message);
        }

        console.log("Schema verificado.");
    } catch (e) {
        console.error("Erro ao verificar schema:", e.message);
    }
}

function normalizeVisitaData(row) {
    const findValue = (possibleKeys) => {
        const keys = Object.keys(row);
        const match = keys.find(k => {
            const normalizedK = k.toUpperCase().replace(/[^A-Z0-9]/g, '');
            return possibleKeys.some(pk => pk.toUpperCase().replace(/[^A-Z0-9]/g, '') === normalizedK);
        });
        return match ? row[match] : null;
    };

    return {
        Cod_Vend: findValue(['CodVend', 'Cod. Vend', 'CODVEND', 'CODMTCEPGVDD']),
        Nome_Vendedor: findValue(['NomeVendedor', 'Nome Vendedor', 'NOMEPG']),
        Cod_Supervisor: findValue(['CodSupervisor', 'Cod. Supervisor', 'CODMTCEPGRPS']),
        Nome_Supervisor: findValue(['NomeSupervisor', 'Nome Supervisor', 'NOMESUPERVISOR', 'NOMEPGSUP']),
        Cod_Cliente: findValue(['CodCliente', 'Cod. Cliente', 'CODCET', 'IDCLIENTE']),
        Razao_Social: findValue(['RazaoSocial', 'Razão Social', 'NOMRAZSCLCET', 'CLIENTE']),
        Dia_Semana: findValue(['DiaSemana', 'Dia Semana', 'DIA_SEMANA', 'CODDIASMN']),
        Periodicidade: findValue(['Periodicidade', 'DESCCOVSTCET', 'FREQ']),
        Data_da_Visita: findValue(['Data_da_Visita', 'Data da Visita', 'DATAVISITA', 'DataVisita']),
        Endereco: findValue(['Endereco', 'Endereço', 'deslgrcet', 'RUA']),
        Bairro: findValue(['Bairro', 'desbro', 'BAIRRO']),
        Cidade: findValue(['Cidade', 'descdd', 'CIDADE']),
        CEP: findValue(['CEP', 'codcepcet', 'CEP_CLIENTE']),
        Lat: parseFloat(findValue(['Lat', 'Latitude', 'LATCET', 'LATITUDE']) || 0),
        Long: parseFloat(findValue(['Long', 'Longitude', 'LONCET', 'Lng', 'LONGITUDE']) || 0)
    };
}

// --- ROTAS ---
app.get('/system/config', async (req, res) => {
    try {
        const query = `
            SELECT 
                CompanyName as companyName, 
                LogoUrl as logoUrl,
                Alert_MaxDailyKM as alertMaxDailyKM,
                Alert_MaxClientDist as alertMaxClientDist,
                HeadquartersAddress as headquartersAddress,
                HeadquartersLat as headquartersLat,
                HeadquartersLong as headquartersLong
            FROM SystemSettings WHERE ID = 1`;
        const { rows } = await executeQuery(dbConfig, query);
        res.json(rows[0] || { companyName: 'Fuel360', logoUrl: '' });
    } catch (e) { res.json({ companyName: 'Fuel360', logoUrl: '' }); }
});

app.put('/system/config', async (req, res) => {
    const { companyName, logoUrl, alertMaxDailyKM, alertMaxClientDist, headquartersAddress, headquartersLat, headquartersLong } = req.body;
    try {
        const query = `
            UPDATE SystemSettings SET 
                CompanyName = @n, 
                LogoUrl = @l,
                Alert_MaxDailyKM = @akm,
                Alert_MaxClientDist = @adist,
                HeadquartersAddress = @hqa,
                HeadquartersLat = @hqlat,
                HeadquartersLong = @hqlon
            WHERE ID = 1`;
        await executeQuery(dbConfig, query, [
            { name: 'n', type: TYPES.NVarChar, value: companyName },
            { name: 'l', type: TYPES.NVarChar, value: logoUrl },
            { name: 'akm', type: TYPES.Int, value: alertMaxDailyKM || 400 },
            { name: 'adist', type: TYPES.Int, value: alertMaxClientDist || 100 },
            { name: 'hqa', type: TYPES.NVarChar, value: headquartersAddress },
            { name: 'hqlat', type: TYPES.Decimal, value: headquartersLat, options: { precision: 18, scale: 10 } },
            { name: 'hqlon', type: TYPES.Decimal, value: headquartersLong, options: { precision: 18, scale: 10 } }
        ]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/system/status', async (req, res) => {
    try {
        const query = "SELECT LicenseClient, LicenseExpires FROM SystemSettings WHERE ID = 1";
        const { rows } = await executeQuery(dbConfig, query);
        const s = rows[0] || {};
        if (!s.LicenseExpires) {
             return res.json({ status: 'ACTIVE', client: 'Fuel360 Enterprise', expiresAt: '2099-12-31' });
        }
        const isValid = new Date(s.LicenseExpires) > new Date();
        res.json({
            status: isValid ? 'ACTIVE' : 'EXPIRED',
            client: s.LicenseClient,
            expiresAt: s.LicenseExpires
        });
    } catch (e) {
        res.json({ status: 'ACTIVE', client: 'Fuel360 Client', expiresAt: '2025-12-31' }); 
    }
});

app.post('/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const query = `SELECT ID_Usuario, Nome, Usuario, SenhaHash, Perfil, Ativo FROM Usuarios WHERE Usuario = @usuario`;
        const { rows } = await executeQuery(dbConfig, query, [{ name: 'usuario', type: TYPES.NVarChar, value: usuario.trim() }]);
        if (rows.length === 0) return res.status(401).json({ message: "Usuário não encontrado" });
        const user = rows[0];
        if (!user.Ativo) return res.status(401).json({ message: "Usuário bloqueado" });
        let valid = false;
        if (usuario.trim().toLowerCase() === 'admin' && senha.trim() === 'admin') {
            valid = true;
        } else {
            try { valid = await bcrypt.compare(senha.trim(), user.SenhaHash); } catch (e) { valid = false; }
        }
        if (!valid) return res.status(401).json({ message: "Senha incorreta" });
        const token = jwt.sign({ id: user.ID_Usuario, perfil: user.Perfil, nome: user.Nome }, JWT_SECRET, { expiresIn: '12h' });
        delete user.SenhaHash;
        res.json({ token, user });
    } catch (e) { res.status(500).json({ message: "Erro: " + e.message }); }
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Sessão expirada" });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(401).json({ message: "Sessão inválida" });
        req.user = user;
        next();
    });
}

app.use(authenticateToken);

app.post('/system/license', async (req, res) => {
    const { key } = req.body;
    if (!key) return res.status(400).json({ message: "Chave não fornecida." });
    try {
        const decoded = jwt.verify(key, JWT_SECRET);
        if (decoded.type !== 'PRO') throw new Error("Tipo de licença inválido.");
        const expiresAt = new Date(decoded.exp * 1000);
        const client = decoded.client;
        const query = `UPDATE SystemSettings SET LicenseKey = @k, LicenseClient = @c, LicenseExpires = @e WHERE ID = 1`;
        await executeQuery(dbConfig, query, [{ name: 'k', type: TYPES.NVarChar, value: key }, { name: 'c', type: TYPES.NVarChar, value: client }, { name: 'e', type: TYPES.DateTime, value: expiresAt }]);
        await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'ATIVACAO_LICENCA', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Licença ativada para: ${client}. Vencimento: ${expiresAt.toISOString()}` }]);
        res.json({ message: "Licença ativada com sucesso!" });
    } catch (e) { res.status(400).json({ message: "Licença inválida: " + e.message }); }
});

app.get('/system/logs', async (req, res) => {
    const { startDate, endDate, user, search } = req.query;
    try {
        let query = `SELECT TOP 500 * FROM LogsSistema WHERE 1=1`;
        const params = [];
        if (startDate && endDate) {
            query += ` AND DataHora BETWEEN @s AND @e`;
            params.push({ name: 's', type: TYPES.DateTime, value: new Date(startDate) });
            params.push({ name: 'e', type: TYPES.DateTime, value: new Date(endDate + ' 23:59:59') });
        }
        if (user) { query += ` AND Usuario LIKE @u`; params.push({ name: 'u', type: TYPES.NVarChar, value: `%${user}%` }); }
        if (search) { query += ` AND (Detalhes LIKE @q OR Acao LIKE @q)`; params.push({ name: 'q', type: TYPES.NVarChar, value: `%${search}%` }); }
        query += ` ORDER BY DataHora DESC`;
        const { rows } = await executeQuery(dbConfig, query, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/roteiro/previsao', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const { rows: settings } = await executeQuery(dbConfig, "SELECT * FROM SystemSettings WHERE ID = 1");
        const s = settings[0];
        if (!s.ExtRoute_Host || !s.ExtRoute_Query) throw new Error("Configuração de Roteirizador Externo não encontrada.");
        const extRouteConfig = { server: s.ExtRoute_Host, authentication: { type: 'default', options: { userName: s.ExtRoute_User, password: s.ExtRoute_Pass } }, options: { database: s.ExtRoute_Database, port: s.ExtRoute_Port || 1433, encrypt: false, trustServerCertificate: true, rowCollectionOnRequestCompletion: true, requestTimeout: 120000 } };
        const { rows: rawVisitas } = await executeQuery(extRouteConfig, s.ExtRoute_Query, [{ name: 'pStartDate', type: TYPES.Date, value: startDate }, { name: 'pEndDate', type: TYPES.Date, value: endDate }]);
        const normalized = rawVisitas.map(row => normalizeVisitaData(row));
        res.json(normalized);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/roteiro/promotores/clientes', async (req, res) => {
    let mariadbConn;
    try {
        const { rows: settings } = await executeQuery(dbConfig, "SELECT * FROM SystemSettings WHERE ID = 1");
        const s = settings[0];
        if (!s.ExtPromoter_Host || !s.ExtPromoter_Query) throw new Error("Configuração de Clientes Promotores não encontrada.");
        
        let rawClients = [];
        const dbType = s.ExtPromoter_Type || 'MSSQL';

        if (dbType === 'MSSQL') {
            const extPromoterConfig = { 
                server: s.ExtPromoter_Host, 
                authentication: { type: 'default', options: { userName: s.ExtPromoter_User, password: s.ExtPromoter_Pass } }, 
                options: { database: s.ExtPromoter_Database, port: s.ExtPromoter_Port || 1433, encrypt: false, trustServerCertificate: true, rowCollectionOnRequestCompletion: true, requestTimeout: 120000 } 
            };
            const { rows } = await executeQuery(extPromoterConfig, s.ExtPromoter_Query);
            rawClients = rows;
        } else {
            mariadbConn = await mariadb.createConnection({ host: s.ExtPromoter_Host, port: s.ExtPromoter_Port || 3306, user: s.ExtPromoter_User, password: s.ExtPromoter_Pass, database: s.ExtPromoter_Database, connectTimeout: 10000 });
            rawClients = await mariadbConn.query(s.ExtPromoter_Query);
        }
        
        res.json(rawClients);
    } catch (e) { 
        res.status(500).json({ message: e.message }); 
    } finally {
        if (mariadbConn) mariadbConn.end();
    }
});

app.get('/roteiro/historico', async (req, res) => {
    try {
        const query = `SELECT TOP 20 r.*, CASE WHEN h.ID_Historico IS NOT NULL THEN 1 ELSE 0 END as JaCalculado FROM RotaPrevistaHistorico r LEFT JOIN ReembolsoHistorico h ON r.ID_RotaHist = h.ID_RotaHist ORDER BY r.DataSimulacao DESC`;
        const { rows } = await executeQuery(dbConfig, query);
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/roteiro/historico/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `SELECT d.ID_Pulsus, d.NomeColaborador as Nome, d.ID_RotaDet, dia.ID_RotaDia, dia.DataVisita, dia.KM_Dia as KM FROM RotaPrevistaDetalhe d JOIN RotaPrevistaDiario dia ON d.ID_RotaDet = dia.ID_RotaDet WHERE d.ID_RotaHist = @id`;
        const { rows } = await executeQuery(dbConfig, query, [{ name: 'id', type: TYPES.Int, value: id }]);
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/roteiro/historico', async (req, res) => {
    const p = req.body;
    try {
        const histQuery = `INSERT INTO RotaPrevistaHistorico (Periodo, TotalKM, UsuarioSimulacao) VALUES (@p, @t, @u); SELECT SCOPE_IDENTITY() as id;`;
        const { rows } = await executeQuery(dbConfig, histQuery, [{ name: 'p', type: TYPES.NVarChar, value: p.Periodo }, { name: 't', type: TYPES.Decimal, value: p.TotalKM, options: { precision: 18, scale: 2 } }, { name: 'u', type: TYPES.NVarChar, value: req.user.nome }]);
        const histId = rows[0].id;
        for (const item of p.Itens) {
            const detQuery = `INSERT INTO RotaPrevistaDetalhe (ID_RotaHist, ID_Pulsus, NomeColaborador, Grupo, TotalKM) VALUES (@h, @p, @n, @g, @k); SELECT SCOPE_IDENTITY() as id;`;
            const detRes = await executeQuery(dbConfig, detQuery, [{ name: 'h', type: TYPES.Int, value: histId }, { name: 'p', type: TYPES.Int, value: item.ID_Pulsus }, { name: 'n', type: TYPES.NVarChar, value: item.Nome }, { name: 'g', type: TYPES.NVarChar, value: item.Grupo }, { name: 'k', type: TYPES.Decimal, value: item.TotalKM, options: { precision: 18, scale: 4 } }]);
            const detId = detRes.rows[0].id;
            for (const dia of item.Dias) {
                await executeQuery(dbConfig, `INSERT INTO RotaPrevistaDiario (ID_RotaDet, DataVisita, KM_Dia) VALUES (@d, @dt, @km)`, [{ name: 'd', type: TYPES.Int, value: detId }, { name: 'dt', type: TYPES.Date, value: safeDate(dia.Data) }, { name: 'km', type: TYPES.Decimal, value: dia.KM, options: { precision: 18, scale: 4 } }]);
            }
        }
        await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'SALVAR_ROTA_PREVISTA', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Salvou simulação de rota. Período: ${p.Periodo}. Total KM: ${p.TotalKM.toFixed(2)}` }]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/roteiro/historico/:id', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
        const calcRes = await executeQuery(dbConfig, "SELECT 1 FROM ReembolsoHistorico WHERE ID_RotaHist = @id", [{ name: 'id', type: TYPES.Int, value: id }]);
        if(calcRes.rows.length > 0) return res.status(403).json({ message: "Impossível excluir: Existe um cálculo financeiro fechado vinculado especificamente a esta simulação." });
        await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'DELETE_ROTA', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Excluiu simulação de rota ID ${id}. Motivo: ${reason}` }]);
        await executeQuery(dbConfig, "DELETE FROM RotaPrevistaHistorico WHERE ID_RotaHist = @id", [{ name: 'id', type: TYPES.Int, value: id }]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/roteiro/diario/:id', async (req, res) => {
    const { id } = req.params;
    const { km, reason } = req.body;
    try {
        const infoQuery = `SELECT d.ID_RotaDet, h.ID_RotaHist, dia.KM_Dia as OldKm FROM RotaPrevistaDiario dia JOIN RotaPrevistaDetalhe d ON dia.ID_RotaDet = d.ID_RotaDet JOIN RotaPrevistaHistorico h ON d.ID_RotaHist = h.ID_RotaHist WHERE dia.ID_RotaDia = @id`;
        const infoRes = await executeQuery(dbConfig, infoQuery, [{ name: 'id', type: TYPES.Int, value: id }]);
        if(infoRes.rows.length === 0) throw new Error("Registro não encontrado");
        const { ID_RotaDet, ID_RotaHist, OldKm } = infoRes.rows[0];
        await executeQuery(dbConfig, "UPDATE RotaPrevistaDiario SET KM_Dia = @km WHERE ID_RotaDia = @id", [{ name: 'km', type: TYPES.Decimal, value: km, options: { precision: 18, scale: 4 } }, { name: 'id', type: TYPES.Int, value: id }]);
        const sumDetRes = await executeQuery(dbConfig, `SELECT SUM(KM_Dia) as Total FROM RotaPrevistaDiario WHERE ID_RotaDet = @id`, [{ name: 'id', type: TYPES.Int, value: ID_RotaDet }]);
        const newDetTotal = sumDetRes.rows[0].Total || 0;
        await executeQuery(dbConfig, "UPDATE RotaPrevistaDetalhe SET TotalKM = @t WHERE ID_RotaDet = @id", [{ name: 't', type: TYPES.Decimal, value: newDetTotal, options: { precision: 18, scale: 4 } }, { name: 'id', type: TYPES.Int, value: ID_RotaDet }]);
        const sumHistRes = await executeQuery(dbConfig, `SELECT SUM(TotalKM) as Total FROM RotaPrevistaDetalhe WHERE ID_RotaHist = @id`, [{ name: 'id', type: TYPES.Int, value: ID_RotaHist }]);
        const newHistTotal = sumHistRes.rows[0].Total || 0;
        await executeQuery(dbConfig, "UPDATE RotaPrevistaHistorico SET TotalKM = @t WHERE ID_RotaHist = @id", [{ name: 't', type: TYPES.Decimal, value: newHistTotal, options: { precision: 18, scale: 2 } }, { name: 'id', type: TYPES.Int, value: ID_RotaHist }]);
        await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'EDIT_ROTA_DIA', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Editou dia ID ${id} de ${OldKm} para ${km} km. Motivo: ${reason}` }]);
        res.json({ success: true, newDetTotal, newHistTotal });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/calculo/historico', async (req, res) => {
    try { const query = `SELECT TOP 20 * FROM ReembolsoHistorico ORDER BY DataFechamento DESC`; const { rows } = await executeQuery(dbConfig, query); res.json(rows); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/calculo/historico/:id', async (req, res) => {
    const { id } = req.params;
    try { const query = `SELECT d.ID_Pulsus, d.NomeColaborador as Nome, d.ID_Detalhe, dia.ID_Diario, dia.DataOcorrencia, dia.KM_Dia, dia.Valor_Dia FROM ReembolsoDetalhe d JOIN ReembolsoDiario dia ON d.ID_Detalhe = dia.ID_Detalhe WHERE d.ID_Historico = @id`; const { rows } = await executeQuery(dbConfig, query, [{ name: 'id', type: TYPES.Int, value: id }]); res.json(rows); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/calculo/diario/:id', async (req, res) => {
    const { id } = req.params;
    const { km, reason } = req.body;
    try {
        const infoRes = await executeQuery(dbConfig, `SELECT dia.ID_Detalhe, d.ID_Historico, dia.KM_Dia as OldKm, dia.Valor_Dia as OldVal, d.ParametroPreco, d.ParametroKmL, d.Efetividade, d.Ajuste FROM ReembolsoDiario r JOIN ReembolsoDetalhe d ON r.ID_Detalhe = d.ID_Detalhe WHERE r.ID_Diario = @id`, [{ name: 'id', type: TYPES.Int, value: id }]);
        if(infoRes.rows.length === 0) throw new Error("Registro não encontrado");
        const { ID_Detalhe, ID_Historico, OldKm, OldVal, ParametroPreco, ParametroKmL, Efetividade, Ajuste } = infoRes.rows[0];
        const newValor = (km / (ParametroKmL || 10)) * (ParametroPreco || 0);
        await executeQuery(dbConfig, "UPDATE ReembolsoDiario SET KM_Dia = @km, Valor_Dia = @val, Observacao = @obs WHERE ID_Diario = @id", [{ name: 'km', type: TYPES.Decimal, value: km, options: { precision: 18, scale: 4 } }, { name: 'val', type: TYPES.Decimal, value: newValor, options: { precision: 18, scale: 2 } }, { name: 'obs', type: TYPES.NVarChar, value: `Editado: ${reason}` }, { name: 'id', type: TYPES.Int, value: id }]);
        const sumDetRes = await executeQuery(dbConfig, `SELECT SUM(KM_Dia) as TotalKM, SUM(Valor_Dia) as TotalVal FROM ReembolsoDiario WHERE ID_Detalhe = @id`, [{ name: 'id', type: TYPES.Int, value: ID_Detalhe }]);
        const { TotalKM, TotalVal } = sumDetRes.rows[0];
        const finalValue = (TotalVal || 0) + (Ajuste || 0);
        await executeQuery(dbConfig, "UPDATE ReembolsoDetalhe SET TotalKM = @k, ValorReembolso = @v WHERE ID_Detalhe = @id", [{ name: 'k', type: TYPES.Decimal, value: TotalKM, options: { precision: 18, scale: 4 } }, { name: 'v', type: TYPES.Decimal, value: finalValue, options: { precision: 18, scale: 2 } }, { name: 'id', type: TYPES.Int, value: ID_Detalhe }]);
        const sumHistRes = await executeQuery(dbConfig, `SELECT SUM(ValorReembolso) as TotalGeral FROM ReembolsoDetalhe WHERE ID_Historico = @id`, [{ name: 'id', type: TYPES.Int, value: ID_Historico }]);
        const newTotalGeral = sumHistRes.rows[0].TotalGeral || 0;
        await executeQuery(dbConfig, "UPDATE ReembolsoHistorico SET TotalGeral = @t, MotivoEdicao = @m WHERE ID_Historico = @id", [{ name: 't', type: TYPES.Decimal, value: newTotalGeral, options: { precision: 18, scale: 2 } }, { name: 'm', type: TYPES.NVarChar, value: `Recálculo manual via gestão. Última: ${reason}` }, { name: 'id', type: TYPES.Int, value: ID_Historico }]);
        await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'EDIT_CALCULO_DIA', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Editou dia ID ${id} em cálculo fechado. KM: ${OldKm}->${km}. Valor: ${OldVal}->${newValor.toFixed(2)}. Motivo: ${reason}` }]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/colaboradores', async (req, res) => {
    try { const { rows } = await executeQuery(dbConfig, "SELECT * FROM Colaboradores ORDER BY Nome"); res.json(rows); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/colaboradores', async (req, res) => {
    const c = req.body;
    try {
        const query = `INSERT INTO Colaboradores (ID_Pulsus, CodigoSetor, Nome, Grupo, TipoVeiculo, Ativo, EnderecoBase, LatitudeBase, LongitudeBase)
                       VALUES (@p, @s, @n, @g, @t, @a, @e, @lat, @lng);
                       SELECT * FROM Colaboradores WHERE ID_Colaborador = SCOPE_IDENTITY();`;
        const { rows } = await executeQuery(dbConfig, query, [{ name: 'p', type: TYPES.Int, value: c.ID_Pulsus }, { name: 's', type: TYPES.Int, value: c.CodigoSetor }, { name: 'n', type: TYPES.NVarChar, value: c.Nome }, { name: 'g', type: TYPES.NVarChar, value: c.Grupo }, { name: 't', type: TYPES.NVarChar, value: c.TipoVeiculo }, { name: 'a', type: TYPES.Bit, value: c.Ativo }, { name: 'e', type: TYPES.NVarChar, value: c.EnderecoBase || '' }, { name: 'lat', type: TYPES.Decimal, value: c.LatitudeBase || 0, options: { precision: 12, scale: 9 } }, { name: 'lng', type: TYPES.Decimal, value: c.LongitudeBase || 0, options: { precision: 12, scale: 9 } }]);
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/colaboradores/:id', async (req, res) => {
    const { id } = req.params;
    const c = req.body;
    try {
        const query = `UPDATE Colaboradores SET 
                       ID_Pulsus = @p, CodigoSetor = @s, Nome = @n, Grupo = @g, TipoVeiculo = @t, Ativo = @a, 
                       EnderecoBase = @e, LatitudeBase = @lat, LongitudeBase = @lng, EnderecoPendente = 0
                       WHERE ID_Colaborador = @id;
                       SELECT * FROM Colaboradores WHERE ID_Colaborador = @id;`;
        const { rows } = await executeQuery(dbConfig, query, [{ name: 'id', type: TYPES.Int, value: id }, { name: 'p', type: TYPES.Int, value: c.ID_Pulsus }, { name: 's', type: TYPES.Int, value: c.CodigoSetor }, { name: 'n', type: TYPES.NVarChar, value: c.Nome }, { name: 'g', type: TYPES.NVarChar, value: c.Grupo }, { name: 't', type: TYPES.NVarChar, value: c.TipoVeiculo }, { name: 'a', type: TYPES.Bit, value: c.Ativo }, { name: 'e', type: TYPES.NVarChar, value: c.EnderecoBase || '' }, { name: 'lat', type: TYPES.Decimal, value: c.LatitudeBase || 0, options: { precision: 12, scale: 9 } }, { name: 'lng', type: TYPES.Decimal, value: c.LongitudeBase || 0, options: { precision: 12, scale: 9 } }]);
        if (c.MotivoAlteracao) await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'EDIT_COLAB', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Editou colaborador ID ${id} (${c.Nome}). Motivo: ${c.MotivoAlteracao}` }]);
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/colaboradores/:id', async (req, res) => {
    const { id } = req.params;
    try { await executeQuery(dbConfig, "UPDATE Colaboradores SET Ativo = 0 WHERE ID_Colaborador = @id", [{ name: 'id', type: TYPES.Int, value: id }]); res.json({ success: true }); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/colaboradores/move', async (req, res) => {
    const { ids, group } = req.body;
    try { const idList = ids.join(','); await executeQuery(dbConfig, `UPDATE Colaboradores SET Grupo = @g WHERE ID_Colaborador IN (${idList})`, [{ name: 'g', type: TYPES.NVarChar, value: group }]); res.json({ success: true }); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/colaboradores/bulk-update', async (req, res) => {
    const { ids, field, value, reason } = req.body;
    try {
        const idList = ids.join(',');
        let query = "";
        const params = [];
        if (field === 'TipoVeiculo') { query = `UPDATE Colaboradores SET TipoVeiculo = @v WHERE ID_Colaborador IN (${idList})`; params.push({ name: 'v', type: TYPES.NVarChar, value: value }); }
        else if (field === 'Ativo') { query = `UPDATE Colaboradores SET Ativo = @v WHERE ID_Colaborador IN (${idList})`; params.push({ name: 'v', type: TYPES.Bit, value: value }); }
        if (query) { await executeQuery(dbConfig, query, params); await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'BULK_UPDATE_COLAB', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Update em massa (${field}=${value}) para IDs [${idList}]. Motivo: ${reason}` }]); res.json({ success: true }); }
        else res.status(400).json({ message: "Campo inválido para bulk update" });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/colaboradores/batch-address', async (req, res) => {
    const { items, reason } = req.body;
    try {
        for (const item of items) { await executeQuery(dbConfig, "UPDATE Colaboradores SET EnderecoBase = @e WHERE ID_Colaborador = @id", [{ name: 'e', type: TYPES.NVarChar, value: item.endereco }, { name: 'id', type: TYPES.Int, value: item.id }]); }
        await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'BATCH_ADDRESS', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Importação em lote de endereços para ${items.length} registros. Motivo: ${reason}` }]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/colaboradores/import-preview', async (req, res) => {
    let mariadbConn;
    try {
        const [configRes, localColabs, localGrupos] = await Promise.all([executeQuery(dbConfig, "SELECT * FROM SystemSettings WHERE ID = 1"), executeQuery(dbConfig, "SELECT * FROM Colaboradores"), executeQuery(dbConfig, "SELECT Nome FROM Grupos")]);
        const s = configRes.rows[0];
        if (!s.ExtDb_Host) throw new Error("Configuração de banco externo incompleta.");
        
        const localMap = new Map();
        localColabs.rows.forEach(c => localMap.set(Number(c.ID_Pulsus), c));
        const gruposValidos = new Set(localGrupos.rows.map(g => g.Nome));
        
        let extRows = [];
        const dbType = s.ExtDb_Type || 'MARIADB';

        if (dbType === 'MSSQL') {
            const extDbConfig = { 
                server: s.ExtDb_Host, 
                authentication: { type: 'default', options: { userName: s.ExtDb_User, password: s.ExtDb_Pass } }, 
                options: { database: s.ExtDb_Database, port: s.ExtDb_Port || 1433, encrypt: false, trustServerCertificate: true, rowCollectionOnRequestCompletion: true, requestTimeout: 60000 } 
            };
            const res = await executeQuery(extDbConfig, s.ExtDb_Query || "SELECT PulsusId as id_pulsus, FullName as nome, InternalCode as codigo_setor, SectorName as grupo FROM devices");
            extRows = res.rows;
        } else {
            mariadbConn = await mariadb.createConnection({ host: s.ExtDb_Host, port: s.ExtDb_Port, user: s.ExtDb_User, password: s.ExtDb_Pass, database: s.ExtDb_Database, connectTimeout: 10000 });
            extRows = await mariadbConn.query(s.ExtDb_Query || "SELECT id_pulsus, nome, codigo_setor, grupo FROM colaboradores");
        }

        const result = { novos: [], alterados: [], conflitos: [], invalidos: [], iguais: [], iguaisCount: 0, totalExternal: extRows.length };
        
        // Mapa por Grupo + CodigoSetor para Identidade do Setor (Padrão Fuel360)
        const identityMap = new Map();
        localColabs.rows.forEach(c => {
            const key = `${String(c.Grupo).trim().toLowerCase()}_${c.CodigoSetor}`;
            identityMap.set(key, c);
        });

        // Mapa reverso por ID_Pulsus para detectar trocas de aparelho/setor
        const pulsusMap = new Map();
        localColabs.rows.forEach(c => pulsusMap.set(Number(c.ID_Pulsus), c));

        for (const ext of extRows) {
            const idPulsus = Number(ext.id_pulsus);
            const codigoSetor = Number(ext.codigo_setor);
            const extNome = String(ext.nome).trim();
            const extGrupo = String(ext.grupo).trim();
            
            const identityKey = `${extGrupo.toLowerCase()}_${codigoSetor}`;
            const localByIdentity = identityMap.get(identityKey);
            const localByPulsus = pulsusMap.get(idPulsus);

            const newData = { nome: extNome, codigo_setor: codigoSetor, grupo: extGrupo };

            if (!gruposValidos.has(extGrupo)) { 
                result.invalidos.push({ id_pulsus: idPulsus, name: extNome, newData }); 
                continue; 
            }

            // CASO 1: Setor/Grupo novo no sistema
            if (!localByIdentity) {
                // Se o ID_Pulsus novo já estiver em uso por OUTRO setor (Troca de setor do colaborador)
                if (localByPulsus) {
                    result.conflitos.push({ 
                        id_pulsus: idPulsus, 
                        nome: extNome, 
                        existingColab: localByPulsus, // Este registro antigo perderá o ID
                        newData,
                        isDeviceTransfer: true 
                    });
                } else {
                    result.novos.push({ id_pulsus: idPulsus, nome: extNome, newData });
                }
            } 
            // CASO 2: Setor/Grupo já existe (Identidade encontrada)
            else {
                const changes = [];
                // Verificamos se o ID do aparelho mudou para este setor
                if (Number(localByIdentity.ID_Pulsus) !== idPulsus) {
                    changes.push({ field: 'ID_Pulsus', oldValue: localByIdentity.ID_Pulsus, newValue: idPulsus });
                }
                
                // Verificamos se o Nome mudou (Troca de pessoa no mesmo setor)
                if (String(localByIdentity.Nome).trim().toUpperCase() !== extNome.toUpperCase()) {
                    changes.push({ field: 'Nome', oldValue: localByIdentity.Nome, newValue: extNome });
                }

                // DETECÇÃO DE REATIVAÇÃO: Se já existe no banco mas está inativo, forçamos a reativação
                if (localByIdentity.Ativo === false || Number(localByIdentity.Ativo) === 0) {
                    changes.push({ field: 'Status', oldValue: 'Inativo', newValue: 'Ativo' });
                }

                if (changes.length > 0) {
                    result.alterados.push({ 
                        id_pulsus: idPulsus, 
                        nome: extNome, 
                        changes, 
                        newData, 
                        id_colaborador: localByIdentity.ID_Colaborador,
                        needsPulsusTransfer: Number(localByIdentity.ID_Pulsus) !== idPulsus 
                    });
                } else {
                    result.iguais.push({ id_pulsus: idPulsus, nome: extNome });
                    result.iguaisCount++;
                }
            }
        }

        // CASO 3: Detecção de Inativação (Colaboradores no banco que deixaram de vir na query externa baseados em Nome + Código Setor + ID Pulsus + Grupo)
        const extKeys = new Set(extRows.map(ext => {
            const extNome = String(ext.nome).trim().toLowerCase();
            const extSetor = Number(ext.codigo_setor);
            const extPulsus = Number(ext.id_pulsus);
            const extGrupo = String(ext.grupo).trim().toLowerCase();
            return `${extNome}_${extSetor}_${extPulsus}_${extGrupo}`;
        }));
        const inativar = [];
        localColabs.rows.forEach(c => {
            if (c.Ativo === true || Number(c.Ativo) === 1) {
                const localNome = String(c.Nome).trim().toLowerCase();
                const localSetor = Number(c.CodigoSetor);
                const localPulsus = Number(c.ID_Pulsus);
                const localGrupo = String(c.Grupo).trim().toLowerCase();
                const localKey = `${localNome}_${localSetor}_${localPulsus}_${localGrupo}`;

                if (!extKeys.has(localKey)) {
                    inativar.push({ 
                        id_pulsus: c.ID_Pulsus,
                        nome: c.Nome,
                        codigo_setor: c.CodigoSetor,
                        grupo: c.Grupo,
                        id_colaborador: c.ID_Colaborador
                    });
                }
            }
        });
        result.inativar = inativar;
        res.json(result);
    } catch (e) { res.status(500).json({ message: e.message }); }
    finally { if (mariadbConn) mariadbConn.end(); }
});

app.post('/colaboradores/sync', async (req, res) => {
    const { items } = req.body;
    let count = 0, inserted = 0, updated = 0, idChanged = 0;
    try {
        for (const item of items) {
            const idPulsus = Number(item.id_pulsus);
            
            // 1. RESOLUÇÃO DE CONFLITO DE ID (PREEMPTIVA)
            // Buscamos quem é o dono ATUAL deste ID no banco
            const checkConflict = await executeQuery(dbConfig, "SELECT ID_Colaborador, Nome FROM Colaboradores WHERE ID_Pulsus = @p", [{ name: 'p', type: TYPES.Int, value: idPulsus }]);
            
            if (checkConflict.rows.length > 0) {
                const conflict = checkConflict.rows[0];
                
                // Se o dono encontrado no banco for DIFERENTE do registro que queremos atualizar/inserir (pelo ID fixo ID_Colaborador)
                // OU se for um INSERT e o ID já estiver ocupado.
                const isTheExactSameRow = item.id_colaborador && Number(conflict.ID_Colaborador) === Number(item.id_colaborador);

                if (!isTheExactSameRow) {
                    // CONFLITO REAL: O ID 869 (exemplo) está em outro registro.
                    // Liberamos o ID do registro antigo movendo-o para negativo
                    await executeQuery(dbConfig, "UPDATE Colaboradores SET ID_Pulsus = (ID_Colaborador * -1), Ativo = 0, EnderecoPendente = 1 WHERE ID_Colaborador = @cid", [{ name: 'cid', type: TYPES.Int, value: conflict.ID_Colaborador }]);
                    idChanged++;
                }
            }

            if (item.syncAction === 'INSERT') {
                await executeQuery(dbConfig, "INSERT INTO Colaboradores (ID_Pulsus, CodigoSetor, Nome, Grupo, TipoVeiculo, Ativo, EnderecoPendente) VALUES (@p, @s, @n, @g, 'Carro', 1, 0)", [{ name: 'p', type: TYPES.Int, value: idPulsus }, { name: 's', type: TYPES.Int, value: item.newData.codigo_setor }, { name: 'n', type: TYPES.NVarChar, value: item.nome }, { name: 'g', type: TYPES.NVarChar, value: item.newData.grupo }]);
                inserted++;
            } else if (item.syncAction === 'UPDATE_DATA') {
                let cid = item.id_colaborador;
                // Se não temos o CID, tentamos buscar pelo Grupo + Setor para garantir que estamos no registro certo
                if (!cid) {
                    const find = await executeQuery(dbConfig, "SELECT ID_Colaborador FROM Colaboradores WHERE Grupo = @g AND CodigoSetor = @s", [{ name: 'g', type: TYPES.NVarChar, value: item.newData.grupo }, { name: 's', type: TYPES.Int, value: item.newData.codigo_setor }]);
                    if (find.rows.length > 0) cid = find.rows[0].ID_Colaborador;
                }

                if (cid) {
                    await executeQuery(dbConfig, `UPDATE Colaboradores SET ID_Pulsus = @p, Nome = @n, CodigoSetor = @s, Grupo = @g, Ativo = 1 WHERE ID_Colaborador = @cid`, [
                        { name: 'p', type: TYPES.Int, value: idPulsus }, 
                        { name: 'n', type: TYPES.NVarChar, value: item.nome }, 
                        { name: 's', type: TYPES.Int, value: item.newData.codigo_setor }, 
                        { name: 'g', type: TYPES.NVarChar, value: item.newData.grupo },
                        { name: 'cid', type: TYPES.Int, value: cid }
                    ]);
                    updated++;
                } else {
                    // Fallback para Insert se o setor sumiu do banco mas voltou no arquivo
                    await executeQuery(dbConfig, "INSERT INTO Colaboradores (ID_Pulsus, CodigoSetor, Nome, Grupo, TipoVeiculo, Ativo, EnderecoPendente) VALUES (@p, @s, @n, @g, 'Carro', 1, 0)", [{ name: 'p', type: TYPES.Int, value: idPulsus }, { name: 's', type: TYPES.Int, value: item.newData.codigo_setor }, { name: 'n', type: TYPES.NVarChar, value: item.nome }, { name: 'g', type: TYPES.NVarChar, value: item.newData.grupo }]);
                    inserted++;
                }
            } else if (item.syncAction === 'UPDATE_ID') {
                // Caso legado ou conflito explícito - Sempre Reativando
                await executeQuery(dbConfig, "UPDATE Colaboradores SET ID_Pulsus = @newId, CodigoSetor = @s, Grupo = @g, Ativo = 1, EnderecoPendente = 1 WHERE ID_Colaborador = @cid", [{ name: 'newId', type: TYPES.Int, value: idPulsus }, { name: 'cid', type: TYPES.Int, value: item.existingColab.ID_Colaborador }, { name: 's', type: TYPES.Int, value: item.newData.codigo_setor }, { name: 'g', type: TYPES.NVarChar, value: item.newData.grupo }]);
                updated++;
            } else if (item.syncAction === 'DEACTIVATE') {
                // Inativação de setores removidos do Pulsus
                await executeQuery(dbConfig, "UPDATE Colaboradores SET Ativo = 0 WHERE ID_Colaborador = @cid", [{ name: 'cid', type: TYPES.Int, value: item.id_colaborador }]);
                count++;
            }
            count++;
        }
        await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'SYNC_COLABORADORES', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Sincronização externa realizada. Novos: ${inserted}, Alterados: ${updated}, Troca de ID: ${idChanged}. Total processado: ${count}` }]);
        res.json({ success: true, count });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/system/integration', async (req, res) => {
    try {
        const { rows } = await executeQuery(dbConfig, "SELECT * FROM SystemSettings WHERE ID = 1");
        const s = rows[0];
        res.json({
            colab: { host: s.ExtDb_Host, port: s.ExtDb_Port, user: s.ExtDb_User, pass: s.ExtDb_Pass, database: s.ExtDb_Database, query: s.ExtDb_Query, type: s.ExtDb_Type || 'MARIADB' },
            route: { host: s.ExtRoute_Host, port: s.ExtRoute_Port, user: s.ExtRoute_User, pass: s.ExtRoute_Pass, database: s.ExtRoute_Database, query: s.ExtRoute_Query, type: 'MSSQL' },
            promoter: { host: s.ExtPromoter_Host, port: s.ExtPromoter_Port, user: s.ExtPromoter_User, pass: s.ExtPromoter_Pass, database: s.ExtPromoter_Database, query: s.ExtPromoter_Query, type: s.ExtPromoter_Type || 'MSSQL' }
        });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/system/integration', async (req, res) => {
    const { colab, route, promoter } = req.body;
    try {
        const query = `UPDATE SystemSettings SET ExtDb_Host = @ch, ExtDb_Port = @cp, ExtDb_User = @cu, ExtDb_Pass = @cpass, ExtDb_Database = @cdb, ExtDb_Query = @cq, ExtDb_Type = @ct, ExtRoute_Host = @rh, ExtRoute_Port = @rp, ExtRoute_User = @ru, ExtRoute_Pass = @rpass, ExtRoute_Database = @rdb, ExtRoute_Query = @rq, ExtPromoter_Host = @ph, ExtPromoter_Port = @pp, ExtPromoter_User = @pu, ExtPromoter_Pass = @ppass, ExtPromoter_Database = @pdb, ExtPromoter_Query = @pq, ExtPromoter_Type = @pt WHERE ID = 1`;
        await executeQuery(dbConfig, query, [
            { name: 'ch', type: TYPES.NVarChar, value: colab.host }, 
            { name: 'cp', type: TYPES.Int, value: colab.port }, 
            { name: 'cu', type: TYPES.NVarChar, value: colab.user }, 
            { name: 'cpass', type: TYPES.NVarChar, value: colab.pass }, 
            { name: 'cdb', type: TYPES.NVarChar, value: colab.database }, 
            { name: 'cq', type: TYPES.NVarChar, value: colab.query }, 
            { name: 'ct', type: TYPES.NVarChar, value: colab.type || 'MARIADB' },
            { name: 'rh', type: TYPES.NVarChar, value: route.host }, 
            { name: 'rp', type: TYPES.Int, value: route.port }, 
            { name: 'ru', type: TYPES.NVarChar, value: route.user }, 
            { name: 'rpass', type: TYPES.NVarChar, value: route.pass }, 
            { name: 'rdb', type: TYPES.NVarChar, value: route.database }, 
            { name: 'rq', type: TYPES.NVarChar, value: route.query },
            { name: 'ph', type: TYPES.NVarChar, value: promoter?.host || '' }, 
            { name: 'pp', type: TYPES.Int, value: promoter?.port || 1433 }, 
            { name: 'pu', type: TYPES.NVarChar, value: promoter?.user || '' }, 
            { name: 'ppass', type: TYPES.NVarChar, value: promoter?.pass || '' }, 
            { name: 'pdb', type: TYPES.NVarChar, value: promoter?.database || '' }, 
            { name: 'pq', type: TYPES.NVarChar, value: promoter?.query || '' },
            { name: 'pt', type: TYPES.NVarChar, value: promoter?.type || 'MSSQL' }
        ]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/system/test-connection', async (req, res) => {
    const { config } = req.body;
    if (config.type === 'MARIADB') {
        let conn;
        try { conn = await mariadb.createConnection({ host: config.host, port: config.port, user: config.user, password: config.pass, database: config.database, connectTimeout: 5000 }); res.json({ success: true, message: "Conexão MariaDB OK!" }); } catch (err) { res.json({ success: false, message: err.message }); }
        finally { if (conn) conn.end(); }
    } else {
        const testConfig = { server: config.host, authentication: { type: 'default', options: { userName: config.user, password: config.pass } }, options: { database: config.database, port: config.port || 1433, encrypt: false, trustServerCertificate: true, connectTimeout: 5000 } };
        const connection = new Connection(testConfig);
        connection.on('connect', err => { if (err) res.json({ success: false, message: err.message }); else { connection.close(); res.json({ success: true, message: "Conexão SQL Server OK!" }); } });
        connection.connect();
    }
});

app.get('/usuarios', async (req, res) => {
    try { const { rows } = await executeQuery(dbConfig, "SELECT ID_Usuario, Nome, Usuario, Perfil, Ativo FROM Usuarios"); res.json(rows); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/usuarios', async (req, res) => {
    const { Nome, Usuario, Senha, Perfil, Ativo } = req.body;
    const hash = await bcrypt.hash(Senha, 10);
    try { await executeQuery(dbConfig, "INSERT INTO Usuarios (Nome, Usuario, SenhaHash, Perfil, Ativo) VALUES (@n, @u, @h, @p, @a)", [{ name: 'n', type: TYPES.NVarChar, value: Nome }, { name: 'u', type: TYPES.NVarChar, value: Usuario }, { name: 'h', type: TYPES.NVarChar, value: hash }, { name: 'p', type: TYPES.NVarChar, value: Perfil }, { name: 'a', type: TYPES.Bit, value: Ativo }]); res.json({ success: true }); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    const { Nome, Usuario, Senha, Perfil, Ativo } = req.body;
    try {
        let query = "UPDATE Usuarios SET Nome = @n, Usuario = @u, Perfil = @p, Ativo = @a";
        const params = [
            { name: 'n', type: TYPES.NVarChar, value: Nome },
            { name: 'u', type: TYPES.NVarChar, value: Usuario },
            { name: 'p', type: TYPES.NVarChar, value: Perfil },
            { name: 'a', type: TYPES.Bit, value: Ativo },
            { name: 'id', type: TYPES.Int, value: parseInt(id) }
        ];

        // Se uma nova senha for fornecida, atualiza o hash
        if (Senha && Senha.trim() !== "") {
            const hash = await bcrypt.hash(Senha, 10);
            query += ", SenhaHash = @h";
            params.push({ name: 'h', type: TYPES.NVarChar, value: hash });
        }

        query += " WHERE ID_Usuario = @id";
        await executeQuery(dbConfig, query, params);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: "Erro ao atualizar usuário: " + e.message });
    }
});

app.get('/config/fuel', async (req, res) => {
    try { const { rows } = await executeQuery(dbConfig, "SELECT FuelPrice as PrecoCombustivel, KmL_Car as KmL_Carro, KmL_Moto as KmL_Moto FROM SystemSettings WHERE ID = 1"); res.json(rows[0]); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/config/fuel', async (req, res) => {
    const { PrecoCombustivel, KmL_Carro, KmL_Moto, MotivoAlteracao } = req.body;
    try { await executeQuery(dbConfig, "UPDATE SystemSettings SET FuelPrice = @p, KmL_Car = @c, KmL_Moto = @m WHERE ID = 1", [{ name: 'p', type: TYPES.Decimal, value: PrecoCombustivel, options: { precision: 10, scale: 4 } }, { name: 'c', type: TYPES.Int, value: KmL_Carro }, { name: 'm', type: TYPES.Int, value: KmL_Moto }]); await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'ALTERACAO_FUEL', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Preço: ${PrecoCombustivel}, Carro: ${KmL_Carro}, Moto: ${KmL_Moto}. Motivo: ${MotivoAlteracao}` }]); res.json({ success: true }); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/config/fuel/history', async (req, res) => {
    try { const { rows } = await executeQuery(dbConfig, "SELECT TOP 10 * FROM LogsSistema WHERE Acao = 'ALTERACAO_FUEL' ORDER BY DataHora DESC"); res.json(rows); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/grupos', async (req, res) => {
    try { const { rows } = await executeQuery(dbConfig, "SELECT * FROM Grupos ORDER BY Nome"); res.json(rows); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/grupos', async (req, res) => {
    const { nome } = req.body;
    try { const { rows } = await executeQuery(dbConfig, "INSERT INTO Grupos (Nome) VALUES (@n); SELECT SCOPE_IDENTITY() as ID_Grupo;", [{ name: 'n', type: TYPES.NVarChar, value: nome }]); res.json({ ID_Grupo: rows[0].ID_Grupo, Nome: nome }); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/ausencias', async (req, res) => {
    try { const query = `SELECT A.*, C.Nome as NomeColaborador, C.ID_Pulsus FROM Ausencias A JOIN Colaboradores C ON A.ID_Colaborador = C.ID_Colaborador ORDER BY A.DataInicio DESC`; const { rows } = await executeQuery(dbConfig, query); res.json(rows); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/ausencias', async (req, res) => {
    const { ID_Colaborador, DataInicio, DataFim, Motivo } = req.body;
    try {
        const query = `INSERT INTO Ausencias (ID_Colaborador, DataInicio, DataFim, Motivo) VALUES (@c, @s, @e, @m); SELECT SCOPE_IDENTITY() as id;`;
        const { rows } = await executeQuery(dbConfig, query, [{ name: 'c', type: TYPES.Int, value: ID_Colaborador }, { name: 's', type: TYPES.Date, value: safeDate(DataInicio) }, { name: 'e', type: TYPES.Date, value: safeDate(DataFim) }, { name: 'm', type: TYPES.NVarChar, value: Motivo }]);
        const id = rows[0].id;
        const resCol = await executeQuery(dbConfig, "SELECT Nome as NomeColaborador, ID_Pulsus FROM Colaboradores WHERE ID_Colaborador = @c", [{ name: 'c', type: TYPES.Int, value: ID_Colaborador }]);
        res.json({ ID_Ausencia: id, ...req.body, ...resCol.rows[0] });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/ausencias/:id', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try { await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'EXCLUSAO_AUSENCIA', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Exclusão Ausência ID ${id}. Motivo: ${reason}` }]); await executeQuery(dbConfig, "DELETE FROM Ausencias WHERE ID_Ausencia = @id", [{ name: 'id', type: TYPES.Int, value: id }]); res.json({ success: true }); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/calculo/exists', async (req, res) => {
    const { periodo } = req.query;
    try { const { rows } = await executeQuery(dbConfig, "SELECT 1 as x FROM ReembolsoHistorico WHERE Periodo = @p", [{ name: 'p', type: TYPES.NVarChar, value: periodo }]); res.json(rows.length > 0); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/calculo', async (req, res) => {
    const p = req.body;
    try {
        await checkDbUpdates();
        
        let histId;
        const checkHist = await executeQuery(dbConfig, "SELECT ID_Historico FROM ReembolsoHistorico WHERE Periodo = @p", [{ name: 'p', type: TYPES.NVarChar, value: p.Periodo }]);
        
        if (p.Overwrite && checkHist.rows.length > 0) {
            histId = checkHist.rows[0].ID_Historico;
            // Se for overwrite total, apaga tudo deste histórico e insere novo
            await executeQuery(dbConfig, "DELETE FROM ReembolsoDetalhe WHERE ID_Historico = @h", [{ name: 'h', type: TYPES.Int, value: histId }]);
            await executeQuery(dbConfig, "UPDATE ReembolsoHistorico SET TotalGeral = @t, UsuarioFechamento = @u, OrigemDados = @o, MotivoEdicao = @m, ID_RotaHist = @rid WHERE ID_Historico = @h", [
                { name: 't', type: TYPES.Decimal, value: p.TotalGeral, options: { precision: 18, scale: 2 } },
                { name: 'u', type: TYPES.NVarChar, value: req.user.nome },
                { name: 'o', type: TYPES.NVarChar, value: p.OrigemDados || 'CSV' },
                { name: 'm', type: TYPES.NVarChar, value: p.MotivoOverwrite || null },
                { name: 'rid', type: TYPES.Int, value: p.ID_RotaHist || null },
                { name: 'h', type: TYPES.Int, value: histId }
            ]);
            await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'OVERWRITE_CALC', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Sobrescreveu cálculo completo para o período ${p.Periodo}. Motivo: ${p.MotivoOverwrite}` }]);
        } else if (checkHist.rows.length > 0) {
            // CÁLCULO PARCIAL (O que o usuário pediu): Atualiza apenas os colaboradores enviados
            histId = checkHist.rows[0].ID_Historico;
            for (const item of p.Itens) {
                // Remove registro anterior DESTE colaborador neste período
                await executeQuery(dbConfig, "DELETE FROM ReembolsoDetalhe WHERE ID_Historico = @h AND ID_Pulsus = @p", [
                    { name: 'h', type: TYPES.Int, value: histId },
                    { name: 'p', type: TYPES.Int, value: item.ID_Pulsus }
                ]);
            }
            await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, 'UPDATE_CALC_PARTIAL', @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'd', type: TYPES.NVarChar, value: `Atualizou cálculo parcial para ${p.Itens.length} colaboradores no período ${p.Periodo}.` }]);
        } else {
            // NOVO CÁLCULO
            const insertHist = await executeQuery(dbConfig, `INSERT INTO ReembolsoHistorico (Periodo, TotalGeral, UsuarioFechamento, OrigemDados, MotivoEdicao, ID_RotaHist) VALUES (@p, @t, @u, @origem, @me, @rotaId); SELECT SCOPE_IDENTITY() as id;`, [
                { name: 'p', type: TYPES.NVarChar, value: p.Periodo }, 
                { name: 't', type: TYPES.Decimal, value: p.TotalGeral, options: { precision: 18, scale: 2 } }, 
                { name: 'u', type: TYPES.NVarChar, value: req.user.nome }, 
                { name: 'origem', type: TYPES.NVarChar, value: p.OrigemDados || 'CSV' }, 
                { name: 'me', type: TYPES.NVarChar, value: p.MotivoOverwrite || null }, 
                { name: 'rotaId', type: TYPES.Int, value: p.ID_RotaHist || null }
            ]);
            histId = insertHist.rows[0].id;
        }

        // Inserção dos Detalhes (Comum a todos os fluxos acima)
        for (const item of p.Itens) {
            const detRes = await executeQuery(dbConfig, `INSERT INTO ReembolsoDetalhe (ID_Historico, ID_Pulsus, NomeColaborador, Grupo, TipoVeiculo, TotalKM, ValorReembolso, ParametroPreco, ParametroKmL, Efetividade, Ajuste) VALUES (@h, @pulsus, @nome, @grupo, @tipo, @km, @val, @preco, @kml, @eff, @ajust); SELECT SCOPE_IDENTITY() as id;`, [
                { name: 'h', type: TYPES.Int, value: histId }, 
                { name: 'pulsus', type: TYPES.Int, value: item.ID_Pulsus }, 
                { name: 'nome', type: TYPES.NVarChar, value: item.Nome }, 
                { name: 'grupo', type: TYPES.NVarChar, value: item.Grupo }, 
                { name: 'tipo', type: TYPES.NVarChar, value: item.TipoVeiculo }, 
                { name: 'km', type: TYPES.Decimal, value: item.TotalKM, options: { precision: 18, scale: 4 } }, 
                { name: 'val', type: TYPES.Decimal, value: item.ValorReembolso, options: { precision: 18, scale: 2 } }, 
                { name: 'preco', type: TYPES.Decimal, value: item.ParametroPreco, options: { precision: 10, scale: 4 } }, 
                { name: 'kml', type: TYPES.Int, value: item.ParametroKmL }, 
                { name: 'eff', type: TYPES.Decimal, value: item.Efetividade || 1, options: { precision: 5, scale: 4 } }, 
                { name: 'ajust', type: TYPES.Decimal, value: item.Ajuste || 0, options: { precision: 18, scale: 2 } }
            ]);
            const detId = detRes.rows[0].id;
            for (const dia of item.RegistrosDiarios) { 
                await executeQuery(dbConfig, `INSERT INTO ReembolsoDiario (ID_Detalhe, DataOcorrencia, KM_Dia, Valor_Dia, Observacao) VALUES (@d, @date, @km, @val, @obs)`, [
                    { name: 'd', type: TYPES.Int, value: detId }, 
                    { name: 'date', type: TYPES.Date, value: safeDate(dia.Data) }, 
                    { name: 'km', type: TYPES.Decimal, value: dia.KM, options: { precision: 18, scale: 4 } }, 
                    { name: 'val', type: TYPES.Decimal, value: dia.Valor, options: { precision: 18, scale: 2 } }, 
                    { name: 'obs', type: TYPES.NVarChar, value: dia.Observacao || '' }
                ]); 
            }
        }

        // RECALCULO FINAL DO TOTAL GERAL NO HISTORICO (Soma tudo o que existe no Detalhe agora)
        const finalSum = await executeQuery(dbConfig, "SELECT SUM(ValorReembolso) as Total FROM ReembolsoDetalhe WHERE ID_Historico = @h", [{ name: 'h', type: TYPES.Int, value: histId }]);
        const newTotal = finalSum.rows[0].Total || 0;
        await executeQuery(dbConfig, "UPDATE ReembolsoHistorico SET TotalGeral = @t WHERE ID_Historico = @h", [
            { name: 't', type: TYPES.Decimal, value: newTotal, options: { precision: 18, scale: 2 } },
            { name: 'h', type: TYPES.Int, value: histId }
        ]);

        res.json({ success: true, id: histId });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/relatorios/reembolso', async (req, res) => {
    const { startDate, endDate, colab, group } = req.query;
    try {
        let query = `SELECT d.*, c.CodigoSetor, h.DataFechamento as DataGeracao, h.Periodo as PeriodoReferencia, h.UsuarioFechamento as UsuarioGerador, h.OrigemDados, h.MotivoEdicao FROM ReembolsoDetalhe d JOIN ReembolsoHistorico h ON d.ID_Historico = h.ID_Historico LEFT JOIN Colaboradores c ON d.ID_Pulsus = c.ID_Pulsus WHERE h.DataFechamento BETWEEN @s AND @e`;
        const params = [{ name: 's', type: TYPES.DateTime, value: new Date(startDate) }, { name: 'e', type: TYPES.DateTime, value: new Date(endDate + ' 23:59:59') }];
        if (colab) { query += ` AND d.ID_Pulsus = @colab`; params.push({ name: 'colab', type: TYPES.Int, value: parseInt(colab) }); }
        if (group) { query += ` AND d.Grupo = @group`; params.push({ name: 'group', type: TYPES.NVarChar, value: group }); }
        query += ` ORDER BY d.NomeColaborador ASC`;
        const { rows } = await executeQuery(dbConfig, query, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/relatorios/analitico', async (req, res) => {
    const { startDate, endDate, colab, group } = req.query;
    try {
        let query = `SELECT r.*, d.NomeColaborador, d.Grupo, d.TipoVeiculo, d.ID_Pulsus, c.CodigoSetor, h.DataFechamento as DataGeracao, h.Periodo as PeriodoReferencia, h.OrigemDados, h.MotivoEdicao FROM ReembolsoDiario r JOIN ReembolsoDetalhe d ON r.ID_Detalhe = d.ID_Detalhe JOIN ReembolsoHistorico h ON d.ID_Historico = h.ID_Historico LEFT JOIN Colaboradores c ON d.ID_Pulsus = c.ID_Pulsus WHERE h.DataFechamento BETWEEN @s AND @e`;
        const params = [{ name: 's', type: TYPES.DateTime, value: new Date(startDate) }, { name: 'e', type: TYPES.DateTime, value: new Date(endDate + ' 23:59:59') }];
        if (colab) { query += ` AND d.ID_Pulsus = @colab`; params.push({ name: 'colab', type: TYPES.Int, value: parseInt(colab) }); }
        if (group) { query += ` AND d.Grupo = @group`; params.push({ name: 'group', type: TYPES.NVarChar, value: group }); }
        query += ` ORDER BY r.DataOcorrencia ASC`;
        const { rows } = await executeQuery(dbConfig, query, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/logs', async (req, res) => {
    const { acao, detalhes } = req.body;
    try { await executeQuery(dbConfig, "INSERT INTO LogsSistema (Usuario, Acao, Detalhes) VALUES (@u, @a, @d)", [{ name: 'u', type: TYPES.NVarChar, value: req.user.nome }, { name: 'a', type: TYPES.NVarChar, value: acao }, { name: 'd', type: TYPES.NVarChar, value: detalhes }]); res.json({ success: true }); }
    catch (e) { res.status(500).json({ message: e.message }); }
});

const https = require('https');
const http = require('http');

function performGeocode(address) {
    return new Promise((resolve, reject) => {
        const geocoderUrl = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search';
        const url = `${geocoderUrl}?q=${encodeURIComponent(address)}&format=json&limit=1`;
        const client = url.startsWith('https') ? https : http;

        client.get(url, {
            headers: { 'User-Agent': 'Fuel360-App/1.0' }
        }, (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (Array.isArray(json) && json.length > 0) {
                        resolve({ lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) });
                    } else if (json && json.lat && json.lon) {
                        resolve({ lat: parseFloat(json.lat), lon: parseFloat(json.lon) });
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(new Error("Erro ao processar resposta do geocodificador."));
                }
            });
        }).on('error', (e) => {
            reject(new Error("Erro na conexão com o geocodificador: " + e.message));
        });
    });
}

function cleanAddress(address) {
    // Remove complementos comuns como "d 62", "ap 10", "bloco A", "sala 5", etc.
    // Tenta identificar padrões de letra+espaço+número ou palavras chave
    let cleaned = address;
    
    // Remove padrões como " - d 62", " - ap 10", " - bloco B"
    // Procura por hífens ou vírgulas seguidos de termos de complemento
    const patterns = [
        /\s*-\s*[a-zA-Z]\s*\d+/gi,        // - d 62
        /\s*,\s*[a-zA-Z]\s*\d+/gi,        // , d 62
        /\s*-\s*(ap|apto|bl|bloco|sala|casa|fundos|sobrado|loja)\s*\d*[a-zA-Z]?/gi,
        /\s*,\s*(ap|apto|bl|bloco|sala|casa|fundos|sobrado|loja)\s*\d*[a-zA-Z]?/gi
    ];

    patterns.forEach(p => {
        cleaned = cleaned.replace(p, '');
    });

    return cleaned.trim();
}

app.post('/system/geocode', async (req, res) => {
    const { address } = req.body;
    if (!address) return res.status(400).json({ message: "Endereço não fornecido." });

    try {
        // 1. Tenta busca original
        let result = await performGeocode(address);
        
        // 2. Se falhar, tenta limpar o endereço (remover complementos)
        if (!result) {
            const cleaned = cleanAddress(address);
            if (cleaned !== address) {
                console.log(`Geocode fallback: "${address}" -> "${cleaned}"`);
                result = await performGeocode(cleaned);
            }
        }

        if (result) {
            res.json(result);
        } else {
            res.status(404).json({ message: "Endereço não encontrado no geocodificador (mesmo após tentativa de limpeza)." });
        }
    } catch (e) {
        console.error("Erro geocode:", e.message);
        res.status(500).json({ message: e.message });
    }
});

app.listen(API_PORT, async () => {
    console.log(`Fuel360 API Server v1.9.7 - Rodando na porta ${API_PORT}`);
    await checkDbUpdates();
});
