import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

describe('LeliBramBas+ Library Manager', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = '#/dashboard';
  });

  it('renders the deterministic archive dashboard', () => {
    render(<App />);

    expect(document.querySelector('.brand-lockup strong')).toHaveTextContent('LeliBramBas+');
    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Good morning, Bram.' })).toBeInTheDocument();
    expect(screen.getByText('32', { selector: '.hero-metric strong' })).toBeInTheDocument();
    expect(
      screen.getByText('The United States of America (2014) viewing copy'),
    ).toBeInTheDocument();
  });

  it('navigates to the DVD title review and exposes safe candidate choices', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /VIDEO_TS review/i }));

    const dvdView = await screen.findByTestId('video-ts-view');
    expect(within(dvdView).getByText('Three playable candidates found')).toBeInTheDocument();
    expect(
      within(dvdView).getByLabelText(/Keep Eline Maria Peters \(Part 1\) - main title/i),
    ).toBeChecked();
    expect(within(dvdView).getByLabelText(/Keep Synthetic menu loop/i)).toBeDisabled();
    expect(
      within(dvdView).getByText(/Original IFO, BUP and VOB files are never/i),
    ).toBeInTheDocument();
  });

  it('edits and persists catalogue metadata locally', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Catalogue' }));
    await user.click(
      await screen.findByRole('button', { name: 'Edit Eline Maria Peters (Part 1)' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Eline Maria Peters (Part 1)' });
    const titleField = within(dialog).getByLabelText('Title');
    await user.clear(titleField);
    await user.type(titleField, 'Eline Maria Peters (Part 1) - Restored');
    await user.click(within(dialog).getByRole('button', { name: /Save metadata/i }));

    expect(await screen.findByText('Eline Maria Peters (Part 1) - Restored')).toBeInTheDocument();
    expect(window.localStorage.length).toBeGreaterThan(0);
  });

  it('opens the local import workflow with file, folder, OneDrive and VIDEO_TS choices', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^Import$/i }));
    const dialog = screen.getByRole('dialog', { name: 'Bring memories into the archive' });

    expect(within(dialog).getByRole('button', { name: /Choose videos/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Import a folder/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /OneDrive folder/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /VIDEO_TS folder/i })).toBeInTheDocument();
    expect(within(dialog).getByText(/Nothing is uploaded or changed/i)).toBeInTheDocument();
  });

  it('supports a keyboard-first global catalogue search', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard('/');
    const search = screen.getByLabelText('Search library');
    expect(search).toHaveFocus();
    await user.type(search, 'Eline Maria Peters{Enter}');

    expect(await screen.findByTestId('catalogue-view')).toBeInTheDocument();
    expect(screen.getByText('Eline Maria Peters (Part 1)')).toBeInTheDocument();
  });
});
