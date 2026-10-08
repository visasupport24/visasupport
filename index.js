const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'imm-secure-gateway-2026',
    resave: false,
    saveUninitialized: true
}));

// ফাইলগুলো একই ফোল্ডারে থাকায় সরাসরি এক্সপ্রেসকে রুট ডিরেক্টরি চেনানো হলো
app.use(express.static(__dirname));

const authRoutes = require('./auth');
const adminRoutes = require('./admin');
app.use('/', authRoutes);
app.use('/', adminRoutes);

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

app.listen(port, () => console.log(`🚀 Gateway Running Flawlessly On Port ${port}`));
