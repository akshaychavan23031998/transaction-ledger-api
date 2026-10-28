import type { RequestHandler } from 'express';

import { createAccount, getBalance } from './account.service';
import { getTransactionHistory } from '../ledger/ledger.service';
import type { HistoryQuery } from '../ledger/ledger.schema';

export const postAccount: RequestHandler = async (req, res) => {
  const account = await createAccount(req.body);
  res.status(201).json({ success: true, data: account, request_id: req.requestId });
};

export const accountBalance: RequestHandler = async (req, res) => {
  const balance = await getBalance(req.params.accountId as string);
  res.json({ success: true, data: balance, request_id: req.requestId });
};

export const accountHistory: RequestHandler = async (req, res) => {
  const history = await getTransactionHistory(
    req.params.accountId as string,
    res.locals.validated.query as HistoryQuery,
  );
  res.json({ success: true, data: history, request_id: req.requestId });
};
