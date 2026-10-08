const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Multer Memory Setup for PDF Upload (Up to 50MB)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } });

// --- AIVEN.IO CLOUD DATABASE CONNECTION ---
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER || 'avnadmin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'defaultdb',
    port: process.env.DB_PORT || 23643,
    ssl: { rejectUnauthorized: false }, // Aiven MySQL Requires SSL
    waitForConnections: true,
    connectionLimit: 10
});
const db = pool.promise();

// Table Auto-Initialization
db.execute(`
    CREATE TABLE IF NOT EXISTS imm_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        pdf_name VARCHAR(255) NULL,
        pdf_data LONGBLOB NULL,
        app_status VARCHAR(20) DEFAULT 'Pending',
        payment_status VARCHAR(50) DEFAULT 'Not Paid',
        visa_status VARCHAR(20) DEFAULT 'Pending'
    )
`).catch(err => console.error("Table Creation Error:", err));

app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'imm-secure-gateway-2026',
    resave: false,
    saveUninitialized: true
}));

// Route Definitions
app.get('/', async (req, res) => {
    if (req.query.shared_user) {
        try {
            const [rows] = await db.execute("SELECT name, user_id, pdf_name, pdf_data, app_status FROM imm_users WHERE user_id = ?", [req.query.shared_user]);
            if (rows.length > 0 && rows[0].pdf_data && rows[0].app_status === 'Successful') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="${rows[0].pdf_name}"`);
                return res.send(rows[0].pdf_data);
            } else {
                return res.send("<script>alert('Invalid path or not verified yet.'); window.location.href='/';</script>");
            }
        } catch (err) {
            return res.send("<script>alert('Database query error.'); window.location.href='/';</script>");
        }
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// APIs for Auth and Operations
app.post('/register', async (req, res) => {
    const { regName, regId, regPassword } = req.body;
    try {
        await db.execute("INSERT INTO imm_users (user_id, name, password) VALUES (?, ?, ?)", [regId, regName, regPassword]);
        res.send("<script>alert('Registration successful!'); window.location.href='/';</script>");
    } catch (e) {
        res.send("<script>alert('User ID already exists!'); window.location.href='/';</script>");
    }
});

app.post('/login', async (req, res) => {
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

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.post('/upload', upload.single('pdfFile'), async (req, res) => {
    if (!req.session.user || !req.file) return res.redirect('/');
    try {
        await db.execute("UPDATE imm_users SET pdf_name = ?, pdf_data = ?, app_status = 'Pending' WHERE user_id = ?", [req.file.originalname, req.file.buffer, req.session.user.user_id]);
        res.send("<script>alert('Dossier uploaded successfully!'); window.location.href='/';</script>");
    } catch (err) {
        res.send("<script>alert('Upload failed.'); window.location.href='/';</script>");
    }
});

app.post('/admin-update', async (req, res) => {
    const { target_user_id, new_app_status, new_payment, new_visa } = req.body;
    try {
        await db.execute("UPDATE imm_users SET app_status = ?, payment_status = ?, visa_status = ? WHERE user_id = ?", [new_app_status, new_payment, new_visa, target_user_id]);
        res.send("<script>alert('Configurations successfully synchronized.'); window.location.href='/';</script>");
    } catch (err) {
        res.send("<script>alert('Admin action failed.'); window.location.href='/';</script>");
    }
});

app.get('/api/user-data', async (req, res) => {
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

app.get('/api/admin-data', async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT user_id, name, pdf_name, app_status, payment_status, visa_status FROM imm_users WHERE pdf_data IS NOT NULL");
        res.json(rows);
    } catch (err) {
        res.json([]);
    }
});

app.listen(port, () => console.log(`Gateway running flawlessly on port ${port}`));
