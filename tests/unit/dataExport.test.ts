import { DataExportService } from '../../src/services/DataExportService';
import { SwapTool } from '../../src/Agents/tools/swap';
import {
  TransactionLifecycle,
  TransactionLifecycleService,
} from '../../src/transactions';
import { AuthProvider, User } from '../../src/Auth/user.entity';
import { Contact } from '../../src/Contacts/contact.entity';

const asRecord = <T>(value: T): Record<string, unknown> =>
  value as unknown as Record<string, unknown>;

const makeFakeUser = (patch: Partial<User> = {}): User => {
  const now = new Date('2025-01-01T00:00:00.000Z');
  const u = new User();
  u.id = 'usr_1234';
  u.email = 'alice@example.com';
  u.name = 'Alice';
  u.address = '0xAlice';
  u.tokenType = 'STRK';
  u.authProvider = AuthProvider.EMAIL;
  u.isEmailVerified = true;
  u.isFunded = true;
  u.fundedAt = now;
  u.isDeployed = true;
  u.createdAt = now;
  u.updatedAt = now;
  Object.assign(u, patch);
  return u;
};

const makeFakeLifecycle = (
  patch: Partial<TransactionLifecycle> = {}
): TransactionLifecycle => {
  const tx = new TransactionLifecycle();
  tx.id = 'tx_001';
  tx.correlationId = 'corr_stable_42';
  tx.userId = 'usr_1234';
  tx.kind = 'swap';
  tx.stage = 'submitting';
  tx.payload = {
    fromAsset: 'STRK',
    toAsset: 'BTC',
    sendAmount: 100,
    minDestAmount: 0.0000123,
  };
  tx.metadata = {
    canonicalAmount: '100.0000000',
    canonicalMinDestAmount: '0.0000123',
  };
  tx.createdAt = new Date('2025-01-02T00:00:00.000Z');
  Object.assign(tx, patch);
  return tx;
};

describe('SwapTool canonical amount formatting', () => {
  it('pads whole numbers to 7 decimals as strings', () => {
    expect(SwapTool.toCanonicalAmount(100)).toBe('100.0000000');
  });

  it('preserves 7-decimal precision for fractional values', () => {
    expect(SwapTool.toCanonicalAmount(0.0000123)).toBe('0.0000123');
    expect(SwapTool.toCanonicalAmount(1.1234567)).toBe('1.1234567');
  });

  it('roundtrips through JSON parse + stringify without losing precision', () => {
    const metadata = {
      canonicalAmount: SwapTool.toCanonicalAmount(100),
      canonicalMinDestAmount: SwapTool.toCanonicalAmount(0.0000123),
    };
    const roundtripped = JSON.parse(JSON.stringify(metadata));
    expect(typeof roundtripped.canonicalAmount).toBe('string');
    expect(typeof roundtripped.canonicalMinDestAmount).toBe('string');
    expect(roundtripped.canonicalAmount).toBe('100.0000000');
    expect(roundtripped.canonicalMinDestAmount).toBe('0.0000123');
  });
});

describe('DataExportService shape and stability', () => {
  const svc = new DataExportService() as unknown as Record<string, unknown>;

  it('maps user, contacts and transaction history with stable ids', async () => {
    const user = makeFakeUser();
    const contact = {
      id: 'c_1',
      name: 'Bob',
      address: '0xBob',
      userId: 'usr_1234',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    } as unknown as Contact;
    const tx = makeFakeLifecycle();

    const origLifecycle = TransactionLifecycleService.prototype;
    const spy = jest
      .spyOn(TransactionLifecycleService.prototype, 'findByUserIds')
      .mockImplementation(async () => [tx]) as unknown as jest.SpyInstance;
    const svcAny = svc as Record<string, unknown>;
    (svcAny as { userRepo: { findOne: jest.Mock } }).userRepo = {
      findOne: jest.fn().mockResolvedValue(user),
    } as never;
    (svcAny as { contactRepo: { find: jest.Mock } }).contactRepo = {
      find: jest.fn().mockResolvedValue([contact]),
    } as never;

    const exportFn = svc.exportUserProfile as (
      id: string
    ) => Promise<ReturnType<DataExportService['exportUserProfile']>>;
    const data = await exportFn.call(svc, 'usr_1234');

    expect(data.profile!.id).toBe('usr_1234');
    expect(data.transactionHistory).toHaveLength(1);
    const exported = data.transactionHistory[0];
    expect(exported.id).toBe('tx_001');
    expect(exported.correlationId).toBe('corr_stable_42');

    const md = exported.metadata as Record<string, unknown>;
    expect(typeof md.canonicalAmount).toBe('string');
    expect(md.canonicalAmount).toBe('100.0000000');
    expect(md.canonicalMinDestAmount).toBe('0.0000123');

    const roundtrip = JSON.parse(JSON.stringify(data));
    const roundtripTx = roundtrip.transactionHistory[0] as Record<
      string,
      unknown
    >;
    const rtMeta = roundtripTx.metadata as Record<string, unknown>;
    const rtPayload = roundtripTx.payload as Record<string, unknown>;
    expect(roundtripTx.id).toBe('tx_001');
    expect(roundtripTx.correlationId).toBe('corr_stable_42');
    expect(rtMeta.canonicalAmount).toBe('100.0000000');
    expect(rtPayload.sendAmount).toBe(100);
    expect(rtPayload.minDestAmount).toBe(0.0000123);

    spy.mockRestore();
    origLifecycle;
  });

  it('preserves canonical amounts and stable IDs when metadata is serialized end to end', () => {
    const tx = makeFakeLifecycle();
    const mapped = (
      new DataExportService() as unknown as {
        mapHistory: (t: TransactionLifecycle) => Record<string, unknown>;
      }
    ).mapHistory(tx);
    const roundtripped = JSON.parse(JSON.stringify(mapped)) as Record<
      string,
      unknown
    >;
    expect(roundtripped.id).toBe('tx_001');
    expect(roundtripped.correlationId).toBe('corr_stable_42');
    const meta = roundtripped.metadata as Record<string, unknown>;
    expect(typeof meta.canonicalAmount).toBe('string');
    expect(meta.canonicalAmount).toBe('100.0000000');
  });
});
