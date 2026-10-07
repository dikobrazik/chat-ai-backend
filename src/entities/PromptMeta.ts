import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index('UQ_prompt_meta_response_id', ['response_id'], { unique: true })
export class PromptMeta {
  @PrimaryGeneratedColumn('increment')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  prompt_id: string;

  @Column()
  response_id: string;

  @Column({ default: 0 })
  input_tokens: number;

  @Column({ default: 0 })
  output_tokens: number;

  @Column({ default: 0 })
  thinking_tokens: number;
}
