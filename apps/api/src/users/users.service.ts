import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = config.get<string>('UPLOAD_DIR', './uploads');
  }

  private readonly userSelect = {
    id: true,
    email: true,
    username: true,
    firstName: true,
    lastName: true,
    role: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    partner: {
      select: {
        id: true,
        companyName: true,
        logoPath: true,
        calculatorConfig: true,
        telegramBotToken: true,
        telegramChatId: true,
        telegramEnabled: true,
        users: {
          select: { id: true, firstName: true, lastName: true, email: true, username: true, role: true, isActive: true },
          orderBy: { createdAt: 'asc' as const },
        },
      },
    },
  } as const;

  async findAll() {
    return this.prisma.user.findMany({
      select: this.userSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: this.userSelect });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { partner: { include: { users: { select: { id: true } } } } },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: { partner: { include: { users: { select: { id: true } } } } },
    });
  }

  async create(dto: CreateUserDto) {
    if (dto.email) {
      const emailExists = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (emailExists) throw new ConflictException('Email deja înregistrat');
    }

    if (dto.username) {
      const usernameExists = await this.prisma.user.findUnique({ where: { username: dto.username } });
      if (usernameExists) throw new ConflictException('Username deja înregistrat');
    }

    if (dto.partner && dto.partnerId) {
      throw new BadRequestException('Specifică fie "partner" (nou), fie "partnerId" (existent), nu ambele');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    if (dto.partnerId) {
      const partnerExists = await this.prisma.partner.findUnique({ where: { id: dto.partnerId } });
      if (!partnerExists) throw new NotFoundException('Partenerul nu a fost găsit');

      return this.prisma.user.create({
        data: {
          email: dto.email ?? null,
          username: dto.username ?? null,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role ?? 'MANAGER',
          partnerId: dto.partnerId,
        },
        select: this.userSelect,
      });
    }

    if (dto.partner) {
      return this.prisma.user.create({
        data: {
          email: dto.email ?? null,
          username: dto.username ?? null,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'PARTNER_ADMIN',
          partner: {
            create: {
              companyName: dto.partner.companyName,
              calculatorConfig: dto.partner.calculatorConfig,
            },
          },
        },
        select: this.userSelect,
      });
    }

    return this.prisma.user.create({
      data: {
        email: dto.email ?? null,
        username: dto.username ?? null,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role ?? 'MANAGER',
      },
      select: this.userSelect,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.ensureExists(id);

    const data: any = {
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    if (dto.password) data.password = await bcrypt.hash(dto.password, 12);

    if (dto.partner) {
      data.partner = {
        update: {
          ...(dto.partner.companyName && { companyName: dto.partner.companyName }),
          ...(dto.partner.calculatorConfig && { calculatorConfig: dto.partner.calculatorConfig }),
        },
      };
    }

    return this.prisma.user.update({ where: { id }, data, select: this.userSelect });
  }

  async uploadLogo(partnerId: string, file: Express.Multer.File): Promise<string> {
    const allowed = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Format acceptat: PNG, SVG, JPEG, WEBP');
    }
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('Logo max 2 MB');

    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Partenerul nu a fost găsit');

    const logoDir = path.join(this.uploadDir, 'logos');
    fs.mkdirSync(logoDir, { recursive: true });

    // Delete old logo if exists
    if (partner.logoPath) {
      const old = path.join(this.uploadDir, partner.logoPath);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }

    const ext = path.extname(file.originalname) || '.png';
    const filename = `${uuidv4()}${ext}`;
    fs.writeFileSync(path.join(logoDir, filename), file.buffer);

    const relativePath = `logos/${filename}`;   // always forward slashes for URL usage
    await this.prisma.partner.update({ where: { id: partnerId }, data: { logoPath: relativePath } });

    return relativePath;
  }

  async updatePartnerTelegram(
    partnerId: string,
    dto: { telegramBotToken?: string; telegramChatId?: string; telegramEnabled?: boolean },
  ) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Partenerul nu a fost găsit');

    return this.prisma.partner.update({
      where: { id: partnerId },
      data: {
        telegramBotToken: dto.telegramBotToken ?? null,
        telegramChatId:   dto.telegramChatId   ?? null,
        ...(dto.telegramEnabled !== undefined && { telegramEnabled: dto.telegramEnabled }),
      },
      select: { id: true, telegramBotToken: true, telegramChatId: true, telegramEnabled: true },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.user.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilizatorul nu a fost găsit');
    return user;
  }
}
