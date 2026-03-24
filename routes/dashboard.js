const express = require('express');
const router = express.Router();
const { sql, dbConfig } = require('./db');

router.get('/expediente-alerts', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const configRes = await pool.request().query("SELECT TOP 1 * FROM ExternalDbConfig");
        const config = configRes.recordset[0];

        if (!config || !config.Host || !config.SelectionQuery) {
            return res.json([]);
        }

        const extConfig = {
            user: config.Username,
            password: config.Password,
            server: config.Host,
            port: config.Port,
            database: config.DatabaseName,
            options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
        };

        const externalPool = await new sql.ConnectionPool(extConfig).connect();
        const result = await externalPool.request().query(config.SelectionQuery);
        await externalPool.close();

        // Buscar overrides locais
        const overridesRes = await pool.request().query("SELECT * FROM ExpedienteOverrides");
        const overridesMap = new Map();
        overridesRes.recordset.forEach(row => {
            overridesMap.set(String(row.Codigo), {
                observation: row.Observation,
                reactivationDate: row.ReactivationDate
            });
        });

        // Filtra apenas os que estão com ValidaExpediente = 0 (FALSO)
        // A query do usuário traz BOLVLAEXDEPG AS ValidaExpediente
        const alerts = result.recordset.filter(row => {
            // Aceita 0, '0', false, 'F', 'N' como falso
            const val = row.ValidaExpediente;
            return val === 0 || val === '0' || val === false || val === 'F' || val === 'N';
        }).map(row => {
            const codigoStr = String(row.Codigo);
            const override = overridesMap.get(codigoStr);
            return {
                codigo: codigoStr,
                nome: row.Nome,
                cpf: row.CPF,
                rg: row.RG,
                pis: row.PIS,
                validaExpediente: false,
                observation: override?.observation || null,
                reactivationDate: override?.reactivationDate || null
            };
        });

        res.json(alerts);
    } catch (err) {
        console.error('Erro ao buscar alertas externos:', err.message);
        res.status(500).send(err.message);
    }
});

router.post('/expediente-alerts/override', async (req, res) => {
    try {
        const { codigo, observation, reactivationDate } = req.body;
        const codigoStr = String(codigo);
        const pool = await sql.connect(dbConfig);
        
        // Verifica se já existe
        const check = await pool.request()
            .input('Codigo', sql.NVarChar, codigoStr)
            .query("SELECT Id FROM ExpedienteOverrides WHERE Codigo = @Codigo");
            
        if (check.recordset.length > 0) {
            await pool.request()
                .input('Codigo', sql.NVarChar, codigoStr)
                .input('Observation', sql.NVarChar, observation || null)
                .input('ReactivationDate', sql.DateTime, reactivationDate ? new Date(reactivationDate) : null)
                .query("UPDATE ExpedienteOverrides SET Observation = @Observation, ReactivationDate = @ReactivationDate WHERE Codigo = @Codigo");
        } else {
            await pool.request()
                .input('Id', sql.NVarChar, Math.random().toString(36).substr(2, 9))
                .input('Codigo', sql.NVarChar, codigoStr)
                .input('Observation', sql.NVarChar, observation || null)
                .input('ReactivationDate', sql.DateTime, reactivationDate ? new Date(reactivationDate) : null)
                .query("INSERT INTO ExpedienteOverrides (Id, Codigo, Observation, ReactivationDate) VALUES (@Id, @Codigo, @Observation, @ReactivationDate)");
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao salvar override de expediente:', err.message);
        res.status(500).send(err.message);
    }
});

module.exports = router;
