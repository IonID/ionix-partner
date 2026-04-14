import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userSelect = {
    id: true,
    email: true,
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
        commissionRate: true,
        calculatorConfig: true,
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
    return this.prisma.user.findUnique({
      where: { id },
      select: this.userSelect,
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { partner: true },
    });
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email deja înregistrat');

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        partner: dto.role === 'PARTNER' && dto.partner
          ? {
              create: {
                companyName: dto.partner.companyName,
                commissionRate: dto.partner.commissionRate ?? 0,
                calculatorConfig: dto.partner.calculatorConfig,
              },
            }
          : undefined,
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

    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 12);
    }

    if (dto.partner) {
      data.partner = {
        update: {
          ...(dto.partner.companyName && { companyName: dto.partner.companyName }),
          ...(dto.partner.commissionRate !== undefined && { commissionRate: dto.partner.commissionRate }),
          ...(dto.partner.calculatorConfig && { calculatorConfig: dto.partner.calculatorConfig }),
        },
      };
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: this.userSelect,
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
