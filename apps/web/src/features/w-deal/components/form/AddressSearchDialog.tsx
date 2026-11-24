'use client';
import { Button, FieldError, Input, Modal, Spinner } from '@house/ui';
import { useEffect, useRef, useState } from 'react';
import { BRAND } from '@/config/brand';
import { env } from '@/config/env';
import { loadDaumPostcode, toPickedAddress, type PickedAddress } from '../../lib/daum-postcode';
import { inServiceArea } from '../../lib/service-area';
import styles from './form.module.css';

/**
 * Fictional sample addresses for mock mode, so the flow works without the external script.
 * Their bcode uses the provisional region codes of the mocks (see lib/regions.ts).
 */
const MOCK_SAMPLES: readonly PickedAddress[] = [
  {
    roadAddress: '전남 순천시 해룡면 신대2로 40',
    jibunAddress: '전남 순천시 해룡면 신대리 1970',
    zonecode: '58023',
    bcode: '1215033028',
    buildingName: '신대 레이크파크 1단지',
  },
  {
    roadAddress: '전남 순천시 연향3로 20',
    jibunAddress: '전남 순천시 연향동 1325',
    zonecode: '57988',
    bcode: '1215012100',
    buildingName: '연향 센트럴',
  },
  {
    roadAddress: '전남 순천시 대학로 22',
    jibunAddress: '전남 순천시 석현동 310',
    zonecode: '57922',
    bcode: '1215011000',
    buildingName: '해오름빌',
  },
  {
    roadAddress: '전남 순천시 왕지2로 61',
    jibunAddress: '전남 순천시 왕지동 742',
    zonecode: '57957',
    bcode: '1215012200',
    buildingName: '',
  },
];

export interface AddressSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (address: PickedAddress) => void;
}

/**
 * Address search: embeds the Daum postcode widget. When the script cannot be loaded the dialog
 * falls back to typing the road address by hand; in API mock mode it also lists sample addresses.
 */
export function AddressSearchDialog({ open, onClose, onSelect }: AddressSearchDialogProps) {
  const embedRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [outside, setOutside] = useState(false);
  const [manual, setManual] = useState('');
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState('loading');
    setOutside(false);
    loadDaumPostcode()
      .then((daum) => {
        if (cancelled || !embedRef.current) return;
        embedRef.current.replaceChildren();
        new daum.Postcode({
          width: '100%',
          height: '100%',
          animation: false,
          oncomplete: (data) => {
            const picked = toPickedAddress(data);
            if (!inServiceArea(picked)) {
              setOutside(true);
              return;
            }
            onSelectRef.current(picked);
          },
        }).embed(embedRef.current, { autoClose: false });
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const submitManual = () => {
    const roadAddress = manual.trim();
    if (roadAddress.length < 5) return;
    onSelect({ roadAddress, jibunAddress: '', zonecode: '', bcode: '', buildingName: '' });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="주소 검색"
      description="도로명, 건물명 또는 지번으로 검색해 주세요."
    >
      <div className={styles.addrBox}>
        {state !== 'failed' && (
          <div className={styles.addrEmbed} aria-busy={state === 'loading'}>
            {state === 'loading' && <Spinner label="주소 검색을 불러오는 중" />}
            <div ref={embedRef} hidden={state !== 'ready'} />
          </div>
        )}
        {outside && (
          <FieldError>
            지금은 {BRAND.region} 매물만 내놓을 수 있어요. 다른 주소를 선택해 주세요.
          </FieldError>
        )}
        {state === 'failed' && (
          <>
            <p className="t-sm">
              주소 검색 서비스를 불러오지 못했어요. 도로명 주소를 직접 입력해 주세요.
            </p>
            <div className={styles.addrManual}>
              <Input
                aria-label="도로명 주소"
                placeholder="예: 전남 순천시 해룡면 신대2로 40"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitManual();
                  }
                }}
                maxLength={200}
              />
              <Button type="button" onClick={submitManual} disabled={manual.trim().length < 5}>
                이 주소 사용
              </Button>
            </div>
          </>
        )}
        {env.apiMock && (
          <div className={styles.addrList}>
            <p className="t-cap">
              <span className={styles.devTag}>MOCK</span>샘플 주소 (목업 모드에서만 보여요)
            </p>
            {MOCK_SAMPLES.map((a) => (
              <button
                key={a.roadAddress}
                type="button"
                className={styles.addrItem}
                onClick={() => onSelect(a)}
              >
                <b>{a.roadAddress}</b>
                <span>
                  {a.jibunAddress}
                  {a.buildingName ? ` · ${a.buildingName}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
