import type { AdStatus } from './ads';
import { apiRequest } from './client';

export type ComplaintReason =
  'SPAM' | 'FRAUD' | 'PROHIBITED' | 'OFFENSIVE' | 'OTHER';
export type ComplaintDecision = 'ACCEPTED' | 'DISMISSED';

// Порядок ключей — порядок вариантов в форме жалобы
export const complaintReasons: Record<ComplaintReason, string> = {
  SPAM: 'Спам или реклама',
  FRAUD: 'Мошенничество',
  PROHIBITED: 'Запрещённый товар',
  OFFENSIVE: 'Оскорбления',
  OTHER: 'Другое',
};

// Жалуются либо на объявление, либо на пользователя
export type ComplaintTarget = { adId: number } | { userId: number };

export interface Complaint {
  id: number;
  reason: ComplaintReason;
  comment: string | null;
  createdAt: string;
  reporter: { id: number; name: string };
  ad: {
    id: number;
    title: string;
    status: AdStatus;
    author: { id: number; name: string };
  } | null;
  user: { id: number; name: string } | null;
}

export const complaintsApi = {
  create: (
    target: ComplaintTarget,
    reason: ComplaintReason,
    comment: string,
    token: string,
  ) =>
    apiRequest<Complaint>('/complaints', {
      method: 'POST',
      body: { ...target, reason, comment },
      token,
    }),
  list: (token: string) => apiRequest<Complaint[]>('/complaints', { token }),
  resolve: (id: number, status: ComplaintDecision, token: string) =>
    apiRequest<void>(`/complaints/${id}`, {
      method: 'PATCH',
      body: { status },
      token,
    }),
};
