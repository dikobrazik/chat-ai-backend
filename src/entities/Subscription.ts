import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

export enum SubscriptionPlan {
  BASE = 'base',
  PLUS = 'plus',
  PRO = 'pro',
}

export enum SubscriptionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
}

@Entity()
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column({ type: 'enum', enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @Column({ type: 'enum', enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @Column('timestamp', { nullable: true })
  current_period_start: number;

  @Column('timestamp', { nullable: true })
  current_period_end: number;

  @Column({ nullable: true })
  tinkoffSubscriptionId: string;

  @Column('timestamp', { nullable: true })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
