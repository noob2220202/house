/**
 * Minimal typings of the Kakao Maps JS SDK (v2 loader, map core 4.4.x) surface we use — there is
 * no official @types package — plus a one-time loader.
 *
 * The SDK is loaded with `autoload=false`: `dapi.kakao.com/v2/maps/sdk.js` checks the app key and
 * the page's domain (Kakao Developers → 플랫폼 → Web → 사이트 도메인) and then `kakao.maps.load()`
 * pulls the map core from t1.daumcdn.net. Markers/clusters come from our API (server-side
 * clustering), so no SDK library (`clusterer`, `services`) is requested.
 */
export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
export interface KakaoLatLngBounds {
  getSouthWest(): KakaoLatLng;
  getNorthEast(): KakaoLatLng;
}
export interface KakaoMapOptions {
  center: KakaoLatLng;
  /** 1 (closest) … 14 (farthest) — see `@/lib/map/kakao-level`. */
  level: number;
  minLevel?: number;
  maxLevel?: number;
  draggable?: boolean;
  scrollwheel?: boolean;
  disableDoubleClick?: boolean;
  disableDoubleClickZoom?: boolean;
  keyboardShortcuts?: boolean;
  tileAnimation?: boolean;
}
export interface KakaoMap {
  getCenter(): KakaoLatLng;
  getLevel(): number;
  getBounds(): KakaoLatLngBounds;
  setCenter(latlng: KakaoLatLng): void;
  panTo(latlng: KakaoLatLng): void;
  setLevel(level: number, options?: { animate?: boolean | { duration: number } }): void;
  setZoomable(zoomable: boolean): void;
  /** Re-reads the container size and redraws the tiles (after the element was resized). */
  relayout(): void;
}
export interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void;
  setPosition(latlng: KakaoLatLng): void;
  setZIndex(z: number): void;
}
export interface KakaoMouseEvent {
  latLng?: KakaoLatLng;
}
export type KakaoHandler = (e?: KakaoMouseEvent) => void;
export interface KakaoMaps {
  load(callback: () => void): void;
  Map: new (el: HTMLElement, options: KakaoMapOptions) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: HTMLElement;
    map?: KakaoMap;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
    /** true: clicks on the content do not reach the map (no map `click`, no drag start). */
    clickable?: boolean;
  }) => KakaoCustomOverlay;
  event: {
    addListener(target: object, type: string, handler: KakaoHandler): void;
    removeListener(target: object, type: string, handler: KakaoHandler): void;
  };
}

declare global {
  interface Window {
    kakao?: { maps?: KakaoMaps };
  }
}

export const KAKAO_SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js';
/** The loader script answers 401 for an unknown key / unregistered domain → onerror. */
const LOAD_TIMEOUT_MS = 15_000;
let loading: Promise<KakaoMaps> | null = null;

/** Script URL for a JavaScript key (`autoload=false`: we call `kakao.maps.load` ourselves). */
export function kakaoSdkUrl(appKey: string): string {
  return `${KAKAO_SDK_URL}?appkey=${encodeURIComponent(appKey)}&autoload=false`;
}

/**
 * Loads the Kakao Maps SDK once. Rejects when the key/domain is refused (the loader answers 401,
 * which fires `onerror`), on network failure, or when the map core does not arrive in time.
 */
export function loadKakaoMaps(appKey: string): Promise<KakaoMaps> {
  if (typeof window === 'undefined')
    return Promise.reject(new Error('Kakao Maps can only load in the browser'));
  const ready = window.kakao?.maps;
  if (ready && typeof ready.Map === 'function') return Promise.resolve(ready);
  loading ??= new Promise<KakaoMaps>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fail = (message: string) => {
      if (timer) clearTimeout(timer);
      loading = null;
      reject(new Error(message));
    };
    const boot = () => {
      const maps = window.kakao?.maps;
      if (!maps || typeof maps.load !== 'function') {
        fail(
          'Kakao Maps SDK refused the key (check NEXT_PUBLIC_KAKAO_MAP_KEY and the registered site domain)',
        );
        return;
      }
      timer = setTimeout(() => fail('Kakao Maps core did not load in time'), LOAD_TIMEOUT_MS);
      maps.load(() => {
        if (timer) clearTimeout(timer);
        resolve(maps);
      });
    };
    if (window.kakao?.maps?.load) {
      boot();
      return;
    }
    const script = document.createElement('script');
    script.src = kakaoSdkUrl(appKey);
    script.async = true;
    script.dataset.kakaoMaps = '';
    script.onload = boot;
    script.onerror = () => {
      script.remove();
      fail('Failed to load the Kakao Maps SDK (wrong key, unregistered domain or network)');
    };
    document.head.appendChild(script);
  });
  return loading;
}
