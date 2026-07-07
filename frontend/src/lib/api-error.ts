import axios from 'axios'

const getDetailMessage = (detail: unknown) => {
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const firstIssue = detail[0]

    if (typeof firstIssue === 'string' && firstIssue.trim()) {
      return firstIssue
    }

    if (
      firstIssue &&
      typeof firstIssue === 'object' &&
      'msg' in firstIssue &&
      typeof firstIssue.msg === 'string' &&
      firstIssue.msg.trim()
    ) {
      return firstIssue.msg
    }
  }

  return ''
}

export const getApiErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
) => {
  if (axios.isAxiosError(error)) {
    const detailMessage = getDetailMessage(error.response?.data?.detail)
    if (detailMessage) {
      return detailMessage
    }

    const message =
      error.response?.data &&
      typeof error.response.data === 'object' &&
      'message' in error.response.data &&
      typeof error.response.data.message === 'string'
        ? error.response.data.message
        : ''

    if (message.trim()) {
      return message
    }

    if (!error.response) {
      return 'Unable to reach the server. Please check your connection and try again.'
    }

    if (error.response.status >= 500) {
      return 'Server error. Please try again in a moment.'
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
