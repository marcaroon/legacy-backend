const prisma = require("../config/prismaClient");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

class UserService {
  constructor() {
    this.saltRounds = 12;
  }

  generateTokens(userId, username, role) {
    try {
      const secretKey = process.env.JWT_SECRET;
      const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

      if (!secretKey) {
        throw new Error("env jwt belum di setting");
      }

      const payload = {
        id: userId,
        username: username,
        role: role,
      };

      const token = jwt.sign(payload, secretKey, {
        expiresIn,
        issuer: "legacy-training-backend",
        subject: userId.toString(),
      });

      const expiresAt = new Date();
      const durationInSeconds = this.parseJwtDuration(expiresIn);
      expiresAt.setSeconds(expiresAt.getSeconds() + durationInSeconds);

      return {
        access_token: token,
        token_type: "Bearer",
        expires_in: durationInSeconds,
        expires_at: expiresAt.toISOString(),
      };
    } catch (error) {
      console.error("error generating tokens:", error);
      throw new Error(`error generating tokens: ${error.message}`);
    }
  }

  parseJwtDuration(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 60 * 60;
      case "d":
        return value * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }

  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      console.error("error hashing password: ", error);
      throw new Error("error processing password: ");
    }
  }

  async verifyPassword(password, hashedPassword) {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      throw new Error("error verifying password");
    }
  }

  async createUser(userData) {
    try {
      return await prisma.$transaction(async (tx) => {
        const { username, password, role = "admin" } = userData;

        const existingUser = await tx.user.findUnique({
          where: { username: username.toLowerCase() },
        });

        if (existingUser) {
          throw new Error("username sudah ada");
        }

        const hashedPassword = await this.hashPassword(password);

        const user = await tx.user.create({
          data: {
            username: username.toLowerCase(),
            password: hashedPassword,
            role: role,
          },
          select: {
            id: true,
            username: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const tokens = this.generateTokens(user.id, user.username, user.role);

        console.log(`user berhasil dibuat: ${user.username}`);

        return {
          user: user,
          ...tokens,
        };
      });
    } catch (error) {
      console.error("error creating user:", error);
      throw error;
    }
  }

  async authenticateUser(credentials) {
    try {
      const { username, password } = credentials;

      const user = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
      });

      if (!user) {
        throw new Error("user tidak ditemukan");
      }

      const isPasswordValid = await this.verifyPassword(
        password,
        user.password
      );

      if (!isPasswordValid) {
        throw new Error("invalid credentials");
      }

      const tokens = this.generateTokens(user.id, user.username, user.role);

      await prisma.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
      });

      console.log(`user sukses terautentikasi: ${user.username}`);

      return {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        ...tokens,
      };
    } catch (error) {
      console.error("error autentikasi:", error);
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      throw new Error(`error fetching user: ${error.message}`);
    }
  }

  async getUserByUsername(username) {
    try {
      const user = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      throw new Error(`error fetching user: ${error.message}`);
    }
  }

  async getAllUsers(filters = {}) {
    try {
      const whereClause = {};

      if (filters.role) {
        whereClause.role = filters.role;
      }

      const queryOptions = {
        where: whereClause,
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      };

      if (filters.limit) {
        queryOptions.take = parseInt(filters.limit);
      }

      const users = await prisma.user.findMany(queryOptions);

      return users;
    } catch (error) {
      throw new Error(`error fetching users: ${error.message}`);
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          throw new Error("user tidak ditemukan");
        }

        const isCurrentPasswordValid = await this.verifyPassword(
          currentPassword,
          user.password
        );

        if (!isCurrentPasswordValid) {
          throw new Error("current password is incorrect");
        }

        const hashedNewPassword = await this.hashPassword(newPassword);

        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            password: hashedNewPassword,
            updatedAt: new Date(),
          },
          select: {
            id: true,
            username: true,
            role: true,
            updatedAt: true,
          },
        });

        console.log(`password berhasil diganti dengan user: ${user.username}`);

        return {
          user: updatedUser,
          message: "password changed successfully",
        };
      });
    } catch (error) {
      console.error("error changing password:", error);
      throw error;
    }
  }

  async updateUserProfile(userId, updateData) {
    try {
      const allowedFields = ["username"];
      const filteredData = {};

      Object.keys(updateData).forEach((key) => {
        if (allowedFields.includes(key) && updateData[key] !== undefined) {
          filteredData[key] = updateData[key];
        }
      });

      if (Object.keys(filteredData).length === 0) {
        throw new Error("no valid fields to update");
      }

      if (filteredData.username) {
        const existingUser = await prisma.user.findFirst({
          where: {
            username: filteredData.username.toLowerCase(),
            id: { not: userId },
          },
        });

        if (existingUser) {
          throw new Error("username already exists");
        }

        filteredData.username = filteredData.username.toLowerCase();
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...filteredData,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      console.log(`user profile updated: ${updatedUser.username}`);

      return updatedUser;
    } catch (error) {
      console.error("error updating user:", error);
      throw error;
    }
  }

  async deleteUser(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      await prisma.user.delete({
        where: { id: userId },
      });

      console.log(`User deleted successfully: ${user.username}`);

      return {
        success: true,
        message: "User deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  }

  async getUserStats() {
    try {
      const totalUsers = await prisma.user.count();

      const usersByRole = await prisma.user.groupBy({
        by: ["role"],
        _count: true,
      });

      const roleStats = usersByRole.reduce((acc, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {});

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentUsers = await prisma.user.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      return {
        total_users: totalUsers,
        by_role: roleStats,
        recent_users: recentUsers,
      };
    } catch (error) {
      console.error("Error fetching user stats:", error);
      throw new Error(`Error fetching user stats: ${error.message}`);
    }
  }

  verifyToken(token) {
    try {
      const secretKey = process.env.JWT_SECRET;
      if (!secretKey) {
        throw new Error("JWT_SECRET is not configured");
      }

      return jwt.verify(token, secretKey);
    } catch (error) {
      console.error("Error verifying token:", error);
      throw error;
    }
  }
}

module.exports = new UserService();
