import { Column, CreateDateColumn, Entity, UpdateDateColumn } from 'typeorm'
import { Provider, Role } from '@english-platform/shared'

@Entity('users')
export class User {
  @Column('uuid', {
    default: () => 'uuidv7()',
    primary: true,
  })
  id: string

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string

  @Column({
    type: 'varchar',
    length: 255,
    name: 'password_hash',
    nullable: true,
  })
  passwordHash: string | null

  @Column({ type: 'enum', enum: Provider, default: Provider.LOCAL })
  provider: Provider

  @Column({ type: 'varchar', length: 100, name: 'display_name' })
  displayName: string

  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role

  @Column({ type: 'varchar', length: 10, default: 'en' })
  locale: string

  @Column({ type: 'varchar', length: 20, default: 'light' })
  theme: string

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date
}
