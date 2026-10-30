import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CameraError, startCamera, toCameraError } from '../src/services/cameraService';
import { TrackedCamera } from '../src/components/Camera/TrackedCamera';
import { SettingsProvider } from '../src/context/AppProviders';

const domError = (name: string) => Object.assign(new Error(name), { name });

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(impl), enumerateDevices: vi.fn(async () => []) } });
}

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});

describe('camera failure handling', () => {
  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['NotFoundError', 'no-camera'],
    ['OverconstrainedError', 'no-camera'],
    ['NotReadableError', 'in-use'],
    ['WeirdError', 'unknown'],
  ])('maps %s to %s', (name, code) => {
    expect(toCameraError(domError(name)).code).toBe(code);
  });

  it('reports unsupported browsers', async () => {
    await expect(startCamera()).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('converts a permission rejection into a CameraError', async () => {
    mockGetUserMedia(() => Promise.reject(domError('NotAllowedError')));
    const err = await startCamera().catch((e) => e);
    expect(err).toBeInstanceOf(CameraError);
    expect(err.code).toBe('permission-denied');
  });

  it('shows an actionable message in the UI when permission is denied', async () => {
    mockGetUserMedia(() => Promise.reject(domError('NotAllowedError')));
    const createDetector = vi.fn();
    render(
      <SettingsProvider>
        <TrackedCamera createDetector={createDetector} />
      </SettingsProvider>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /start camera/i })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission was denied/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(createDetector).not.toHaveBeenCalled();
  });

  it('shows a no-camera message when no device exists', async () => {
    mockGetUserMedia(() => Promise.reject(domError('NotFoundError')));
    render(
      <SettingsProvider>
        <TrackedCamera createDetector={vi.fn()} />
      </SettingsProvider>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /start camera/i })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent(/no camera was found/i);
  });
});
