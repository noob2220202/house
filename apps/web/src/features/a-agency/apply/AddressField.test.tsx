import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AddressField } from './AddressField';

vi.mock('../api/queries', () => ({
  agencyKeys: { geocode: (q: string) => ['geo', 'geocode', q] },
  geocode: vi.fn(async () => ({ items: [] })),
}));

const SELECTED = '전라남도 순천시 해룡면 신대1로 18';

function Harness({ onClear }: { onClear: () => void }) {
  const [value, setValue] = useState(SELECTED);
  return (
    <AddressField
      value={value}
      onSelect={(item) => setValue(item.roadAddress)}
      onClear={() => {
        onClear();
        setValue('');
      }}
    />
  );
}

describe('AddressField', () => {
  it('keeps the typed text when a selected address is edited (only the selection is cleared)', async () => {
    const onClear = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Harness onClear={onClear} />
      </QueryClientProvider>,
    );
    const input = screen.getByRole('combobox', { name: /사무소 주소/ });
    expect(input).toHaveValue(SELECTED);
    await userEvent.type(input, '{Backspace}');
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('전라남도 순천시 해룡면 신대1로 1');
    await userEvent.type(input, '9');
    expect(input).toHaveValue('전라남도 순천시 해룡면 신대1로 19');
  });
});
