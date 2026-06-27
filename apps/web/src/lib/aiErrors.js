export function getAiErrorMessage(error, action = 'generate that') {
  const status = Number(error?.status || error?.data?.status);

  if (status === 429) {
    return "You've hit today's AI limit. Upgrade or try again tomorrow.";
  }

  if (status === 502 || status === 503 || status === 504) {
    return 'The AI service is busy. Please retry.';
  }

  if (status >= 500) {
    return 'The AI request failed. Please retry in a moment.';
  }

  return `We could not ${action}. Please try again.`;
}
