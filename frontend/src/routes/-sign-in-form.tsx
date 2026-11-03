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
import { signInApplicant } from '../services/auth.api'
import { accountAccessHref, isSafeJourneyPath } from './-return-target'
import styles from './account-access.module.css'

export interface SignInFormProps {
  onNavigate?: (href: string) => void
  returnTo?: string
  onSuccess: (href: string) => void
}

function getLoginError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401) {
      // The API intentionally uses the same response for unknown emails and
      // incorrect passwords. Keep the UI equally non-specific.
      return 'Email or password is incorrect. Check your details and try again.'
    }
    if (cause.status === 429) {
      const seconds = Number(cause.retryAfter)
      return Number.isFinite(seconds) && seconds > 0
        ? `Too many sign-in attempts. Please try again in ${seconds} seconds.`
        : 'Too many sign-in attempts. Please try again later.'
    }
    if (cause.status === 400) {
      const detail = cause.errors
        .map((item) => item.detail)
        .filter((item): item is string => Boolean(item))
        .join(' ')
      return detail || 'Some sign-in details are malformed. Check your email and password.'
    }
    return 'We could not sign you in right now. Please try again.'
  }

  if (cause instanceof Error) {
    // The shared API client provides a safe, user-facing network error.
    if (cause.message.toLowerCase().includes('connect')) {
      return cause.message
    }
  }

  return 'An unexpected error occurred while signing in. Please try again.'
}

export function SignInForm({
  onNavigate,
  returnTo,
  onSuccess,
}: SignInFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [emailError, setEmailError] = useState<string>()
  const [passwordError, setPasswordError] = useState<string>()
  const [isPending, setIsPending] = useState(false)
  const pendingRef = useRef(false)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (emailError) {
      emailInput.current?.focus()
    } else if (passwordError) {
      passwordInput.current?.focus()
    }
  }, [emailError, passwordError])

  async function submit(): Promise<void> {
    if (pendingRef.current) return

    setError(undefined)
    setEmailError(undefined)
    setPasswordError(undefined)

    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setEmailError('Enter your email address.')
      return
    }
    if (!password) {
      setPasswordError('Enter your password.')
      return
    }

    pendingRef.current = true
    setIsPending(true)
    try {
      const session = await signInApplicant(normalizedEmail, password)
      const destination = session?.data?.attributes?.href

      if (
        session?.data?.type !== 'applicant-sessions' ||
        typeof destination !== 'string' ||
        !isSafeJourneyPath(destination)
      ) {
        throw new Error('The sign-in response did not include a valid journey URL.')
      }

      // The API response's href is authoritative; never substitute a local
      // default or an untrusted returnTo query parameter.
      onSuccess(destination)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 400) {
        for (const item of cause.errors) {
          if (item.source?.pointer?.endsWith('/email')) {
            setEmailError(item.detail ?? 'Enter a valid email address.')
          } else if (item.source?.pointer?.endsWith('/password')) {
            setPasswordError(item.detail ?? 'Check your password.')
          }
        }
        const hasMappedFieldError = cause.errors.some((item) =>
          item.source?.pointer?.endsWith('/email') ||
          item.source?.pointer?.endsWith('/password'),
        )
        if (!hasMappedFieldError) {
          setError(getLoginError(cause))
        }
      } else {
        setError(getLoginError(cause))
      }
    } finally {
      pendingRef.current = false
      setIsPending(false)
    }
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <Stack
            component="form"
            className={styles.form}
            aria-busy={isPending}
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
            spacing={3}
          >
            <Stack spacing={1}>
              <Typography component="h1" variant="heading">
                Welcome back
              </Typography>
              <Typography tone="muted">
                Sign in to continue your KYC application.
              </Typography>
            </Stack>
            {error ? (
              <Alert aria-live="assertive" severity="error">
                {error}
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
                setError(undefined)
              }}
              required
              type="email"
              value={email}
              disabled={isPending}
            />
            <TextField
              autoComplete="current-password"
              error={Boolean(passwordError)}
              fullWidth
              helperText={passwordError}
              id="applicant-password"
              inputRef={passwordInput}
              label="Password"
              name="password"
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordError(undefined)
                setError(undefined)
              }}
              required
              type="password"
              value={password}
              disabled={isPending}
            />
            <Button
              className={styles.submit}
              fullWidth
              size="large"
              type="submit"
              isDisabled={isPending}
            >
              {isPending ? 'Signing in…' : 'Sign in'}
            </Button>
            <Typography
              className={styles.footer}
              align="center"
              variant="caption"
            >
              <span>New to KYC? </span>
              <Link
                href={accountAccessHref('/create-account', returnTo)}
                onClick={(event) => {
                  if (onNavigate) {
                    event.preventDefault()
                    onNavigate(accountAccessHref('/create-account', returnTo))
                  }
                }}
              >
                Create account
              </Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}
