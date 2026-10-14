export const PUBLIC_DYN3_PRODUCT_NO = 'dynamic_dyn3';
export const PUBLIC_DYNAMIC_2_PRODUCT_NO = 'dynamic_2';

const PUBLIC_TO_BACKEND_DYNAMIC_PRODUCTS: Record<string, string> = {
  [PUBLIC_DYN3_PRODUCT_NO]: 'dynamic_ipweb',
  [PUBLIC_DYNAMIC_2_PRODUCT_NO]: 'out_dynamic_ipweb',
};

const BACKEND_TO_PUBLIC_DYNAMIC_PRODUCTS = Object.fromEntries(
  Object.entries(PUBLIC_TO_BACKEND_DYNAMIC_PRODUCTS).map(
    ([publicProductNo, backendProductNo]) => [backendProductNo, publicProductNo]
  )
);

export function toPublicDynamicProductNo(
  backendProductNo: string
): string | null {
  if (PUBLIC_TO_BACKEND_DYNAMIC_PRODUCTS[backendProductNo]) {
    return backendProductNo;
  }
  return BACKEND_TO_PUBLIC_DYNAMIC_PRODUCTS[backendProductNo] ?? null;
}

export function toBackendDynamicProductNo(
  publicProductNo: string
): string | null {
  return PUBLIC_TO_BACKEND_DYNAMIC_PRODUCTS[publicProductNo] ?? null;
}

export function dynamicProductName(publicProductNo: string): string {
  if (publicProductNo === PUBLIC_DYNAMIC_2_PRODUCT_NO) {
    return 'Dynamic Proxy Pool 2';
  }
  if (publicProductNo === PUBLIC_DYN3_PRODUCT_NO) {
    return 'Dynamic Proxy Pool 3';
  }
  return 'Dynamic Proxy';
}
