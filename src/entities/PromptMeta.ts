import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class PromptMeta {
  @PrimaryGeneratedColumn('increment')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  prompt_id: string;

  @Column()
  response_id: string;

  @Column()
  input_tokens: number;

  @Column()
  output_tokens: number;

  @Column()
  thinking_tokens: number;
}
