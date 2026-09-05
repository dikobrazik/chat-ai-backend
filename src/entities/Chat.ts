import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  VirtualColumn,
} from 'typeorm';
import { Model } from './Model';
import { User } from './User';

@Entity()
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: '' })
  title: string;

  @Column({ nullable: true })
  external_chat_id: string;

  @Column({ default: false })
  is_public: boolean;

  @Column({ default: false, nullable: true })
  is_pinned: boolean;

  @ManyToOne(() => User, (user) => user.id, { lazy: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @ManyToOne(() => Model, (model) => model.id, { lazy: true })
  @JoinColumn({ name: 'model_id' })
  model: Model;

  @Column({ default: 1 })
  model_id: number;

  @VirtualColumn({
    query: (alias) =>
      `SELECT EXISTS (SELECT 1 FROM prompt p WHERE p.chat_id = ${alias}.id) as has_prompt`,
  })
  has_prompt: boolean;

  @CreateDateColumn()
  created_at: Date;
}
