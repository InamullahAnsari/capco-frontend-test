import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../services/api-client'
import { signInApplicant } from '../services/auth.api'
import { SignInForm } from './-sign-in-form'

vi.mock('../services/auth.api', () => ({
  signInApplicant: vi.fn(),
}))

const signInMock = vi.mocked(signInApplicant)

function renderSignIn() {
  const onSuccess = vi.fn()
  const onNavigate = vi.fn()
  return {
    onSuccess,
    onNavigate,
    ...render(
      <SignInForm onSuccess={onSuccess} onNavigate={onNavigate} />,
    ),
  }
}

describe('SignInForm', () => {
  it('requires email and password before sending a request', async () => {
    const user = userEvent.setup()
    renderSignIn()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('submits credentials and navigates to the journey href returned by the API', async () => {
    const user = userEvent.setup()
    const { onSuccess } = renderSignIn()
    signInMock.mockResolvedValueOnce({
      data: {
        type: 'applicant-sessions',
        id: 'session-id',
        attributes: { href: '/applications/current' },
      },
    })

    await user.type(screen.getByLabelText('Email address'), 'applicant@example.com')
    await user.type(screen.getByLabelText('Password'), 'Secure@123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signInMock).toHaveBeenCalledWith('applicant@example.com', 'Secure@123')
    expect(onSuccess).toHaveBeenCalledWith('/applications/current')
  })

  it('shows a generic invalid-credentials message without exposing account existence', async () => {
    const user = userEvent.setup()
    renderSignIn()
    signInMock.mockRejectedValueOnce(
      new ApiError('Invalid email or password', 401),
    )

    await user.type(screen.getByLabelText('Email address'), 'unknown@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Email or password is incorrect.')
    expect(screen.getByLabelText('Email address')).toHaveValue('unknown@example.com')
    expect(screen.queryByText(/email address is not registered/i)).not.toBeInTheDocument()
  })

  it('shows rate-limit feedback using Retry-After when available', async () => {
    const user = userEvent.setup()
    renderSignIn()
    signInMock.mockRejectedValueOnce(
      new ApiError('Too many attempts', 429, [], '30'),
    )

    await user.type(screen.getByLabelText('Email address'), 'applicant@example.com')
    await user.type(screen.getByLabelText('Password'), 'Secure@123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please try again in 30 seconds.',
    )
  })

  it('disables the submit button while the request is pending', async () => {
    const user = userEvent.setup()
    renderSignIn()
    let resolveRequest!: (value: {
      data: {
        type: 'applicant-sessions'
        id: string
        attributes: { href: string }
      }
    }) => void
    signInMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )

    await user.type(screen.getByLabelText('Email address'), 'applicant@example.com')
    await user.type(screen.getByLabelText('Password'), 'Secure@123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true')

    resolveRequest({
      data: {
        type: 'applicant-sessions',
        id: 'session-id',
        attributes: { href: '/applications/current' },
      },
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    })
  })


  it('shows API field validation errors beside the relevant fields', async () => {
    const user = userEvent.setup()
    renderSignIn()
    signInMock.mockRejectedValueOnce(
      new ApiError('Invalid attributes', 400, [
        {
          detail: 'Enter a valid email address.',
          source: { pointer: '/data/attributes/email' },
        },
        {
          detail: 'Password is required.',
          source: { pointer: '/data/attributes/password' },
        },
      ]),
    )

    await user.type(screen.getByLabelText('Email address'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'x')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toHaveValue('not-an-email')
  })

  it('shows a useful network error and preserves the entered email', async () => {
    const user = userEvent.setup()
    renderSignIn()
    signInMock.mockRejectedValueOnce(
      new Error('Unable to connect. Check your internet connection and try again.'),
    )

    await user.type(screen.getByLabelText('Email address'), 'applicant@example.com')
    await user.type(screen.getByLabelText('Password'), 'Secure@123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your internet connection and try again.',
    )
    expect(screen.getByLabelText('Email address')).toHaveValue('applicant@example.com')
  })

  it('rejects an unsafe journey URL returned by the API', async () => {
    const user = userEvent.setup()
    const { onSuccess } = renderSignIn()
    signInMock.mockResolvedValueOnce({
      data: {
        type: 'applicant-sessions',
        id: 'session-id',
        attributes: { href: 'https://example.com/steal-session' },
      },
    })

    await user.type(screen.getByLabelText('Email address'), 'applicant@example.com')
    await user.type(screen.getByLabelText('Password'), 'Secure@123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'valid journey URL',
    )
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
