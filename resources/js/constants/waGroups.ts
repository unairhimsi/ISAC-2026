import type { CompetitionType } from '@/features/registrations/types/registrationTypes'

export const WA_GROUPS: Record<CompetitionType, string> = {
  OLIMPIADE: 'https://chat.whatsapp.com/JCbDTzi7i7NIAo8Ox6rS5j?s=sw&p=a&mlu=4',
  BUSINESS_PLAN: 'https://chat.whatsapp.com/KgLRrBbkpFnIVVYgELrFO1?s=sw&p=a&mlu=4',
  BUSINESS_IT_CASE: 'https://chat.whatsapp.com/BgosLzwfNjEBj8avuvzmhr?s=sw&p=a&mlu=4',
}

export const WA_GROUP_LABELS: Record<CompetitionType, string> = {
  OLIMPIADE: 'IS Olympiad',
  BUSINESS_PLAN: 'Business Plan Competition',
  BUSINESS_IT_CASE: 'Business IT Case Competition',
}
