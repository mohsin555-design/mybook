// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppHeader } from './AppHeader'

afterEach(cleanup)

describe('AppHeader', () => {
  it('renders the page identity and optional rows', () => {
    render(
      <AppHeader
        title="Project notes"
        breadcrumbs={[{ label: 'Home' }, { label: 'Project notes' }]}
        status="saved"
        shareAction
        toolbar={<div>Formatting toolbar</div>}
        segmentControl={<div>View controls</div>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Project notes' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'breadcrumb' }).textContent).toContain('Home')
    expect(screen.getByRole('navigation', { name: 'breadcrumb' }).textContent).toContain('Project notes')
    expect(screen.getByText('Formatting toolbar')).toBeTruthy()
    expect(screen.getByText('View controls')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy()
  })

  it.each([
    ['saving', 'Saving…'],
    ['saved', 'Saved'],
  ] as const)('announces the %s state', (saveStatus, label) => {
    render(<AppHeader title="Draft" status={saveStatus} />)
    expect(screen.getByRole('status').textContent).toContain(label)
  })

  it('uses one primary heading when only heading is provided', () => {
    render(<AppHeader heading="Welcome to Writin" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Writin' })).toBeTruthy()
  })

  it('opens a rename popover from the current breadcrumb', () => {
    const onRename = vi.fn()
    render(<AppHeader title="Project notes" breadcrumbs={[{ label: 'Home' }, { label: 'Untitled' }]} onRename={onRename} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rename Untitled' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'File name' }), { target: { value: 'Project brief' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onRename).toHaveBeenCalledWith('Project brief')
  })

  it('shows collapsed breadcrumbs in the More dropdown', () => {
    const openDocuments = vi.fn()
    render(
      <AppHeader
        title="Draft"
        breadcrumbs={[
          { label: 'Home' },
          { label: 'Documents', onPress: openDocuments },
          { label: 'Projects' },
          { label: 'Drafts' },
          { label: 'Untitled' },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'More breadcrumbs' }))
    expect(screen.getByRole('menuitem', { name: 'Drafts' })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Documents' }))

    expect(openDocuments).toHaveBeenCalledOnce()
  })
})
