import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Prompt } from './Prompt';
import { FileEntity } from './File';

@Entity()
export class PromptFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => FileEntity, { cascade: true })
  @JoinColumn({ name: 'file_id' })
  file: FileEntity;

  @Column()
  file_id: string;

  @ManyToOne(() => Prompt, (prompt) => prompt.files)
  @JoinColumn({ name: 'prompt_id' })
  prompt?: Prompt | null;

  @Column()
  prompt_id: string;
}
