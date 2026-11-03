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

interface JsonApiErrorDocument {
  errors?: JsonApiError[]
}

function csrfTokenFromCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined

  const cookie = document.cookie
    .split('; ')
    .find((part) => part.startsWith('XSRF-TOKEN='))

  if (!cookie) return undefined

  const value = cookie.slice('XSRF-TOKEN='.length)
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

async function requestJsonApi<TResponse>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  body?: unknown,
): Promise<TResponse> {
  const headers: Record<string, string> = {
    Accept: JSON_API_MEDIA_TYPE,
  }

  if (body !== undefined) {
    headers['Content-Type'] = JSON_API_MEDIA_TYPE
  }

  if (method === 'PATCH') {
    const csrfToken = csrfTokenFromCookie()
    if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken
  }

  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: 'include',
    })
  } catch {
    throw new Error(
      'Unable to connect. Check your connection and try again.',
    )
  }

  if (!response.ok) {
    const document = (await response.json().catch(() => null)) as
      | JsonApiErrorDocument
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

  if (response.status === 204) return undefined as TResponse

  const responseBody = await response.text()
  if (!responseBody) return undefined as TResponse

  try {
    return JSON.parse(responseBody) as TResponse
  } catch {
    throw new Error('The server returned an unreadable response. Please try again.')
  }
}

export function getJsonApi<TResponse>(path: string): Promise<TResponse> {
  return requestJsonApi<TResponse>(path, 'GET')
}

export function postJsonApi<TResponse = unknown>(
  path: string,
  body?: unknown,
): Promise<TResponse> {
  return requestJsonApi<TResponse>(path, 'POST', body)
}

export function patchJsonApi<TResponse = unknown>(
  path: string,
  body: unknown,
): Promise<TResponse> {
  return requestJsonApi<TResponse>(path, 'PATCH', body)
}
