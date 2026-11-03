import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@kyc/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import {
  getApplicantApplicationForm,
  updateApplicantApplicationForm,
  type ApplicantStep,
  type FormAnswers,
} from '../../../services/application.api'
import { ApiError } from '../../../services/api-client'
import styles from '../../application-step.module.css'

import type { Route } from './+types/$step'

const personalFields = [
  { name: 'name', label: 'Name', type: 'text' },
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
  { name: 'country', label: 'Country', type: 'text' },
  { name: 'nationality', label: 'Nationality', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
] as const

const identityFields = [
  { name: 'documentType', label: 'Document type', type: 'text' },
  { name: 'documentNumber', label: 'Document number', type: 'text' },
  { name: 'documentCountry', label: 'Document country', type: 'text' },
  { name: 'expiry', label: 'Expiry', type: 'date' },
  { name: 'street', label: 'Street', type: 'text' },
  { name: 'city', label: 'City', type: 'text' },
  { name: 'postal', label: 'Postal code', type: 'text' },
  { name: 'residentialCountry', label: 'Residential country', type: 'text' },
] as const

export default function CurrentApplicationStepPage({ params }: Route.ComponentProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const applicationId = params.applicationId
  const step: ApplicantStep =
    params.step === 'identity-and-address'
      ? 'identity-and-address'
      : 'personal-details'

  const formQuery = useQuery({
    queryKey: ['applicant-application-form', applicationId],
    queryFn: () => getApplicantApplicationForm(applicationId),
    retry: false,
  })

  const [answers, setAnswers] = useState<FormAnswers>({})
  const [errorMessage, setErrorMessage] = useState<string>()
  const [sessionExpired, setSessionExpired] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string>()
  const [savedThisStep, setSavedThisStep] = useState(false)
  const [saving, setSaving] = useState(false)
  const initialized = useRef(false)
  const version = useRef<number | undefined>(undefined)
  const formId = formQuery.data?.data.id

  useEffect(() => {
    if (formQuery.data && !initialized.current) {
      const attributes = formQuery.data.data.attributes
      setAnswers(attributes.answers ?? {})
      version.current = attributes.version
      initialized.current = true
    }
  }, [formQuery.data])

  async function saveCurrentStep(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!formId || saving) return

    setSaving(true)
    setErrorMessage(undefined)
    setSessionExpired(false)
    setSavedMessage(undefined)
    setSavedThisStep(false)

    const stepAnswers: FormAnswers =
      step === 'personal-details'
        ? {
            name: answers.name ?? '',
            dateOfBirth: answers.dateOfBirth ?? '',
            country: answers.country ?? '',
            nationality: answers.nationality ?? '',
            email: answers.email ?? '',
            phone: answers.phone ?? '',
            consentConfirmed: Boolean(answers.consentConfirmed),
          }
        : {
            documentType: answers.documentType ?? '',
            documentNumber: answers.documentNumber ?? '',
            documentCountry: answers.documentCountry ?? '',
            expiry: answers.expiry ?? '',
            street: answers.street ?? '',
            city: answers.city ?? '',
            postal: answers.postal ?? '',
            residentialCountry: answers.residentialCountry ?? '',
          }

    try {
      const updated = await updateApplicantApplicationForm(
        applicationId,
        formId,
        step,
        stepAnswers,
        version.current,
      )
      version.current = updated.data.attributes.version
      queryClient.setQueryData(
        ['applicant-application-form', applicationId],
        updated,
      )
      setSavedMessage('Your answers have been saved successfully.')
      setSavedThisStep(true)
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) {
        setSessionExpired(true)
        setErrorMessage('Your session has expired. Your entries are still on this page. Sign in again to continue.')
      } else if (saveError instanceof ApiError && saveError.status === 409) {
        try {
          const latest = await getApplicantApplicationForm(applicationId)
          version.current = latest.data.attributes.version
          queryClient.setQueryData(
            ['applicant-application-form', applicationId],
            latest,
          )
          setErrorMessage('This application was updated elsewhere. Your entries are still here. Review them and select Save again to apply them to the latest version.')
        } catch {
          setErrorMessage('This application changed elsewhere. Your entries are still here, but we could not refresh its version. Please try again.')
        }
      } else if (saveError instanceof ApiError && saveError.status === 422) {
        setErrorMessage(saveError.message || 'Some answers could not be saved. Check the information and try again.')
      } else {
        setErrorMessage(saveError instanceof Error ? saveError.message : 'Your answers could not be saved. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (formQuery.isPending) {
    return <main aria-busy="true"><Typography component="h1" variant="heading">Loading saved answers…</Typography></main>
  }

  if (formQuery.error || !formQuery.data) {
    const expired = formQuery.error instanceof ApiError && formQuery.error.status === 401
    return (
      <main className={styles.page}>
        <Stack spacing={2}>
          <Typography component="h1" variant="heading">We couldn't load your saved answers</Typography>
          <Alert severity="error">
            {expired ? 'Your session has expired. Sign in again to continue.' : 'The application form could not be loaded. Please try again.'}
          </Alert>
          {expired ? <Link to="/sign-in">Sign in again</Link> : <Button onPress={() => void formQuery.refetch()}>Try again</Button>}
        </Stack>
      </main>
    )
  }

  const fields = step === 'personal-details' ? personalFields : identityFields

  return (
    <main className={styles.page}>
      <Card className={styles.reviewCard}>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography component="p" variant="eyebrow" tone="accent">
                STEP {step === 'personal-details' ? '1' : '2'} OF 2
              </Typography>
              <Typography component="h1" variant="heading">
                {step === 'personal-details' ? 'Personal details' : 'Identity and address'}
              </Typography>
              <Typography tone="muted">Your saved answers are loaded automatically. Save your progress before leaving this step.</Typography>
            </Stack>

            <Stack component="form" className={styles.stepForm} onSubmit={(event) => void saveCurrentStep(event)} spacing={2}>
              {fields.map((field) => (
                <TextField
                  key={field.name}
                  autoComplete="off"
                  fullWidth
                  label={`${field.label} (required)`}
                  name={field.name}
                  onChange={(event) => {
                    setAnswers((previous) => ({ ...previous, [field.name]: event.target.value }))
                    setErrorMessage(undefined)
                    setSessionExpired(false)
                    setSavedMessage(undefined)
                    setSavedThisStep(false)
                  }}
                  required
                  type={field.type}
                  value={String(answers[field.name] ?? '')}
                />
              ))}

              {step === 'personal-details' ? (
                <label>
                  <input
                    checked={Boolean(answers.consentConfirmed)}
                    onChange={(event) => setAnswers((previous) => ({ ...previous, consentConfirmed: event.target.checked }))}
                    required
                    type="checkbox"
                  />{' '}
                  I confirm these details are accurate and belong to me.
                </label>
              ) : (
                <Stack spacing={1}>
                  <label htmlFor="document-evidence">Document evidence</label>
                  <input id="document-evidence" type="file" accept="image/jpeg,image/png" />
                  <Typography variant="caption" tone="muted">Document evidence is uploaded separately from the saved text answers.</Typography>
                </Stack>
              )}

              {errorMessage ? (
                <Alert aria-live="assertive" severity="error">
                  {errorMessage}{' '}
                  {sessionExpired ? <Link to="/sign-in">Sign in again</Link> : null}
                </Alert>
              ) : null}
              {savedMessage ? <Alert aria-live="polite" severity="success">{savedMessage}</Alert> : null}

              <Stack component="div" className={styles.formActions} direction="row" spacing={2}>
                <Button
                  type="button"
                  variant="quiet"
                  disabled={saving}
                  onPress={() => step === 'personal-details'
                    ? void navigate('/applications/current')
                    : void navigate(`/applications/${applicationId}/personal-details`)}
                >Back</Button>
                <Button type="submit" isDisabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                {savedThisStep ? (
                  <Button
                    type="button"
                    onPress={() => step === 'personal-details'
                      ? void navigate(`/applications/${applicationId}/identity-and-address`)
                      : void navigate(`/applications/${applicationId}/review`)}
                  >
                    {step === 'personal-details' ? 'Continue' : 'Review application'}
                  </Button>
                ) : null}
              </Stack>
              <Typography variant="caption" tone="muted" aria-live="polite">
                {saving ? 'Saving your answers…' : 'Your answers are saved to your account only after the server confirms the save.'}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}
