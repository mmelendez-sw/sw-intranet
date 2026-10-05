import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  BirthdayCoverageNotice,
  BirthdayImportPanel,
  BirthdayStatusBadge,
} from './BirthdayEditorParts';
import type { BirthdayPerson } from '../services/contentService';
import type { GraphUser } from '../services/directoryService';

const u = (id: string, displayName: string, extra: Partial<GraphUser> = {}): GraphUser => ({
  id,
  displayName,
  jobTitle: 'Analyst',
  department: null,
  mail: null,
  ...extra,
});
const p = (name: string, extra: Partial<BirthdayPerson> = {}): BirthdayPerson => ({
  id: `p-${name}`,
  name,
  month: 1,
  day: 1,
  ...extra,
});

const NOTIFY_EMAIL = 'mmelendez@symphonyinfra.com';

afterEach(cleanup);

describe('<BirthdayCoverageNotice />', () => {
  const users = [u('1', 'Amy Alpha'), u('2', 'Bob Bravo')];

  it('renders nothing for users not on the notify allowlist', () => {
    const { container } = render(
      <BirthdayCoverageNotice email="someone@symphonyinfra.com" people={[]} users={users} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing while the directory is loading or unavailable', () => {
    const a = render(<BirthdayCoverageNotice email={NOTIFY_EMAIL} people={[]} users={undefined} />);
    expect(a.container.innerHTML).toBe('');
    const b = render(<BirthdayCoverageNotice email={NOTIFY_EMAIL} people={[]} users={null} />);
    expect(b.container.innerHTML).toBe('');
  });

  it('renders nothing when there are no gaps', () => {
    const { container } = render(
      <BirthdayCoverageNotice email={NOTIFY_EMAIL} people={[p('Amy Alpha'), p('Bob Bravo')]} users={users} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('lists a single missing employee and plural unmatched birthdays', () => {
    render(
      <BirthdayCoverageNotice
        email="MMelendez@symphonywireless.com"
        people={[p('Amy Alpha'), p('Ghost One'), p('Ghost Two')]}
        users={users}
      />
    );
    expect(screen.getByText('Birthday list needs an update')).toBeTruthy();
    expect(screen.getByText('1 person is in the directory with no birthday saved:')).toBeTruthy();
    expect(screen.getByText('Bob Bravo')).toBeTruthy();
    expect(screen.getByText('2 birthdays do not match anyone in the directory:')).toBeTruthy();
    expect(screen.getByText('Ghost One')).toBeTruthy();
  });

  it('uses plural/singular wording for the other cases', () => {
    render(
      <BirthdayCoverageNotice email={NOTIFY_EMAIL} people={[p('Ghost One')]} users={users} />
    );
    expect(screen.getByText('2 people are in the directory with no birthday saved:')).toBeTruthy();
    expect(screen.getByText('1 birthday does not match anyone in the directory:')).toBeTruthy();
  });
});

describe('<BirthdayStatusBadge />', () => {
  const users = [u('1', 'Amy Alpha'), u('2', 'Carl Contract', { jobTitle: 'Contractor' })];

  it.each([
    [undefined, 'Amy Alpha', 'Checking directory…'],
    [null, 'Amy Alpha', 'Directory unavailable — shown'],
    [users, 'Amy Alpha', '✓ In directory'],
    [users, 'Carl Contract', 'Contractor/consultant — hidden'],
    [users, 'Ghost Person', 'Not in directory — hidden'],
  ] as const)('users=%s name=%s → %s', (list, name, text) => {
    render(<BirthdayStatusBadge person={p(name)} users={list as GraphUser[] | null | undefined} />);
    expect(screen.getByText(text)).toBeTruthy();
  });
});

describe('<BirthdayImportPanel />', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: /Import from spreadsheet/ }));
  const paste = (text: string) =>
    fireEvent.change(screen.getByLabelText('Paste rows from Excel'), { target: { value: text } });

  it('starts collapsed and honours disabled', () => {
    render(<BirthdayImportPanel people={[]} users={[]} disabled onImport={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /Import from spreadsheet/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('disables Import until text is entered and can be closed', () => {
    render(<BirthdayImportPanel people={[]} users={[]} disabled={false} onImport={vi.fn()} />);
    open();
    const importBtn = screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement;
    expect(importBtn.disabled).toBe(true);
    paste('1/2\tA,B');
    expect(importBtn.disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: /Import from spreadsheet/ })).toBeTruthy();
  });

  it('reports when no rows are found', () => {
    const onImport = vi.fn();
    render(<BirthdayImportPanel people={[]} users={[]} disabled={false} onImport={onImport} />);
    open();
    paste('garbage');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/^No rows found/);
  });

  it('imports rows, matches the directory and summarizes', () => {
    const onImport = vi.fn();
    const users = [u('1', 'Amy Alpha', { mail: 'amy@x.com' })];
    render(<BirthdayImportPanel people={[]} users={users} disabled={false} onImport={onImport} />);
    open();
    paste('3/4\tAlpha,Amy\n5/6\tGhost,Gary\nbad line');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(onImport).toHaveBeenCalledTimes(1);
    const imported: BirthdayPerson[] = onImport.mock.calls[0][0];
    expect(imported.map((x) => [x.name, x.month, x.day, x.email])).toEqual([
      ['Amy Alpha', 3, 4, 'amy@x.com'],
      ['Gary Ghost', 5, 6, undefined],
    ]);
    expect(screen.getByRole('status').textContent).toBe(
      'Imported 2 rows. 1 not found in the directory (kept, but hidden): Gary Ghost. 1 line skipped. Review below, then Save.'
    );
    expect((screen.getByLabelText('Paste rows from Excel') as HTMLTextAreaElement).value).toBe('');
  });

  it('notes when the directory is unavailable', () => {
    const onImport = vi.fn();
    render(<BirthdayImportPanel people={[]} users={null} disabled={false} onImport={onImport} />);
    open();
    paste('3/4\tAlpha,Amy');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByRole('status').textContent).toBe(
      'Imported 1 row. Directory unavailable — names were not matched. Review below, then Save.'
    );
  });
});
