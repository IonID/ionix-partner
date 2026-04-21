import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
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
    const user = await this.prisma.user.findUnique({
      where: { id: requestingUser.id },
      include: { partner: true },
    });

    if (!user?.partner) throw new ForbiddenException('Acces refuzat: nu ești partener');
    const partner = user.partner;
    const partnerTelegram = {
      token:   partner.telegramBotToken  ?? undefined,
      chatId:  partner.telegramChatId    ?? undefined,
      enabled: partner.telegramEnabled,
    };

    const calc = await this.calculator.calculate(
      { creditType: dto.creditType, amount: dto.amount, months: dto.months },
      partner.commissionRate,
    );

    const application = await this.prisma.application.create({
      data: {
        partnerId:       partner.id,
        createdByUserId: requestingUser.id,
        clientFirstName: dto.clientFirstName,
        clientLastName:  dto.clientLastName,
        clientIdnp:      dto.clientProduct,   // repurposed column — stores product name
        clientPhone:     dto.clientPhone,
        creditType:      dto.creditType,
        amount:          calc.amount,
        months:          calc.months,
        monthlyRate:     calc.monthlyRate,
        monthlyPayment:  calc.monthlyPayment,
        totalAmount:     calc.totalAmount,
        dae:             calc.dae,
        commissionAmount: calc.commissionAmount,
      },
    });

    const docTypeMap: Record<string, DocumentType> = {
      idFront: 'ID_FRONT',
      idBack:  'ID_BACK',
      selfie:  'SELFIE',
    };

    const docLabelMap: Record<string, string> = {
      idFront: '📋 Buletin de Identitate (față)',
      idBack:  '📋 Buletin de Identitate (verso)',
      selfie:  '🤳 Selfie cu buletinul',
    };

    const savedFiles: { path: string; label: string }[] = [];
    for (const [field, fieldFiles] of Object.entries(files ?? {})) {
      for (const file of fieldFiles) {
        const doc = await this.documents.saveFile(file, application.id, docTypeMap[field] ?? 'OTHER');
        savedFiles.push({
          path:  this.documents.getAbsolutePath(doc.path),
          label: docLabelMap[field] ?? '📎 Document',
        });
      }
    }

    const msgId = await this.telegram.sendApplication(
      {
        applicationId:   application.id,
        clientFirstName: dto.clientFirstName,
        clientLastName:  dto.clientLastName,
        clientProduct:   dto.clientProduct,
        clientPhone:     dto.clientPhone,
        creditType:      dto.creditType,
        amount:          calc.amount,
        months:          calc.months,
        monthlyPayment:  calc.monthlyPayment,
        totalAmount:     calc.totalAmount,
        dae:             calc.dae,
      },
      partnerTelegram,
      savedFiles,
    );

    if (msgId) {
      await this.prisma.application.update({
        where: { id: application.id },
        data: { telegramMessageId: msgId },
      });
    }

    return this.findOne(application.id, requestingUser);
  }

  async findAll(requestingUser: any, page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;

    const isSystemWide = requestingUser.role === Role.ADMIN || requestingUser.role === Role.VIEWER;
    const baseWhere = isSystemWide
      ? {}
      : { partner: { users: { some: { id: requestingUser.id } } } };

    const where = status ? { ...baseWhere, status: status as any } : baseWhere;

    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          partner:          { select: { companyName: true, logoPath: true } },
          documents:        { select: { id: true, type: true, originalName: true } },
          createdByUser:    { select: { id: true, firstName: true, lastName: true } },
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
        partner: {
          include: {
            users: {
              where: { role: { in: ['PARTNER_ADMIN', 'MANAGER', 'PARTNER'] as any[] } },
              select: { id: true, email: true, username: true, firstName: true, lastName: true, role: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        documents:        true,
        createdByUser:    { select: { id: true, firstName: true, lastName: true, email: true, username: true, role: true } },
      },
    });

    if (!application) throw new NotFoundException('Cererea nu a fost găsită');

    const isSystemWide = requestingUser.role === Role.ADMIN || requestingUser.role === Role.VIEWER;
    if (!isSystemWide) {
      const isMember = await this.prisma.user.findFirst({
        where: { id: requestingUser.id, partnerId: application.partnerId },
      });
      if (!isMember) throw new ForbiddenException('Acces refuzat');
    }

    return application;
  }

  async cancel(id: string, requestingUser: any) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: { partner: { select: { telegramBotToken: true, telegramChatId: true, telegramEnabled: true } } },
    });

    if (!application) throw new NotFoundException('Cererea nu a fost găsită');

    if (application.status !== 'PENDING') {
      throw new BadRequestException('Doar cererile în așteptare pot fi anulate');
    }

    await this.assertPartnerAccess(application, requestingUser, 'anula');

    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: 'CANCELLED', statusChangedByName: `${requestingUser.firstName} ${requestingUser.lastName}` },
    });

    await this.telegram.sendStatusUpdate(id, 'CANCELLED', undefined, {
      token:   application.partner.telegramBotToken ?? undefined,
      chatId:  application.partner.telegramChatId   ?? undefined,
      enabled: application.partner.telegramEnabled,
    });

    return updated;
  }

  async resubmit(id: string, requestingUser: any) {
    const application = await this.prisma.application.findUnique({ where: { id } });

    if (!application) throw new NotFoundException('Cererea nu a fost găsită');

    if (application.status !== 'CANCELLED') {
      throw new BadRequestException('Doar cererile anulate pot fi repuse');
    }

    await this.assertPartnerAccess(application, requestingUser, 'repune');

    return this.prisma.application.update({
      where: { id },
      data: { status: 'PENDING', statusChangedByName: `${requestingUser.firstName} ${requestingUser.lastName}` },
    });
  }

  private async assertPartnerAccess(application: any, requestingUser: any, action: string) {
    if (requestingUser.role === Role.ADMIN) return;

    if (requestingUser.role === 'PARTNER_ADMIN') {
      const isMember = await this.prisma.user.findFirst({
        where: { id: requestingUser.id, partnerId: application.partnerId },
      });
      if (!isMember) throw new ForbiddenException('Acces refuzat');
      return;
    }

    // MANAGER / PARTNER — doar propriile cereri
    if (application.createdByUserId !== requestingUser.id) {
      throw new ForbiddenException(`Doar utilizatorul care a depus cererea o poate ${action}`);
    }
  }

  async exportCsv(): Promise<string> {
    const apps = await this.prisma.application.findMany({
      include: { partner: { select: { companyName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'ID', 'Partener', 'Prenume', 'Nume', 'Telefon', 'Produs',
      'Tip Credit', 'Suma (MDL)', 'Termen (luni)', 'Rată lunară (MDL)',
      'VTP (MDL)', 'DAE (%)', 'Status', 'Data cererii',
    ];

    const escape = (v: any) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const rows = apps.map((a) => [
      a.id,
      a.partner?.companyName ?? '',
      a.clientFirstName,
      a.clientLastName,
      a.clientPhone,
      a.clientIdnp ?? '',  // product name stored here
      a.creditType,
      a.amount.toFixed(2),
      a.months,
      a.monthlyPayment.toFixed(2),
      a.totalAmount.toFixed(2),
      a.dae.toFixed(2),
      a.status,
      new Date(a.createdAt).toISOString().replace('T', ' ').slice(0, 19),
    ].map(escape).join(','));

    return [headers.join(','), ...rows].join('\r\n');
  }

  async exportExcel(): Promise<Buffer> {
    const apps = await this.prisma.application.findMany({
      include: { partner: { select: { companyName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Ionix Partner';
    wb.created = new Date();

    const ws = wb.addWorksheet('Cereri Credit', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // ── Columns definition ───────────────────────────────────────────
    ws.columns = [
      { header: 'ID',              key: 'id',        width: 38 },
      { header: 'Partener',        key: 'partner',   width: 18 },
      { header: 'Prenume',         key: 'firstName', width: 16 },
      { header: 'Nume',            key: 'lastName',  width: 16 },
      { header: 'Telefon',         key: 'phone',     width: 14 },
      { header: 'Produs',          key: 'product',   width: 24 },
      { header: 'Tip Credit',      key: 'type',      width: 12 },
      { header: 'Sumă (MDL)',      key: 'amount',    width: 14 },
      { header: 'Termen (luni)',   key: 'months',    width: 14 },
      { header: 'Rată lunară',     key: 'monthly',   width: 14 },
      { header: 'VTP (MDL)',       key: 'total',     width: 14 },
      { header: 'DAE (%)',         key: 'dae',       width: 10 },
      { header: 'Status',          key: 'status',    width: 14 },
      { header: 'Data cererii',    key: 'createdAt', width: 20 },
    ];

    // ── Header row style ─────────────────────────────────────────────
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF219653' } };
      cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF16A34A' } },
      };
    });
    headerRow.height = 24;

    // ── Status colour map ────────────────────────────────────────────
    const statusColor: Record<string, string> = {
      PENDING:    'FFFEF9C3',
      PROCESSING: 'FFDBEAFE',
      APPROVED:   'FFD1FAE5',
      REJECTED:   'FFFEE2E2',
      CANCELLED:  'FFF3F4F6',
    };

    // ── Data rows ────────────────────────────────────────────────────
    apps.forEach((a, idx) => {
      const row = ws.addRow({
        id:        a.id,
        partner:   a.partner?.companyName ?? '',
        firstName: a.clientFirstName,
        lastName:  a.clientLastName,
        phone:     a.clientPhone,
        product:   a.clientIdnp ?? '',
        type:      a.creditType,
        amount:    Number(a.amount),
        months:    a.months,
        monthly:   Number(a.monthlyPayment),
        total:     Number(a.totalAmount),
        dae:       Number(a.dae),
        status:    a.status,
        createdAt: new Date(a.createdAt).toLocaleString('ro-MD'),
      });

      // Alternate row background
      const rowBg = idx % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.alignment = { vertical: 'middle', horizontal: col <= 2 ? 'left' : 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };
      });

      // Status cell highlight
      const statusCell = row.getCell('status');
      const bgColor = statusColor[a.status] ?? 'FFFFFFFF';
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      statusCell.font = { bold: true };

      // Number format for monetary columns
      (['amount', 'monthly', 'total'] as const).forEach((key) => {
        const cell = row.getCell(key);
        cell.numFmt = '#,##0.00';
      });
      row.getCell('dae').numFmt = '0.00"%"';

      row.height = 20;
    });

    // ── Summary row ──────────────────────────────────────────────────
    if (apps.length > 0) {
      const lastDataRow = apps.length + 1;
      ws.addRow([]);  // blank separator
      const sumRow = ws.addRow({
        id: 'TOTAL',
        partner: `${apps.length} cereri`,
        amount:  { formula: `SUM(H2:H${lastDataRow})` },
        monthly: { formula: `AVERAGE(J2:J${lastDataRow})` },
        total:   { formula: `SUM(L2:L${lastDataRow})` },
      });
      sumRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        cell.font = { bold: true, color: { argb: 'FF065F46' } };
        cell.border = { top: { style: 'medium', color: { argb: 'FF16A34A' } } };
      });
      (['amount', 'monthly', 'total'] as const).forEach((key) => {
        sumRow.getCell(key).numFmt = '#,##0.00';
      });
      sumRow.height = 22;
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async deleteOne(id: string): Promise<void> {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Cererea nu a fost găsită');
    await this.documents.deleteByApplication(id);
    await this.prisma.application.delete({ where: { id } });
  }

  async deleteAll(): Promise<{ deleted: number }> {
    const apps = await this.prisma.application.findMany({ select: { id: true } });
    for (const app of apps) {
      await this.documents.deleteByApplication(app.id);
    }
    const result = await this.prisma.application.deleteMany({});
    return { deleted: result.count };
  }

  async updateStatus(id: string, status: string, notes?: string, requestingUser?: any) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        partner: { select: { telegramBotToken: true, telegramChatId: true, telegramEnabled: true } },
        createdByUser: { select: { role: true } },
      },
    });
    if (!application) throw new NotFoundException('Cererea nu a fost găsită');

    if (requestingUser && requestingUser.role === 'PARTNER_ADMIN') {
      const isMember = await this.prisma.user.findFirst({
        where: { id: requestingUser.id, partnerId: application.partnerId },
      });
      if (!isMember) throw new ForbiddenException('Acces refuzat');

      if (application.createdByUser?.role !== 'MANAGER') {
        throw new ForbiddenException('Admin Partener poate modifica statusul doar pentru cererile depuse de Manageri');
      }
    }

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: status as any,
        processorNotes: notes,
        ...(requestingUser && { statusChangedByName: `${requestingUser.firstName} ${requestingUser.lastName}` }),
      },
    });

    await this.telegram.sendStatusUpdate(id, status, notes, {
      token:   application.partner.telegramBotToken ?? undefined,
      chatId:  application.partner.telegramChatId   ?? undefined,
      enabled: application.partner.telegramEnabled,
    });

    return updated;
  }
}
