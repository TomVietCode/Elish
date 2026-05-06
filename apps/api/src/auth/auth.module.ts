import { Module } from "@nestjs/common";
import { UsersModule } from "src/users/users.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { RefreshToken } from "src/auth/entities/refresh-token.entity";
import { AuthController } from "src/auth/auth.controller";
import { JwtStrategy } from "src/auth/strategies/jwt.strategy";
import { AuthService } from "src/auth/auth.service";

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshToken])
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})

export class AuthModule {}