import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  VirtualColumn,
} from 'typeorm';
import { User } from './User';

@Entity()
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  external_chat_id: string;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @VirtualColumn({
    query: (alias) => `
      (SELECT p.response
       FROM prompt p
       WHERE p.chat_id = ${alias}.id
       ORDER BY p.created_at DESC
       LIMIT 1)
    `,
  })
  last_prompt: string;

  @CreateDateColumn()
  created_at: Date;
}
