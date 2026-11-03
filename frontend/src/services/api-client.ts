export const JSON_API_MEDIA_TYPE = 'application/vnd.api+json'

export interface JsonApiError {
  code?: string
  detail?: string
  source?: { pointer?: string }
  status?: string
  title?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly errors: JsonApiError[]
  readonly retryAfter: string | null

  constructor(
    message: string,
    status: number,
    errors: JsonApiError[] = [],
    retryAfter: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.retryAfter = retryAfter
  }
}

interface JsonApiDocument {
  errors?: JsonApiError[]
}

export async function postJsonApi<TResponse = unknown>(
  path: string,
  body: unknown,
): Promise<TResponse> {
  let response: Response

  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        Accept: JSON_API_MEDIA_TYPE,
        'Content-Type': JSON_API_MEDIA_TYPE,
      },
      body: JSON.stringify(body),
      credentials: 'include',
    })
  } catch {
    throw new Error(
      'Unable to connect. Check your internet connection and try again.',
    )
  }

  if (!response.ok) {
    const document = (await response.json().catch(() => null)) as
      | JsonApiDocument
      | null
    const errors = Array.isArray(document?.errors) ? document.errors : []
    const firstError = errors[0]
    const message =
      firstError?.detail ??
      firstError?.title ??
      `The request failed with status ${response.status}.`

    throw new ApiError(
      message,
      response.status,
      errors,
      response.headers.get('Retry-After'),
    )
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  // Some successful JSON:API operations, including account creation,
  // intentionally return headers only and have no response document.
  const responseBody = await response.text()
  if (!responseBody) {
    return undefined as TResponse
  }

  return JSON.parse(responseBody) as TResponse
}
