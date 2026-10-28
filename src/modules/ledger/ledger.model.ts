import { Schema, model, type InferSchemaType } from 'mongoose';

import { MAX_AMOUNT_MINOR, MAX_BALANCE_MINOR } from '../../common/utils/money';

const ledgerSchema = new Schema(
  {
    transaction_id: { type: String, required: true, unique: true, index: true, immutable: true },
    account_id: { type: String, required: true, index: true, immutable: true },
    type: { type: String, required: true, enum: ['credit', 'debit'], immutable: true },
    amount_minor: { type: Number, required: true, min: 1, max: MAX_AMOUNT_MINOR, immutable: true },
    balance_after_minor: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_BALANCE_MINOR,
      immutable: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 500,
      immutable: true,
    },
    reference_id: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
      immutable: true,
    },
    transfer_id: { type: String, immutable: true },
  },
  {
    collection: 'ledger_transactions',
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
    strict: true,
  },
);

ledgerSchema.index({ account_id: 1, reference_id: 1 }, { unique: true });
ledgerSchema.index({ account_id: 1, created_at: -1, transaction_id: -1 });
ledgerSchema.index({ transfer_id: 1 });

export type LedgerTransaction = InferSchemaType<typeof ledgerSchema> & {
  _id: Schema.Types.ObjectId;
};
export const LedgerModel = model('LedgerTransaction', ledgerSchema);
