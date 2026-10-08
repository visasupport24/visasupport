const express = require('express');
const router = express.Router();
const db = require('./db'); // একই জায়গায় থাকায় ./db দেওয়া হয়েছে

router.post('/admin-update', async (req, res) => {
    const { target_user_id, new_app_status, new_payment, new_visa } = req.body;
    try {
        await db.execute("UPDATE imm_users SET app_status = ?, payment_status = ?, visa_status = ? WHERE user_id = ?", [new_app_status, new_payment, new_visa, target_user_id]);
        res.send("<script>alert('Configurations successfully synchronized.'); window.location.href='/';</script>");
    } catch (err) {
        res.send("<script>alert('Admin action failed.'); window.location.href='/';</script>");
    }
});

router.get('/api/admin-data', async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT user_id, name, pdf_name, app_status, payment_status, visa_status FROM imm_users WHERE pdf_data IS NOT NULL");
        res.json(rows);
    } catch (err) {
        res.json([]);
    }
});

module.exports = router;
