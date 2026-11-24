import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BarList } from '../stats/BarList';
import { moveItem } from '../lib/reorder';
import { MarkupEditor } from './MarkupEditor';
import { OrderButtons } from './OrderButtons';
import { RichPreview } from './RichPreview';

function Editor({
  initial = '',
  previewToggle = false,
}: {
  initial?: string;
  previewToggle?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <MarkupEditor
      label="내용"
      value={value}
      onChange={setValue}
      maxLength={20}
      previewToggle={previewToggle}
    />
  );
}

describe('RichPreview', () => {
  it('renders the markup as elements and shows HTML as plain text', () => {
    const { container } = render(
      <RichPreview source={'## 안내\n<img src=x onerror=alert(1)>\n\n- 하나\n- 둘\n\n1. 첫째'} />,
    );
    expect(screen.getByRole('heading', { level: 3, name: '안내' })).toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
    expect(container.querySelector('ol li')).toHaveTextContent('1.첫째');
  });

  it('links only safe URLs and opens them in a new tab without referrer', () => {
    render(<RichPreview source="자세히 https://example.com/notice. javascript:alert(1)" />);
    const link = screen.getByRole('link', { name: 'https://example.com/notice' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('shows a hint when there is nothing to preview', () => {
    render(<RichPreview source={'  \n'} emptyText="내용이 없어요" />);
    expect(screen.getByText('내용이 없어요')).toBeInTheDocument();
  });
});

describe('MarkupEditor', () => {
  it('applies and removes a heading from the toolbar', async () => {
    const user = userEvent.setup();
    render(<Editor initial="점검 안내" />);
    const area = screen.getByLabelText('내용');
    // The "H1" glyph is decorative (aria-hidden), so the accessible name is just "제목".
    const button = screen.getByRole('button', { name: '제목' });

    await user.click(area);
    await user.click(button);
    expect(area).toHaveValue('## 점검 안내');
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await user.click(button);
    expect(area).toHaveValue('점검 안내');
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('continues a list with Enter', () => {
    render(<Editor initial="- 하나" />);
    const area = screen.getByLabelText<HTMLTextAreaElement>('내용');
    area.focus();
    area.setSelectionRange(4, 4);
    fireEvent.keyDown(area, { key: 'Enter' });
    expect(area).toHaveValue('- 하나\n- ');
  });

  it('flags text over the limit and switches to the preview', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editor initial={'## 제목\n' + '가'.repeat(20)} previewToggle />);
    expect(container).toHaveTextContent('26 / 20자');
    // Only crossing the limit is announced — not every keystroke.
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('20자를 넘었어요.');

    await user.click(screen.getByRole('radio', { name: '미리보기' }));
    expect(screen.queryByLabelText('내용', { selector: 'textarea' })).toBeNull();
    expect(screen.getByRole('heading', { name: '제목' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /글머리 목록/ })).toBeDisabled();
  });
});

describe('BarList', () => {
  it('shows label, value and share for every row', () => {
    render(
      <BarList
        label="가입 경로"
        unit="명"
        items={[
          { key: 'k', label: '카카오', value: 300 },
          { key: 'n', label: '네이버', value: 100 },
        ]}
      />,
    );
    const rows = within(screen.getByRole('list', { name: '가입 경로' })).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('카카오');
    expect(rows[0]).toHaveTextContent('300명');
    expect(rows[0]).toHaveTextContent('75%');
    expect(rows[1]).toHaveTextContent('25%');
  });
});

function Reorderable() {
  const [items, setItems] = useState(['가', '나', '다']);
  return (
    <ul>
      {items.map((name, index) => (
        <li key={name}>
          {name}
          <OrderButtons
            name={name}
            index={index}
            count={items.length}
            onMove={(delta) => setItems(moveItem(items, index, index + delta))}
          />
        </li>
      ))}
    </ul>
  );
}

describe('OrderButtons', () => {
  it('keeps keyboard focus on the moved item, handing it over at the end of the list', async () => {
    const user = userEvent.setup();
    render(<Reorderable />);
    screen.getByRole('button', { name: '가 아래로 이동' }).focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '가 아래로 이동' }));
    await user.keyboard('{Enter}');
    // 가 is last now: its 아래로 button is disabled, so focus moves to 위로.
    expect(screen.getAllByRole('listitem').map((li) => li.textContent?.charAt(0))).toEqual([
      '나',
      '다',
      '가',
    ]);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '가 위로 이동' }));
  });
});
