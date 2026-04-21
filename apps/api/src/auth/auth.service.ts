import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Login ─────────────────────────────────────────────────────────
  async login(dto: LoginDto, ipAddress: string) {
    // Email contains '@' → system user (ADMIN/VIEWER); altfel → username partener
    const isEmail = dto.credential.includes('@');
    const user = isEmail
      ? await this.usersService.findByEmail(dto.credential)
      : await this.usersService.findByUsername(dto.credential);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credențiale invalide');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Credențiale invalide');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const identity = user.email ?? user.username ?? user.id;
    const tokens = await this.generateTokens(user.id, identity, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken, ipAddress);

    this.logger.log(`User ${identity} logged in from ${ipAddress}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id:        user.id,
        email:     user.email    ?? null,
        username:  user.username ?? null,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      user.role,
        partner:   user.partner
          ? { id: user.partner.id, companyName: user.partner.companyName, logoPath: user.partner.logoPath ?? null }
          : null,
      },
    };
  }

  // ── Refresh ───────────────────────────────────────────────────────
  async refresh(refreshToken: string, ipAddress: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new ForbiddenException('Token de refresh invalid sau expirat');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new ForbiddenException('Token de refresh invalid sau expirat');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const identity = stored.user.email ?? stored.user.username ?? stored.user.id;
    const tokens = await this.generateTokens(stored.user.id, identity, stored.user.role);
    await this.storeRefreshToken(stored.user.id, tokens.refreshToken, ipAddress);

    return tokens;
  }

  // ── Logout ────────────────────────────────────────────────────────
  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Private helpers ───────────────────────────────────────────────
  private async generateTokens(userId: string, identity: string, role: string) {
    const payload = { sub: userId, identity, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret:    this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRY', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret:    this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRY', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string, ipAddress: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { token, userId, expiresAt, ipAddress },
    });

    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        OR: [
          { revokedAt: { not: null } },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });
  }
}
