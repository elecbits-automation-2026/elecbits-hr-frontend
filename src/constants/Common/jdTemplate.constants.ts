/**
 * The company's fixed JD text, from the "Test Portal JD" template (learner,
 * 2026-10-27): every JD carries it unchanged. Recruiters fill only the
 * role-specific parts (stored per position); this is added when the JD is
 * shown or printed, never stored with it.
 */
export const JD_ABOUT_ELECBITS = [
  'Elecbits is a tech-enabled B2B platform that helps Electronics Enterprises to go from an idea to a shelf-ready, commercial Electronics Product. We cover the end-to-end intricacies involved in the Electronics product development & manufacturing cycle using 25+ micro-services on our platform.',
  'We are proud to have worked with more than 100 eminent enterprises, digitizing their product development and manufacturing lifecycle. Some notable names are Ola Electric, Urban Company, Maruti Suzuki, Bosch, V-Guard, Luminous, PhonePe, Escorts Kubota, Napino, etc. We are the largest B2B Electronics development and manufacturing platform of its kind, having more than 3000 global Electronics manufacturers and suppliers on our platform.',
] as const;

export const JD_WHY_JOIN = [
  { title: 'Work hard, party harder:', text: 'Our mantra balances dedication and celebration.' },
  {
    title: 'No self-imposed limits:',
    text: 'We encourage you to push your boundaries and reach your full potential.',
  },
  {
    title: 'Energized environment:',
    text: "Our company's energy fuels growth and self-improvement.",
  },
  {
    title: 'Good vibes only:',
    text: 'We foster a positive and supportive atmosphere for all.',
  },
] as const;

export const JD_FOOTER = {
  office:
    'Prestige Tech Cloud , Navarathna Agrahara , Devanahalli Taluk, Bengaluru, Karnataka 562110 - India',
  phone: '+91-8569986023 / +91-7317825555',
  email: 'careers@elecbits.in',
} as const;

export const JD_JOB_TYPES = ['Full-time', 'Internship', 'Contract', 'Part-time'] as const;
