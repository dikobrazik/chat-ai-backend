import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserStatus } from './User';
import { ModelProvider } from './ModelProvider';

@Entity()
export class Model {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => ModelProvider, (provider) => provider.id)
  @JoinColumn({ name: 'provider_id' })
  provider: ModelProvider;

  @Column()
  provider_id: number;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ type: 'enum', enum: UserStatus })
  available_for_status: UserStatus;
}
