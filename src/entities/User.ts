import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SubscriptionPlan } from './Subscription';

export enum UserStatus {
  GUEST = 'guest',
  ACTIVE = 'active',
  // с привязаной почтой
  VERIFIED = 'verified',
  SUBSCRIPTION_BASE = `subscription_${SubscriptionPlan.BASE}`,
  SUBSCRIPTION_PLUS = `subscription_${SubscriptionPlan.PLUS}`,
  SUBSCRIPTION_PRO = `subscription_${SubscriptionPlan.PRO}`,
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  passwordHash: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  photo: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.GUEST,
  })
  status: UserStatus;

  @Column({ nullable: true })
  active_subscription_id: string;

  @CreateDateColumn()
  created_at: Date;
}
