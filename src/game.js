import {
  createPatient,
  createBaby,
  setPose,
  makeLabel,
  setLabelText,
  disposeObject,
} from './characters.js';
import { Walker } from './npc.js';

const NAMES = ['Mrs. Chen', 'Mrs. Lin', 'Ms. Garcia', 'Mrs. Patel', 'Ms. Kim', 'Mrs. Wang', 'Ms. Rossi', 'Mrs. Okafor', 'Ms. Tanaka', 'Mrs. Silva'];
const DRESSES = [0xb39ddb, 0x90caf9, 0xffcc80, 0xa5d6a7, 0xf48fb1, 0x80cbc4];
const HAIR = [0x3b2a20, 0x1a1a1a, 0x8d5a2b, 0xc9a15b, 0x5a3825];
const PATIENT_LINES = [
  'The baby has been kicking a lot lately!',
  'My back hurts a little, is that normal?',
  'I hope everything looks okay, Doctor.',
  "I've been craving pickles all week.",
];
const NURSE_LINES = [
  'All quiet for now, Doctor.',
  'The delivery room is prepped and ready.',
  "We're running low on ultrasound gel.",
  "Don't forget to take a break, Doctor!",
];
const FEE = { consult: 80, ultrasound: 150, delivery: 500, wardDischarge: 200 };
const WARD_STAY = { observation: 40, postpartum: 30 }; // seconds

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Patient flow:
 *   arriving → waiting → (call) → inClinic → (consult) →
 *     routine        → home
 *     needsUltrasound → onExamBed → (scan) → home | labor → onDeliveryBed → (deliver) → ward (postpartum)
 *     needsAdmit     → ward (observation)
 *   ward: admitted → (timer) → readyDischarge → (discharge) → home
 *
 * p.location is where a patient is settled (or headed): chair | clinic | exam | delivery | ward.
 */
export class Game {
  constructor({ scene, hospital, interactions, hud, player, nurse }) {
    this.scene = scene;
    this.h = hospital;
    this.s = hospital.spots;
    this.ix = interactions;
    this.hud = hud;
    this.player = player;
    this.nurse = nurse;

    this.stats = { money: 500, treated: 0, babies: 0 };
    this.patients = [];
    this.spawnTimer = 1.5;
    this.baby = null;

    const s = this.s;
    this.nurseWalker = new Walker(nurse, 1.8);
    this.nurseStop = 0;
    this.nurseIdle = 3;
    this.nurseRoute = [
      { path: [s.wardDoorOut, s.wardDoorIn, [14.75, -2.2], [14.75, -6.4]], idle: 5 },
      { path: [[14.75, -2.2], s.wardDoorIn, s.wardDoorOut, s.deliveryDoorOut, s.deliveryDoorIn, [3.5, -4.3]], idle: 4 },
      { path: [s.deliveryDoorIn, s.deliveryDoorOut, s.examDoorOut, s.examDoorIn, [-4, -4.3]], idle: 4 },
      { path: [s.examDoorIn, s.examDoorOut, s.clinicDoorOut, s.clinicDoorIn, [-12.5, -3]], idle: 3 },
      { path: [s.clinicDoorIn, s.clinicDoorOut, [-5, 3]], idle: 3 },
      { path: [s.nurseHome], idle: 6 },
    ];

    this.addFixedInteractions();
    hud.toast('Welcome, Doctor! Call waiting patients to the Clinic to begin.', 'good');
  }

  // ---------------------------------------------------------------- setup

  addFixedInteractions() {
    const { objects, clinic, examBed, deliveryBed } = this.h;

    this.ix.add({
      object: objects.clinicDesk,
      range: 2.0,
      label: () => (clinic.occupant?.state === 'inClinic' ? 'Start Consultation' : 'Clinic Desk'),
      action: () => this.consult(),
    });

    this.ix.add({
      object: objects.ultrasound,
      label: () => (examBed.occupant?.state === 'onExamBed' ? 'Perform Ultrasound' : 'Ultrasound Machine'),
      action: () => this.performUltrasound(),
    });

    this.ix.add({
      object: deliveryBed.mesh,
      range: 2.0,
      label: () => (deliveryBed.occupant?.state === 'onDeliveryBed' ? 'Deliver Baby' : null),
      action: () => this.deliverBaby(),
    });

    this.ix.add({
      object: objects.incubator,
      label: () => 'Check Incubator',
      action: () =>
        this.hud.toast(this.baby ? 'The newborn is sleeping peacefully. 👶' : 'The incubator is warm and ready.'),
    });

    this.ix.add({
      object: objects.reception,
      range: 2.2,
      label: () => 'Check Schedule',
      action: () =>
        this.hud.toast(
          `Reception: ${this.countState('waiting')} waiting, ${this.wardCount()}/6 ward beds used, ${this.stats.treated} treated today.`
        ),
    });

    this.ix.add({
      object: this.nurse,
      promptHeight: 2.6,
      label: () => 'Talk to Nurse Amy',
      action: () => this.talkToNurse(),
    });
  }

  // ---------------------------------------------------------------- loop

  update(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnPatient();
      this.spawnTimer = this.patients.length < 2 ? 6 : rand(18, 28);
    }
    for (const p of [...this.patients]) {
      p.walker.update(dt);
      if (p.state === 'admitted') this.updateRecovery(p, dt);
    }
    this.updateNurse(dt);

    this.hud.setStats({ ...this.stats, waiting: this.countState('waiting'), ward: `${this.wardCount()}/6` });
  }

  updateNurse(dt) {
    this.nurseWalker.update(dt);
    if (this.nurseWalker.moving) return;
    this.nurseIdle -= dt;
    if (this.nurseIdle > 0) return;
    const stop = this.nurseRoute[this.nurseStop];
    this.nurseStop = (this.nurseStop + 1) % this.nurseRoute.length;
    this.nurseIdle = Infinity;
    this.nurseWalker.go(stop.path, () => {
      this.nurseIdle = stop.idle;
    });
  }

  updateRecovery(p, dt) {
    const before = Math.ceil(p.recover);
    p.recover -= dt;
    if (p.recover <= 0) {
      this.setStatus(p, 'readyDischarge', '✅ ready to go home');
      this.hud.toast(`${p.name} has recovered and can be discharged.`, 'good');
    } else if (Math.ceil(p.recover) !== before) {
      setLabelText(p.label, `${p.name} · 🛏 ${Math.ceil(p.recover)}s`);
    }
  }

  countState(state) {
    return this.patients.filter((p) => p.state === state).length;
  }

  wardCount() {
    return this.h.wardBeds.filter((b) => b.occupant).length;
  }

  // ---------------------------------------------------------------- patients

  spawnPatient() {
    const chair = this.h.chairs.find((c) => !c.occupant);
    if (!chair) return;

    const char = createPatient({ dress: pick(DRESSES), hair: pick(HAIR) });
    char.position.set(this.s.entrance[0], 0, this.s.entrance[1]);
    char.rotation.y = Math.PI;
    this.scene.add(char);

    const p = {
      char,
      name: pick(NAMES),
      weeks: Math.floor(rand(14, 41)),
      state: 'arriving',
      location: 'chair',
      chair,
      bed: null,
      walker: new Walker(char, 1.6),
      label: makeLabel(''),
    };
    p.label.position.y = 2.2;
    char.add(p.label);
    chair.occupant = p;
    this.setStatus(p, 'arriving', 'checking in');

    p.item = this.ix.add({
      object: char,
      range: 1.9,
      promptHeight: 2.8,
      label: () => this.patientPrompt(p),
      action: () => this.onPatientInteract(p),
    });

    this.patients.push(p);
    p.walker.go(
      [this.s.entranceInside, this.s.receptionFront, 1.5, [chair.x, 6.2], [chair.x, chair.z]],
      () => {
        char.rotation.y = 0;
        setPose(char, 'sit');
        this.setStatus(p, 'waiting', '⌛');
      }
    );
  }

  patientPrompt(p) {
    switch (p.state) {
      case 'waiting': return `Call ${p.name} to Clinic`;
      case 'inClinic': return `Consult ${p.name}`;
      case 'needsUltrasound': return `Send ${p.name} to Exam Room`;
      case 'needsAdmit': return `Admit ${p.name} to Ward`;
      case 'onExamBed': return `Talk to ${p.name}`;
      case 'labor': return `Send ${p.name} to Delivery Room`;
      case 'admitted': return p.rounded ? null : `Ward Round: ${p.name}`;
      case 'readyDischarge': return `Discharge ${p.name}`;
      default: return null;
    }
  }

  setStatus(p, state, text) {
    p.state = state;
    setLabelText(p.label, `${p.name} · ${text}`);
  }

  onPatientInteract(p) {
    const { clinic, examBed, deliveryBed } = this.h;

    switch (p.state) {
      case 'waiting':
        if (clinic.occupant) return this.hud.toast('The clinic is busy. Finish the current consultation first.', 'warn');
        this.hud.toast(`${p.name}: "Coming, Doctor!"`);
        this.moveTo(p, 'clinic', '→ clinic', () => this.setStatus(p, 'inClinic', '🩺 in clinic'));
        break;

      case 'inClinic':
        this.consult();
        break;

      case 'needsUltrasound':
        if (examBed.occupant) return this.hud.toast('The exam room is occupied. Finish the current scan first.', 'warn');
        this.moveTo(p, 'exam', '→ exam room', () => this.setStatus(p, 'onExamBed', 'on exam bed'));
        break;

      case 'needsAdmit':
        this.admit(p, 'observation');
        break;

      case 'onExamBed':
        this.hud.toast(`${p.name}: "${pick(PATIENT_LINES)}"`);
        break;

      case 'labor':
        if (deliveryBed.occupant) return this.hud.toast('The delivery room is busy!', 'warn');
        this.moveTo(p, 'delivery', '→ delivery room', () => this.setStatus(p, 'onDeliveryBed', '🤰 in labor'));
        break;

      case 'admitted': {
        const bp = `${Math.round(rand(110, 135))}/${Math.round(rand(70, 88))}`;
        this.hud.toast(`Ward round: ${p.name}, BP ${bp}, recovering well. Recovery sped up.`, 'good');
        p.rounded = true;
        p.recover = Math.max(0.1, p.recover - 10);
        break;
      }

      case 'readyDischarge':
        this.earn(FEE.wardDischarge, `${p.name} discharged from the ward.`);
        this.sendHome(p);
        break;
    }
  }

  async consult() {
    const p = this.h.clinic.occupant;
    if (p?.state !== 'inClinic') {
      this.hud.toast('No patient in the clinic. Call one from the waiting area.', 'warn');
      return;
    }

    this.player.locked = true;
    await this.hud.progress('Consulting…', 2);
    this.player.locked = false;
    this.earn(FEE.consult, 'Consultation fee.');

    const r = Math.random();
    if (p.weeks >= 37 || r < 0.35) {
      this.setStatus(p, 'needsUltrasound', '→ needs ultrasound');
      this.hud.toast(`Consult: ${p.name}, ${p.weeks} weeks. Let's check the baby with an ultrasound.`);
    } else if (r < 0.6) {
      const bp = `${Math.round(rand(145, 165))}/${Math.round(rand(92, 105))}`;
      this.setStatus(p, 'needsAdmit', '⚠ needs admission');
      this.hud.toast(`Consult: BP ${bp}, signs of preeclampsia. Admit ${p.name} to the ward.`, 'warn');
    } else {
      this.hud.toast(`Consult: routine check-up at ${p.weeks} weeks. Mother and baby are doing great.`, 'good');
      this.sendHome(p);
    }
  }

  async performUltrasound() {
    const p = this.h.examBed.occupant;
    if (p?.state !== 'onExamBed') {
      this.hud.toast('No patient on the exam bed. Send one from the Clinic.', 'warn');
      return;
    }

    const screen = this.h.objects.ultrasoundScreen.material;
    this.player.locked = true;
    screen.emissive.setHex(0x4fc3f7);
    await this.hud.progress('Scanning…', 2.5);
    screen.emissive.setHex(0x000000);
    this.player.locked = false;

    const bpm = Math.round(rand(125, 160));
    this.earn(FEE.ultrasound, 'Ultrasound fee.');
    if (p.weeks < 37) {
      this.hud.toast(`Ultrasound: ${p.weeks} weeks, healthy baby, heartbeat ${bpm} bpm. ❤`, 'good');
      this.sendHome(p);
    } else {
      this.setStatus(p, 'labor', '⚠ in labor!');
      this.hud.toast(`${p.weeks} weeks: ${p.name} is in labor! Send her to the Delivery Room.`, 'warn');
    }
  }

  async deliverBaby() {
    const p = this.h.deliveryBed.occupant;
    if (p?.state !== 'onDeliveryBed') return;

    this.player.locked = true;
    await this.hud.progress('Delivering baby…', 4);
    this.player.locked = false;

    const girl = Math.random() < 0.5;
    const kg = rand(2.8, 3.9).toFixed(1);
    this.hud.toast(`It's a ${girl ? 'girl' : 'boy'}! ${kg} kg. Mother and baby are healthy. 🎉`, 'good');
    this.earn(FEE.delivery, 'Delivery complete.');
    this.stats.babies++;
    this.placeBaby(girl);

    if (this.freeWardBed()) this.admit(p, 'postpartum');
    else {
      this.hud.toast('The ward is full, so the new mother goes home to rest.', 'warn');
      this.sendHome(p);
    }
  }

  freeWardBed() {
    return this.h.wardBeds.find((b) => !b.occupant) ?? null;
  }

  admit(p, reason) {
    const bed = this.freeWardBed();
    if (!bed) return this.hud.toast('The ward is full! Discharge a recovered patient first.', 'warn');
    p.rounded = false;
    p.recover = WARD_STAY[reason];
    this.moveTo(p, 'ward', '→ ward', () => this.setStatus(p, 'admitted', `🛏 ${p.recover}s`), bed);
  }

  earn(amount, reason) {
    this.stats.money += amount;
    this.hud.toast(`${reason} +$${amount}`, 'money');
  }

  placeBaby(girl) {
    if (this.baby) {
      this.scene.remove(this.baby);
      disposeObject(this.baby);
    }
    this.baby = createBaby(girl ? 0xf8bbd0 : 0x90caf9);
    this.baby.position.copy(this.s.babyCrib);
    this.baby.rotation.y = Math.PI / 2;
    this.scene.add(this.baby);
  }

  // ---------------------------------------------------------------- movement between rooms

  /** Frees the patient's current spot and returns the path from there out to the lobby. */
  leaveCurrentSpot(p) {
    const { s, h } = this;
    switch (p.location) {
      case 'chair': {
        const cx = p.chair.x;
        p.chair.occupant = null;
        p.chair = null;
        return [[cx, 6.2], [s.westAisle, 6.2], [s.westAisle, 2.5]];
      }
      case 'clinic':
        h.clinic.occupant = null;
        this.standAt(p, s.clinicSide);
        return [s.clinicDoorIn, s.clinicDoorOut];
      case 'exam':
        h.examBed.occupant = null;
        this.standAt(p, s.examBedSide);
        return [s.examDoorIn, s.examDoorOut];
      case 'delivery':
        h.deliveryBed.occupant = null;
        this.standAt(p, s.deliveryBedSide);
        return [s.deliveryDoorIn, s.deliveryDoorOut];
      case 'ward': {
        const bed = p.bed;
        bed.occupant = null;
        p.bed = null;
        this.standAt(p, bed.approach.at(-1));
        return [...bed.approach.slice(0, -1).reverse(), s.wardDoorIn, s.wardDoorOut];
      }
    }
    return [];
  }

  /** Path from the lobby into a room (last point = where the patient stands before settling). */
  routeInto(room, bed) {
    const s = this.s;
    switch (room) {
      case 'clinic': return [s.clinicDoorOut, s.clinicDoorIn, s.clinicSide];
      case 'exam': return [s.examDoorOut, s.examDoorIn, s.examBedSide];
      case 'delivery': return [s.deliveryDoorOut, s.deliveryDoorIn, s.deliveryBedSide];
      case 'ward': return [s.wardDoorOut, s.wardDoorIn, ...bed.approach];
    }
  }

  /** Reserves a room (or ward bed), walks the patient there, then sits/lays her down. */
  moveTo(p, room, statusText, onArrive, bed = null) {
    const out = this.leaveCurrentSpot(p);
    p.location = room;
    if (room === 'clinic') this.h.clinic.occupant = p;
    if (room === 'exam') this.h.examBed.occupant = p;
    if (room === 'delivery') this.h.deliveryBed.occupant = p;
    if (room === 'ward') {
      bed.occupant = p;
      p.bed = bed;
    }
    this.setStatus(p, 'walking', statusText);
    p.walker.go([...out, ...this.routeInto(room, bed)], () => {
      this.settle(p);
      onArrive();
    });
  }

  settle(p) {
    const s = this.s;
    switch (p.location) {
      case 'clinic': {
        const seat = s.clinicSeat;
        p.char.position.set(seat.x, 0, seat.z);
        p.char.rotation.y = seat.yaw;
        setPose(p.char, 'sit');
        break;
      }
      case 'exam': this.lieOn(p, s.examBedLie); break;
      case 'delivery': this.lieOn(p, s.deliveryBedLie); break;
      case 'ward': this.lieOn(p, p.bed.lie); break;
    }
  }

  sendHome(p) {
    const out = this.leaveCurrentSpot(p);
    p.location = null;
    this.stats.treated++;
    this.setStatus(p, 'leaving', '👋 going home');
    p.walker.go([...out, this.s.lobbyCenter, this.s.entranceInside, this.s.entrance], () => this.removePatient(p));
  }

  removePatient(p) {
    this.scene.remove(p.char);
    this.ix.remove(p.item);
    disposeObject(p.char);
    this.patients = this.patients.filter((x) => x !== p);
  }

  lieOn(p, spot) {
    p.char.position.set(spot.x, 0, spot.z);
    p.char.rotation.y = spot.yaw;
    setPose(p.char, 'lie');
  }

  standAt(p, [x, z]) {
    setPose(p.char, 'stand');
    p.char.position.set(x, 0, z);
  }

  talkToNurse() {
    const urgent = this.patients.find((p) => p.state === 'labor');
    const ready = this.patients.find((p) => p.state === 'readyDischarge');
    const waiting = this.countState('waiting');
    let line;
    if (urgent) line = `${urgent.name} is in labor. Please move her to the Delivery Room!`;
    else if (ready) line = `${ready.name} in the ward is ready to be discharged.`;
    else if (waiting) line = `Doctor, ${waiting} patient${waiting > 1 ? 's are' : ' is'} waiting.`;
    else line = pick(NURSE_LINES);
    this.hud.toast(`Nurse Amy: "${line}"`);
  }
}
