import type { Page } from 'playwright/test';

/** What the Kakao(Daum) postcode widget hands to `oncomplete` (subset the apps read). */
export interface FakeAddress {
  roadAddress: string;
  jibunAddress: string;
  zonecode: string;
  /** 법정동코드, 10 digits (current 12150… codes, D1). */
  bcode: string;
  buildingName?: string;
  apartment?: 'Y' | 'N';
  bname?: string;
}

/**
 * Replaces the external postcode script (t1.kakaocdn.net, or NEXT_PUBLIC_POSTCODE_SCRIPT_URL) with
 * a local fake: `embed()` renders one button "e2e 주소 선택: <road address>"; clicking it calls
 * `oncomplete` like the real widget. Tests never depend on the external CDN.
 */
export async function installFakePostcode(page: Page, address: FakeAddress): Promise<void> {
  const data = {
    zonecode: address.zonecode,
    roadAddress: address.roadAddress,
    jibunAddress: address.jibunAddress,
    autoRoadAddress: '',
    autoJibunAddress: '',
    bcode: address.bcode,
    sido: '전남광주통합특별시',
    sigungu: '순천시',
    sigunguCode: address.bcode.slice(0, 5),
    bname: address.bname ?? '',
    buildingName: address.buildingName ?? '',
    apartment: address.apartment ?? 'N',
    userSelectedType: 'R',
  };
  const script = `
    (function () {
      var DATA = ${JSON.stringify(data)};
      function Postcode(options) { this.options = options; }
      Postcode.prototype.embed = function (el) {
        var self = this;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-testid', 'e2e-postcode-pick');
        btn.textContent = 'e2e 주소 선택: ' + DATA.roadAddress;
        btn.addEventListener('click', function () { self.options.oncomplete(DATA); });
        el.appendChild(btn);
      };
      Postcode.prototype.open = function () { this.options.oncomplete(DATA); };
      window.daum = window.daum || {};
      window.daum.Postcode = Postcode;
      window.kakao = window.kakao || {};
      window.kakao.Postcode = Postcode;
    })();`;
  await page.route(/postcode(\.v2)?\.js(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: script }),
  );
}

/** Opens the address dialog's fake widget and picks the address. */
export async function pickFakeAddress(page: Page): Promise<void> {
  await page.getByTestId('e2e-postcode-pick').click();
}
