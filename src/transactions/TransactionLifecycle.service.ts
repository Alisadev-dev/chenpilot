import { injectable } from 'tsyringe';
import { In, Repository } from 'typeorm';
import AppDataSource from '../config/Datasource';
import { TransactionLifecycle } from './TransactionLifecycle.entity';

@injectable()
export class TransactionLifecycleService {
  private repo: Repository<TransactionLifecycle>;

  constructor() {
    this.repo = AppDataSource.getRepository(TransactionLifecycle);
  }

  async record(params: {
    correlationId: string;
    userId?: string;
    kind?: TransactionLifecycle['kind'];
    stage: TransactionLifecycle['stage'];
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    transactionHash?: string;
    error?: TransactionLifecycle['error'];
  }): Promise<TransactionLifecycle> {
    const existing = params.correlationId
      ? await this.repo.findOne({
          where: { correlationId: params.correlationId },
        })
      : null;
    if (existing) {
      if (params.stage && params.stage !== existing.stage)
        existing.stage = params.stage;
      if (params.payload)
        existing.payload = { ...existing.payload, ...params.payload };
      if (params.metadata)
        existing.metadata = { ...existing.metadata, ...params.metadata };
      if (params.transactionHash)
        existing.transactionHash = params.transactionHash;
      if (params.error) existing.error = params.error;
      if (params.stage === 'confirmed') existing.confirmedAt = new Date();
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({
        correlationId: params.correlationId,
        userId: params.userId,
        kind: params.kind ?? 'other',
        stage: params.stage,
        payload: params.payload ?? {},
        metadata: params.metadata ?? {},
        transactionHash: params.transactionHash,
        error: params.error,
        confirmedAt: params.stage === 'confirmed' ? new Date() : undefined,
      })
    );
  }

  async findByUserIds(userIds: string[]): Promise<TransactionLifecycle[]> {
    if (!userIds.length) return [];
    return this.repo.find({
      where: { userId: In(userIds) },
      order: { createdAt: 'DESC' },
    });
  }
}
