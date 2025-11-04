import {
  Column,
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
  ACTIVE = 'active',
  PENDING = 'pending',
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

  @Column({ type: 'enum', enum: SubscriptionPlan })
  status: SubscriptionPlan;

  @Column('date')
  current_period_start: number;

  @Column('date')
  current_period_end: number;

  @Column()
  tinkoffSubscriptionId: string;

  @Column('timestamp with time zone', { nullable: true })
  expires_at: Date;
}
