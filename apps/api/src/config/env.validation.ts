import { IsNumber, IsString, validateSync } from 'class-validator'
import { plainToInstance, Type } from 'class-transformer'
export class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string

  @IsString()
  JWT_ACCESS_SECRET: string

  @IsString()
  JWT_REFRESH_SECRET: string

  @IsString()
  JWT_ACCESS_EXPIRES: string

  @IsString()
  JWT_REFRESH_EXPIRES: string

  @IsNumber()
  @Type(() => Number)
  API_PORT: number

  @IsString()
  API_CORS_ORIGIN: string
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true
  })

  const errors = validateSync(validated, {
    skipMissingProperties: false
  })

  if (errors.length > 0) {
    throw new Error(`Config validation error:\n${errors.toString()}`)
  }

  return validated
}