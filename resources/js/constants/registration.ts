import { Trophy, Users, User, FileText, CreditCard } from 'lucide-react'

const BASE_REGISTRATION_STEPS = [
  {
    id: 'competition',
    name: 'Competition',
    icon: Trophy,
  },
  {
    id: 'team',
    name: 'Team',
    icon: Users,
  },
  {
    id: 'biodata',
    name: 'Biodata',
    icon: User,
  },
  {
    id: 'documents',
    name: 'Documents',
    icon: FileText,
  },
] as const

const PAYMENT_STEP = {
  id: 'payment',
  name: 'Payment',
  icon: CreditCard,
} as const

export const getRegistrationSteps = (_isOlympiad?: boolean) => [...BASE_REGISTRATION_STEPS, PAYMENT_STEP] as const
