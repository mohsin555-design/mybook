// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { SettingsPage } from './SettingsPage'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockLogout = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}))

vi.mock('../hooks/useDriveBootstrap', () => ({
  useDriveBootstrap: () => ({ isPreparing: false, statusMessage: null }),
}))

vi.mock('../services/googleDrive', () => ({
  getDriveFolderStatus: vi.fn().mockResolvedValue(null),
  openMyBookFolderInDrive: vi.fn(),
}))

vi.mock('../database/db', () => ({
  db: {
    files: { filter: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })) },
    syncQueue: { toArray: vi.fn().mockResolvedValue([]) },
    open: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../database/repositories', () => ({
  processPendingDriveFolderSync: vi.fn(),
}))

vi.mock('../stores/useAppStore', () => ({
  useAppStore: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}))

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => ({ email: 'user@example.com', logout: mockLogout, reconnect: vi.fn() }),
}))

describe('SettingsPage', () => {
  it('logs out from Preferences and navigates to login without blocked-route state', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /log out/i }))

    await waitFor(() => expect(mockLogout).toHaveBeenCalled())
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true, state: null })
  })
})
