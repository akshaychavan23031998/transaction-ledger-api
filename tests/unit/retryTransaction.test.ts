import mongoose, { type ClientSession } from 'mongoose';

import { runInTransaction } from '../../src/common/utils/retryTransaction';

describe('transaction retry helper', () => {
  it('retries a transient transaction error within the configured bound', async () => {
    const transientError = Object.assign(new Error('transient'), {
      errorLabels: ['TransientTransactionError'],
    });
    let executions = 0;
    const firstSession = {
      withTransaction: jest.fn().mockRejectedValue(transientError),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const secondSession = {
      withTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const startSession = jest
      .spyOn(mongoose, 'startSession')
      .mockResolvedValueOnce(firstSession as unknown as ClientSession)
      .mockResolvedValueOnce(secondSession as unknown as ClientSession);

    await expect(
      runInTransaction(async () => {
        executions += 1;
        return 'ok';
      }),
    ).resolves.toBe('ok');

    expect(startSession).toHaveBeenCalledTimes(2);
    expect(firstSession.endSession).toHaveBeenCalledTimes(1);
    expect(secondSession.endSession).toHaveBeenCalledTimes(1);
    expect(executions).toBe(1);
    startSession.mockRestore();
  });
});
