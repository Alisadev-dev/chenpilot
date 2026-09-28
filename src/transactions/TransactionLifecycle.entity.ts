import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../Auth/user.entity';

export type LifecycleStage =
  | 'created'
  | 'signing'
  | 'submitting'
  | 'broadcast'
  | 'confirmed'
  | 'failed'
  | 'expired';

export type TransactionKind =
  | 'swap'
  | 'transfer'
  | 'mint'
  | 'deploy_account'
  | 'auto_fund'
  | 'other';

@Entity()
export class TransactionLifecycle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: false })
  correlationId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({
    type: 'enum',
    enum: ['swap', 'transfer', 'mint', 'deploy_account', 'auto_fund', 'other'],
    default: 'other',
  })
  kind!: TransactionKind;

  @Column({
    type: 'enum',
    enum: [
      'created',
      'signing',
      'submitting',
      'broadcast',
      'confirmed',
      'failed',
      'expired',
    ],
    default: 'created',
  })
  stage!: LifecycleStage;

  @Column({ type: 'varchar', nullable: true })
  transactionHash?: string;

  @Column({ type: 'simple-json', nullable: true })
  payload?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  error?: { code?: string; message?: string; detail?: unknown };

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date;
}
