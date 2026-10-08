const express = require('express');
const router = express.Router();
const db = require('./db'); // একই জায়গায় থাকায় ./db দেওয়া হয়েছে
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/register', async (req, res) => {
    const { regName, regId, regPassword } = req.body;
    try {
        const [rows] = await db.execute("SELECT id FROM imm_users WHERE user_id = ?", [regId]);
        if (rows.length > 0) {
            return res.send("<script>alert('User ID or Passport already exists!'); window.location.href='/';</script>");
        }
        await db.execute("INSERT INTO imm_users (user_id, name, password) VALUES (?, ?, ?)", [regId, regName, regPassword]);
        res.send("<script>alert('Registration successful! Please login.'); window.location.href='/';</script>");
    } catch (e) {
        res.send("<script>alert('Server encountered an error during registration.'); window.location.href='/';</script>");
    }
});

router.post('/login', async (req, res) => {
    const { loginId, loginPassword } = req.body;
    try {
        const [rows] = await db.execute("SELECT * FROM imm_users WHERE user_id = ?", [loginId]);
        if (rows.length > 0 && rows[0].password === loginPassword) {
            req.session.user = rows[0]; 
            res.redirect('/');
        } else {
            res.send("<script>alert('Invalid credentials!'); window.location.href='/';</script>");
        }
    } catch (err) {
        res.send("<script>alert('Login process encountered a server error.'); window.location.href='/';</script>");
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

router.post('/upload', upload.single('pdfFile'), async (req, res) => {
    if (!req.session.user || !req.file) return res.redirect('/');
    try {
        await db.execute("UPDATE imm_users SET pdf_name = ?, pdf_data = ?, app_status = 'Pending' WHERE user_id = ?", [req.file.originalname, req.file.buffer, req.session.user.user_id]);
        res.send("<script>alert('Dossier uploaded successfully!'); window.location.href='/';</script>");
    } catch (err) {
        res.send("<script>alert('Upload failed.'); window.location.href='/';</script>");
    }
});

router.get('/api/user-data', async (req, res) => {
    if (!req.session.user) return res.json({ loggedIn: false });
    try {
        const [rows] = await db.execute("SELECT name, user_id, pdf_name, app_status, payment_status, visa_status FROM imm_users WHERE user_id = ?", [req.session.user.user_id]);
        if (rows.length > 0) {
            res.json({ loggedIn: true, user: rows[0] });
        } else {
            res.json({ loggedIn: false });
        }
    } catch (err) {
        res.json({ loggedIn: false });
    }
});

module.exports = router;
