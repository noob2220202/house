import { describe, expect, it } from 'vitest';
import { CLUSTER_MAX_ZOOM, buildAgencyMarkers, clusterCellDeg, isClusterId } from '../lib/markers';

type Office = Parameters<typeof buildAgencyMarkers>[0][number];

let seq = 0;
const office = (lat: number, lng: number, count: number, emdName = '연향동'): Office => {
  seq += 1;
  return {
    id: `a${seq}`,
    name: `사무소${seq} 공인중개사사무소`,
    lat,
    lng,
    emdName,
    activeListingCount: count,
    specialties: ['APT'],
  };
};

// Three offices a few metres apart (one grid cell at any clustering zoom) + two far away.
const dense = () => [
  office(34.9201, 127.5451, 5, '해룡면'),
  office(34.9202, 127.5452, 9, '해룡면'),
  office(34.9203, 127.5453, 2, '조례동'),
];
const far = () => [office(34.97, 127.5, 40), office(34.95, 127.58, 3)];

describe('buildAgencyMarkers', () => {
  it('merges dense offices into one bubble named after the most common 동', () => {
    const markers = buildAgencyMarkers([...dense(), ...far()], { zoom: 13 });
    const clusters = markers.filter((m) => m.kind === 'cluster');
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({ name: '해룡면', count: 3, size: 'sm' });
    expect(isClusterId(clusters[0]!.id)).toBe(true);
    expect(clusters[0]!.ariaLabel).toBe('해룡면 중개사무소 3곳, 확대해서 보기');
    // The bubble sits at the centroid of its members.
    expect(clusters[0]!.position.lat).toBeCloseTo(34.9202, 4);
    expect(markers).toHaveLength(3);
  });

  it('labels the offices with the most listings and pins the rest', () => {
    const markers = buildAgencyMarkers(far(), { zoom: 13, maxLabels: 1 });
    expect(markers.map((m) => m.kind)).toEqual(['pin', 'complex']);
    const label = markers[1]!;
    // Reads "사무소1 / 매물 40" like the design's office marker.
    expect(label).toMatchObject({
      kind: 'complex',
      count: 40,
      areaLabel: '매물',
      priceLabel: '40',
    });
    expect(label.kind === 'complex' && label.name).toMatch(/^사무소\d+$/); // suffix stripped
    expect(label.ariaLabel).toMatch(/공인중개사사무소, 보유 매물 40건$/);
  });

  it('never hides the selected office inside a cluster and paints it last', () => {
    const offices = [...dense(), ...far()];
    const selectedId = offices[0]!.id;
    const markers = buildAgencyMarkers(offices, { zoom: 13, selectedId });
    expect(markers.at(-1)).toMatchObject({ kind: 'complex', id: selectedId });
    // Two members left → below the cluster threshold → shown individually.
    expect(markers.some((m) => m.kind === 'cluster')).toBe(false);
    expect(markers.filter((m) => m.id === selectedId)).toHaveLength(1);
  });

  it('stops clustering when zoomed in', () => {
    const markers = buildAgencyMarkers(dense(), { zoom: CLUSTER_MAX_ZOOM });
    expect(markers.every((m) => m.kind !== 'cluster')).toBe(true);
    expect(markers).toHaveLength(3);
  });

  it('uses bigger cells when zoomed out', () => {
    expect(clusterCellDeg(12)).toBeCloseTo(clusterCellDeg(13) * 2);
    // ~1.5 km apart: separate at zoom 14, one cell row/column at zoom 9.
    const spread = [office(34.94, 127.52, 1), office(34.945, 127.53, 1), office(34.95, 127.535, 1)];
    expect(buildAgencyMarkers(spread, { zoom: 14 }).some((m) => m.kind === 'cluster')).toBe(false);
    expect(
      buildAgencyMarkers(spread, { zoom: 9 }).filter((m) => m.kind === 'cluster'),
    ).toHaveLength(1);
  });

  it('handles an empty result', () => {
    expect(buildAgencyMarkers([], { zoom: 13, selectedId: 'x' })).toEqual([]);
  });
});
