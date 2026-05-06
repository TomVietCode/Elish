# API Coding Guidelines — NestJS

> This file governs all agent behavior inside `apps/api/`.
> Follow every rule here precisely. Do not deviate unless explicitly told to in the task prompt.

---

## Stack

- **Framework**: NestJS (latest)
- **Language**: TypeScript (strict mode, no `any`)
- **ORM**: TypeORM
- **Validation**: `class-validator` + `class-transformer` on all DTOs
- **Shared types**: Import from `@repo/shared` — never redeclare DTOs locally
- **Testing**: Jest + Supertest

---

## Architecture: Module Structure

Every feature lives in its own NestJS module. Flat files at the `api/src/` root are forbidden.

```
apps/api/src/
├── app.module.ts
├── main.ts
└── <feature>/
    ├── <feature>.module.ts
    ├── <feature>.controller.ts
    ├── <feature>.service.ts
    ├── <feature>.repository.ts     # optional — only if data access is complex
    ├── dto/
    │   ├── create-<feature>.dto.ts
    │   └── update-<feature>.dto.ts
    ├── entities/
    │   └── <feature>.entity.ts
    └── <feature>.spec.ts
```

---

## OOP Rules

### 1. Classes over plain objects
All services, repositories, guards, interceptors, and pipes **must be classes**.
Never export a raw object literal in place of a class.

### 2. Encapsulation
Mark internal helpers `private`. Only expose what the caller genuinely needs.

```ts
// ✅ correct
@Injectable()
export class AuthService {
  constructor(private readonly userRepo: UserRepository) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.findByEmail(email);   // delegates to private method
    await this.verifyPassword(password, user.passwordHash);
    return user;
  }

  private async findByEmail(email: string): Promise<User> { ... }
  private async verifyPassword(raw: string, hash: string): Promise<void> { ... }
}
```

### 3. Composition over inheritance
Prefer injecting collaborators. Only extend abstract base classes when there is a genuine shared contract (e.g. `BaseRepository<T>`).

### 4. Immutability first
Prefer `readonly` on constructor-injected dependencies and DTO properties.
Use `const` everywhere `let` is not required.

---

## SOLID Rules

### S — Single Responsibility
One class, one reason to change.

- **Controller**: HTTP wiring only — maps request → service call → response. Zero business logic.
- **Service**: Orchestrates use-case logic. No raw SQL, no HTTP calls.
- **Repository**: Data access only. No business rules.
- **Guard / Interceptor / Pipe**: One cross-cutting concern each.

```ts
// ❌ wrong — service doing HTTP and DB in one method
async createUser(dto: CreateUserDto) {
  const exists = await this.db.query('SELECT …');   // DB in service — ok
  await axios.post('/mailer', { email: dto.email }); // HTTP side-effect — extract this
}

// ✅ correct — delegate to a dedicated MailerService
async createUser(dto: CreateUserDto) {
  const user = await this.userRepo.create(dto);
  await this.mailerService.sendWelcome(user.email);
  return user;
}
```

### O — Open/Closed
Extend behavior through new classes or strategies, not by editing existing ones.
Use NestJS interceptors, guards, and decorators for cross-cutting extensions.

```ts
// Add audit logging via interceptor — don't touch existing services
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(tap(() => this.log(ctx)));
  }
}
```

### L — Liskov Substitution
If you extend a base class, the subclass must be usable wherever the base is expected without breaking callers.

```ts
abstract class BaseRepository<T> {
  abstract findById(id: string): Promise<T | null>;
  abstract save(entity: T): Promise<T>;
}

// Subclass must honour the full contract — never throw where the base returns null
class UserRepository extends BaseRepository<User> {
  findById(id: string): Promise<User | null> { ... }
  save(user: User): Promise<User> { ... }
}
```

### I — Interface Segregation
Define narrow interfaces. Never force a class to implement methods it does not use.

```ts
// ❌ wrong — one fat interface
interface UserService {
  createUser(...): Promise<User>;
  sendEmail(...): Promise<void>;   // unrelated to user domain
  generateReport(...): string;
}

// ✅ correct — split by concern
interface IUserWriter { createUser(dto: CreateUserDto): Promise<User>; }
interface IUserReader { findById(id: string): Promise<User | null>; }
```

### D — Dependency Inversion
Depend on abstractions (interfaces / injection tokens), not concrete implementations.
Always inject via NestJS DI — never `new ConcreteService()` inside a class.

```ts
// ✅ correct — depend on the token, not the class
@Injectable()
export class OrderService {
  constructor(
    @Inject(PAYMENT_GATEWAY_TOKEN) private readonly gateway: IPaymentGateway,
  ) {}
}
```

---

## DTOs

- All DTOs live in `dto/` inside their feature folder.
- Shared DTOs (used by both `api` and `web`) go in `packages/shared` — import from `@repo/shared`.
- Every field must have at least one `class-validator` decorator.
- Every incoming body must pass through a `ValidationPipe`.

```ts
// create-user.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  readonly email: string;

  @IsString()
  @MinLength(8)
  readonly password: string;
}
```

---

## Error Handling

- Use NestJS built-in HTTP exceptions (`NotFoundException`, `BadRequestException`, etc.).
- Never `throw new Error('...')` in service/controller code — use typed exceptions.
- Add a global `HttpExceptionFilter` for consistent error response shape.
- Never leak stack traces to the client in production.

```ts
// ✅ correct
if (!user) throw new NotFoundException(`User ${id} not found`);
```

---

## Controllers

- Decorate every route with the correct HTTP method decorator.
- Always declare the response type with `@ApiResponse` (Swagger).
- Return the service result directly — no manual `res.json()` unless streaming.
- Guards go on the controller class or individual route, not inside services.

```ts
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.userService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return this.userService.findOne(id);
  }
}
```

---

## Services

- Every public method must have an explicit return type.
- Async methods must return `Promise<T>` — never leave it implicit.
- No `console.log` — use NestJS `Logger` with the class name as context.

```ts
private readonly logger = new Logger(UserService.name);
```

---

## Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Files | `kebab-case` | `user-profile.service.ts` |
| Classes | `PascalCase` | `UserProfileService` |
| Methods / variables | `camelCase` | `findActiveUsers()` |
| Constants / tokens | `SCREAMING_SNAKE_CASE` | `PAYMENT_GATEWAY_TOKEN` |
| Interfaces | `IPascalCase` | `IPaymentGateway` |
| Enums | `PascalCase` members | `UserRole.Admin` |
| DTOs | `<Action><Feature>Dto` | `CreateUserDto`, `UpdateOrderDto` |

---

## Testing

- Unit test every service method. Mock all injected dependencies with `jest.fn()`.
- Integration-test every controller route with Supertest.
- Test files sit next to the file they test: `user.service.spec.ts`.
- Aim for 80 %+ branch coverage on services.

```ts
describe('UserService.create', () => {
  it('throws ConflictException when email already exists', async () => {
    userRepo.findByEmail.mockResolvedValue(existingUser);
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
  });
});
```

---

## What Agents Must NOT Do

- ❌ Put business logic in controllers
- ❌ Call `new SomeService()` — always use DI
- ❌ Use `any` type
- ❌ Commit commented-out code
- ❌ Bypass `ValidationPipe` for incoming payloads
- ❌ Redeclare DTOs that already exist in `@repo/shared`
- ❌ Use `console.log` — use `Logger`
- ❌ Swallow exceptions silently (`catch (e) {}`)