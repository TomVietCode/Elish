# Auth & Admin Layout — Implementation Guide

> **Audience:** Developer implementing Phase 0/1 of the English Learning Platform.
> **Prerequisite:** pnpm monorepo already scaffolded (`apps/api`, `apps/web`, `packages/shared`).
> **Last updated:** 2026-05-02

---

## Table of Contents

1. [Feature 1 — Dependency Installation](#feature-1--dependency-installation)
2. [Feature 2 — Authentication](#feature-2--authentication-register-login-refresh-token-role-based-access)
3. [Feature 3 — Admin Layout](#feature-3--admin-layout-sidebar--header--main)
4. [Running the Full Stack Locally](#running-the-full-stack-locally)

---

## Feature 1 — Dependency Installation

### Problem Analysis & Approach

**What we need:**
The monorepo has three package zones — `apps/api` (NestJS), `apps/web` (Next.js), and `packages/shared` (Zod schemas). Each zone needs its own set of dependencies installed at the correct scope. Installing a package at the wrong scope causes phantom dependency issues in pnpm's strict hoisting model.

**Key decisions:**


| Decision             | Choice                                                 | Rationale                                                                                                                                   |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Root-level devDeps?  | Minimal — only `turbo` if we add it later              | pnpm workspaces already handle per-app tooling; root deps should be orchestration-only                                                      |
| ORM for API          | TypeORM (per `CLAUDE.md` spec)                         | Already decided; class-based entity model integrates with NestJS decorators                                                                 |
| HTTP client for web  | `axios`                                                | Widely used, interceptor API makes token refresh straightforward                                                                            |
| Auth library for web | Custom Zustand store + axios interceptor (no NextAuth) | NextAuth adds complexity for a custom JWT backend; a thin client-side token store is simpler for our "API issues its own JWTs" architecture |
| Component library    | shadcn/ui (installed via CLI)                          | Not an npm dependency — generates source files into the project                                                                             |


**Peer-dependency notes:**

- `@nestjs/passport` requires `passport` as a peer — install both.
- `@nestjs/jwt` requires `@nestjs/common` ≥ 10 — already satisfied (v11).
- `class-validator` and `class-transformer` must be installed together.
- `bcrypt` requires native compilation — use `bcryptjs` (pure JS) to avoid build issues on Windows and Docker.
- `@hookform/resolvers` requires `react-hook-form` as a peer.

### Implementation Steps

#### Step 1 — `packages/shared` dependencies

The shared package only needs `zod` — already installed. No changes needed.

```jsonc
// packages/shared/package.json  (already correct)
{
  "name": "@english-platform/shared",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

#### Step 2 — `apps/api` dependencies

```bash
# Production dependencies
pnpm --filter api add \
  @nestjs/config \
  @nestjs/passport \
  @nestjs/jwt \
  @nestjs/typeorm \
  @nestjs/swagger \
  passport \
  passport-jwt \
  typeorm \
  pg \
  bcryptjs \
  class-validator \
  class-transformer \
  helmet \
  cookie-parser

# Dev dependencies
pnpm --filter api add -D \
  @types/passport-jwt \
  @types/bcryptjs \
  @types/cookie-parser
```


| Package                                 | Why                                                |
| --------------------------------------- | -------------------------------------------------- |
| `@nestjs/config`                        | Typed env var access via `ConfigService`           |
| `@nestjs/passport` + `passport`         | Passport strategy integration for JWT guard        |
| `@nestjs/jwt`                           | JWT sign/verify integrated with NestJS DI          |
| `@nestjs/typeorm` + `typeorm` + `pg`    | PostgreSQL ORM with decorator-based entities       |
| `@nestjs/swagger`                       | Auto-generated API docs at `/api/docs`             |
| `bcryptjs`                              | Pure-JS password hashing (no native build step)    |
| `class-validator` + `class-transformer` | DTO validation via decorators on incoming requests |
| `helmet`                                | Security headers middleware                        |
| `cookie-parser`                         | Parse `httpOnly` refresh-token cookie              |
| `passport-jwt`                          | JWT extraction strategy for Passport               |


#### Step 3 — `apps/web` dependencies

```bash
# Production dependencies
pnpm --filter web add \
  axios \
  zustand \
  @tanstack/react-query \
  react-hook-form \
  @hookform/resolvers \
  zod \
  lucide-react \
  clsx \
  tailwind-merge \
  class-variance-authority \
  next-themes

# Dev dependencies
pnpm --filter web add -D \
  @types/node
```


| Package                                   | Why                                                             |
| ----------------------------------------- | --------------------------------------------------------------- |
| `axios`                                   | HTTP client with interceptor API for token attach + 401 refresh |
| `zustand`                                 | Lightweight client state store (auth state, UI state)           |
| `@tanstack/react-query`                   | Server-state cache, retry, and invalidation                     |
| `react-hook-form` + `@hookform/resolvers` | Performant forms validated against shared Zod schemas           |
| `zod`                                     | Runtime validation (peer of `@hookform/resolvers`)              |
| `lucide-react`                            | Icon set used throughout the UI                                 |
| `clsx` + `tailwind-merge`                 | Utility for conditional class merging (shadcn `cn()` helper)    |
| `class-variance-authority`                | Variant-based component styling (shadcn pattern)                |
| `next-themes`                             | Dark/light theme without FOUC                                   |


#### Step 4 — Initialize shadcn/ui

shadcn/ui is **not** an npm package — it generates component source files. Run the CLI inside `apps/web`:

```bash
cd apps/web
pnpm dlx shadcn@latest init
```

When prompted:

- Style: **Default**
- Base color: **Neutral** (we override with design.md tokens)
- CSS variables: **Yes**
- Components path: `@/components/ui`
- Utils path: `@/lib/utils`

Then install the specific components we need:

```bash
pnpm dlx shadcn@latest add \
  button \
  input \
  label \
  card \
  dialog \
  tabs \
  dropdown-menu \
  avatar \
  separator \
  sheet \
  badge \
  form \
  sonner
```

#### Step 5 — Create `.env.example`

```bash
# .env.example (monorepo root)

# ── Database ──────────────────────────────────────────
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=english_platform

# ── JWT ───────────────────────────────────────────────
JWT_ACCESS_SECRET=change-me-access-secret-min-32-chars
JWT_REFRESH_SECRET=change-me-refresh-secret-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# ── API ───────────────────────────────────────────────
API_PORT=4000
API_CORS_ORIGIN=http://localhost:3000

# ── Azure OpenAI (Phase 2+) ──────────────────────────
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

# ── Azure Speech (Phase 2+) ──────────────────────────
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=

# ── Web (Next.js) ────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:4000
```

#### Step 6 — Create `docker-compose.yml`

```yaml
# docker-compose.yml (monorepo root)
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: english_platform
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

### Verification

```bash
# 1. Start database
docker compose up -d

# 2. Verify shared package resolves
pnpm --filter api exec -- node -e "console.log(require.resolve('@english-platform/shared'))"

# 3. Verify API builds
pnpm --filter api build

# 4. Verify web dev server starts
pnpm --filter web dev
```

---

## Feature 2 — Authentication (Register, Login, Refresh Token, Role-Based Access)

### Problem Analysis & Approach

#### Auth flow (full lifecycle)

```
Register → hash password → persist user → issue access + refresh tokens
Login    → verify credentials → issue access + refresh tokens
Request  → attach access token (Authorization header) → JwtAuthGuard validates
Refresh  → read httpOnly cookie → validate & rotate refresh token → new access token
Logout   → revoke refresh token in DB → clear cookie
```

**MVP simplification:** No email verification. Users can log in immediately after registration.

#### Token storage strategy


| Strategy                                          | Pros                                                                                    | Cons                                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Access in memory + Refresh in httpOnly cookie** | XSS can't steal refresh token; access token is short-lived so memory-only is acceptable | Slightly more complex client code; access token lost on page refresh (triggers silent refresh) |
| Both in httpOnly cookies                          | Simplest CSRF-safe approach                                                             | Harder to use with non-browser clients; every request sends cookies                            |
| Both in localStorage                              | Simplest implementation                                                                 | Vulnerable to XSS — any injected script can steal tokens                                       |


**Decision: Access token in memory (Zustand store) + Refresh token in httpOnly secure cookie.**

The access token lives only in the JavaScript runtime (Zustand store). On page load, the client calls `POST /auth/refresh` to get a new access token from the httpOnly refresh cookie. This means:

- XSS cannot access the refresh token (httpOnly).
- The access token is short-lived (15 min) and never persisted to storage.
- CSRF is mitigated because mutations go through the API with a `Bearer` token header, not automatic cookie auth.

#### Role model

Two roles stored as a PostgreSQL enum on the `users` table:


| Role    | Capabilities                                                     |
| ------- | ---------------------------------------------------------------- |
| `user`  | Access learning features, own progress                           |
| `admin` | All user capabilities + admin panel (CRUD content, manage users) |


Roles are enforced via a `@Roles('admin')` decorator + `RolesGuard` that reads the role from the JWT payload.

**Role escalation protection:** The `role` field is never accepted from client input during registration (always defaults to `user`). Only a database seed or a separate admin CLI can create admin accounts.

#### Edge cases

1. **Expired refresh token:** Return 401, client redirects to login.
2. **Concurrent refresh requests (race condition):** Use a "token family" approach — when a refresh token is used, the old one is revoked and a new one issued. If a revoked token is presented again, revoke the entire family (all tokens for that user) as a security measure.
3. **Revoked token reuse:** If someone presents an already-revoked refresh token, it indicates token theft. Revoke all tokens for that user.

### Implementation Steps

---

#### Step 1 — Shared Zod schemas and types (`packages/shared`)

Create the barrel export and auth schemas.

```typescript
// packages/shared/src/index.ts

export * from './schemas/auth.schema';
export * from './enums';
```

```typescript
// packages/shared/src/enums/index.ts

export enum Role {
  USER = 'user',
  ADMIN = 'admin',
}

export enum DifficultyLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}
```

```typescript
// packages/shared/src/schemas/auth.schema.ts

import { z } from 'zod';
import { Role } from '../enums';

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
    ),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must be at most 100 characters')
    .trim(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string(),
    role: z.nativeEnum(Role),
  }),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export type AuthUser = AuthResponse['user'];
```

---

#### Step 2 — API configuration module (`apps/api`)

Set up `@nestjs/config` for typed environment variable access.

```typescript
// apps/api/src/config/env.validation.ts

import { plainToInstance, Type } from 'class-transformer';
import { IsNumber, IsString, MinLength, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  DATABASE_HOST: string;

  @IsNumber()
  @Type(() => Number)
  DATABASE_PORT: number;

  @IsString()
  DATABASE_USERNAME: string;

  @IsString()
  DATABASE_PASSWORD: string;

  @IsString()
  DATABASE_NAME: string;

  @IsString()
  @MinLength(16)
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(16)
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_ACCESS_EXPIRES: string;

  @IsString()
  JWT_REFRESH_EXPIRES: string;

  @IsNumber()
  @Type(() => Number)
  API_PORT: number;

  @IsString()
  API_CORS_ORIGIN: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });
  if (errors.length > 0) {
    throw new Error(`Config validation error:\n${errors.toString()}`);
  }
  return validated;
}
```

---

#### Step 3 — User entity (`apps/api`)

```typescript
// apps/api/src/users/user.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '@english-platform/shared';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash', nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 20, default: 'local' })
  provider: string;

  @Column({ type: 'varchar', length: 100, name: 'display_name' })
  displayName: string;

  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  locale: string;

  @Column({ type: 'varchar', length: 20, default: 'light' })
  theme: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
```

---

#### Step 4 — Refresh token entity (`apps/api`)

```typescript
// apps/api/src/auth/entities/refresh-token.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255, name: 'token_hash', unique: true })
  tokenHash: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
```

---

#### Step 5 — Users module (`apps/api`)

```typescript
// apps/api/src/users/users.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

```typescript
// apps/api/src/users/users.service.ts

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { RegisterDto, Role } from '@english-platform/shared';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: RegisterDto): Promise<User> {
    const exists = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      role: Role.USER,
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }
}
```

---

#### Step 6 — Auth module, service, controller (`apps/api`)

**Auth service** — handles token issuance, refresh rotation, and logout.

```typescript
// apps/api/src/auth/auth.service.ts

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import {
  AuthResponse,
  LoginDto,
  RegisterDto,
  Role,
} from '@english-platform/shared';
import { User } from '../users/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
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

  async register(dto: RegisterDto): Promise<AuthResponse & { refreshToken: string }> {
    const user = await this.usersService.create(dto);
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse & { refreshToken: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await this.usersService.validatePassword(user, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user);
  }

  async refresh(rawRefreshToken: string): Promise<AuthResponse & { refreshToken: string }> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      // Token reuse detected — revoke ALL tokens for this user (security measure)
      await this.revokeAllUserTokens(storedToken.userId);
      throw new ForbiddenException(
        'Refresh token reuse detected. All sessions revoked.',
      );
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: revoke old token
    await this.refreshTokenRepository.update(storedToken.id, {
      revokedAt: new Date(),
    });

    const user = await this.usersService.findById(storedToken.userId);
    return this.issueTokens(user);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.refreshTokenRepository.update(
      { tokenHash },
      { revokedAt: new Date() },
    );
  }

  private async issueTokens(user: User): Promise<AuthResponse & { refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES'),
    });

    const rawRefreshToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt: this.calculateRefreshExpiry(),
    });
    await this.refreshTokenRepository.save(refreshTokenEntity);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      refreshToken: rawRefreshToken,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private calculateRefreshExpiry(): Date {
    const ms = 7 * 24 * 60 * 60 * 1000; // 7 days
    return new Date(Date.now() + ms);
  }

  private async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: undefined as any },
      { revokedAt: new Date() },
    );
  }
}
```

**Auth controller** — REST endpoints with cookie handling.

```typescript
// apps/api/src/auth/auth.controller.ts

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterRequestDto } from './dto/register-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { Public } from './decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

const REFRESH_COOKIE_NAME = 'refresh_token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async register(
    @Body() dto: RegisterRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async login(
    @Body() dto: LoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refresh(rawToken);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    this.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }
}
```

---

#### Step 7 — NestJS DTOs with class-validator (`apps/api`)

The shared package defines Zod schemas. The API needs `class-validator` DTOs for NestJS's `ValidationPipe`. These DTOs mirror the Zod schemas.

```typescript
// apps/api/src/auth/dto/register-request.dto.ts

import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Str0ngP@ss' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;
}
```

```typescript
// apps/api/src/auth/dto/login-request.dto.ts

import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Str0ngP@ss' })
  @IsString()
  @MinLength(1)
  password: string;
}
```

---

#### Step 8 — JWT strategy and guards (`apps/api`)

```typescript
// apps/api/src/auth/strategies/jwt.strategy.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
```

```typescript
// apps/api/src/auth/guards/jwt-auth.guard.ts

import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
```

```typescript
// apps/api/src/auth/guards/roles.guard.ts

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@english-platform/shared';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
```

---

#### Step 9 — Decorators (`apps/api`)

```typescript
// apps/api/src/auth/decorators/public.decorator.ts

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// apps/api/src/auth/decorators/roles.decorator.ts

import { SetMetadata } from '@nestjs/common';
import { Role } from '@english-platform/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// apps/api/src/auth/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

---

#### Step 10 — Auth module wiring (`apps/api`)

```typescript
// apps/api/src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshToken]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

---

#### Step 11 — Root AppModule with global guard (`apps/api`)

```typescript
// apps/api/src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '../../.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT'),
        username: config.get<string>('DATABASE_USERNAME'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: true, // DEV ONLY — use migrations in production
      }),
    }),
    AuthModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

---

#### Step 12 — Update `main.ts` (`apps/api`)

```typescript
// apps/api/src/main.ts

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: config.get<string>('API_CORS_ORIGIN'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('English Learning Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('API_PORT') ?? 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
```

---

#### Step 13 — Admin seed script (`apps/api`)

Admins are never created via the public API. Use a seed script.

```typescript
// apps/api/src/database/seeds/admin-seed.ts

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../users/user.entity';
import { Role } from '@english-platform/shared';

/**
 * Run with: npx ts-node -r tsconfig-paths/register src/database/seeds/admin-seed.ts
 *
 * Requires these env vars: DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME,
 * DATABASE_PASSWORD, DATABASE_NAME
 */
async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    username: process.env.DATABASE_USERNAME ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'english_platform',
    entities: [User],
    synchronize: false,
  });

  await ds.initialize();
  const repo = ds.getRepository(User);

  const email = 'admin@englishplatform.local';
  const exists = await repo.findOne({ where: { email } });
  if (exists) {
    console.log('Admin user already exists. Skipping.');
    await ds.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash('Admin@123', 12);
  const admin = repo.create({
    email,
    passwordHash,
    displayName: 'Admin',
    role: Role.ADMIN,
  });
  await repo.save(admin);
  console.log(`Admin user created: ${email}`);
  await ds.destroy();
}

seed().catch(console.error);
```

---

#### Step 14 — Frontend: `cn()` utility and design tokens (`apps/web`)

```typescript
// apps/web/lib/utils.ts

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Update `globals.css` to inject the design system tokens from `design.md`:

```css
/* apps/web/app/globals.css */

@import "tailwindcss";

:root {
  /* Design System: Notion Beige */
  --color-primary: #191918;
  --color-secondary: #8C877D;
  --color-tertiary: #C26B5B;
  --color-neutral: #F7F6F3;
  --color-surface: #FFFFFF;
  --color-on-primary: #FFFFFF;

  /* Spacing */
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 32px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;

  /* Shadcn overrides */
  --background: var(--color-neutral);
  --foreground: var(--color-primary);
  --card: var(--color-surface);
  --card-foreground: var(--color-primary);
  --primary: var(--color-tertiary);
  --primary-foreground: var(--color-on-primary);
  --secondary: var(--color-secondary);
  --secondary-foreground: var(--color-primary);
  --muted: #f0efeb;
  --muted-foreground: var(--color-secondary);
  --border: #e5e3de;
  --input: #e5e3de;
  --ring: var(--color-tertiary);
  --radius: var(--radius-md);
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
  --accent: #f0efeb;
  --accent-foreground: var(--color-primary);
  --popover: var(--color-surface);
  --popover-foreground: var(--color-primary);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
```

---

#### Step 15 — Frontend: Axios client with interceptor (`apps/web`)

```typescript
// apps/web/lib/api-client.ts

import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
    : 'http://localhost:4000/api/v1',
  withCredentials: true, // send httpOnly cookies
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${apiClient.defaults.baseURL}/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const newToken = data.accessToken as string;
      useAuthStore.getState().setAuth(newToken, data.user);
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      useAuthStore.getState().clearAuth();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export { apiClient };
```

---

#### Step 16 — Frontend: Auth Zustand store (`apps/web`)

```typescript
// apps/web/stores/auth-store.ts

import { create } from 'zustand';
import type { AuthUser } from '@english-platform/shared';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (accessToken: string, user: AuthUser) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (accessToken, user) =>
    set({ accessToken, user, isAuthenticated: true, isLoading: false }),

  clearAuth: () =>
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  setLoading: (isLoading) => set({ isLoading }),
}));
```

---

#### Step 17 — Frontend: Auth hooks (`apps/web`)

```typescript
// apps/web/hooks/use-auth.ts

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthResponse, LoginDto, RegisterDto } from '@english-platform/shared';
import { useCallback, useEffect } from 'react';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (dto: LoginDto) => {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', dto);
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (dto: RegisterDto) => {
      const { data } = await apiClient.post<AuthResponse>('/auth/register', dto);
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSuccess: () => {
      clearAuth();
    },
  });
}

export function useInitAuth() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setLoading = useAuthStore((s) => s.setLoading);

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/refresh');
      setAuth(data.accessToken, data.user);
    } catch {
      clearAuth();
    }
  }, [setAuth, clearAuth, setLoading]);

  useEffect(() => {
    init();
  }, [init]);
}
```

---

#### Step 18 — Frontend: Auth provider with React Query (`apps/web`)

```tsx
// apps/web/components/providers/app-providers.tsx

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthInitializer } from './auth-initializer';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      {children}
    </QueryClientProvider>
  );
}
```

```tsx
// apps/web/components/providers/auth-initializer.tsx

'use client';

import { useInitAuth } from '@/hooks/use-auth';

export function AuthInitializer() {
  useInitAuth();
  return null;
}
```

---

#### Step 19 — Frontend: AuthDialog (client auth via modal)

The client-side auth uses a modal dialog, not a dedicated route. A "Sign in" button in the top nav opens it.

```tsx
// apps/web/components/auth/auth-dialog.tsx

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [activeTab, setActiveTab] = useState<string>('login');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold tracking-tight"
            style={{ color: 'var(--color-primary)' }}>
            Welcome
          </DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="mt-4">
            <LoginForm onSuccess={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="register" className="mt-4">
            <RegisterForm
              onSuccess={() => onOpenChange(false)}
              onSwitchToLogin={() => setActiveTab('login')}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

```tsx
// apps/web/components/auth/login-form.tsx

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginDto } from '@english-platform/shared';
import { useLogin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoginFormProps {
  onSuccess: () => void;
  redirectTo?: string;
}

export function LoginForm({ onSuccess, redirectTo }: LoginFormProps) {
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = (data: LoginDto) => {
    login.mutate(data, {
      onSuccess: () => {
        if (redirectTo) {
          window.location.href = redirectTo;
        } else {
          onSuccess();
        }
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="you@example.com"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm" style={{ color: 'var(--destructive)' }}>
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          placeholder="••••••••"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm" style={{ color: 'var(--destructive)' }}>
            {errors.password.message}
          </p>
        )}
      </div>

      {login.isError && (
        <p className="text-sm" style={{ color: 'var(--destructive)' }}>
          Invalid email or password. Please try again.
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={login.isPending}
        style={{
          backgroundColor: 'var(--color-tertiary)',
          color: 'var(--color-on-primary)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {login.isPending ? 'Signing in…' : 'Sign In'}
      </Button>
    </form>
  );
}
```

```tsx
// apps/web/components/auth/register-form.tsx

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema, type RegisterDto } from '@english-platform/shared';
import { useRegister } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const registerMutation = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterDto>({
    resolver: zodResolver(RegisterSchema),
  });

  const onSubmit = (data: RegisterDto) => {
    registerMutation.mutate(data, { onSuccess });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="register-name">Display Name</Label>
        <Input
          id="register-name"
          placeholder="John Doe"
          {...register('displayName')}
        />
        {errors.displayName && (
          <p className="text-sm" style={{ color: 'var(--destructive)' }}>
            {errors.displayName.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          placeholder="you@example.com"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm" style={{ color: 'var(--destructive)' }}>
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          type="password"
          placeholder="••••••••"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm" style={{ color: 'var(--destructive)' }}>
            {errors.password.message}
          </p>
        )}
      </div>

      {registerMutation.isError && (
        <p className="text-sm" style={{ color: 'var(--destructive)' }}>
          Registration failed. Email may already be in use.
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={registerMutation.isPending}
        style={{
          backgroundColor: 'var(--color-tertiary)',
          color: 'var(--color-on-primary)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {registerMutation.isPending ? 'Creating account…' : 'Create Account'}
      </Button>

      <p className="text-center text-sm" style={{ color: 'var(--color-secondary)' }}>
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="underline font-medium"
          style={{ color: 'var(--color-tertiary)' }}
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
```

---

#### Step 20 — Frontend: Admin login page (`apps/web`)

The admin surface has a dedicated login route — a full-page centered form (no nav, no sidebar).

```tsx
// apps/web/app/admin/auth/login/page.tsx

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginDto } from '@english-platform/shared';
import { useLogin } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminLoginPage() {
  const router = useRouter();
  const login = useLogin();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user?.role === 'admin') {
      router.replace('/admin/dashboard');
    }
  }, [user, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = (data: LoginDto) => {
    login.mutate(data, {
      onSuccess: (result) => {
        if (result.user.role === 'admin') {
          router.push('/admin/dashboard');
        }
      },
    });
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-neutral)' }}
    >
      <Card className="w-full max-w-sm" style={{ borderRadius: 'var(--radius-lg)' }}>
        <CardHeader className="text-center">
          <CardTitle
            className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--color-primary)' }}
          >
            Admin Login
          </CardTitle>
          <p className="text-sm mt-1" style={{ color: 'var(--color-secondary)' }}>
            English Learning Platform
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm" style={{ color: 'var(--destructive)' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm" style={{ color: 'var(--destructive)' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {login.isError && (
              <p className="text-sm" style={{ color: 'var(--destructive)' }}>
                Invalid credentials. Please try again.
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={login.isPending}
              style={{
                backgroundColor: 'var(--color-tertiary)',
                color: 'var(--color-on-primary)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {login.isPending ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

#### Step 21 — Frontend: Middleware for route protection (`apps/web`)

Next.js middleware runs on the edge before every request. For client-side token management, the middleware checks for the `refresh_token` cookie as a proxy for "logged-in" — the actual JWT validation happens server-side on the API.

```typescript
// apps/web/middleware.ts

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_AUTH_PATH = '/admin/auth';
const ADMIN_LOGIN_PATH = '/admin/auth/login';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip admin auth pages from protection
  if (pathname.startsWith(ADMIN_AUTH_PATH)) {
    return NextResponse.next();
  }

  // Protect /admin/* routes
  if (pathname.startsWith('/admin')) {
    const hasRefreshToken = request.cookies.has('refresh_token');
    if (!hasRefreshToken) {
      const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

### Verification

**Backend (API):**

```bash
# 1. Start database
docker compose up -d

# 2. Start API in dev mode
pnpm --filter api start:dev

# 3. Register a user
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","displayName":"Test User"}'
# Expected: { "accessToken": "...", "user": { ... } }
# Expected: Set-Cookie header with refresh_token

# 4. Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}' \
  -c cookies.txt
# Expected: 200 with accessToken + user

# 5. Refresh
curl -X POST http://localhost:4000/api/v1/auth/refresh \
  -b cookies.txt -c cookies.txt
# Expected: 200 with new accessToken

# 6. Access protected route without token
curl http://localhost:4000/api/v1/some-protected-route
# Expected: 401 Unauthorized

# 7. Logout
curl -X POST http://localhost:4000/api/v1/auth/logout \
  -H "Authorization: Bearer <access_token>" \
  -b cookies.txt
# Expected: 200 { "message": "Logged out" }

# 8. Verify Swagger docs
# Open: http://localhost:4000/api/docs
```

**Frontend (Web):**

```bash
# Start web dev server
pnpm --filter web dev

# 1. Navigate to http://localhost:3000
# 2. Click "Sign in" → AuthDialog should open with Login/Register tabs
# 3. Register a new account → dialog closes, page refreshes
# 4. Navigate to http://localhost:3000/admin → redirected to /admin/auth/login
# 5. Login as admin → redirected to /admin/dashboard
```

---

## Feature 3 — Admin Layout (Sidebar + Header + Main)

### Problem Analysis & Approach

#### Information architecture

The admin panel has these top-level sections:


| Section   | Route              | Icon              | Purpose                           |
| --------- | ------------------ | ----------------- | --------------------------------- |
| Dashboard | `/admin/dashboard` | `LayoutDashboard` | Overview stats (placeholder)      |
| Videos    | `/admin/videos`    | `Video`           | CRUD shadowing videos + subtitles |
| Scenarios | `/admin/scenarios` | `MessageSquare`   | CRUD AI conversation scenarios    |
| Users     | `/admin/users`     | `Users`           | User management                   |
| Settings  | `/admin/settings`  | `Settings`        | Platform settings (placeholder)   |


#### Sidebar behavior


| Viewport                  | Behavior                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Desktop (≥ 1024px, `lg:`) | Persistent sidebar, 256px wide. Can collapse to 64px icon-only mode via a toggle button. State stored in `localStorage`. |
| Mobile/Tablet (< 1024px)  | Sidebar hidden by default. Hamburger button in header opens a `Sheet` (shadcn drawer) that slides in from the left.      |


**Animation:** The sidebar width transition uses `transition-[width] duration-200 ease-in-out` for smooth collapse/expand. The mobile drawer uses shadcn's `Sheet` (Radix Dialog primitive) with built-in slide animation.

#### Header responsibilities

- **Left:** Hamburger button (mobile), breadcrumb (desktop).
- **Right:** User avatar + dropdown menu (profile, logout).

#### Layout integration with App Router

```
app/admin/
├── auth/
│   └── login/
│       └── page.tsx          ← full-page, NO admin layout
├── layout.tsx                ← admin shell (sidebar + header)
├── dashboard/
│   └── page.tsx
├── videos/
│   └── page.tsx
├── scenarios/
│   └── page.tsx
├── users/
│   └── page.tsx
└── settings/
    └── page.tsx
```

The `layout.tsx` at `app/admin/` wraps everything under `/admin/*` **except** `app/admin/auth/`** because Next.js App Router uses file-system-based layout nesting. To exclude the auth routes:

Use a route group: move the admin shell into `app/admin/(dashboard)/layout.tsx` so auth pages under `app/admin/auth/` do not inherit the admin shell.

**Revised structure:**

```
app/admin/
├── auth/
│   └── login/
│       └── page.tsx          ← standalone, no admin shell
├── (dashboard)/
│   ├── layout.tsx            ← admin shell layout
│   ├── dashboard/
│   │   └── page.tsx
│   ├── videos/
│   │   └── page.tsx
│   ├── scenarios/
│   │   └── page.tsx
│   ├── users/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
```

### Implementation Steps

---

#### Step 1 — Sidebar store (`apps/web`)

```typescript
// apps/web/stores/sidebar-store.ts

import { create } from 'zustand';

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapsed: () => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed:
    typeof window !== 'undefined'
      ? localStorage.getItem('sidebar-collapsed') === 'true'
      : false,
  isMobileOpen: false,

  toggleCollapsed: () =>
    set((state) => {
      const next = !state.isCollapsed;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebar-collapsed', String(next));
      }
      return { isCollapsed: next };
    }),

  setMobileOpen: (open) => set({ isMobileOpen: open }),
}));
```

---

#### Step 2 — Sidebar nav items config (`apps/web`)

```typescript
// apps/web/components/admin/nav-items.ts

import {
  LayoutDashboard,
  Video,
  MessageSquare,
  Users,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const adminNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Videos', href: '/admin/videos', icon: Video },
  { label: 'Scenarios', href: '/admin/scenarios', icon: MessageSquare },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];
```

---

#### Step 3 — Sidebar component (`apps/web`)

```tsx
// apps/web/components/admin/sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminNavItems } from './nav-items';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Button } from '@/components/ui/button';

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapsed } = useSidebarStore();

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r h-screen sticky top-0',
        'transition-[width] duration-200 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64',
      )}
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo / Brand */}
      <div
        className={cn(
          'flex items-center h-14 border-b px-4',
          isCollapsed ? 'justify-center' : 'justify-between',
        )}
        style={{ borderColor: 'var(--border)' }}
      >
        {!isCollapsed && (
          <span
            className="text-sm font-bold tracking-tight truncate"
            style={{ color: 'var(--color-primary)' }}
          >
            English Platform
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className="h-8 w-8 shrink-0"
        >
          {isCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {adminNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isCollapsed && 'justify-center px-2',
                isActive
                  ? 'text-[var(--color-on-primary)]'
                  : 'hover:bg-[var(--accent)]',
              )}
              style={
                isActive
                  ? {
                      backgroundColor: 'var(--color-tertiary)',
                      color: 'var(--color-on-primary)',
                      borderRadius: 'var(--radius-md)',
                    }
                  : {
                      color: 'var(--color-secondary)',
                      borderRadius: 'var(--radius-md)',
                    }
              }
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

---

#### Step 4 — Mobile sidebar (Sheet drawer) (`apps/web`)

```tsx
// apps/web/components/admin/mobile-sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { adminNavItems } from './nav-items';
import { useSidebarStore } from '@/stores/sidebar-store';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function MobileSidebar() {
  const pathname = usePathname();
  const { isMobileOpen, setMobileOpen } = useSidebarStore();

  return (
    <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="h-14 flex items-center px-4 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <SheetTitle
            className="text-sm font-bold tracking-tight"
            style={{ color: 'var(--color-primary)' }}
          >
            English Platform
          </SheetTitle>
        </SheetHeader>
        <nav className="py-4 space-y-1 px-2">
          {adminNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-[var(--color-on-primary)]'
                    : 'hover:bg-[var(--accent)]',
                )}
                style={
                  isActive
                    ? {
                        backgroundColor: 'var(--color-tertiary)',
                        color: 'var(--color-on-primary)',
                        borderRadius: 'var(--radius-md)',
                      }
                    : {
                        color: 'var(--color-secondary)',
                        borderRadius: 'var(--radius-md)',
                      }
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
```

---

#### Step 5 — Header component (`apps/web`)

```tsx
// apps/web/components/admin/header.tsx

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, User as UserIcon } from 'lucide-react';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useAuthStore } from '@/stores/auth-store';
import { useLogout } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function getBreadcrumbs(pathname: string): string[] {
  const segments = pathname
    .replace('/admin/', '')
    .split('/')
    .filter(Boolean);
  return segments.map(
    (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '),
  );
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  const breadcrumbs = getBreadcrumbs(pathname);
  const initials = user?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => router.push('/admin/auth/login'),
    });
  };

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b px-4 lg:px-6"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-8 w-8"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Breadcrumb */}
      <div className="flex-1">
        <nav className="flex items-center gap-1 text-sm">
          <span style={{ color: 'var(--color-secondary)' }}>Admin</span>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              <span style={{ color: 'var(--color-secondary)' }}>/</span>
              <span
                style={{
                  color:
                    i === breadcrumbs.length - 1
                      ? 'var(--color-primary)'
                      : 'var(--color-secondary)',
                  fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                }}
              >
                {crumb}
              </span>
            </span>
          ))}
        </nav>
      </div>

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback
                style={{
                  backgroundColor: 'var(--color-tertiary)',
                  color: 'var(--color-on-primary)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p
              className="text-sm font-medium truncate"
              style={{ color: 'var(--color-primary)' }}
            >
              {user?.displayName}
            </p>
            <p
              className="text-xs truncate"
              style={{ color: 'var(--color-secondary)' }}
            >
              {user?.email}
            </p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <UserIcon className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

---

#### Step 6 — AdminShell composition (`apps/web`)

```tsx
// apps/web/components/admin/admin-shell.tsx

'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { MobileSidebar } from './mobile-sidebar';
import { Header } from './header';

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <MobileSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main
          className="flex-1 overflow-y-auto p-4 lg:p-6"
          style={{ backgroundColor: 'var(--color-neutral)' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

#### Step 7 — Admin layout (App Router) (`apps/web`)

```tsx
// apps/web/app/admin/(dashboard)/layout.tsx

import { AdminShell } from '@/components/admin/admin-shell';
import type { ReactNode } from 'react';

export default function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
```

---

#### Step 8 — Placeholder admin pages (`apps/web`)

```tsx
// apps/web/app/admin/(dashboard)/dashboard/page.tsx

export default function AdminDashboardPage() {
  return (
    <div>
      <h1
        className="text-2xl font-bold tracking-tight mb-4"
        style={{ color: 'var(--color-primary)' }}
      >
        Dashboard
      </h1>
      <p style={{ color: 'var(--color-secondary)' }}>
        Welcome to the admin panel. Use the sidebar to manage content.
      </p>
    </div>
  );
}
```

```tsx
// apps/web/app/admin/(dashboard)/videos/page.tsx

export default function AdminVideosPage() {
  return (
    <div>
      <h1
        className="text-2xl font-bold tracking-tight mb-4"
        style={{ color: 'var(--color-primary)' }}
      >
        Videos
      </h1>
      <p style={{ color: 'var(--color-secondary)' }}>
        Video management will be implemented in Phase 1.
      </p>
    </div>
  );
}
```

```tsx
// apps/web/app/admin/(dashboard)/scenarios/page.tsx

export default function AdminScenariosPage() {
  return (
    <div>
      <h1
        className="text-2xl font-bold tracking-tight mb-4"
        style={{ color: 'var(--color-primary)' }}
      >
        Scenarios
      </h1>
      <p style={{ color: 'var(--color-secondary)' }}>
        Scenario management will be implemented in Phase 2.
      </p>
    </div>
  );
}
```

```tsx
// apps/web/app/admin/(dashboard)/users/page.tsx

export default function AdminUsersPage() {
  return (
    <div>
      <h1
        className="text-2xl font-bold tracking-tight mb-4"
        style={{ color: 'var(--color-primary)' }}
      >
        Users
      </h1>
      <p style={{ color: 'var(--color-secondary)' }}>
        User management coming soon.
      </p>
    </div>
  );
}
```

```tsx
// apps/web/app/admin/(dashboard)/settings/page.tsx

export default function AdminSettingsPage() {
  return (
    <div>
      <h1
        className="text-2xl font-bold tracking-tight mb-4"
        style={{ color: 'var(--color-primary)' }}
      >
        Settings
      </h1>
      <p style={{ color: 'var(--color-secondary)' }}>
        Platform settings coming soon.
      </p>
    </div>
  );
}
```

---

#### Step 9 — Update root layout (`apps/web`)

Wire up the `AppProviders` and use the Inter font from design.md.

```tsx
// apps/web/app/layout.tsx

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'English Learning Platform',
  description: 'Practice English speaking with interactive shadowing and AI conversations',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
```

### Verification

```bash
# 1. Start the full stack
docker compose up -d
pnpm --filter api start:dev &
pnpm --filter web dev &

# 2. Navigate to http://localhost:3000/admin
#    → Should redirect to /admin/auth/login (no refresh_token cookie)

# 3. Login with admin credentials
#    → Should redirect to /admin/dashboard
#    → Sidebar visible on left with 5 nav items
#    → Header shows breadcrumb "Admin / Dashboard" and user avatar

# 4. Click each sidebar item
#    → Active item highlighted with tertiary color (#C26B5B)
#    → Breadcrumb updates accordingly
#    → Content area shows placeholder text

# 5. Resize browser to < 1024px
#    → Sidebar disappears
#    → Hamburger icon appears in header
#    → Click hamburger → Sheet slides in from left with nav items
#    → Click a nav item → Sheet closes, page navigates

# 6. On desktop, click the collapse button in sidebar
#    → Sidebar collapses to 64px icon-only mode
#    → Hover over icons shows tooltip (title attribute)
#    → Refresh page → sidebar stays collapsed (localStorage)

# 7. Click user avatar dropdown
#    → Shows display name, email, Profile option, Log out option
#    → Click "Log out" → redirects to /admin/auth/login
```

---

## Running the Full Stack Locally

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for PostgreSQL)

### One-time setup

```bash
# 1. Clone and install
git clone <repo-url> && cd english-learning-platform
pnpm install

# 2. Create .env from template
cp .env.example .env
# Edit .env with your secrets (or keep defaults for local dev)

# 3. Start PostgreSQL
docker compose up -d

# 4. Wait for healthy database
docker compose ps
# postgres should show "healthy"

# 5. Seed admin user (after first API start creates tables via synchronize)
pnpm --filter api start:dev
# Wait for "API running on http://localhost:4000"
# Then in a new terminal:
cd apps/api
npx ts-node -r tsconfig-paths/register src/database/seeds/admin-seed.ts
# Output: "Admin user created: admin@englishplatform.local"
```

### Daily development

```bash
# Start everything in parallel
pnpm dev

# This runs (from root package.json):
#   pnpm --parallel --filter=api --filter=web dev
#
# API: http://localhost:4000  (Swagger: http://localhost:4000/api/docs)
# Web: http://localhost:3000
```

### Individual commands

```bash
# API only
pnpm --filter api start:dev

# Web only
pnpm --filter web dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Run API tests
pnpm --filter api test

# Stop database
docker compose down
```

### Default credentials


| Surface | Email                         | Password    |
| ------- | ----------------------------- | ----------- |
| Admin   | `admin@englishplatform.local` | `Admin@123` |


> **Security note:** Change these immediately in any non-local environment. The seed script should only run in development.

---

## File Index

Quick reference of every file created or modified by this guide:

### `packages/shared/src/`


| File                     | Purpose                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `index.ts`               | Barrel export                                                          |
| `enums/index.ts`         | `Role`, `DifficultyLevel` enums                                        |
| `schemas/auth.schema.ts` | `RegisterSchema`, `LoginSchema`, `AuthResponseSchema` + inferred types |


### `apps/api/src/`


| File                                        | Purpose                                       |
| ------------------------------------------- | --------------------------------------------- |
| `main.ts`                                   | Bootstrap with prefix, CORS, Swagger, pipes   |
| `app.module.ts`                             | Root module with Config, TypeORM, Auth, Users |
| `config/env.validation.ts`                  | Typed env var validation                      |
| `users/user.entity.ts`                      | User TypeORM entity                           |
| `users/users.module.ts`                     | Users module                                  |
| `users/users.service.ts`                    | User CRUD + password validation               |
| `auth/auth.module.ts`                       | Auth module wiring                            |
| `auth/auth.service.ts`                      | Token issuance, refresh rotation, logout      |
| `auth/auth.controller.ts`                   | REST endpoints + cookie handling              |
| `auth/entities/refresh-token.entity.ts`     | RefreshToken entity                           |
| `auth/dto/register-request.dto.ts`          | Registration DTO with class-validator         |
| `auth/dto/login-request.dto.ts`             | Login DTO with class-validator                |
| `auth/strategies/jwt.strategy.ts`           | Passport JWT strategy                         |
| `auth/guards/jwt-auth.guard.ts`             | Global JWT guard with @Public() support       |
| `auth/guards/roles.guard.ts`                | RBAC guard                                    |
| `auth/decorators/public.decorator.ts`       | `@Public()` decorator                         |
| `auth/decorators/roles.decorator.ts`        | `@Roles()` decorator                          |
| `auth/decorators/current-user.decorator.ts` | `@CurrentUser()` param decorator              |
| `database/seeds/admin-seed.ts`              | Admin user seeder                             |


### `apps/web/`


| File                                        | Purpose                                               |
| ------------------------------------------- | ----------------------------------------------------- |
| `app/globals.css`                           | Design system CSS variables                           |
| `app/layout.tsx`                            | Root layout with AppProviders + Inter font            |
| `middleware.ts`                             | Route protection for `/admin/`*                       |
| `lib/utils.ts`                              | `cn()` utility                                        |
| `lib/api-client.ts`                         | Axios instance with interceptor                       |
| `stores/auth-store.ts`                      | Zustand auth state                                    |
| `stores/sidebar-store.ts`                   | Zustand sidebar state                                 |
| `hooks/use-auth.ts`                         | `useLogin`, `useRegister`, `useLogout`, `useInitAuth` |
| `components/providers/app-providers.tsx`    | React Query + auth init                               |
| `components/providers/auth-initializer.tsx` | Silent refresh on mount                               |
| `components/auth/auth-dialog.tsx`           | Client auth modal                                     |
| `components/auth/login-form.tsx`            | Login form                                            |
| `components/auth/register-form.tsx`         | Register form                                         |
| `components/admin/nav-items.ts`             | Sidebar nav config                                    |
| `components/admin/sidebar.tsx`              | Desktop sidebar                                       |
| `components/admin/mobile-sidebar.tsx`       | Mobile sheet sidebar                                  |
| `components/admin/header.tsx`               | Admin header with breadcrumb + avatar                 |
| `components/admin/admin-shell.tsx`          | Shell composition                                     |
| `app/admin/auth/login/page.tsx`             | Admin login page                                      |
| `app/admin/(dashboard)/layout.tsx`          | Admin dashboard layout                                |
| `app/admin/(dashboard)/dashboard/page.tsx`  | Dashboard placeholder                                 |
| `app/admin/(dashboard)/videos/page.tsx`     | Videos placeholder                                    |
| `app/admin/(dashboard)/scenarios/page.tsx`  | Scenarios placeholder                                 |
| `app/admin/(dashboard)/users/page.tsx`      | Users placeholder                                     |
| `app/admin/(dashboard)/settings/page.tsx`   | Settings placeholder                                  |


### Root


| File                 | Purpose                          |
| -------------------- | -------------------------------- |
| `.env.example`       | Environment variable template    |
| `docker-compose.yml` | PostgreSQL for local development |


