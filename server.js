const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const routes = require("./routes/routes");

const app = express();
const PORT = process.env.PORT || 5000;
// console.log("DATABASE_URL:", process.env.DATABASE_URL);

const allowedOrigins = [
  "https://fromlegacy.tqpartner.com",
  "https://admin.fromlegacy.tqpartner.com",
  "http://localhost:5174",
  "http://localhost:5173",
  "https://a5e00b954176.ngrok-free.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error("CORS blocked:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204); // Preflight OK
  }
  // const timestamp = new Date().toISOString();
  // console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api", routes);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Legacy API is running!" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : {},
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
