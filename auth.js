const express = require('express');
const router = express.Router();
const db = require('./db');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } });

// অ্যাকাউন্ট রেজিস্ট্রেশন লজিক
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

// ইউজার লগইন লজিক (🎯 ফাইনাল ইনডেক্স জিরো অবজেক্ট লক ফিক্স)
router.post('/login', async (req, res) => {
    const { loginId, loginPassword } = req.body;
    try {
        const [rows] = await db.execute("SELECT * FROM imm_users WHERE user_id = ?", [loginId]);
        
        // 🎯 FIXED: rows[0] ব্যবহার করে খাঁটি জাভাস্ক্রিপ্ট অবজেক্ট সেশনে স্টোর করা হলো
        if (rows.length > 0 && rows[0].password === loginPassword) {
            req.session.user = {
                id: rows[0].id,
                user_id: rows[0].user_id,
                name: rows[0].name
            }; 
            res.redirect('/');
        } else {
            res.send("<script>alert('Invalid credentials!'); window.location.href='/';</script>");
        }
    } catch (err) {
        res.send("<script>alert('Login process encountered a server error.'); window.location.href='/';</script>");
    }
});

// লগআউট লজিক
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ইউজার পিডিএফ আপলোড লজিক
router.post('/upload', upload.single('pdfFile'), async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    try {
        await db.execute("UPDATE imm_users SET pdf_name = ?, pdf_data = ?, app_status = 'Pending' WHERE user_id = ?", [req.file.originalname, req.file.buffer, req.session.user.user_id]);
        res.send("<script>alert('Dossier uploaded successfully!'); window.location.href='/';</script>");
    } catch (err) {
        res.send("<script>alert('Upload failed.'); window.location.href='/';</script>");
    }
});

// কারেন্ট লগইন ইউজারের ডাটা চেক এপিআই
router.get('/api/user-data', async (req, res) => {
    if (!req.session.user) return res.json({ loggedIn: false });
    try {
        const [rows] = await db.execute("SELECT name, user_id, pdf_name, app_status, payment_status, visa_status FROM imm_users WHERE user_id = ?", [req.session.user.user_id]);
        if (rows.length > 0) {
            // 🎯 FIXED: ফ্রন্টএন্ডের জন্য সিঙ্গেল অবজেক্ট ফরম্যাট পাঠানো হলো
            res.json({ loggedIn: true, user: rows[0] });
        } else {
            res.json({ loggedIn: false });
        }
    } catch (err) {
        res.json({ loggedIn: false });
    }
});

module.exports = router;
