export function safeMultiply(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    throw new RangeError("Operands must be safe integers");
  }
  const result = a * b;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Multiplication result exceeds Number.MAX_SAFE_INTEGER");
  }
  return result;
}

export function divideAndRound(numerator: number, denominator: number): number {
  if (denominator <= 0 || !Number.isSafeInteger(denominator)) {
    throw new RangeError("Denominator must be a positive safe integer");
  }
  if (!Number.isSafeInteger(numerator)) {
    throw new RangeError("Numerator must be a safe integer");
  }
  // Math.round does standard round-half-up
  const result = Math.round(numerator / denominator);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Result exceeds Number.MAX_SAFE_INTEGER");
  }
  return result;
}

export function convertCurrency(amountMinor: number, fxNumerator: number, fxDenominator: number): number {
  if (fxNumerator === 1 && fxDenominator === 1) {
    return amountMinor;
  }
  const product = safeMultiply(amountMinor, fxNumerator);
  return divideAndRound(product, fxDenominator);
}
