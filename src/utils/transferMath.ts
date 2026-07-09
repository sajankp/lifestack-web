export interface TransferFeeInputs {
  gross: number;
  fxRate?: number | null;
  fxFee?: number;
  platformFee?: number;
  tax?: number;
}

/** Shared by the create and edit transfer forms so the live preview and the submitted net always agree. */
export const computeTransferNet = ({ gross, fxRate, fxFee = 0, platformFee = 0, tax = 0 }: TransferFeeInputs): number => {
  const g = Number.isFinite(gross) ? gross : 0;
  const rate = fxRate && Number.isFinite(fxRate) && fxRate > 0 ? fxRate : 1;
  const f = Number.isFinite(fxFee) && fxFee > 0 ? fxFee : 0;
  const p = Number.isFinite(platformFee) && platformFee > 0 ? platformFee : 0;
  const t = Number.isFinite(tax) && tax > 0 ? tax : 0;
  return Math.max(0, g * rate - f - p - t);
};
