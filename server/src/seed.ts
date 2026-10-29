// Adds a few sample fishers and deliveries so you can try the app.
// Run:  npm run seed
// Each fisher's login code is printed so you can type it in the app ("Enter my code").

import * as store from './db';

if (store.listFishers().length > 0) {
  console.log('There are already fishers in the database, so nothing was added. (Delete data/isdako.db to start fresh.)');
  process.exit(0);
}

const people = [
  { name: 'Juan Dela Cruz', boat: 'Bangka Lucky', barangay: 'Macasandig', phone: null, smsOptIn: false },
  { name: 'Pedro Santos', boat: 'Sta. Maria', barangay: 'Bonbon', phone: null, smsOptIn: false },
  { name: 'Maria Reyes', boat: 'Dalagang Bukid', barangay: 'Puntod', phone: null, smsOptIn: false },
];

const catches: Array<[string, number | null, number | null, number | null]> = [
  ['Tulingan', 18.5, null, 120],
  ['Galunggong', 7.25, null, 180],
  ['Bangsi', 32, 4, 260],
  ['Pusit', 4.5, null, 300],
  ['Tamban', 25, null, 90],
];

for (const person of people) {
  const fisher = store.createFisher(person);
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const [species, kg, pieces, pricePerKg] = catches[Math.floor(Math.random() * catches.length)] as [
      string,
      number | null,
      number | null,
      number | null,
    ];
    store.addDelivery(fisher.id, { species, kg, pieces, pricePerKg, note: null });
  }
  console.log(`${fisher.name}: code ${fisher.token}`);
}
console.log('Done. In the app, tap "Staff sign in" to see them, or "Enter my code" to view one as that fisher.');
