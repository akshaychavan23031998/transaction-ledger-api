import type { ClientSession } from 'mongoose';

import { LedgerModel } from './ledger.model';

export class LedgerRepository {
  findByAccountAndReference(accountId: string, referenceId: string, session: ClientSession) {
    return LedgerModel.findOne({ account_id: accountId, reference_id: referenceId })
      .session(session)
      .lean()
      .exec();
  }

  async create(input: Record<string, unknown>, session: ClientSession) {
    const [ledger] = await LedgerModel.create([input], { session });
    if (!ledger) {
      throw new Error('Ledger creation returned no document');
    }
    return ledger.toObject();
  }

  async findHistory(
    accountId: string,
    filter: { type?: 'credit' | 'debit'; skip: number; limit: number },
  ) {
    const query = { account_id: accountId, ...(filter.type ? { type: filter.type } : {}) };
    const [items, total] = await Promise.all([
      LedgerModel.find(query)
        .sort({ created_at: -1, transaction_id: -1 })
        .skip(filter.skip)
        .limit(filter.limit)
        .lean()
        .exec(),
      LedgerModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  findByTransferId(transferId: string, session: ClientSession) {
    return LedgerModel.find({ transfer_id: transferId })
      .sort({ type: 1 })
      .session(session)
      .lean()
      .exec();
  }
}
