/**
 * Upstream data sources the site states on its pages, llms.txt and Dataset JSON-LD. Only name
 * what the backend actually syncs (apps/api complexes trade-sync: 국토교통부 아파트 매매·전월세
 * 실거래가 via 공공데이터포털).
 */
export const DATA_SOURCES = {
  trades: {
    name: '국토교통부 아파트 매매·전월세 실거래가 자료',
    provider: '공공데이터포털(data.go.kr) Open API',
    url: 'https://www.data.go.kr',
    /** Public lookup service of the same data, for readers who want to check a figure. */
    lookupName: '국토교통부 실거래가 공개시스템',
    lookupUrl: 'https://rt.molit.go.kr',
    /** apps/api TRADE_SYNC_CRON ('13 4 2,16 * *', Asia/Seoul) — keep in sync when it changes. */
    updateCadence: '매월 2일·16일 새벽에 국토교통부 자료를 다시 받아 갱신',
    /** 부동산 거래신고법: contracts are reported within 30 days, so recent months still grow. */
    reportingNote:
      '부동산 거래 신고는 계약일로부터 30일 이내에 하므로 최근 한두 달의 거래량은 이후 늘어날 수 있습니다. 해제(취소)된 거래는 통계에서 제외합니다.',
  },
  listings: {
    name: '중개사 회원이 등록한 매물 정보',
    note: '매물은 공인중개사무소(중개사 회원)가 직접 등록·관리하며 광고 중·계약 중인 매물만 공개합니다.',
    updateCadence: '중개사가 등록·수정하는 즉시 반영(검색 페이지는 수 분 단위로 갱신)',
  },
} as const;
