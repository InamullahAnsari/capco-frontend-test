import {
  Alert,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  TextField,
  Typography,
} from '@kyc/ui'
import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../services/api-client'
import { registerApplicant } from '../services/auth.api'
import { accountAccessHref } from './-return-target'
import styles from './account-access.module.css'

export interface CreateAccountFormProps {
  onNavigate?: (href: string) => void
  returnTo?: string
}

const passwordGuidance =
  'Use at least six characters, including one uppercase letter and one special character.'

function validatePassword(password: string): string | undefined {
  if (password.length < 6) {
    return 'Password must contain at least six characters.'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.'
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character.'
  }
  return undefined
}

function getRegistrationError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 409) {
      return 'An account already exists for this email address. Please sign in instead.'
    }
    if (cause.status === 429) {
      const seconds = Number(cause.retryAfter)
      return Number.isFinite(seconds) && seconds > 0
        ? `Too many attempts. Please try again in ${seconds} seconds.`
        : 'Too many attempts. Please try again later.'
    }
    if (cause.status === 400) {
      return 'Some registration details are invalid. Please review the highlighted fields.'
    }
    return cause.message || 'We could not create your account. Please try again.'
  }

  if (cause instanceof Error) {
    return cause.message
  }

  return 'An unexpected error occurred. Please try again.'
}

export function CreateAccountForm({
  onNavigate,
  returnTo,
}: CreateAccountFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string>()
  const [emailError, setEmailError] = useState<string>()
  const [passwordError, setPasswordError] = useState<string>()
  const [confirmPasswordError, setConfirmPasswordError] = useState<string>()
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const confirmPasswordInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (emailError) {
      emailInput.current?.focus()
    } else if (passwordError) {
      passwordInput.current?.focus()
    } else if (confirmPasswordError) {
      confirmPasswordInput.current?.focus()
    }
  }, [emailError, passwordError, confirmPasswordError])

  async function submit(): Promise<void> {
    if (isSubmitting) return

    setError(undefined)
    setEmailError(undefined)
    setPasswordError(undefined)
    setConfirmPasswordError(undefined)
    setSuccess(false)

    const normalizedEmail = email.trim()
    let hasValidationError = false

    if (!normalizedEmail) {
      setEmailError('Enter your email address.')
      hasValidationError = true
    } else if (emailInput.current?.validity.typeMismatch) {
      setEmailError('Enter a valid email address.')
      hasValidationError = true
    }

    const passwordValidationError = validatePassword(password)
    if (passwordValidationError) {
      setPasswordError(passwordValidationError)
      hasValidationError = true
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Confirm your password.')
      hasValidationError = true
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.')
      hasValidationError = true
    }

    if (hasValidationError) return

    setIsSubmitting(true)
    try {
      await registerApplicant(normalizedEmail, password)
      setPassword('')
      setConfirmPassword('')
      setSuccess(true)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 400) {
        for (const apiError of cause.errors) {
          const pointer = apiError.source?.pointer
          if (pointer?.endsWith('/email')) {
            setEmailError(apiError.detail ?? 'Enter a valid email address.')
          } else if (pointer?.endsWith('/password')) {
            setPasswordError(apiError.detail ?? passwordGuidance)
          }
        }
      }
      setError(getRegistrationError(cause))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <Stack
            component="form"
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
            spacing={3}
            aria-busy={isSubmitting}
          >
            <Stack spacing={1}>
              <Typography component="h1" variant="heading">
                Create your account
              </Typography>
              <Typography tone="muted">
                Create credentials to begin your KYC application.
              </Typography>
            </Stack>
            {error ? (
              <Alert aria-live="assertive" role="alert" severity="error">
                {error}
              </Alert>
            ) : null}
            {success ? (
              <Alert aria-live="polite" role="status" severity="success">
                Your account has been created. You can now sign in.
              </Alert>
            ) : null}
            <TextField
              autoComplete="email"
              error={Boolean(emailError)}
              fullWidth
              helperText={emailError}
              id="applicant-email"
              inputRef={emailInput}
              label="Email address"
              name="email"
              onChange={(event) => {
                setEmail(event.target.value)
                setEmailError(undefined)
              }}
              required
              type="email"
              value={email}
            />
            <TextField
              autoComplete="new-password"
              error={Boolean(passwordError)}
              fullWidth
              helperText={passwordError ?? passwordGuidance}
              id="applicant-password"
              inputRef={passwordInput}
              label="Password"
              name="password"
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordError(undefined)
              }}
              required
              type="password"
              value={password}
            />
            <TextField
              autoComplete="new-password"
              error={Boolean(confirmPasswordError)}
              fullWidth
              helperText={confirmPasswordError}
              id="applicant-confirm-password"
              inputRef={confirmPasswordInput}
              label="Confirm password"
              name="confirmPassword"
              onChange={(event) => {
                setConfirmPassword(event.target.value)
                setConfirmPasswordError(undefined)
              }}
              required
              type="password"
              value={confirmPassword}
            />
            <Button
              className={styles.submit}
              disabled={isSubmitting}
              fullWidth
              size="large"
              type="submit"
            >
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
            <Typography
              className={styles.footer}
              align="center"
              variant="caption"
            >
              <span>Already have an account? </span>
              <Link
                href={accountAccessHref('/sign-in', returnTo)}
                onClick={(event) => {
                  if (onNavigate) {
                    event.preventDefault()
                    onNavigate(accountAccessHref('/sign-in', returnTo))
                  }
                }}
              >
                Sign in
              </Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}
