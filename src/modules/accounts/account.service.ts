import { randomUUID } from 'node:crypto';

import { accountNotFound } from '../../common/errors/AppError';
import { formatMinorUnits } from '../../common/utils/money';
import type { CreateAccountInput } from './account.schema';
import { AccountRepository } from './account.repository';

const accountRepository = new AccountRepository();

export async function createAccount(input: CreateAccountInput) {
  const account = await accountRepository.create({
    account_id: `acc_${randomUUID()}`,
    account_holder_name: input.account_holder_name,
  });
  if (!account) {
    throw new Error('Account creation returned no document');
  }

  return {
    account_id: account.account_id,
    account_holder_name: account.account_holder_name,
    balance: formatMinorUnits(account.balance_minor),
    currency: account.currency,
    created_at: account.created_at,
  };
}

export async function getBalance(accountId: string) {
  const account = await accountRepository.findByAccountId(accountId);
  if (!account) {
    throw accountNotFound();
  }

  return {
    account_id: account.account_id,
    balance: formatMinorUnits(account.balance_minor),
    currency: account.currency,
    updated_at: account.updated_at,
  };
}
