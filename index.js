const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer'); 
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'imm-secure-gateway-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('শুধুমাত্র PDF ফাইল আপলোড করা যাবে!'), false);
        }
    }
});

const authRoutes = require('./auth');
const adminRoutes = require('./admin');

app.use('/', authRoutes);
app.use('/', adminRoutes);

// ১. পিডিএফ আপলোড করার এপিআই রাউট
app.post('/api/upload-pdf', upload.single('visa_document'), async (req, res) => {
    const userId = req.body.user_id; 
    if (!userId || !req.file) {
        return res.status(400).json({ success: false, message: 'ইউজার আইডি বা পিডিএফ ফাইল পাওয়া যায়নি।' });
    }

    try {
        const pdfName = req.file.originalname;
        const pdfData = req.file.buffer; 

        await db.execute(
            "UPDATE imm_users SET pdf_name = ?, pdf_data = ? WHERE user_id = ?", 
            [pdfName, pdfData, userId]
        );

        res.json({ success: true, message: 'পিডিএফ সফলভাবে আপলোড এবং ডাটাবেসে সংরক্ষিত হয়েছে।' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'ডাটাবেস আপডেট করতে সমস্যা হয়েছে।' });
    }
});

// ২. পিডিএফ বাইনারি স্ট্রিমিং এপিআই রাউট
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
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

// ৩. শেয়ার্ড ভেরিফিকেশন গেটওয়ে
app.get('/', async (req, res) => {
    if (req.query.shared_user) {
        try {
            const [rows] = await db.execute("SELECT name, user_id, pdf_name, app_status, payment_status, visa_status FROM imm_users WHERE user_id = ?", [req.query.shared_user]);
            
            if (rows.length > 0 && rows[0].app_status === 'Successful') {
                const user = rows[0]; 
                
                // 🎯 ডবল স্ল্যাশ এরর এড়াতে ইউআরএল এর শেষের স্ল্যাশ বাদ দিয়ে প্রফেশনাল এনভায়রনমেন্ট লজিক
                const liveAppUrl = process.env.NODE_ENV === 'production' 
                    ? `https://${process.env.RENDER_EXTERNAL_URL.replace(/^https?:\/\//, '')}` 
                    : `http://localhost:${port}`;

                const pdfStreamUrl = `${liveAppUrl}/api/view-pdf?user_id=${user.user_id}`;

                return res.send(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Official Immigration Verification Gateway</title>
                        <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; padding: 10px; margin: 0; color: #1f2937; }
                            .verify-card { max-width: 800px; margin: 30px auto; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-top: 5px solid #10b981; text-align: center; }
                            .submit-btn { background: #2563eb; color: white; border: none; padding: 12px 25px; margin: 20px auto; cursor: pointer; border-radius: 50px; font-size: 15px; font-weight: bold; width: 100%; max-width: 300px; display: block; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-decoration: none; }
                            .badge-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 25px 0; text-align: left; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px; }
                            .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
                            .successful, .approved { background: #dcfce7; color: #16a34a; }
                        </style>
                    </head>
                    <body>
                        <div class="verify-card">
                            <h2>🛡️ Official Dossier Verification</h2>
                            <p style="color: #6b7280; font-size: 14px;">High Commission Immigration Clearance System</p>
                            
                            <button onclick="copyShareLink()" class="submit-btn">🔗 Share This Verification</button>
                            
                            <div class="badge-grid">
                                <div><b>Applicant Name:</b> <span style="color:#1e3a8a;">${user.name}</span></div>
                                <div><b>Passport/User ID:</b> <span>${user.user_id}</span></div>
                                <div><b>Application Status:</b> <span class="status-badge successful">${user.app_status}</span></div>
                                <div><b>Payment Status:</b> <span class="status-badge" style="background:#e0f2fe; color:#0369a1;">${user.payment_status}</span></div>
                                <div><b>Immigration Status:</b> <span class="status-badge approved">${user.visa_status}</span></div>
                            </div>
                            
                            <h3>📄 Verified Document Stream:</h3>
                            
                            <!-- প্রফেশনাল ভিউ বাটন যা সরাসরি ফুল স্ক্রিনে পিডিএফ ওপেন করবে (সাদা বক্স সম্পূর্ণ বাদ) -->
                            <a href="${pdfStreamUrl}" target="_blank" class="submit-btn" style="background:#10b981; margin-bottom: 20px; text-decoration: none;">👁️ View Verified PDF Document</a>
                        </div>
                        <script>
                            function copyShareLink() {
                                navigator.clipboard.writeText(window.location.href);
                                alert('Verification link copied!');
                            }
                        </script>
                    </body>
                    </html>
                `);
            } else {
                return res.send("<script>alert('Dossier path invalid or application not successful.'); window.location.href='/';</script>");
            }
        } catch (err) {
            console.error(err);
            return res.send("System optimization error.");
        }
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(__dirname));

app.listen(port, () => console.log(`🚀 Gateway Running On Port ${port}`));
