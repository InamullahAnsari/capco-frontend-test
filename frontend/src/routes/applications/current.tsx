import { Alert, Button, Stack, Typography } from '@kyc/ui'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'

import {
  getApplicantApplicationForm,
  getOrCreateCurrentApplication,
} from '../../services/application.api'
import { ApiError } from '../../services/api-client'
import {
  ApplicantJourneyPresentation,
  type ApplicantJourneyEntryState,
  type ApplicantJourneyProgressItem,
} from './-applicant-journey-presentation'

export default function CurrentApplicationJourneyPage() {
  const navigate = useNavigate()
  const applicationQuery = useQuery({
    queryKey: ['applicant-current-application'],
    queryFn: getOrCreateCurrentApplication,
    retry: false,
  })

  const applicationId = applicationQuery.data?.data.id
  const formQuery = useQuery({
    queryKey: ['applicant-application-form', applicationId],
    queryFn: () => getApplicantApplicationForm(applicationId!),
    enabled: Boolean(applicationId),
    retry: false,
  })

  if (applicationQuery.isPending || (applicationId && formQuery.isPending)) {
    return (
      <main aria-busy="true" aria-live="polite">
        <Typography component="h1" variant="heading">Loading your application…</Typography>
      </main>
    )
  }

  const error = applicationQuery.error ?? formQuery.error
  if (error || !applicationQuery.data || !formQuery.data) {
    const expired = error instanceof ApiError && error.status === 401
    return (
      <main>
        <Stack spacing={2}>
          <Typography component="h1" variant="heading">
            We couldn't load your application
          </Typography>
          <Alert severity="error">
            {expired
              ? 'Your session has expired. Sign in again to access your saved application.'
              : 'Your application could not be loaded. Your saved answers have not been changed. Please try again.'}
          </Alert>
          {expired ? (
            <Link to="/sign-in">Sign in again</Link>
          ) : (
            <Button onPress={() => {
              void applicationQuery.refetch()
              if (applicationId) void formQuery.refetch()
            }}>Try again</Button>
          )}
        </Stack>
      </main>
    )
  }

  const application = applicationQuery.data.data
  const form = formQuery.data.data
  const progress: ApplicantJourneyProgressItem[] = application.attributes.progress.map(
    ({ step, state }) => ({
      step,
      state: state === 'complete' ? 'complete' : state === 'current' ? 'current' : 'remaining',
    }),
  )
  const hasSavedAnswers = Object.keys(form.attributes.answers ?? {}).length > 0
  const entryState: ApplicantJourneyEntryState =
    hasSavedAnswers || progress.some((item) => item.state === 'complete')
      ? 'resume'
      : 'start'

  return (
    <ApplicantJourneyPresentation
      entryState={entryState}
      progress={progress}
      onPrimaryAction={() => {
        void navigate(`/applications/${application.id}/${form.attributes.currentStep}`)
      }}
    />
  )
}
