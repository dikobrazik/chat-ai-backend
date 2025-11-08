import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';
import { Subscription } from './Subscription';

export enum PaymentStatus {
  NEW = 'new',
  FORM_SHOWN = 'form_shown',
  CONFIRMED = 'confirmed',
  REFUNDED = 'refunded',
  REJECTED = 'rejected',
}

@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @ManyToOne(() => Subscription, (sub) => sub.id)
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;

  @Column()
  subscription_id: string;

  // tinkoff payment id
  @Column({ nullable: true })
  payment_id: string;

  @Column()
  amount: number;

  @Column({ type: 'enum', enum: PaymentStatus })
  status: PaymentStatus;

  @Column('timestamp', { nullable: true })
  paymentDate: Date;
}
