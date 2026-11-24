/** Minimal typings of the Naver Maps JS v3 API surface we use (there is no official @types package). */
export interface NaverLatLng {
  lat(): number;
  lng(): number;
}
export interface NaverLatLngBounds {
  getSW(): NaverLatLng;
  getNE(): NaverLatLng;
}
export interface NaverPoint {
  x: number;
  y: number;
}
export interface NaverMapOptions {
  center: NaverLatLng;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  zoomControl?: boolean;
  scaleControl?: boolean;
  mapDataControl?: boolean;
  mapTypeControl?: boolean;
  draggable?: boolean;
  scrollWheel?: boolean;
  pinchZoom?: boolean;
  keyboardShortcuts?: boolean;
  disableDoubleClickZoom?: boolean;
  tileTransition?: boolean;
}
export interface NaverMap {
  getCenter(): NaverLatLng;
  getZoom(): number;
  getBounds(): NaverLatLngBounds;
  morph(latlng: NaverLatLng, zoom?: number): void;
  /** Re-reads the container size and redraws the tiles (after the element was resized). */
  autoResize(): void;
  destroy(): void;
}
export interface NaverMarker {
  setMap(map: NaverMap | null): void;
  setPosition(latlng: NaverLatLng): void;
  setZIndex(z: number): void;
}
export interface NaverListener {
  readonly eventName?: string;
}
export interface NaverMaps {
  Map: new (el: HTMLElement, options: NaverMapOptions) => NaverMap;
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  Point: new (x: number, y: number) => NaverPoint;
  Marker: new (options: {
    position: NaverLatLng;
    map: NaverMap;
    icon: { content: HTMLElement; anchor: NaverPoint };
    zIndex?: number;
    clickable?: boolean;
  }) => NaverMarker;
  Event: {
    addListener(
      target: object,
      name: string,
      handler: (e: { coord?: NaverLatLng }) => void,
    ): NaverListener;
    removeListener(listener: NaverListener | NaverListener[]): void;
  };
}

declare global {
  interface Window {
    naver?: { maps?: NaverMaps };
    /** Called by the Naver SDK when the key/domain is rejected. */
    navermap_authFailure?: () => void;
  }
}

const SDK_URL = 'https://oapi.map.naver.com/openapi/v3/maps.js';
let loading: Promise<NaverMaps> | null = null;

/** Loads the Naver Maps JS v3 SDK once (script tag with `ncpKeyId`). Rejects on auth/network failure. */
export function loadNaverMaps(keyId: string): Promise<NaverMaps> {
  if (typeof window === 'undefined')
    return Promise.reject(new Error('Naver Maps can only load in the browser'));
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  loading ??= new Promise<NaverMaps>((resolve, reject) => {
    const fail = (message: string) => {
      loading = null;
      reject(new Error(message));
    };
    window.navermap_authFailure = () =>
      fail(
        'Naver Maps authentication failed (check NEXT_PUBLIC_NAVER_MAP_KEY_ID and the registered web service URL)',
      );
    const script = document.createElement('script');
    script.src = `${SDK_URL}?ncpKeyId=${encodeURIComponent(keyId)}`;
    script.async = true;
    script.onload = () => {
      const maps = window.naver?.maps;
      if (maps) resolve(maps);
      else fail('Naver Maps SDK loaded but window.naver.maps is missing');
    };
    script.onerror = () => {
      script.remove();
      fail('Failed to load the Naver Maps SDK');
    };
    document.head.appendChild(script);
  });
  return loading;
}
