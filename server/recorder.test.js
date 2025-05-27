const rewire = require('rewire');
const recorder = rewire('./recorder');

const redact = recorder.__get__('redact');
const snapshot = recorder.snapshot;

describe('redact function', () => {
  test('should redact sensitive keys at root level', () => {
    const input = { password: 'secret', foo: 'bar' };
    const output = redact(input);
    expect(output.password).toBe('***REDACTED***');
    expect(output.foo).toBe('bar');
  });

  test('should redact nested sensitive keys', () => {
    const input = { level1: { token: 'abc123', nested: { authorization: 'bearer xyz' } } };
    const output = redact(input);
    expect(output.level1.token).toBe('***REDACTED***');
    expect(output.level1.nested.authorization).toBe('***REDACTED***');
  });

  test('should redact inline secrets in strings', () => {
    const input = { note: 'my password is secretpass', message: 'token=abcd' };
    const output = redact(input);
    expect(output.note).not.toContain('secretpass');
    expect(output.message).not.toContain('abcd');
    expect(output.message).toContain('***REDACTED***');
  });

  test('should return non-object values unchanged', () => {
    expect(redact(null)).toBeNull();
    expect(redact(123)).toBe(123);
    expect(redact('simple string')).toBe('simple string');
  });
});

describe('snapshot function', () => {
  let events;
  let setEvents;

  beforeEach(() => {
    setEvents = recorder.__set__('events', []);
    events = recorder.__get__('events');
  });

  test('should push a snapshot event with redacted data', () => {
    const data = { password: 'topsecret', info: 'visible' };
    snapshot('testSnapshot', data);

    expect(events.length).toBe(1);
    const ev = events[0];
    expect(ev.type).toBe('snapshot');
    expect(ev.name).toBe('testSnapshot');
    expect(ev.data.password).toBe('***REDACTED***');
    expect(ev.data.info).toBe('visible');
    expect(typeof ev.timestamp).toBe('number');
  });

  test('should not throw when snapshotting circular objects', () => {
    const obj = { a: 'alpha' };
    obj.self = obj;
    expect(() => snapshot('circularTest', obj)).not.toThrow();
    expect(events.length).toBe(1);
  });
});
