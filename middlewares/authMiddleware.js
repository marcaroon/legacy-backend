const jwt = require("jsonwebtoken");

class AuthMiddleware {
  static authenticateToken(req, res, next) {
    try {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access token is required",
        });
      }

      const secretKey = process.env.JWT_SECRET;
      if (!secretKey) {
        console.error("JWT_SECRET is not configured");
        return res.status(500).json({
          success: false,
          message: "Server configuration error",
        });
      }

      jwt.verify(token, secretKey, (err, user) => {
        if (err) {
          console.log("Token verification failed:", err.message);

          if (err.name === "TokenExpiredError") {
            return res.status(401).json({
              success: false,
              message: "Access token has expired",
              code: "TOKEN_EXPIRED",
            });
          }

          if (err.name === "JsonWebTokenError") {
            return res.status(403).json({
              success: false,
              message: "Invalid access token",
              code: "INVALID_TOKEN",
            });
          }

          return res.status(403).json({
            success: false,
            message: "Token verification failed",
          });
        }

        // Attach user info to request
        req.user = {
          id: user.id,
          username: user.username,
          role: user.role,
        };

        next();
      });
    } catch (error) {
      console.error("Auth middleware error:", error);
      res.status(500).json({
        success: false,
        message: "Authentication error",
        error: error.message,
      });
    }
  }

  // Middleware untuk verifikasi role admin
  static requireAdmin(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      next();
    } catch (error) {
      console.error("Admin middleware error:", error);
      res.status(500).json({
        success: false,
        message: "Authorization error",
        error: error.message,
      });
    }
  }

  // Middleware kombinasi: auth + admin
  static adminOnly(req, res, next) {
    AuthMiddleware.authenticateToken(req, res, (err) => {
      if (err) return;
      AuthMiddleware.requireAdmin(req, res, next);
    });
  }

  // Optional auth - tidak wajib login tapi jika ada token akan diparse
  static optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      if (!token) {
        req.user = null;
        return next();
      }

      const secretKey = process.env.JWT_SECRET;
      if (!secretKey) {
        req.user = null;
        return next();
      }

      jwt.verify(token, secretKey, (err, user) => {
        if (err) {
          req.user = null;
        } else {
          req.user = {
            id: user.id,
            username: user.username,
            role: user.role,
          };
        }
        next();
      });
    } catch (error) {
      console.error("Optional auth middleware error:", error);
      req.user = null;
      next();
    }
  }
}

module.exports = AuthMiddleware;
