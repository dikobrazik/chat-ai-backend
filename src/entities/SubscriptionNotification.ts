import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Subscription } from './Subscription';

export enum SubscriptionNotificationType {
  CHARGE_REMINDER = 'charge_reminder',
}

export enum SubscriptionNotificationStatus {
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity()
@Index(
  'UQ_subscription_notification_subscription_type_period',
  ['subscription_id', 'type', 'period_end'],
  { unique: true },
)
export class SubscriptionNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;

  @Column()
  subscription_id: string;

  @Column({ type: 'enum', enum: SubscriptionNotificationType })
  type: SubscriptionNotificationType;

  @Column('timestamptz')
  period_end: Date;

  @Column({
    type: 'enum',
    enum: SubscriptionNotificationStatus,
    default: SubscriptionNotificationStatus.PROCESSING,
  })
  status: SubscriptionNotificationStatus;

  @Column({ default: 1 })
  attempts: number;

  @Column('timestamptz', { nullable: true })
  sent_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
