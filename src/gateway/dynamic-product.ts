export const PUBLIC_DYN3_PRODUCT_NO = 'dynamic_dyn3';

export function toPublicDynamicProductNo(
  backendProductNo: string
): string | null {
  return ['dynamic_ipweb', PUBLIC_DYN3_PRODUCT_NO].includes(
    backendProductNo
  )
    ? PUBLIC_DYN3_PRODUCT_NO
    : null;
}

export function toBackendDynamicProductNo(
  publicProductNo: string
): string | null {
  return publicProductNo === PUBLIC_DYN3_PRODUCT_NO
    ? 'dynamic_ipweb'
    : null;
}
