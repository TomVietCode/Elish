import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm'
import { User } from '../../users/user.entity'

@Entity('refresh_tokens')
export class RefreshToken {
  @Column('uuid', {
    default: () => 'uuidv7()',
    primary: true,
  })
  id: string

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({ type: 'varchar', length: 255, name: 'token_hash', unique: true })
  tokenHash: string

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt: Date | null

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date
}
