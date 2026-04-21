import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(user: any) {
    if (user.role === Role.ADMIN) {
      return this.getAdminStats();
    }
    return this.getPartnerStats(user);
  }

  // ── Admin Dashboard ────────────────────────────────────────────
  private async getAdminStats() {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [
      totalPartners,
      totalApplications,
      monthApplications,
      recentApplications,
      statusBreakdown,
    ] = await Promise.all([
      this.prisma.partner.count(),
      this.prisma.application.count(),
      this.prisma.application.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd } },
      }),
      this.prisma.application.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { partner: { select: { companyName: true } } },
      }),
      this.prisma.application.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    // Monthly volume for the last 6 months
    const monthlyVolume = await this.getMonthlyVolume(6);

    return {
      overview: { totalPartners, totalApplications, monthApplications },
      statusBreakdown: Object.fromEntries(
        statusBreakdown.map((s) => [s.status, s._count.id]),
      ),
      recentApplications,
      monthlyVolume,
    };
  }

  // ── Partner Dashboard ───────────────────────────────────────────
  private async getPartnerStats(user: any) {
    const userWithPartner = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { partner: true },
    });
    const partner = userWithPartner?.partner ?? null;
    if (!partner) return null;

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const [
      todayApplications,
      weekApplications,
      monthApplications,
      totalApplications,
      recentApplications,
    ] = await Promise.all([
      this.prisma.application.count({
        where: { partnerId: partner.id, createdAt: { gte: dayStart, lte: dayEnd } },
      }),
      this.prisma.application.count({
        where: { partnerId: partner.id, createdAt: { gte: weekStart, lte: weekEnd } },
      }),
      this.prisma.application.count({
        where: { partnerId: partner.id, createdAt: { gte: monthStart, lte: monthEnd } },
      }),
      this.prisma.application.count({ where: { partnerId: partner.id } }),
      this.prisma.application.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, clientFirstName: true, clientLastName: true,
          creditType: true, amount: true, months: true,
          monthlyPayment: true, status: true, createdAt: true,
        },
      }),
    ]);

    const monthlyVolume = await this.getPartnerMonthlyVolume(partner.id, 6);

    return {
      overview: {
        todayApplications,
        weekApplications,
        monthApplications,
        totalApplications,
      },
      recentApplications,
      monthlyVolume,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────
  private async getMonthlyVolume(months: number) {
    const result: { month: string; count: number; volume: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const count = await this.prisma.application.count({
        where: { createdAt: { gte: start, lte: end } },
      });
      const sum = await this.prisma.application.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      });
      result.push({
        month: start.toISOString().slice(0, 7),
        count,
        volume: Number(sum._sum.amount ?? 0),
      });
    }
    return result;
  }

  private async getPartnerMonthlyVolume(partnerId: string, months: number) {
    const result: { month: string; count: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const count = await this.prisma.application.count({
        where: { partnerId, createdAt: { gte: start, lte: end } },
      });
      result.push({ month: start.toISOString().slice(0, 7), count });
    }
    return result;
  }
}
