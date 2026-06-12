import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export enum PromotionType {
  PROMO_CODE = 'PROMO_CODE',
  NEW_USER = 'NEW_USER',
  REFERRAL = 'REFERRAL',
  MANUAL = 'MANUAL',
}

export enum PromotionRewardType {
  FREE_DAYS = 'FREE_DAYS',
  PERCENT_DISCOUNT = 'PERCENT_DISCOUNT',
  FIXED_DISCOUNT = 'FIXED_DISCOUNT',
}

@Entity()
export class Promotion {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ default: null })
  code: string | null;

  @Column({
    type: 'enum',
    default: PromotionType.MANUAL,
    enum: PromotionType,
  })
  type: PromotionType;

  @Column({
    type: 'enum',
    enum: PromotionRewardType,
  })
  reward_type: PromotionRewardType;

  @Column('int')
  reward_value: number;

  @CreateDateColumn()
  created_at: Date;

  @Column('timestamp with time zone', { nullable: true })
  ends_at: Date | null;

  @Column({ nullable: true })
  max_usages: number | null; // null means no limit

  @Column({ nullable: true })
  max_usages_per_user: number | null; // null means no limit
}
