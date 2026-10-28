import { randomUUID } from 'node:crypto';

import { AppError, accountNotFound, idempotencyConflict } from '../../common/errors/AppError';
import { formatMinorUnits, parseAmountToMinor } from '../../common/utils/money';
import { runInTransaction } from '../../common/utils/retryTransaction';
import { throwIfFaultInjected } from '../../common/utils/faultInjection';
import { AccountRepository } from '../accounts/account.repository';
import { LedgerRepository } from '../ledger/ledger.repository';
import type { CreateTransferInput } from './transfer.schema';
import { TransferRepository } from './transfer.repository';

const accountRepository = new AccountRepository();
const ledgerRepository = new LedgerRepository();
const transferRepository = new TransferRepository();

export async function createTransfer(input: CreateTransferInput) {
  if (input.from_account_id === input.to_account_id) {
    throw new AppError(
      400,
      'TRANSFER_NOT_ALLOWED',
      'Source and destination accounts must be different',
    );
  }

  const amountMinor = parseAmountToMinor(input.amount);

  try {
    return await runInTransaction(async (session) => {
      const existing = await transferRepository.findByReference(input.reference_id, session);
      if (existing) {
        if (
          existing.from_account_id !== input.from_account_id ||
          existing.to_account_id !== input.to_account_id ||
          existing.amount_minor !== amountMinor ||
          existing.description !== input.description
        ) {
          throw idempotencyConflict();
        }
        const ledgers = await ledgerRepository.findByTransferId(existing.transfer_id, session);
        return { status: 'replayed' as const, data: transferResponse(existing, ledgers, true) };
      }

      const source = await accountRepository.findByAccountId(input.from_account_id, session);
      const destination = await accountRepository.findByAccountId(input.to_account_id, session);
      if (!source || !destination) {
        throw accountNotFound();
      }

      const sourceReference = await ledgerRepository.findByAccountAndReference(
        input.from_account_id,
        input.reference_id,
        session,
      );
      const destinationReference = await ledgerRepository.findByAccountAndReference(
        input.to_account_id,
        input.reference_id,
        session,
      );
      if (sourceReference || destinationReference) {
        throw idempotencyConflict();
      }

      const updatedSource = await accountRepository.updateBalance(
        input.from_account_id,
        amountMinor,
        'debit',
        session,
      );
      if (!updatedSource) {
        throw new AppError(409, 'INSUFFICIENT_FUNDS', 'Insufficient account balance');
      }

      throwIfFaultInjected('transfer_after_source_balance');
      const updatedDestination = await accountRepository.updateBalance(
        input.to_account_id,
        amountMinor,
        'credit',
        session,
      );
      if (!updatedDestination) {
        throw new AppError(
          400,
          'INVALID_AMOUNT',
          'Destination balance would exceed the supported maximum',
        );
      }

      throwIfFaultInjected('transfer_after_destination_balance');
      const transferId = `trf_${randomUUID()}`;
      const transfer = await transferRepository.create(
        {
          transfer_id: transferId,
          from_account_id: input.from_account_id,
          to_account_id: input.to_account_id,
          amount_minor: amountMinor,
          reference_id: input.reference_id,
          description: input.description,
        },
        session,
      );

      const debit = await ledgerRepository.create(
        {
          transaction_id: `txn_${randomUUID()}`,
          account_id: input.from_account_id,
          type: 'debit',
          amount_minor: amountMinor,
          balance_after_minor: updatedSource.balance_minor,
          description: input.description,
          reference_id: input.reference_id,
          transfer_id: transferId,
        },
        session,
      );
      throwIfFaultInjected('transfer_after_debit_ledger');
      const credit = await ledgerRepository.create(
        {
          transaction_id: `txn_${randomUUID()}`,
          account_id: input.to_account_id,
          type: 'credit',
          amount_minor: amountMinor,
          balance_after_minor: updatedDestination.balance_minor,
          description: input.description,
          reference_id: input.reference_id,
          transfer_id: transferId,
        },
        session,
      );

      return {
        status: 'created' as const,
        data: transferResponse(transfer, [debit, credit], false),
      };
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      throw idempotencyConflict();
    }
    throw error;
  }
}

function transferResponse(
  transfer: {
    transfer_id: string;
    from_account_id: string;
    to_account_id: string;
    amount_minor: number;
    reference_id: string;
    description: string;
    created_at?: Date;
  },
  ledgers: Array<{
    transaction_id: string;
    account_id: string;
    type: 'credit' | 'debit';
    balance_after_minor: number;
  }>,
  replayed: boolean,
) {
  return {
    transfer_id: transfer.transfer_id,
    from_account_id: transfer.from_account_id,
    to_account_id: transfer.to_account_id,
    amount: formatMinorUnits(transfer.amount_minor),
    reference_id: transfer.reference_id,
    description: transfer.description,
    ledger_transaction_ids: ledgers.map((ledger) => ledger.transaction_id),
    balances: Object.fromEntries(
      ledgers.map((ledger) => [ledger.account_id, formatMinorUnits(ledger.balance_after_minor)]),
    ),
    created_at: transfer.created_at,
    idempotent_replay: replayed,
  };
}
