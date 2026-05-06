import { UsersService } from 'src/users/users.service'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RefreshToken } from './entities/refresh-token.entity'
import {
  AuthResponse,
  LoginDto,
  RegisterDto,
  Role,
} from '@english-platform/shared'
import { User } from 'src/users/user.entity'
import { createHash, randomBytes } from 'crypto'
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

export interface JwtPayload {
  sub: string
  role: Role
  email: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<AuthResponse & { refreshToken: string }> {
    const user = await this.usersService.create(dto)
    return this.issueTokens(user)
  }

  async login(dto: LoginDto): Promise<AuthResponse & { refreshToken: string }> {
    const user = await this.usersService.findByEmail(dto.email)
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password')
    }

    const valid = await this.usersService.validatePassword(user, dto.password)
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password')
    }

    return this.issueTokens(user)
  }

  async refresh(
    rawRefreshToken: string,
  ): Promise<AuthResponse & { refreshToken: string }> {
    const tokenHash = this.hashToken(rawRefreshToken)
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    })

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token')
    }
    if (storedToken.revokedAt) {
      // Token reuse detected — revoke ALL tokens for this user (security measure)
      await this.revokeAllUserTokens(storedToken.userId)
      throw new ForbiddenException(
        'Refresh token reuse detected. All sessions revoked.',
      )
    }
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired')
    }

    // Rotate: revoke old token
    await this.refreshTokenRepository.update(storedToken.id, {
      revokedAt: new Date(),
    })

    const user = await this.usersService.findById(storedToken.userId)
    return this.issueTokens(user)
  }

  private async issueTokens(
    user: User,
  ): Promise<AuthResponse & { refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    }

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_ACCESS_EXPIRES',
      ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
    })

    const rawRefreshToken = randomBytes(32).toString('hex')
    const tokenHash = this.hashToken(rawRefreshToken)

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt: this.calculateRefreshExpiry(),
    })
    await this.refreshTokenRepository.save(refreshTokenEntity)

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      refreshToken: rawRefreshToken,
    }
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken)
    await this.refreshTokenRepository.update(
      { tokenHash },
      { revokedAt: new Date() },
    )
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private calculateRefreshExpiry(): Date {
    const ms = 7 * 24 * 60 * 60 * 1000 // 7 days
    return new Date(Date.now() + ms)
  }

  private async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: undefined as any },
      { revokedAt: new Date() },
    )
  }
}
