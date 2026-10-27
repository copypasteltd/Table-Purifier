import { invariant } from './errors.js';

export interface PricePolicy { id: string; baseMinor: number; unitMinor: number; maxMinor: number }

export function calculateQuote(policy: PricePolicy, measuredUnits: number): { amount_minor: number; cap_minor: number; measured_units: number } {
  invariant(Number.isSafeInteger(measuredUnits) && measuredUnits >= 1 && measuredUnits <= 50,
    'INVALID_MEASUREMENT', '请先完成本次全部资料的可信范围计量。', 422);
  invariant([policy.baseMinor, policy.unitMinor, policy.maxMinor].every(Number.isSafeInteger)
    && policy.baseMinor > 0 && policy.unitMinor >= 0 && policy.maxMinor >= policy.baseMinor,
  'PRICE_POLICY_INVALID', '当前价格配置尚不可用。', 503);
  const amount = policy.baseMinor + (measuredUnits - 1) * policy.unitMinor;
  invariant(amount <= policy.maxMinor, 'PRICE_LIMIT_EXCEEDED', '本次范围超过当前可售价格上限，请调整范围。', 422);
  return { amount_minor: amount, cap_minor: amount, measured_units: measuredUnits };
}
