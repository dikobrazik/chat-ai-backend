import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Chat } from './Chat';

@Entity()
export class Prompt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Chat, (chat) => chat.id)
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @Column()
  chat_id: string;

  @Column()
  input: string;

  @Column()
  response: string;

  @CreateDateColumn()
  created_at: Date;
}
