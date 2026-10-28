import { randomUUID } from 'node:crypto';

import { idempotencyConflict, accountNotFound, AppError } from '../../common/errors/AppError';
import { formatMinorUnits, parseAmountToMinor } from '../../common/utils/money';
import { runInTransaction } from '../../common/utils/retryTransaction';
import { throwIfFaultInjected } from '../../common/utils/faultInjection';
import type { CreateLedgerInput, HistoryQuery } from './ledger.schema';
import { AccountRepository } from '../accounts/account.repository';
import { LedgerRepository } from './ledger.repository';

const accountRepository = new AccountRepository();
const ledgerRepository = new LedgerRepository();

function responseFromLedger(
  ledger: {
    transaction_id: string;
    account_id: string;
    type: 'credit' | 'debit';
    amount_minor: number;
    balance_after_minor: number;
    description: string;
    reference_id: string;
    created_at?: Date;
  },
  replayed = false,
) {
  return {
    transaction_id: ledger.transaction_id,
    account_id: ledger.account_id,
    type: ledger.type,
    amount: formatMinorUnits(ledger.amount_minor),
    balance: formatMinorUnits(ledger.balance_after_minor),
    description: ledger.description,
    reference_id: ledger.reference_id,
    created_at: ledger.created_at,
    idempotent_replay: replayed,
  };
}

export async function createLedgerTransaction(input: CreateLedgerInput) {
  const amountMinor = parseAmountToMinor(input.amount);

  return runInTransaction(async (session) => {
    const existing = await ledgerRepository.findByAccountAndReference(
      input.account_id,
      input.reference_id,
      session,
    );
    if (existing) {
      if (
        existing.type !== input.type ||
        existing.amount_minor !== amountMinor ||
        existing.description !== input.description
      ) {
        throw idempotencyConflict();
      }
      return { status: 'replayed' as const, data: responseFromLedger(existing, true) };
    }

    const account = await accountRepository.findByAccountId(input.account_id, session);
    if (!account) {
      throw accountNotFound();
    }

    throwIfFaultInjected('ledger_before_balance_update');
    const updatedAccount = await accountRepository.updateBalance(
      input.account_id,
      amountMinor,
      input.type,
      session,
    );

    if (!updatedAccount) {
      if (input.type === 'debit') {
        throw new AppError(409, 'INSUFFICIENT_FUNDS', 'Insufficient account balance');
      }
      throw new AppError(400, 'INVALID_AMOUNT', 'Balance would exceed the supported maximum');
    }

    throwIfFaultInjected('ledger_after_balance_update');
    const ledger = await ledgerRepository.create(
      {
        transaction_id: `txn_${randomUUID()}`,
        account_id: input.account_id,
        type: input.type,
        amount_minor: amountMinor,
        balance_after_minor: updatedAccount.balance_minor,
        description: input.description,
        reference_id: input.reference_id,
      },
      session,
    );

    return {
      status: 'created' as const,
      data: responseFromLedger(ledger, false),
    };
  });
}

export async function getTransactionHistory(accountId: string, query: HistoryQuery) {
  const account = await accountRepository.findByAccountId(accountId);
  if (!account) {
    throw accountNotFound();
  }

  const skip = (query.page - 1) * query.limit;
  const { items, total } = await ledgerRepository.findHistory(accountId, {
    type: query.type,
    skip,
    limit: query.limit,
  });

  return {
    account_id: accountId,
    data: items.map((item) => ({
      transaction_id: item.transaction_id,
      type: item.type,
      amount: formatMinorUnits(item.amount_minor),
      balance: formatMinorUnits(item.balance_after_minor),
      description: item.description,
      reference_id: item.reference_id,
      transfer_id: item.transfer_id,
      created_at: item.created_at,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total_records: total,
      total_pages: Math.ceil(total / query.limit),
    },
  };
}
