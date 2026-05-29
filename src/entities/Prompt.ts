import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Chat } from './Chat';
import { PromptFile } from './PromptFile';

@Entity()
export class Prompt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @Column()
  chat_id: string;

  @OneToMany(() => PromptFile, (promptFile) => promptFile.prompt)
  files: PromptFile[];

  @Column()
  input: string;

  @Column()
  response: string;

  @Column({ nullable: true })
  is_image: boolean;

  @CreateDateColumn()
  created_at: Date;
}
