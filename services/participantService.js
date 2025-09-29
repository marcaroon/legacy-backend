const prisma = require("../config/prismaClient");

class ParticipantService {
  async getAllParticipants(filters = {}) {
    try {
      const whereClause = {};

      if (filters.registration_id) {
        whereClause.registrationId = parseInt(filters.registration_id);
      }

      const participants = await prisma.participant.findMany({
        where: whereClause,
        include: {
          registration: {
            select: {
              registrationId: true,
              midtransOrderId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const totalCount = await prisma.participant.count({
        where: whereClause,
      });

      return {
        participants,
        totalCount,
      };
    } catch (error) {
      console.error("Error fetching participants:", error);
      throw new Error(`Error fetching participants: ${error.message}`);
    }
  }

  async getParticipantById(id) {
    try {
      const participant = await prisma.participant.findUnique({
        where: { id: parseInt(id) },
      });

      return participant;
    } catch (error) {
      console.error("Error fetching participant:", error);
      throw new Error(`Error fetching participant: ${error.message}`);
    }
  }
}

module.exports = new ParticipantService();
