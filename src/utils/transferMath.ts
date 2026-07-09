export interface TransferFeeInputs {
  gross: number;
  fxRate?: number | null;
  fxFee?: number;
  platformFee?: number;
  tax?: number;
}

/** Shared by the create and edit transfer forms so the live preview and the submitted net always agree. */
export const computeTransferNet = ({ gross, fxRate, fxFee = 0, platformFee = 0, tax = 0 }: TransferFeeInputs): number => {
  if (!Number.isFinite(gross)) return 0;
  const rate = fxRate && fxRate > 0 ? fxRate : 1;
  return Math.max(0, gross * rate - fxFee - platformFee - tax);
};
