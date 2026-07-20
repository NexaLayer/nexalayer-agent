export const PUBLIC_DYN3_PRODUCT_NO = 'dynamic_dyn3';

export function toPublicDynamicProductNo(
  backendProductNo: string
): string | null {
  return backendProductNo === 'dynamic_ipweb'
    ? PUBLIC_DYN3_PRODUCT_NO
    : null;
}
