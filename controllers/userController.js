const userService = require("../services/userService");

class UserController {
  static async register(req, res) {
    try {
      console.log(
        "creating user with data:",
        JSON.stringify(req.body, null, 2)
      );

      const { username, password, confirmPassword } = req.body;

      const validationErrors = [];

      if (!username || !username.trim()) {
        validationErrors.push("username is required");
      }
      if (!password || !password.trim()) {
        validationErrors.push("password is required");
      }
      if (!confirmPassword || !confirmPassword.trim()) {
        validationErrors.push("confirmPassword is required");
      }

      if (username && username.trim().length < 3) {
        validationErrors.push("username must be at least 3 characters long");
      }

      if (password && password.length < 6) {
        validationErrors.push("password must be at least 6 characters long");
      }

      if (password && confirmPassword && password !== confirmPassword) {
        validationErrors.push("password and confirmPassword do not match");
      }

      const usernameRegex = /^[a-zA-Z0-9_-]+$/;
      if (username && !usernameRegex.test(username.trim())) {
        validationErrors.push(
          "username can only contain letters, numbers, underscore, and dash"
        );
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "validation errors",
          errors: validationErrors,
        });
      }

      const cleanedData = {
        username: username.trim().toLowerCase(),
        password: password,
      };

      console.log("Creating user with cleaned data:", {
        username: cleanedData.username,
      });

      const result = await userService.createUser(cleanedData);

      console.log("User created successfully:", {
        id: result.user.id,
        username: result.user.username,
      });

      res.status(201).json({
        success: true,
        data: result,
        message: "User created successfully",
      });
    } catch (error) {
      console.error("Error in register:", error);

      let statusCode = 500;
      let message = "Failed to create user";

      if (error.message.includes("username already exists")) {
        statusCode = 409;
        message = "username already exist";
      } else if (
        error.message.includes("validation") ||
        error.message.includes("required") ||
        error.message.includes("invalid")
      ) {
        statusCode = 400;
        message = "Invalid input data";
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.message,
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      });
    }
  }

  static async login(req, res) {
    try {
      console.log("percobaan masuk untuk: ", req.body.username);

      const { username, password } = req.body;

      const validationErrors = [];

      if (!username || !username.trim()) {
        validationErrors.push("username is required");
      }
      if (!password || !password.trim()) {
        validationErrors.push("password is required");
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: validationErrors,
        });
      }

      const cleanedData = {
        username: username.trim().toLowerCase(),
        password: password,
      };

      const result = await userService.authenticateUser(cleanedData);

      // console.log("user telah login:", {
      //   username: result.user.username,
      // });

      res.json({
        success: true,
        data: result,
        message: "login sukses",
      });
    } catch (error) {
      console.error("login error:", error);

      let statusCode = 500;
      let message = "login gagal";

      if (
        error.message.includes("invalid credentials") ||
        error.message.includes("user tidak ada")
      ) {
        statusCode = 401;
        message = "username/password salah";
      } else if (
        error.message.includes("validation") ||
        error.message.includes("required")
      ) {
        statusCode = 400;
        message = "input tidak valid";
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.message,
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      });
    }
  }

  static async getProfile(req, res) {
    try {
      const userId = req.user.id;

      console.log(`Fetching profile for user: ${userId}`);

      const user = await userService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        data: user,
        message: "Profile retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getProfile:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve profile",
        error: error.message,
      });
    }
  }

  static async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword, confirmPassword } = req.body;

      console.log(`Password change request for user: ${userId}`);

      const validationErrors = [];

      if (!currentPassword || !currentPassword.trim()) {
        validationErrors.push("currentPassword is required");
      }
      if (!newPassword || !newPassword.trim()) {
        validationErrors.push("newPassword is required");
      }
      if (!confirmPassword || !confirmPassword.trim()) {
        validationErrors.push("confirmPassword is required");
      }

      if (newPassword && newPassword.length < 6) {
        validationErrors.push("newPassword must be at least 6 characters long");
      }

      if (newPassword && confirmPassword && newPassword !== confirmPassword) {
        validationErrors.push("newPassword and confirmPassword do not match");
      }

      if (currentPassword && newPassword && currentPassword === newPassword) {
        validationErrors.push(
          "newPassword must be different from current password"
        );
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: validationErrors,
        });
      }

      const result = await userService.changePassword(
        userId,
        currentPassword,
        newPassword
      );

      console.log("Password changed successfully for user:", userId);

      res.json({
        success: true,
        data: result,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Error in changePassword:", error);

      let statusCode = 500;
      let message = "Failed to change password";

      if (error.message.includes("Current password is incorrect")) {
        statusCode = 400;
        message = "Current password is incorrect";
      } else if (error.message.includes("User not found")) {
        statusCode = 404;
        message = "User not found";
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.message,
      });
    }
  }

  static async getAllUsers(req, res) {
    try {
      const filters = {
        role: req.query.role,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      };

      Object.keys(filters).forEach((key) => {
        if (
          filters[key] === null ||
          filters[key] === undefined ||
          filters[key] === ""
        ) {
          delete filters[key];
        }
      });

      console.log("Fetching users with filters:", filters);

      const users = await userService.getAllUsers(filters);

      res.json({
        success: true,
        data: users,
        count: users.length,
        filters: filters,
        message: "Users retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getAllUsers:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve users",
        error: error.message,
      });
    }
  }

  static async getUserById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "Valid user ID is required",
        });
      }

      console.log(`Fetching user: ${id}`);

      const user = await userService.getUserById(parseInt(id));

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        data: user,
        message: "User retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getUserById:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user",
        error: error.message,
      });
    }
  }

  static async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const currentUserId = req.user.id;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "Valid user ID is required",
        });
      }

      const targetUserId = parseInt(id);

      if (targetUserId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete your own account",
        });
      }

      console.log(`Deleting user: ${targetUserId}`);

      const user = await userService.getUserById(targetUserId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await userService.deleteUser(targetUserId);

      console.log("User deleted successfully:", targetUserId);

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Error in deleteUser:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete user",
        error: error.message,
      });
    }
  }

  static async refreshToken(req, res) {
    try {
      const userId = req.user.id;

      console.log(`Refreshing token for user: ${userId}`);

      const result = await userService.generateTokens(userId);

      res.json({
        success: true,
        data: result,
        message: "Token refreshed successfully",
      });
    } catch (error) {
      console.error("Error in refreshToken:", error);
      res.status(500).json({
        success: false,
        message: "Failed to refresh token",
        error: error.message,
      });
    }
  }

  static async logout(req, res) {
    try {
      console.log(`User logged out: ${req.user.username}`);

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Error in logout:", error);
      res.status(500).json({
        success: false,
        message: "Logout failed",
        error: error.message,
      });
    }
  }
}

module.exports = UserController;
