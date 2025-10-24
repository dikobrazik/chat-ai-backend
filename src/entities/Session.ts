import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';

export enum SessionProvider {
  YANDEX = 'yandex',
  GOOGLE = 'google',
  LOCAL = 'local',
}

@Entity()
export class Session {
  @OneToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @PrimaryColumn()
  user_id: string;

  @Column({ type: 'enum', enum: SessionProvider })
  provider: SessionProvider;

  @Column()
  provider_user_id: string;

  @Column({ nullable: true })
  access_token: string;

  @Column({ nullable: true })
  refresh_token: string;

  @Column('timestamp with time zone', { nullable: true })
  expires_at: Date;
}
