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

  @Column()
  external_chat_id: string;

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
    query: (alias) => `
      (SELECT p.input
       FROM prompt p
       WHERE p.chat_id = ${alias}.id
       ORDER BY p.created_at ASC
       LIMIT 1)
    `,
  })
  last_prompt: string;

  @CreateDateColumn()
  created_at: Date;
}
