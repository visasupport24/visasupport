const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER || 'avnadmin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'defaultdb',
    port: process.env.DB_PORT || 23643,
    ssl: { rejectUnauthorized: false }, 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const db = pool.promise();

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
`)
.then(() => console.log("🔒 Cloud Database Synchronized Successfully."))
.catch(err => console.error("❌ Database sync failed:", err));

module.exports = db;
