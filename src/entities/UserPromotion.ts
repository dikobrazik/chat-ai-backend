import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';
import { Promotion } from './Promotion';

export enum UserPromotionStatus {
  ACTIVE = 'ACTIVE', // может быть использована
  EXPIRED = 'EXPIRED', // срок действия истек
  CONSUMED = 'CONSUMED', // уже использована для получения скидки или бесплатного периода
}

@Entity()
export class UserPromotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @ManyToOne(() => Promotion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotion_id' })
  promotion: Promotion;

  @Column()
  promotion_id: string;

  @CreateDateColumn()
  activated_at: Date;

  @Column({ nullable: true })
  expires_at: Date | null; // null means no expiration

  @Column({
    type: 'enum',
    default: UserPromotionStatus.ACTIVE,
    enum: UserPromotionStatus,
  })
  status: UserPromotionStatus;
}
