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
