// Static demo dataset. All EUR figures; AUD conversion done in CurrencyContext.

export const accounts = [
  {
    id: 'livret',
    name: 'Livret A / LDDS',
    category: 'Sécurité',
    institution: 'Banque Populaire',
    balance: 40000,
    risk: 1,
    apy: 3.0,
    change24h: 3.29,
    icon: 'shield',
  },
  {
    id: 'av',
    name: 'Assurance Vie',
    category: 'Investissement',
    institution: 'Linxea Spirit 2',
    balance: 9600,
    risk: 4,
    apy: 6.4,
    change24h: 18.42,
    icon: 'trending',
  },
  {
    id: 'ps',
    name: 'Parts Sociales',
    category: 'Bloqué',
    institution: 'Crédit Mutuel',
    balance: 11400,
    risk: 2,
    apy: 2.1,
    change24h: 0,
    icon: 'lock',
  },
]

export const totalCapitalSeries = [
  { month: 'May 25', value: 52400 },
  { month: 'Jun 25', value: 54100 },
  { month: 'Jul 25', value: 55800 },
  { month: 'Aug 25', value: 57200 },
  { month: 'Sep 25', value: 59100 },
  { month: 'Oct 25', value: 60800 },
  { month: 'Nov 25', value: 62500 },
  { month: 'Dec 25', value: 64100 },
  { month: 'Jan 26', value: 65900 },
  { month: 'Feb 26', value: 67400 },
  { month: 'Mar 26', value: 68900 },
  { month: 'Apr 26', value: 70000 },
]

export const allocation = [
  { name: 'Sécurité', value: 40000, color: '#2D7FF9' },
  { name: 'Investissement', value: 18600, color: '#22C55E' },
  { name: 'Bloqué', value: 11400, color: '#F59E0B' },
]

export const australia = {
  loanGoal: 35000,
  loanRaised: 12400,
  departureDate: '2026-09-01',
  monthlyBurn: 2150,
  monthlyIncome: 1400,
  settlement: [
    { name: 'Visa sous-classe 500', cost: 1600, paid: 1600 },
    { name: 'Vols (Paris → Sydney)', cost: 1200, paid: 800 },
    { name: 'Couverture santé OSHC', cost: 950, paid: 0 },
    { name: 'Acompte école (T1)', cost: 6800, paid: 2400 },
    { name: 'Premier mois de loyer + dépôt de garantie', cost: 3200, paid: 0 },
  ],
}
