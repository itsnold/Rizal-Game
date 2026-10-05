import { COLORS, type Question } from './model';

// Rehearsal-only sample data. Real answer keys are read from the host-private database.
export const demoQuestions: Question[] = [
  { id: 'birthplace', section: '01 · Early life', prompt: 'In which town was José Rizal born?', choices: ['Calamba', 'Dapitan', 'Manila', 'Vigan'], correctIndex: 0, explanation: 'José Rizal was born in Calamba, Laguna, on June 19, 1861.' },
  { id: 'first-novel', section: '02 · The novels', prompt: 'Which novel did José Rizal publish first?', choices: ['El Filibusterismo', 'Noli Me Tangere', 'Florante at Laura', 'La Solidaridad'], correctIndex: 1, explanation: 'Noli Me Tangere was published in 1887. El Filibusterismo followed in 1891.' },
  { id: 'exile', section: '03 · Exile', prompt: 'Where was Rizal exiled from 1892 to 1896?', choices: ['Cebu', 'Bohol', 'Dapitan', 'Iloilo'], correctIndex: 2, explanation: 'Rizal spent his exile in Dapitan, where he practiced medicine, taught, and worked on community projects.' },
  { id: 'profession', section: '04 · A life of learning', prompt: 'What medical specialty did Rizal study?', choices: ['Cardiology', 'Dermatology', 'Pediatrics', 'Ophthalmology'], correctIndex: 3, explanation: 'Rizal specialized in ophthalmology, motivated in part by his mother’s failing eyesight.' },
];

export function demoSeed() {
  const groups = Object.fromEntries(['La Liga', 'Ilustrados', 'Propagandistas', 'Los Indios'].map((name, i) => [`group-${i + 1}`, { id: `group-${i + 1}`, name, color: COLORS[i] }]));
  const roster = Object.fromEntries(Object.keys(groups).map((id, i) => [`rep${i + 1}@addu,edu,ph`, { email: `rep${i + 1}@addu.edu.ph`, groupId: id }]));
  return { controllers: {}, roster, questions: Object.fromEntries(demoQuestions.map(q => [q.id, q])), lobby: { title: 'Rizal Live', sessionId: 'rehearsal' }, sessions: { rehearsal: { public: { id: 'rehearsal', title: 'Rizal Live', mode: 'waiting', currentRoundId: '', groups } } } };
}
