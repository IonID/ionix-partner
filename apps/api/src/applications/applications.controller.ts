import {
  Controller, Get, Post, Patch, Param, Body, Req,
  UseGuards, UseInterceptors, UploadedFiles, Query,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
  ) {
    return this.applicationsService.findAll(user, +page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalii cerere' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationsService.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Depune o cerere de credit nouă cu documente' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'idFront', maxCount: 1 },
        { name: 'idBack', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
      ],
      { storage: undefined }, // use memory storage — service handles persistence
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

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Actualizează statusul cererii' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
  ) {
    return this.applicationsService.updateStatus(id, body.status, body.notes);
  }
}
