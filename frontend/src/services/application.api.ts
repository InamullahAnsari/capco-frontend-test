import { getJsonApi, patchJsonApi, postJsonApi } from './api-client'

export type ApplicantStep = 'personal-details' | 'identity-and-address'

export interface ApplicantApplication {
  data: {
    type: 'applicant-applications'
    id: string
    attributes: {
      status: 'draft'
      currentStep: ApplicantStep
      href: string
      progress: Array<{
        step: ApplicantStep
        state: 'not-started' | 'current' | 'complete'
      }>
    }
  }
}

export interface FormAnswers {
  name?: string
  dateOfBirth?: string
  country?: string
  nationality?: string
  email?: string
  phone?: string
  consentConfirmed?: boolean
  documentType?: string
  documentNumber?: string
  documentCountry?: string
  expiry?: string
  street?: string
  city?: string
  postal?: string
  residentialCountry?: string
}

export interface ApplicantFormDocument {
  data: {
    type: 'applicant-application-forms'
    id: string
    attributes: {
      status: 'draft'
      currentStep: ApplicantStep
      steps: Array<{
        step: ApplicantStep
        state: 'not-started' | 'current' | 'complete'
      }>
      answers: FormAnswers
      documentEvidence: { present: boolean }
      version?: number
    }
  }
}

export interface FormUpdateDocument {
  data: {
    type: 'applicant-application-forms'
    id: string
    attributes: {
      step: ApplicantStep
      answers: FormAnswers
      version?: number
    }
  }
}

export async function getOrCreateCurrentApplication(): Promise<ApplicantApplication> {
  const current = await getJsonApi<ApplicantApplication | undefined>(
    '/api/v1/applicant-applications/current',
  )

  if (current) return current

  // The API intentionally accepts no request body for this operation.
  return postJsonApi<ApplicantApplication>('/api/v1/applicant-applications')
}

export function getApplicantApplicationForm(
  applicationId: string,
): Promise<ApplicantFormDocument> {
  return getJsonApi<ApplicantFormDocument>(
    `/api/v1/applicant-applications/${encodeURIComponent(applicationId)}/form`,
  )
}

export function updateApplicantApplicationForm(
  applicationId: string,
  formId: string,
  step: ApplicantStep,
  answers: FormAnswers,
  version?: number,
): Promise<ApplicantFormDocument> {
  const document: FormUpdateDocument = {
    data: {
      type: 'applicant-application-forms',
      id: formId,
      attributes: {
        step,
        answers,
        ...(version === undefined ? {} : { version }),
      },
    },
  }

  return patchJsonApi<ApplicantFormDocument>(
    `/api/v1/applicant-applications/${encodeURIComponent(applicationId)}/form`,
    document,
  )
}
