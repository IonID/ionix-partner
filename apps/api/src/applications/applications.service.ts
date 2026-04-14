import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalculatorService } from '../calculator/calculator.service';
import { DocumentsService } from '../documents/documents.service';
import { TelegramService } from '../notifications/telegram.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { DocumentType, Role } from '@prisma/client';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: CalculatorService,
    private readonly documents: DocumentsService,
    private readonly telegram: TelegramService,
  ) {}

  async create(
    dto: CreateApplicationDto,
    files: Record<string, Express.Multer.File[]>,
    requestingUser: any,
  ) {
    // Verify partner exists for this user
    const partner = await this.prisma.partner.findUnique({
      where: { userId: requestingUser.id },
      include: { user: true },
    });

    if (!partner) throw new ForbiddenException('Acces refuzat: nu ești partener');

    // Recalculate on backend (never trust frontend calculations)
    const calc = await this.calculator.calculate(
      { creditType: dto.creditType, amount: dto.amount, months: dto.months },
      partner.commissionRate,
    );

    const application = await this.prisma.application.create({
      data: {
        partnerId: partner.id,
        clientFirstName: dto.clientFirstName,
        clientLastName: dto.clientLastName,
        clientIdnp: dto.clientIdnp,
        clientPhone: dto.clientPhone,
        clientEmail: dto.clientEmail,
        clientAddress: dto.clientAddress,
        creditType: dto.creditType,
        amount: calc.amount,
        months: calc.months,
        monthlyRate: calc.monthlyRate,
        monthlyPayment: calc.monthlyPayment,
        totalAmount: calc.totalAmount,
        dae: calc.dae,
        commissionAmount: calc.commissionAmount,
      },
    });

    // Save uploaded documents
    const docTypeMap: Record<string, DocumentType> = {
      idFront: 'ID_FRONT',
      idBack: 'ID_BACK',
      selfie: 'SELFIE',
    };

    for (const [field, fieldFiles] of Object.entries(files)) {
      for (const file of fieldFiles) {
        await this.documents.saveFile(
          file,
          application.id,
          docTypeMap[field] ?? 'OTHER',
        );
      }
    }

    // Send to Telegram
    const msgId = await this.telegram.sendApplication({
      id: application.id,
      clientFirstName: dto.clientFirstName,
      clientLastName: dto.clientLastName,
      clientIdnp: dto.clientIdnp,
      clientPhone: dto.clientPhone,
      creditType: dto.creditType,
      amount: calc.amount,
      months: calc.months,
      monthlyPayment: calc.monthlyPayment,
      totalAmount: calc.totalAmount,
      dae: calc.dae,
      partnerCompany: partner.companyName,
      partnerEmail: partner.user.email,
    });

    if (msgId) {
      await this.prisma.application.update({
        where: { id: application.id },
        data: { telegramMessageId: msgId },
      });
    }

    return this.findOne(application.id, requestingUser);
  }

  async findAll(requestingUser: any, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where =
      requestingUser.role === Role.ADMIN
        ? {}
        : { partner: { userId: requestingUser.id } };

    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          partner: { select: { companyName: true } },
          documents: { select: { id: true, type: true, originalName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, requestingUser: any) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        partner: { include: { user: { select: { email: true } } } },
        documents: true,
      },
    });

    if (!application) throw new NotFoundException('Cererea nu a fost găsită');

    if (
      requestingUser.role !== Role.ADMIN &&
      application.partner.userId !== requestingUser.id
    ) {
      throw new ForbiddenException('Acces refuzat');
    }

    return application;
  }

  async updateStatus(id: string, status: string, notes?: string) {
    const application = await this.prisma.application.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Cererea nu a fost găsită');

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: status as any,
        processorNotes: notes,
      },
    });

    await this.telegram.sendStatusUpdate(id, status, notes);
    return updated;
  }
}
