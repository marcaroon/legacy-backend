// generate-signature.js
const crypto = require("crypto");

const order_id = "ORDER-17-1757583142456";
const status_code = "200"; 
const gross_amount = "12250000";
const serverKey = process.env.MIDTRANS_SERVER_KEY; 

// Concatenate sesuai dokumentasi Midtrans
const input = order_id + status_code + gross_amount + serverKey;

// Generate SHA512
const signature = crypto.createHash("sha512").update(input).digest("hex");