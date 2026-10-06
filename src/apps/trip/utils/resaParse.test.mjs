// node --test src/apps/trip/utils/*.test.mjs
//
// Lire une réservation dans le texte d'une capture (OCR). Les textes imitent
// ce que rend Tesseract d'une capture de mail : accents parfois perdus,
// lignes en désordre.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findDates, findTimes, parseReservationText, stayFields, transportFields } from './resaParse.js'

const NEAR = '2027-05-10'

test('dates : chiffres, mois en toutes lettres, avec ou sans année', () => {
  const dates = (t) => findDates(t, { near: NEAR }).map((d) => d.date)
  assert.deepEqual(dates('Le 12/05/2027 puis le 14.05.27'), ['2027-05-12', '2027-05-14'])
  assert.deepEqual(dates('mardi 13 mai 2027'), ['2027-05-13'])
  assert.deepEqual(dates('Tue, May 13, 2027'), ['2027-05-13'])
  assert.deepEqual(dates('le 2 aout'), ['2027-08-02'], 'sans année : la plus proche du voyage')
  assert.deepEqual(dates('2027-05-17T19:40'), ['2027-05-17'])
  assert.deepEqual(dates('13 de maio de 2027'), [], 'tournure portugaise non reconnue : rien plutôt que faux')
})

test('heures : 24 h, « h », AM/PM, sans les durées', () => {
  const times = (t) => findTimes(t).map((x) => x.time)
  assert.deepEqual(times('Départ 08:55 Arrivée 10h40'), ['08:55', '10:40'])
  assert.deepEqual(times('Departs 7:05 pm, arrives 9:30 PM'), ['19:05', '21:30'])
  assert.deepEqual(times('Durée 2h35 · départ 14:10'), ['14:10'])
})

test('un vol Air France (mail en français)', () => {
  const text = `Votre carte d'embarquement
AF 1024 Paris CDG - LIS Lisbonne
Mercredi 12 mai 2027
Embarquement 08:15
Départ 08:55 Arrivée 10:40
Siège 23A
Référence de réservation : K7PQ2L
Total payé 189,00 €`
  const parsed = parseReservationText(text, { near: NEAR })
  assert.equal(parsed.transportRef, 'AF 1024')
  assert.equal(parsed.mode, 'flight')
  assert.equal(parsed.confirmation, 'K7PQ2L')
  assert.equal(parsed.seat, '23A')
  assert.deepEqual(parsed.price, { amount: 189, currency: 'EUR' })
  const fields = transportFields(parsed)
  assert.deepEqual(fields.from, { date: '2027-05-12', time: '08:55' })
  assert.deepEqual(fields.to, { date: '2027-05-12', time: '10:40' })
})

test('un vol de nuit : l’arrivée passe au lendemain', () => {
  const text = 'Flight TO 4731\nFAO → ORY\nMay 17, 2027\n23:10 - 02:35\nBooking reference TVX8P3'
  const fields = transportFields(parseReservationText(text, { near: NEAR }))
  assert.equal(fields.ref, 'TO 4731')
  assert.equal(fields.fromName, 'FAO')
  assert.equal(fields.toName, 'ORY')
  assert.deepEqual(fields.to, { date: '2027-05-18', time: '02:35' })
  assert.equal(fields.confirmation, 'TVX8P3')
})

test('un TGV (SNCF)', () => {
  const text = `TGV INOUI 6173
Paris Gare de Lyon 08:12 → Lyon Part-Dieu 10:08
Le 14/05/2027
Voiture 12 Place 64
Référence : QXR7TZ`
  const parsed = parseReservationText(text, { near: NEAR })
  assert.equal(parsed.transportRef, 'TGV INOUI 6173')
  assert.equal(parsed.mode, 'train')
  assert.equal(parsed.seat, 'Voiture 12, place 64')
  assert.equal(parsed.confirmation, 'QXR7TZ')
  assert.deepEqual(transportFields(parsed).from, { date: '2027-05-14', time: '08:12' })
})

test('un Airbnb : arrivée, départ, code de la boîte à clés', () => {
  const text = `Votre réservation est confirmée
Casa na Alfama
Arrivée mer. 12 mai 2027 15:00
Départ ven. 14 mai 2027 11:00
Code de confirmation HMX2K9
Boite a cles : 4417
Total (EUR) 284,00 €`
  const fields = stayFields(parseReservationText(text, { near: NEAR }))
  assert.deepEqual(fields.checkIn, { date: '2027-05-12', time: '15:00' })
  assert.deepEqual(fields.checkOut, { date: '2027-05-14', time: '11:00' })
  assert.equal(fields.accessCode, '4417')
  assert.equal(fields.confirmation, 'HMX2K9')
  assert.deepEqual(fields.price, { amount: 284, currency: 'EUR' })
})

test('un hôtel Booking (anglais), prix à l’anglaise', () => {
  const text = `Booking number: 4318825193
Check-in Thursday, May 14, 2027 from 16:00
Check-out Saturday, May 16, 2027 until 11:00
Total price A$ 1,234.50`
  const fields = stayFields(parseReservationText(text, { near: NEAR }))
  assert.deepEqual(fields.checkIn, { date: '2027-05-14', time: '16:00' })
  assert.deepEqual(fields.checkOut, { date: '2027-05-16', time: '11:00' })
  assert.equal(fields.confirmation, '4318825193')
  assert.deepEqual(fields.price, { amount: 1234.5, currency: 'AUD' })
})

test('rien de reconnaissable : rien d’inventé', () => {
  const parsed = parseReservationText('Merci de votre visite, à bientôt !', { near: NEAR })
  assert.equal(parsed.transportRef, null)
  assert.equal(parsed.confirmation, null)
  assert.deepEqual(parsed.dates, [])
  assert.equal(parsed.price, null)
})
