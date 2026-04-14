import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentType } from '@prisma/client';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = config.get<string>('UPLOAD_DIR', './uploads');
    this.ensureUploadDir();
  }

  async saveFile(
    file: Express.Multer.File,
    applicationId: string,
    docType: DocumentType,
  ) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tip de fișier neacceptat: ${file.mimetype}. Acceptat: JPEG, PNG, WEBP, PDF`,
      );
    }

    if (file.size > MAX_SIZE) {
      throw new BadRequestException('Fișierul depășește limita de 10 MB');
    }

    const ext = path.extname(file.originalname);
    const storedName = `${uuidv4()}${ext}`;
    const subDir = path.join(this.uploadDir, applicationId);
    fs.mkdirSync(subDir, { recursive: true });

    const fullPath = path.join(subDir, storedName);
    fs.writeFileSync(fullPath, file.buffer);

    const relativePath = path.join(applicationId, storedName);

    return this.prisma.document.create({
      data: {
        applicationId,
        type: docType,
        filename: storedName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        path: relativePath,
      },
    });
  }

  getAbsolutePath(relativePath: string): string {
    return path.join(this.uploadDir, relativePath);
  }

  async deleteByApplication(applicationId: string) {
    const docs = await this.prisma.document.findMany({ where: { applicationId } });
    for (const doc of docs) {
      const fullPath = this.getAbsolutePath(doc.path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    await this.prisma.document.deleteMany({ where: { applicationId } });
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Upload directory created: ${this.uploadDir}`);
    }
  }
}
