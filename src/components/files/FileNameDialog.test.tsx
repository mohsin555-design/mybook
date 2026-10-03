// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { FileNameDialog } from './FileNameDialog'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false
  })
})

afterEach(() => {
  cleanup()
})

describe('FileNameDialog', () => {
  it('shows duplicate file name validation before submit', () => {
    render(
      <FileNameDialog
        isOpen
        fileName="Document 1"
        existingFileNames={['Meeting Notes', 'Quarterly Report']}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('File name'), { target: { value: ' meeting notes ' } })

    expect(screen.getByRole('alert')).toHaveTextContent('"Meeting Notes" already exists. Use a different name.')
    expect(screen.getByLabelText('File name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('allows keeping the same file name without showing duplicate error', () => {
    render(
      <FileNameDialog
        isOpen
        fileName="Meeting Notes"
        existingFileNames={['Meeting Notes', 'Quarterly Report']}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('File name')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('blocks submit when duplicate file name is entered', async () => {
    const onSubmit = vi.fn()
    render(
      <FileNameDialog
        isOpen
        fileName="Document 1"
        existingFileNames={['Meeting Notes']}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('File name'), { target: { value: 'Meeting Notes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('"Meeting Notes" already exists. Use a different name.')
  })
})
