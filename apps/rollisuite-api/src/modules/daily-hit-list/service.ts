import { prisma } from '../../db/client';

export class DailyHitListService {
  /**
   * Get today's Daily Hit List
   */
  async getTodayHitList() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hitList = await prisma.dailyHitList.findUnique({
      where: {
        date: today,
      },
    });

    if (!hitList) {
      return {
        date: today.toISOString(),
        items: [],
        metadata: {
          totalJobs: 0,
          urgentCount: 0,
          overdueCount: 0,
        },
      };
    }

    return {
      date: hitList.date.toISOString(),
      items: hitList.items,
      metadata: hitList.metadata || {
        totalJobs: 0,
        urgentCount: 0,
        overdueCount: 0,
      },
      generatedAt: hitList.generatedAt.toISOString(),
    };
  }

  /**
   * Get hit list for a specific date
   */
  async getHitListByDate(date: Date) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const hitList = await prisma.dailyHitList.findUnique({
      where: {
        date: targetDate,
      },
    });

    if (!hitList) {
      return null;
    }

    return {
      date: hitList.date.toISOString(),
      items: hitList.items,
      metadata: hitList.metadata,
      generatedAt: hitList.generatedAt.toISOString(),
    };
  }
}

export const dailyHitListService = new DailyHitListService();
