import type { ClientSession } from 'mongoose';

import { TransferModel } from './transfer.model';

export class TransferRepository {
  findByReference(referenceId: string, session: ClientSession) {
    return TransferModel.findOne({ reference_id: referenceId }).session(session).lean().exec();
  }

  async create(input: Record<string, unknown>, session: ClientSession) {
    const [transfer] = await TransferModel.create([input], { session });
    if (!transfer) {
      throw new Error('Transfer creation returned no document');
    }
    return transfer.toObject();
  }
}
