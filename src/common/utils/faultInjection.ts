export type FaultPoint =
  | 'ledger_before_balance_update'
  | 'ledger_after_balance_update'
  | 'transfer_after_source_balance'
  | 'transfer_after_destination_balance'
  | 'transfer_after_debit_ledger';

let activeFaultPoint: FaultPoint | undefined;

export function setFaultInjection(point: FaultPoint): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Fault injection is only available in test mode');
  }
  activeFaultPoint = point;
}

export function clearFaultInjection(): void {
  activeFaultPoint = undefined;
}

export function throwIfFaultInjected(point: FaultPoint): void {
  if (activeFaultPoint === point) {
    activeFaultPoint = undefined;
    throw new Error(`Controlled test failure at ${point}`);
  }
}
