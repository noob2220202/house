import { canonicalRegionCode } from '@house/shared';

/**
 * Kakao(Daum) 우편번호 서비스 loader. The script is fetched on demand (first time the address dialog
 * opens) and never blocks rendering. No API key is required. The default host is t1.kakaocdn.net —
 * the old t1.daumcdn.net host is retired on 2026-11-30. The URL can be overridden with
 * NEXT_PUBLIC_POSTCODE_SCRIPT_URL (the provider announces CDN host changes in its guide).
 * https://postcode.map.kakao.com/guide
 */
export const DAUM_POSTCODE_SRC =
  process.env.NEXT_PUBLIC_POSTCODE_SCRIPT_URL ||
  'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

/** Subset of the `oncomplete` payload we use. */
export interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  autoRoadAddress?: string;
  autoJibunAddress?: string;
  /** 법정동코드 (10 digits). */
  bcode: string;
  /** 시·도 name ("전남광주통합특별시", "전남"). */
  sido?: string;
  /** 시·군·구 name ("순천시"). */
  sigungu?: string;
  /** 시·군·구 code (5 digits, "12150"). */
  sigunguCode?: string;
  /** 법정동/법정리 name ("왕지동", "신대리"). */
  bname?: string;
  buildingName: string;
  /** 'Y' when the building is a 공동주택. */
  apartment: 'Y' | 'N';
  userSelectedType: 'R' | 'J';
}

interface DaumPostcodeInstance {
  embed: (element: HTMLElement, options?: { autoClose?: boolean }) => void;
}
interface DaumNamespace {
  Postcode: new (options: {
    oncomplete: (data: DaumPostcodeData) => void;
    width?: string | number;
    height?: string | number;
    animation?: boolean;
  }) => DaumPostcodeInstance;
}

declare global {
  interface Window {
    daum?: DaumNamespace;
  }
}

/** Address picked in the dialog — the fields the 내놓기 form stores. */
export interface PickedAddress {
  roadAddress: string;
  jibunAddress: string;
  zonecode: string;
  bcode: string;
  buildingName: string;
  sido?: string;
  sigungu?: string;
  sigunguCode?: string;
  bname?: string;
}

/**
 * Postcode result → picked address. The region codes are canonicalized at this boundary (D1):
 * cached or not-yet-updated postcode data may still carry the legacy 순천 code 46150….
 */
export function toPickedAddress(data: DaumPostcodeData): PickedAddress {
  return {
    roadAddress: data.roadAddress || data.autoRoadAddress || data.jibunAddress,
    jibunAddress: data.jibunAddress || data.autoJibunAddress || '',
    zonecode: data.zonecode,
    bcode: data.bcode ? canonicalRegionCode(data.bcode) : '',
    buildingName: data.buildingName ?? '',
    sido: data.sido,
    sigungu: data.sigungu,
    sigunguCode: data.sigunguCode ? canonicalRegionCode(data.sigunguCode) : data.sigunguCode,
    bname: data.bname,
  };
}

let loading: Promise<DaumNamespace> | null = null;

/** Loads the postcode script once; rejects when it cannot be fetched (offline, blocked). */
export function loadDaumPostcode(timeoutMs = 8000): Promise<DaumNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.daum?.Postcode) return Promise.resolve(window.daum);
  loading ??= new Promise<DaumNamespace>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = DAUM_POSTCODE_SRC;
    script.async = true;
    const fail = () => {
      loading = null;
      script.remove();
      reject(new Error('postcode script failed to load'));
    };
    const timer = window.setTimeout(fail, timeoutMs);
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.daum?.Postcode) resolve(window.daum);
      else fail();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      fail();
    };
    document.head.appendChild(script);
  });
  return loading;
}
