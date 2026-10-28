import { Schema, model, type InferSchemaType } from 'mongoose';

import { MAX_AMOUNT_MINOR } from '../../common/utils/money';

const transferSchema = new Schema(
  {
    transfer_id: { type: String, required: true, unique: true, index: true, immutable: true },
    from_account_id: { type: String, required: true, immutable: true },
    to_account_id: { type: String, required: true, immutable: true },
    amount_minor: { type: Number, required: true, min: 1, max: MAX_AMOUNT_MINOR, immutable: true },
    reference_id: { type: String, required: true, immutable: true },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 500,
      immutable: true,
    },
  },
  {
    collection: 'transfers',
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
    strict: true,
  },
);

transferSchema.index({ reference_id: 1 }, { unique: true });

export type Transfer = InferSchemaType<typeof transferSchema> & { _id: Schema.Types.ObjectId };
export const TransferModel = model('Transfer', transferSchema);
