import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

export enum OauthProvider {
  YANDEX = 'yandex',
  GOOGLE = 'google',
}

@Entity()
export class OauthAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column({ type: 'enum', enum: OauthProvider })
  provider: OauthProvider;

  @Column()
  provider_user_id: string;

  @Column({ nullable: true })
  access_token: string;

  @Column({ nullable: true })
  refresh_token: string;

  @Column('timestamptz', { nullable: true })
  expires_at: Date;
}
