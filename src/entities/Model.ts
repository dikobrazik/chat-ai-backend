import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserStatus } from './User';
import { ModelProvider } from './ModelProvider';

@Entity()
export class Model {
  @PrimaryColumn()
  id: string;

  @ManyToOne(() => ModelProvider, (provider) => provider.id)
  @JoinColumn({ name: 'provider_id' })
  provider: ModelProvider;

  @Column()
  provider_id: number;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ default: false })
  for_image: boolean;

  @Column({ type: 'enum', enum: UserStatus })
  available_for_status: UserStatus;
}
