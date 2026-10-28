import type { ClientSession } from 'mongoose';

import { MAX_BALANCE_MINOR } from '../../common/utils/money';
import { AccountModel } from './account.model';

export class AccountRepository {
  async create(
    input: { account_id: string; account_holder_name: string },
    session?: ClientSession,
  ) {
    const [account] = await AccountModel.create([input], { session });
    return account;
  }

  findByAccountId(accountId: string, session?: ClientSession) {
    return AccountModel.findOne({ account_id: accountId })
      .session(session ?? null)
      .exec();
  }

  updateBalance(
    accountId: string,
    amountMinor: number,
    direction: 'credit' | 'debit',
    session: ClientSession,
  ) {
    const condition =
      direction === 'debit'
        ? { balance_minor: { $gte: amountMinor } }
        : { balance_minor: { $lte: MAX_BALANCE_MINOR - amountMinor } };

    return AccountModel.findOneAndUpdate(
      { account_id: accountId, ...condition },
      { $inc: { balance_minor: direction === 'credit' ? amountMinor : -amountMinor } },
      { new: true, session, runValidators: true },
    ).exec();
  }
}
