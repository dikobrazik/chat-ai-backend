import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Model } from './Model';

@Entity()
export class ModelProvider {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  name: string;

  @OneToMany(() => Model, (model) => model.provider)
  models: Model[];
}
