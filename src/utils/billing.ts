export function refundableCharge(balanceBefore: number, balanceAfter: number): number {
  return Math.round(Math.max(0, balanceBefore - balanceAfter) * 100) / 100;
}
