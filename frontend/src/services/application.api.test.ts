import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getOrCreateCurrentApplication,
  updateApplicantApplicationForm,
} from './application.api'

const application = {
  data: {
    type: 'applicant-applications' as const,
    id: 'application-123',
    attributes: {
      status: 'draft' as const,
      currentStep: 'personal-details' as const,
      href: '/applications/application-123/personal-details',
      progress: [],
    },
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('applicant application API', () => {
  it('creates a draft when the current-application endpoint returns 204', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(application), {
        status: 201,
        headers: { 'Content-Type': 'application/vnd.api+json' },
      }))

    const result = await getOrCreateCurrentApplication()

    expect(result).toEqual(application)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/applicant-applications',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('sends only the active step answers and the latest version', async () => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      value: 'XSRF-TOKEN=csrf-value',
    })
    const response = {
      data: {
        type: 'applicant-application-forms',
        id: 'form-123',
        attributes: { status: 'draft', currentStep: 'personal-details', steps: [], answers: { name: 'A User' }, documentEvidence: false, version: 4 },
      },
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.api+json' },
      }),
    )

    await updateApplicantApplicationForm(
      'application-123',
      'form-123',
      'personal-details',
      { name: 'A User', consentConfirmed: true },
      3,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/applicant-applications/application-123/form',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/vnd.api+json',
          'X-XSRF-TOKEN': 'csrf-value',
        }),
      }),
    )
    const request = fetchMock.mock.calls[0]?.[1]
    expect(JSON.parse(String(request?.body))).toEqual({
      data: {
        type: 'applicant-application-forms',
        id: 'form-123',
        attributes: {
          step: 'personal-details',
          answers: { name: 'A User', consentConfirmed: true },
          version: 3,
        },
      },
    })
  })
})
