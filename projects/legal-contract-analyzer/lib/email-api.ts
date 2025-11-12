// API utility for email actions
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface EmailActionRequest {
  recipients: string[];
  subject: string;
  body: string;
  datetime?: string; // ISO string for schedule
}

export interface EmailActionResponse {
  status: string;
  message: string;
  recipients: string[];
  subject: string;
  scheduled_datetime?: string;
}

export async function sendEmail(request: EmailActionRequest): Promise<EmailActionResponse> {
  const response = await fetch(`${API_BASE}/actions/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to send email');
  }

  return response.json();
}

export async function scheduleEmail(request: EmailActionRequest): Promise<EmailActionResponse> {
  const response = await fetch(`${API_BASE}/actions/email/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to schedule email');
  }

  return response.json();
}