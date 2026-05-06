import { RegisterDto, Role } from '@english-platform/shared'
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { User } from 'src/users/user.entity'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: RegisterDto): Promise<User> {
    const exists = await this.usersRepository.findOne({
      where: { email: dto.email },
    })
    if (exists) {
      throw new ConflictException('Email already registered')
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)

    const user = this.usersRepository.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      role: Role.USER,
    })

    return this.usersRepository.save(user)
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } })
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } })
    if (!user) {
      throw new NotFoundException('User not found')
    }
    return user
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false
    return bcrypt.compare(password, user.passwordHash)
  }
}
