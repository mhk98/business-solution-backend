const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../app/modules/attendance/attendance.rules');
const T = require('../app/modules/attendance/attendance.time');

const shift = R.normalizeShift({
  Id: 1, startTime: '10:30', endTime: '18:30', graceInMinutes: 10, graceOutMinutes: 10,
  weeklyOffDays: '["Friday","Saturday"]', breakMinutes: 60, fullDayMinutes: 360, halfDayMinutes: 180,
});
const policy = { duplicatePunchMinutes: 2, singlePunchAs: 'Half Day', overtimeEnabled: true };
const p = (...clocks) => clocks.map((c) => ({ minutes: T.clockToMinutes(c), seconds: 0 }));
const ev = (o) => R.evaluateDay({
  date: '2026-10-04', today: '2026-10-10', nowMinutes: 600, shift, holiday: null,
  isWeeklyOff: false, leave: null, punches: [], policy, ...o,
});

test('on-time full day is Present; break deducted from worked time', () => {
  const r = ev({ punches: p('10:35', '18:40') });
  assert.equal(r.status, 'Present');
  assert.equal(r.isLate, false);
  assert.equal(r.workedMinutes, 485 - 60);
});

test('late beyond grace counts from shift start; early leave from shift end; overtime after end', () => {
  const r = ev({ punches: p('10:45', '18:00') });
  assert.equal(r.lateMinutes, 15);
  assert.equal(r.earlyLeaveMinutes, 30);
  assert.equal(ev({ punches: p('10:30', '20:00') }).overtimeMinutes, 90);
});

test('single punch / double tap follow the policy; short stays become Half Day or Absent', () => {
  assert.equal(ev({ punches: p('10:30') }).status, 'Half Day');
  assert.equal(ev({ punches: p('10:30') }).isMissingPunch, true);
  assert.equal(ev({ punches: p('10:30', '10:31') }).status, 'Half Day');
  assert.equal(ev({ punches: p('10:30', '14:00') }).status, 'Half Day');
  assert.equal(ev({ punches: p('10:30', '12:00') }).status, 'Absent');
  assert.equal(ev({}).status, 'Absent');
});

test('holiday / weekly off / leave take precedence over punches', () => {
  assert.equal(ev({ isWeeklyOff: true }).status, 'Weekly Off');
  const holiday = ev({ holiday: { Id: 3, name: 'Eid' }, punches: p('11:00', '15:00') });
  assert.equal(holiday.status, 'Holiday');
  assert.equal(holiday.workedOnOffDay, true);
  const leave = ev({ leave: { Id: 9, leaveTypeId: 2, isPaid: true, isHalfDay: false, typeName: 'Sick' } });
  assert.equal(leave.status, 'Leave');
  assert.equal(leave.leaveValue, 1);
  const half = ev({ leave: { Id: 9, isHalfDay: true }, punches: p('14:30', '18:30') });
  assert.equal(half.status, 'Half Leave');
  assert.equal(half.presentValue, 0.5);
  assert.equal(half.leaveValue, 0.5);
});

test('today: Pending before shift start, Absent after, no early-leave while the shift runs', () => {
  const today = { date: '2026-10-10' };
  assert.equal(ev({ ...today, nowMinutes: T.clockToMinutes('09:00') }).status, 'Pending');
  assert.equal(ev({ ...today, nowMinutes: T.clockToMinutes('11:00') }).status, 'Absent');
  const working = ev({ ...today, nowMinutes: T.clockToMinutes('13:00'), punches: p('10:50') });
  assert.equal(working.status, 'Present');
  assert.equal(working.isMissingPunch, false);
  assert.equal(ev({ ...today, nowMinutes: T.clockToMinutes('13:00'), punches: p('10:30', '13:00') }).earlyLeaveMinutes, 0);
  assert.equal(ev({ date: '2026-10-11' }), null);
});

test('night shift crosses midnight and takes the next morning\'s punch', () => {
  const night = R.normalizeShift({ startTime: '22:00', endTime: '06:00', graceInMinutes: 5 });
  assert.equal(night.crossesMidnight, true);
  assert.deepEqual(R.punchWindow(night), { from: 1080, to: 2160 });
  const r = ev({ shift: night, punches: [{ minutes: 1340, seconds: 0 }, { minutes: 1805, seconds: 0 }] });
  assert.equal(r.status, 'Present');
  assert.equal(r.lateMinutes, 20);
  assert.equal(r.outTime, '2026-10-05 06:05:00');
});

test('sandwich rule turns an off day between two absences into Absent', () => {
  const days = [{ result: { status: 'Absent', absentValue: 1 } }, { result: { status: 'Weekly Off' } }, { result: { status: 'Weekly Off' } }, { result: { status: 'Absent', absentValue: 1 } }];
  R.applySandwichRule(days);
  assert.equal(days[1].result.status, 'Absent');
  assert.equal(days[2].result.status, 'Absent');
  const kept = [{ result: { status: 'Present' } }, { result: { status: 'Weekly Off' } }, { result: { status: 'Absent', absentValue: 1 } }];
  R.applySandwichRule(kept);
  assert.equal(kept[1].result.status, 'Weekly Off');
});

test('time helpers work in Bangladesh time regardless of server timezone', () => {
  assert.deepEqual(T.monthBounds('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.equal(T.weekdayName('2026-10-02'), 'Friday');
  assert.deepEqual(T.toBdParts(new Date('2026-10-03T18:30:00Z')), { date: '2026-10-04', clock: '00:30:00' });
  assert.deepEqual(T.normalizeWeekdays('fri, Sat'), ['Friday', 'Saturday']);
});
