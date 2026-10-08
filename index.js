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

app.use(express.static(__dirname));

const authRoutes = require('./auth');
const adminRoutes = require('./admin');
app.use('/', authRoutes);
app.use('/', adminRoutes);

// 🎯 FIXED: পিডিএফ বাইনারি স্ট্রিমিং এর জন্য আলাদা এপিআই রাউট
app.get('/api/view-pdf', async (req, res) => {
    if (!req.query.user_id) return res.status(400).send('Missing User ID');
    try {
        const [rows] = await db.execute("SELECT pdf_name, pdf_data FROM imm_users WHERE user_id = ?", [req.query.user_id]);
        if (rows.length > 0 && rows[0].pdf_data) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${rows[0].pdf_name}"`);
            return res.send(rows[0].pdf_data);
        }
        res.status(404).send('PDF Data Not Found');
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

// 🌐 v2.0 SHARE GATEWAY MECHANISM: শেয়ার্ড ইউজারের জন্য আলাদা এইচটিএমএল ভিউ
app.get('/', async (req, res) => {
    if (req.query.shared_user) {
        try {
            const [rows] = await db.execute("SELECT name, user_id, pdf_name, app_status, payment_status, visa_status FROM imm_users WHERE user_id = ?", [req.query.shared_user]);
            if (rows.length > 0 && rows[0].app_status === 'Successful') {
                const user = rows[0];
                // সরাসরি একটি সুন্দর রেসপন্সিভ শেয়ার ভিউ পেজ রেন্ডার করা হচ্ছে
                return res.send(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Official Immigration Verification Gateway</title>
                        <link rel="stylesheet" href="style.css">
                        <style>
                            .verify-card { max-width: 800px; margin: 30px auto; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-top: 5px solid #10b981; text-align: center; }
                            .pdf-frame { width: 100%; height: 600px; border: 1px solid #d1d5db; border-radius: 8px; margin-top: 20px; }
                            .badge-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; text-align: left; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                        </style>
                    </head>
                    <body style="background: #f0f2f5; padding: 10px;">
                        <div class="verify-card">
                            <h2 style="color: #0b2545; margin-bottom: 5px;">🛡️ Official Dossier Verification</h2>
                            <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 14px;">High Commission Immigration Clearance System</p>
                            
                            <!-- 🔗 লাইভ শেয়ার বাটন -->
                            <button onclick="copyShareLink()" class="submit-btn" style="background: #2563eb; max-width: 300px; margin: 0 auto; display: block; border-radius: 50px;">🔗 Share This Verification</button>
                            
                            <div class="badge-grid">
                                <div><b>Applicant Name:</b> <span style="color:#1e3a8a;">\${user.name}</span></div>
                                <div><b>Passport/User ID:</b> <span>\${user.user_id}</span></div>
                                <div><b>Application Status:</b> <span class="status-badge successful">\${user.app_status}</span></div>
                                <div><b>Payment Status:</b> <span class="status-badge" style="background:#e0f2fe; color:#0369a1;">\${user.payment_status}</span></div>
                                <div><b>Immigration Status:</b> <span class="status-badge approved">\${user.visa_status}</span></div>
                            </div>

                            <h3 style="text-align: left; color: #0b2545; margin-top: 25px;">📄 Verified Document Stream:</h3>
                            <!-- 🤖 ডেটাবেস থেকে লাইভ পিডিএফ লোড করার ফ্রেম -->
                            <iframe class="pdf-frame" src="/api/view-pdf?user_id=\${user.user_id}"></iframe>
                        </div>

                        <script>
                            function copyShareLink() {
                                navigator.clipboard.writeText(window.location.href);
                                alert('Verification link copied to clipboard! You can now send it to anyone.');
                            }
                        </script>
                    </body>
                    </html>
                `);
            } else {
                return res.send("<script>alert('Dossier path invalid or verification under process.'); window.location.href='/';</script>");
            }
        } catch (err) {
            return res.send("System optimization error.");
        }
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => console.log(`🚀 Gateway Running Flawlessly On Port ${port}`));
