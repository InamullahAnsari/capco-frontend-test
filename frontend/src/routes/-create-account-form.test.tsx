import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { server } from '../test/server'
import { CreateAccountForm } from './-create-account-form'

const validEmail = 'applicant@example.com'
const validPassword = 'Secure@123'

function fillRegistrationForm() {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: validEmail },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: validPassword },
  })
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: validPassword },
  })
}

describe('CreateAccountForm', () => {
  it('validates password confirmation before making a request', async () => {
    render(<CreateAccountForm />)
    fillRegistrationForm()
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'Different@123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('submits the JSON:API registration document and confirms success', async () => {
    const requestSpy = vi.fn()
    server.use(
      http.post('/api/v1/applicant-accounts', async ({ request }) => {
        requestSpy({
          contentType: request.headers.get('Content-Type'),
          body: await request.json(),
        })
        return new HttpResponse(null, { status: 201 })
      }),
    )

    render(<CreateAccountForm />)
    fillRegistrationForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      await screen.findByText('Your account has been created. You can now sign in.'),
    ).toBeInTheDocument()
    expect(requestSpy).toHaveBeenCalledWith({
      contentType: 'application/vnd.api+json',
      body: {
        data: {
          type: 'applicant-accounts',
          attributes: { email: validEmail, password: validPassword },
        },
      },
    })
  })

  it('shows a useful message when the email is already registered', async () => {
    server.use(
      http.post('/api/v1/applicant-accounts', () =>
        HttpResponse.json(
          {
            errors: [
              {
                status: '409',
                code: 'email-already-registered',
                title: 'Account conflict',
                detail: 'An account already exists for this email address.',
              },
            ],
          },
          { status: 409, headers: { 'Content-Type': 'application/vnd.api+json' } },
        ),
      ),
    )

    render(<CreateAccountForm />)
    fillRegistrationForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'An account already exists for this email address.',
      )
    })
  })
})
