import { Schema, model, type InferSchemaType } from 'mongoose';

import { MAX_BALANCE_MINOR } from '../../common/utils/money';

const accountSchema = new Schema(
  {
    account_id: { type: String, required: true, immutable: true },
    account_holder_name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    balance_minor: { type: Number, required: true, default: 0, min: 0, max: MAX_BALANCE_MINOR },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      immutable: true,
      match: /^[A-Z]{3}$/,
    },
  },
  {
    collection: 'accounts',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
    strict: true,
  },
);

accountSchema.index({ account_id: 1 }, { unique: true });

export type Account = InferSchemaType<typeof accountSchema> & { _id: Schema.Types.ObjectId };
export const AccountModel = model('Account', accountSchema);
