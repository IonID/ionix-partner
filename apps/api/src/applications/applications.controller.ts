import {
  Controller, Get, Post, Patch, Delete, Param, Body, Req, Res,
  UseGuards, UseInterceptors, UploadedFiles, Query, Logger, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

@ApiTags('Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  private readonly logger = new Logger(ApplicationsController.name);

  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista cererilor (admin: toate, partener: ale sale)' })
  findAll(
    @CurrentUser() user: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.applicationsService.findAll(user, +page, +limit, status);
  }

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Export toate cererile în format Excel (.xlsx)' })
  async exportExcel(@Res() res: Response) {
    const buffer = await this.applicationsService.exportExcel();
    const filename = `cereri-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Șterge o cerere după ID' })
  async deleteOne(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) || (req as any).ip || 'unknown';
    await this.applicationsService.deleteOne(id);
    await this.auditService.log({
      userId: user.id,
      action: 'DELETE_APPLICATION',
      resource: 'application',
      resourceId: id,
      ipAddress: ip,
    });
    return { deleted: 1 };
  }

  @Delete()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Șterge toate cererile din baza de date' })
  async deleteAll(@CurrentUser() user: any, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) || (req as any).ip || 'unknown';
    const result = await this.applicationsService.deleteAll();
    await this.auditService.log({
      userId: user.id,
      action: 'DELETE_ALL_APPLICATIONS',
      resource: 'application',
      ipAddress: ip,
      metadata: { deleted: result.deleted },
    });
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalii cerere' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationsService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PARTNER, 'PARTNER_ADMIN' as any, 'MANAGER' as any)
  @ApiOperation({ summary: '[PARTNER] Depune o cerere de credit nouă cu documente' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'idFront', maxCount: 1 },
        { name: 'idBack', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  async create(
    @Body() dto: CreateApplicationDto,
    @UploadedFiles() files: { idFront?: Express.Multer.File[]; idBack?: Express.Multer.File[]; selfie?: Express.Multer.File[] },
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
    const result = await this.applicationsService.create(dto, files as any, user);

    await this.auditService.log({
      userId: user.id,
      action: 'SUBMIT_APPLICATION',
      resource: 'application',
      resourceId: result.id,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      metadata: { creditType: dto.creditType, amount: dto.amount },
    });

    return result;
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PARTNER, 'PARTNER_ADMIN' as any, 'MANAGER' as any)
  @ApiOperation({ summary: '[PARTNER/MANAGER] Anulează cererea PENDING' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationsService.cancel(id, user);
  }

  @Patch(':id/resubmit')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PARTNER, 'PARTNER_ADMIN' as any, 'MANAGER' as any)
  @ApiOperation({ summary: '[PARTNER/MANAGER] Repune cererea CANCELLED → PENDING' })
  resubmit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationsService.resubmit(id, user);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, 'PARTNER_ADMIN' as any)
  @ApiOperation({ summary: '[ADMIN/PARTNER_ADMIN] Actualizează statusul cererii' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
    @CurrentUser() user: any,
  ) {
    return this.applicationsService.updateStatus(id, body.status, body.notes, user);
  }
}
