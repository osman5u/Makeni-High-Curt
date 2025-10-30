export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
  PROFILE: '/profile',
  DASHBOARD: {
    ADMIN: '/dashboard/admin',
    CLIENT: '/dashboard/client',
    LAWYER: '/dashboard/lawyer',
  },
  CASES: '/cases',
  DOCUMENTS: '/documents',
  CHAT: '/chat',
  NOTIFICATIONS: '/notifications',
} as const;

export const USER_ROLES = {
  CLIENT: 'client',
  LAWYER: 'lawyer',
  ADMIN: 'admin',
} as const;

export const CASE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const MESSAGE_TYPES = {
  TEXT: 'text',
  FILE: 'file',
  IMAGE: 'image',
} as const;

export const NOTIFICATION_TYPES = {
  CASE_CREATED: 'case_created',
  CASE_APPROVED: 'case_approved',
  CASE_REJECTED: 'case_rejected',
  DOCUMENT_UPLOADED: 'document_uploaded',
  MESSAGE_RECEIVED: 'message_received',
} as const;
