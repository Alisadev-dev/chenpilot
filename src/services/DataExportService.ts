import { injectable } from 'tsyringe';
import { In, Repository } from 'typeorm';
import AppDataSource from '../config/Datasource';
import { User } from '../Auth/user.entity';
import { Contact } from '../Contacts/contact.entity';
import { TransactionLifecycle } from '../transactions/TransactionLifecycle.entity';
import { TransactionLifecycleService } from '../transactions/TransactionLifecycle.service';

export interface ExportedTransactionHistory {
  id: string;
  correlationId: string;
  userId?: string;
  kind: string;
  stage: string;
  transactionHash?: string;
  createdAt: string;
  confirmedAt?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: { code?: string; message?: string; detail?: unknown };
}

export interface ExportedContact {
  id: string;
  name?: string;
  address?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedUser {
  id: string;
  email?: string;
  name?: string;
  address?: string;
  authProvider?: string;
  googleId?: string;
  profilePicture?: string;
  isEmailVerified: boolean;
  isFunded: boolean;
  fundingTransactionHash?: string;
  fundedAt?: string;
  isDeployed: boolean;
  deploymentTransactionHash?: string;
  deploymentRequestedAt?: string;
  tokenType: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileExport {
  profile: ExportedUser | null;
  contacts: ExportedContact[];
  transactionHistory: ExportedTransactionHistory[];
  generatedAt: string;
  schemaVersion: 1;
}

@injectable()
export class DataExportService {
  private userRepo: Repository<User>;
  private contactRepo: Repository<Contact>;
  private lifecycleService: TransactionLifecycleService;

  constructor() {
    this.userRepo = AppDataSource.getRepository(User);
    this.contactRepo = AppDataSource.getRepository(Contact);
    this.lifecycleService = new TransactionLifecycleService();
  }

  static toDateISO(
    value: Date | string | null | undefined
  ): string | undefined {
    if (!value) return undefined;
    try {
      return new Date(value).toISOString();
    } catch {
      return undefined;
    }
  }

  private mapUser(user: User | null): ExportedUser | null {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      address: user.address,
      authProvider: user.authProvider,
      googleId: user.googleId,
      profilePicture: user.profilePicture,
      isEmailVerified: !!user.isEmailVerified,
      isFunded: !!user.isFunded,
      fundingTransactionHash: user.fundingTransactionHash,
      fundedAt: DataExportService.toDateISO(user.fundedAt),
      isDeployed: !!user.isDeployed,
      deploymentTransactionHash: user.deploymentTransactionHash,
      deploymentRequestedAt: DataExportService.toDateISO(
        user.deploymentRequestedAt
      ),
      tokenType: user.tokenType || 'STRK',
      createdAt: new Date(user.createdAt).toISOString(),
      updatedAt: new Date(user.updatedAt).toISOString(),
    };
  }

  private mapContact(contact: Contact): ExportedContact {
    const anyContact = contact as unknown as Record<string, unknown>;
    return {
      id: String(anyContact.id),
      name: anyContact.name as string | undefined,
      address: anyContact.address as string | undefined,
      userId: anyContact.userId as string | undefined,
      createdAt: new Date(
        (anyContact.createdAt as Date) || Date.now()
      ).toISOString(),
      updatedAt: new Date(
        (anyContact.updatedAt as Date) || Date.now()
      ).toISOString(),
    };
  }

  private mapHistory(tx: TransactionLifecycle): ExportedTransactionHistory {
    return {
      id: tx.id,
      correlationId: tx.correlationId,
      userId: tx.userId,
      kind: tx.kind,
      stage: tx.stage,
      transactionHash: tx.transactionHash,
      createdAt: new Date(tx.createdAt).toISOString(),
      confirmedAt: DataExportService.toDateISO(tx.confirmedAt),
      payload: tx.payload ?? undefined,
      metadata: tx.metadata ?? undefined,
      error: tx.error ?? undefined,
    };
  }

  async exportUserProfile(userId: string): Promise<UserProfileExport> {
    const user = userId
      ? await this.userRepo.findOne({ where: { id: userId } })
      : null;

    const [contacts, histories] = await Promise.all([
      this.contactRepo.find().catch(() => []),
      this.lifecycleService.findByUserIds(userId ? [userId] : []),
    ]);

    return {
      profile: this.mapUser(user),
      contacts: contacts.map(c => this.mapContact(c)),
      transactionHistory: histories.map(t => this.mapHistory(t)),
      generatedAt: new Date().toISOString(),
      schemaVersion: 1,
    };
  }
}
