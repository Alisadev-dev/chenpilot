import { randomUUID } from 'crypto';
import { BaseTool } from './base/BaseTool';
import { ToolMetadata, ToolResult } from '../registry/ToolMetadata';
import {
  LifecycleStage,
  TransactionKind,
  TransactionLifecycleService,
} from '../../transactions';

interface SwapPayload extends Record<string, unknown> {
  fromAsset?: string;
  toAsset?: string;
  sendAmount?: number | string;
  minDestAmount?: number | string;
  slippageTolerance?: number;
  senderAddress?: string;
  recipientAddress?: string;
  userId?: string;
  correlationId?: string;
  note?: string;
}

export class SwapTool extends BaseTool<SwapPayload> {
  metadata: ToolMetadata = {
    name: 'swap_tool',
    description:
      'Execute a swap between two assets. Records canonical fixed-precision amounts on the submitting lifecycle transition so exported history preserves exact network values.',
    parameters: {
      fromAsset: {
        type: 'string',
        description: 'Asset symbol to send (e.g. STRK, ETH, BTC)',
        required: true,
      },
      toAsset: {
        type: 'string',
        description: 'Asset symbol to receive',
        required: true,
      },
      sendAmount: {
        type: 'number',
        description:
          'Amount of fromAsset to send. Accepts number or string; canonical form is written as a 7-decimal string.',
        required: true,
      },
      minDestAmount: {
        type: 'number',
        description:
          'Minimum amount of toAsset to accept (slippage guard). Canonical 7-decimal string persisted alongside.',
        required: false,
      },
      slippageTolerance: {
        type: 'number',
        description: 'Slippage tolerance percent, e.g. 1 for 1%.',
        required: false,
      },
      recipientAddress: {
        type: 'string',
        description: 'Destination address for the output asset.',
        required: false,
      },
      correlationId: {
        type: 'string',
        description:
          'Stable caller-provided ID. Auto-generated UUID if omitted. Preserved exactly in exported history.',
        required: false,
      },
      note: {
        type: 'string',
        description: 'Optional human note stored in metadata.',
        required: false,
      },
    },
    examples: ['Swap 100 STRK to BTC with 1% slippage.'],
    category: 'trading',
    version: '1.0.0',
  };

  private static readonly DECIMALS = 7;

  static toCanonicalAmount(raw: number | string | undefined): string {
    const num =
      typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? '0'));
    if (!Number.isFinite(num)) return Number(0).toFixed(SwapTool.DECIMALS);
    return num.toFixed(SwapTool.DECIMALS);
  }

  async execute(payload: SwapPayload, userId: string): Promise<ToolResult> {
    const correlationId =
      typeof payload.correlationId === 'string' &&
      payload.correlationId.length > 0
        ? payload.correlationId
        : randomUUID();

    const canonicalAmount = SwapTool.toCanonicalAmount(payload.sendAmount);
    const canonicalMinDestAmount = SwapTool.toCanonicalAmount(
      payload.minDestAmount
    );

    const kind: TransactionKind = 'swap';
    const lifecycle = new TransactionLifecycleService();

    await lifecycle.record({
      correlationId,
      userId,
      kind,
      stage: 'created' as LifecycleStage,
      payload: {
        fromAsset: payload.fromAsset,
        toAsset: payload.toAsset,
        sendAmount:
          typeof payload.sendAmount === 'number'
            ? payload.sendAmount
            : Number.parseFloat(String(payload.sendAmount ?? '0')),
        minDestAmount:
          typeof payload.minDestAmount === 'number'
            ? payload.minDestAmount
            : Number.parseFloat(String(payload.minDestAmount ?? '0')),
        slippageTolerance: payload.slippageTolerance,
        senderAddress: payload.senderAddress,
        recipientAddress: payload.recipientAddress,
      },
      metadata: {
        note: payload.note ?? undefined,
      },
    });

    await lifecycle.record({
      correlationId,
      userId,
      kind,
      stage: 'submitting' as LifecycleStage,
      metadata: {
        canonicalAmount,
        canonicalMinDestAmount,
        decimals: SwapTool.DECIMALS,
      },
    });

    return this.createSuccessResult('swap_submitted', {
      id: correlationId,
      correlationId,
      fromAsset: payload.fromAsset,
      toAsset: payload.toAsset,
      canonicalAmount,
      canonicalMinDestAmount,
      recipientAddress: payload.recipientAddress,
    });
  }
}

export default SwapTool;
