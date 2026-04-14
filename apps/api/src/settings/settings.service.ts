import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Returns all settings as a key→value map for easy lookup
  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async getAllDetailed() {
    return this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
  }

  async get(key: string): Promise<string> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`Setarea '${key}' nu există`);
    return setting.value;
  }

  async upsert(key: string, value: string, updatedBy?: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value, updatedBy },
      create: { key, value, updatedBy },
    });
  }

  async updateMany(updates: { key: string; value: string }[], updatedBy?: string) {
    const ops = updates.map((u) =>
      this.prisma.setting.upsert({
        where: { key: u.key },
        update: { value: u.value, updatedBy },
        create: { key: u.key, value: u.value, updatedBy },
      }),
    );
    return this.prisma.$transaction(ops);
  }
}
