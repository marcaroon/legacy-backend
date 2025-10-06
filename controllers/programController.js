const ProgramService = require("../services/programService");

class ProgramController {
  static async getAllPrograms(req, res) {
    try {
      const filters = {
        search: req.query.search,
        page: req.query.page ? parseInt(req.query.page) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        includeStats: req.query.includeStats === "true",
        onlyAvailable: req.query.onlyAvailable !== "false",
      };

      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined || filters[key] === "") {
          delete filters[key];
        }
      });

      const result = await ProgramService.getAllPrograms(filters);

      res.json({
        success: true,
        data: result.programs,
        summary: result.summary,
        count: result.programs.length,
        filters: filters,
        message: "Programs retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getAllPrograms:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve programs",
        error: error.message,
      });
    }
  }

  static async getProgramById(req, res) {
    try {
      const { id } = req.params;
      const includeStats = req.query.includeStats === "true";

      const program = await ProgramService.getProgramById(
        parseInt(id),
        includeStats
      );

      if (!program) {
        return res.status(404).json({
          success: false,
          message: "Program not found",
        });
      }

      res.json({
        success: true,
        data: program,
        message: "Program retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getProgramById:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve program",
        error: error.message,
      });
    }
  }

  static async getCurrentPrice(req, res) {
    try {
      const { id } = req.params;

      const priceInfo = await ProgramService.getCurrentPrice(parseInt(id));

      res.json({
        success: true,
        data: priceInfo,
        message: "Current price information retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getCurrentPrice:", error);

      let statusCode = 500;
      let message = "Failed to retrieve current price";

      if (error.message.includes("not found")) {
        statusCode = 404;
        message = "Program not found";
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.message,
      });
    }
  }

  static async createProgram(req, res) {
    try {
      const {
        title,
        subtitle,
        duration,
        price,
        earlyBirdPrice,
        earlyBirdEndDate,
        description,
        features,
        isPopular,
      } = req.body;

      if (!title || !duration || price === undefined) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: title, duration, price",
        });
      }

      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid positive number",
        });
      }

      if (earlyBirdPrice !== undefined && earlyBirdPrice !== null) {
        if (isNaN(earlyBirdPrice) || earlyBirdPrice < 0) {
          return res.status(400).json({
            success: false,
            message: "Early bird price must be a valid positive number",
          });
        }
        if (earlyBirdPrice >= price) {
          return res.status(400).json({
            success: false,
            message: "Early bird price must be less than regular price",
          });
        }
      }

      const programId = await ProgramService.createProgram(req.body);

      res.status(201).json({
        success: true,
        data: { id: programId },
        message: "Program created successfully",
      });
    } catch (error) {
      console.error("Error in createProgram:", error);

      let statusCode = 500;
      let message = "Failed to create program";

      if (
        error.message.includes("required") ||
        error.message.includes("must be") ||
        error.message.includes("future")
      ) {
        statusCode = 400;
        message = "Invalid input data";
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.message,
      });
    }
  }

  static async updateProgram(req, res) {
    try {
      const { id } = req.params;

      if (
        req.body.price !== undefined &&
        (isNaN(req.body.price) || req.body.price < 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid positive number",
        });
      }

      if (
        req.body.earlyBirdPrice !== undefined &&
        req.body.earlyBirdPrice !== null &&
        (isNaN(req.body.earlyBirdPrice) || req.body.earlyBirdPrice < 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "Early bird price must be a valid positive number",
        });
      }

      const updatedProgram = await ProgramService.updateProgram(
        parseInt(id),
        req.body
      );

      res.json({
        success: true,
        data: updatedProgram,
        message: "Program updated successfully",
      });
    } catch (error) {
      console.error("Error in updateProgram:", error);

      let statusCode = 500;
      let message = "Failed to update program";

      if (error.message.includes("not found")) {
        statusCode = 404;
        message = "Program not found";
      } else if (
        error.message.includes("must be") ||
        error.message.includes("future")
      ) {
        statusCode = 400;
        message = "Invalid input data";
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.message,
      });
    }
  }

  static async deleteProgram(req, res) {
    try {
      const { id } = req.params;
      const result = await ProgramService.deleteProgram(parseInt(id));

      const message = result.softDeleted
        ? "Program deactivated successfully (has existing registrations)"
        : "Program deleted successfully";

      res.json({
        success: true,
        message: message,
        data: result,
      });
    } catch (error) {
      console.error("Error in deleteProgram:", error);

      let statusCode = 500;
      let message = "Failed to delete program";

      if (error.message.includes("not found")) {
        statusCode = 404;
        message = "Program not found";
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.message,
      });
    }
  }

  static async getProgramStats(req, res) {
    try {
      const filters = {
        startDate: req.query.start_date,
        endDate: req.query.end_date,
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

      const stats = await ProgramService.getProgramStats(filters);

      res.json({
        success: true,
        data: stats,
        filters: filters,
        message: "Program statistics retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getProgramStats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve program statistics",
        error: error.message,
      });
    }
  }

  static async searchPrograms(req, res) {
    try {
      const { q: searchTerm } = req.query;

      if (!searchTerm || searchTerm.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Search term is required",
        });
      }

      const filters = {
        minPrice: req.query.min_price
          ? parseInt(req.query.min_price)
          : undefined,
        maxPrice: req.query.max_price
          ? parseInt(req.query.max_price)
          : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      };

      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const programs = await ProgramService.searchPrograms(
        searchTerm.trim(),
        filters
      );

      res.json({
        success: true,
        data: programs,
        count: programs.length,
        search_term: searchTerm,
        filters: filters,
        message: "Programs search completed successfully",
      });
    } catch (error) {
      console.error("Error in searchPrograms:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search programs",
        error: error.message,
      });
    }
  }

  static async duplicateProgram(req, res) {
    try {
      const { id } = req.params;
      const { title } = req.body;

      const duplicatedProgram = await ProgramService.duplicateProgram(
        parseInt(id),
        title
      );

      res.status(201).json({
        success: true,
        data: duplicatedProgram,
        message: "Program duplicated successfully",
      });
    } catch (error) {
      console.error("Error in duplicateProgram:", error);

      let statusCode = 500;
      let message = "Failed to duplicate program";

      if (error.message.includes("not found")) {
        statusCode = 404;
        message = "Program not found";
      }

      res.status(statusCode).json({
        success: false,
        message: message,
        error: error.message,
      });
    }
  }
}

module.exports = ProgramController;
