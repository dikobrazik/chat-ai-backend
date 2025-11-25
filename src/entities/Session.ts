import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

@Entity()
@Index('idx_session_user_device', ['user_id', 'device_id'], { unique: true })
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column({ nullable: true })
  refresh_token_hash: string;

  @Column({ nullable: true })
  device_id: string;

  @Column({ nullable: true })
  os: string;

  @Column({ nullable: true })
  browser: string;

  @Column({ nullable: true })
  location: string;

  @Column({ default: false })
  revoked: boolean;

  @Column('timestamptz', { nullable: true })
  expires_at: Date;

  @Column('timestamptz', { nullable: true })
  last_active_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
