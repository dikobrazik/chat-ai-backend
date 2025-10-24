import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserStatus {
  // с привязаной почтой
  ACTIVE = 'active',
  GUEST = 'guest',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.GUEST,
  })
  status: UserStatus;

  @CreateDateColumn()
  created_at: Date;
}
