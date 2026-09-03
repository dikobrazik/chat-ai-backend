import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Prompt } from './Prompt';

@Entity()
export class PromptMeta {
  @PrimaryGeneratedColumn('increment')
  id: string;

  // @OneToOne(() => Prompt, { onDelete: 'CASCADE' })
  // @JoinColumn({ name: 'prompt_id' })
  // prompt: Prompt;

  @Column()
  prompt_id: string;

  @Column()
  input_tokens: number;

  @Column()
  output_tokens: number;

  @Column()
  thinking_tokens: number;
}
