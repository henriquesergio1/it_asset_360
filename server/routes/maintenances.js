const { sql, dbConfig, getBase64FromBuffer } = require('../utils/db');

module.exports = (app) => {
    app.get('/api/maintenances/:id/invoice', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT InvoiceBinary FROM MaintenanceRecords WHERE Id=@Id");
            const row = result.recordset[0];
            if (!row) return res.json({ invoiceUrl: '' });
            res.json({ invoiceUrl: getBase64FromBuffer(row.InvoiceBinary) });
        } catch (err) { res.status(500).send(err.message); }
    });
};
