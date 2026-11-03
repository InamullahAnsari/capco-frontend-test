import { postJsonApi } from './api-client'

interface ApplicantAccountCreateDocument {
  data: {
    type: 'applicant-accounts'
    attributes: {
      email: string
      password: string
    }
  }
}

export async function registerApplicant(
  email: string,
  password: string,
): Promise<void> {
  const document: ApplicantAccountCreateDocument = {
    data: {
      type: 'applicant-accounts',
      attributes: { email, password },
    },
  }

  await postJsonApi('/api/v1/applicant-accounts', document)
}

export interface ApplicantSessionDocument {
  data: {
    type: 'applicant-sessions'
    id: string
    attributes: {
      href: string
    }
  }
}

interface ApplicantSessionCreateDocument {
  data: {
    type: 'applicant-sessions'
    attributes: {
      email: string
      password: string
    }
  }
}

/** Authenticates an Applicant. The API sets the session and XSRF cookies. */
export async function signInApplicant(
  email: string,
  password: string,
): Promise<ApplicantSessionDocument> {
  const document: ApplicantSessionCreateDocument = {
    data: {
      type: 'applicant-sessions',
      attributes: { email, password },
    },
  }

  return postJsonApi<ApplicantSessionDocument>(
    '/api/v1/applicant-sessions',
    document,
  )
}
