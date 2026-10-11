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
        
        if (rows && rows.length > 0 && rows[0].pdf_data) {
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

// ৩. শেয়ার্ড ভেরিফিকেশন গেটওয়ে (ডাটাবেজ অবজেক্ট এবং ইন-পেজ ভিউ ফিক্সড)
app.get('/', async (req, res) => {
    if (req.query.shared_user) {
        try {
            const [rows] = await db.execute(
                "SELECT name, user_id, pdf_name, app_status, payment_status, visa_status FROM imm_users WHERE user_id = ?", 
                [req.query.shared_user]
            );
            
            // 🎯 ফিক্স: rows[0] ব্যবহার করে অবজেক্ট ডাটা সঠিকভাবে চেক করা হলো
            if (rows && rows.length > 0 && rows[0].app_status === 'Successful') {
                const user = rows[0]; 
                
                const liveAppUrl = "https://onrender.com";
                const pdfStreamUrl = liveAppUrl + "/api/view-pdf?user_id=" + user.user_id;

                return res.send(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Official Australian Immigration Verification Gateway</title>
                        <link rel="stylesheet" href="style.css">
                        <style>
                            body { display: flex; flex-direction: column; min-height: 100vh; background-color: #f8fafc; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
                            .main-content { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                            .secure-pdf-container { width: 100%; max-width: 650px; background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-top: 20px; overflow: hidden; border: 1px solid #e2e8f0; display: none; }
                            .secure-bar { background: #1e293b; color: #ef4444; padding: 10px; font-size: 12px; font-weight: bold; text-align: center; border-bottom: 2px solid #ffc72c; }
                        </style>
                    </head>
                    <body oncontextmenu="return false;">
                        <div class="main-content">
                            <div class="verify-card">
                                <div class="immi-header-banner">
                                    <div class="immi-logo-area">
                                        <div class="au-crest">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://w3.org">
                                                <path d="M12 2L14.85 8.36L21.82 9L16.57 13.64L18.1 20.47L12 16.85L5.9 20.47L7.43 13.64L2.18 9L9.15 8.36L12 2Z" fill="#ffc72c"/>
                                            </svg>
                                        </div>
                                        <div class="au-text">
                                            <span class="gov-title">Australian Government</span>
                                            <span class="dept-title">Department of Home Affairs</span>
                                        </div>
                                    </div>
                                    <div class="immi-brand-title">ImmiAccount</div>
                                </div>

                                <div class="card-body-content">
                                    <h2 class="verification-main-title">🛡️ Visa Entitlement Verification Online (VEVO)</h2>
                                    <p class="verification-subtitle">Official Secure Verification Gateway</p>
                                    
                                    <table class="info-table">
                                        <tr>
                                            <td>Applicant Name</td>
                                            <td style="color: #2563eb !important; font-weight: 600 !important; text-transform: uppercase;">` + user.name + `</td>
                                        </tr>
                                        <tr>
                                            <td>Passport / User ID</td>
                                            <td style="font-family: monospace; font-size: 15px; font-weight: 600;">` + user.user_id + `</td>
                                        </tr>
                                        <tr>
                                            <td>Application Status</td>
                                            <td><span class="status-badge successful">` + user.app_status + `</span></td>
                                        </tr>
                                        <tr>
                                            <td>Payment Status</td>
                                            <td><span class="status-badge" style="background:#e0f2fe; color:#0369a1;">` + user.payment_status + `</span></td>
                                        </tr>
                                        <tr>
                                            <td>Immigration Status</td>
                                            <td><span class="status-badge approved">` + user.visa_status + `</span></td>
                                        </tr>
                                    </table>
                                    
                                    <div class="btn-group-verify">
                                        <button onclick="toggleSecurePdf()" class="verify-action-btn btn-success-verify">👁️ Secure View PDF Document</button>
                                        <button onclick="copyShareLink()" class="verify-action-btn btn-primary-verify">🔗 Share This Verification</button>
                                    </div>
                                </div>
                            </div>

                            <div id="securePdfBox" class="secure-pdf-container">
                                <div class="secure-bar">🔒 SECURE GATEWAY MODE — DOWNLOAD & PRINT DISABLED</div>
                                <div id="pdf-viewer-container"></div>
                            </div>
                        </div>

                        <div id="toast-msg">Verification link copied to clipboard!</div>

                        <footer class="site-footer">
                            <div class="footer-grid">
                                <div class="footer-brand">
                                    <h2>Australian Government</h2>
                                    <p>Official Department of Home Affairs tracking portal for visa, immigration, and citizenship status check.</p>
                                </div>
                            </div>
                            <div class="footer-bottom">&copy; 2026 Department of Home Affairs. All rights reserved.</div>
                        </footer>

                        <script>
                            function copyShareLink() {
                                navigator.clipboard.writeText(window.location.href);
                                var toast = document.getElementById("toast-msg");
                                toast.className = "show";
                                setTimeout(function(){ toast.className = toast.className.replace("show", ""); }, 3000);
                            }

                                                        function toggleSecurePdf() {
                                var pdfBox = document.getElementById("securePdfBox");
                                var container = document.getElementById('pdf-viewer-container');
                                var pdfUrl = "` + pdfStreamUrl + `#toolbar=0&navpanes=0";
                                
                                if (pdfBox.style.display === "block") {
                                    pdfBox.style.display = "none";
                                } else {
                                    pdfBox.style.display = "block";
                                    pdfBox.scrollIntoView({ behavior: 'smooth' });
                                    
                                    container.innerHTML = '<iframe src="' + pdfUrl + '" style="width:100%; height:500px; border:none;"></iframe>';
                                }
                            }

                            document.addEventListener('keydown', function(e) {
                                if (e.ctrlKey && (e.key === 's' || e.key === 'p' || e.key === 'u' || e.key === 'i')) {
                                    e.preventDefault();
                                    return false;
                                }
                            });
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

