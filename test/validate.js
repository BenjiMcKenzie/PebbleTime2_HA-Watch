'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var packageInfo = require(path.join(root, 'package.json'));
var buildConfig = require(path.join(root, 'src/pkjs/config.js'));

assert.strictEqual(packageInfo.name, 'ha-watch-custom');
assert.strictEqual(packageInfo.author, 'Benji McKenzie');
assert.strictEqual(packageInfo.version, '2.1.0');
assert.strictEqual(packageInfo.license, 'MIT');
assert.strictEqual(packageInfo.pebble.displayName, 'HA Watch Custom');
// Die UUID darf sich nie aendern: Updates ersetzen sonst nicht die installierte App.
assert.strictEqual(packageInfo.pebble.uuid, '9698ca1b-7be6-42c5-88b5-7358678dd4c2');
assert.notStrictEqual(packageInfo.pebble.uuid, '013f5b1c-e688-4bb5-841b-f3ca41505d23');
assert.notStrictEqual(packageInfo.pebble.uuid, '0d6f3a52-8f0e-4c63-9a1b-5e2b7c41d8a7');

function collectMessageKeys(items, result) {
  items.forEach(function(item) {
    if (item.messageKey) result.push(item.messageKey);
    if (item.items) collectMessageKeys(item.items, result);
  });
  return result;
}

var englishKeys = collectMessageKeys(buildConfig('en'), []);
var germanKeys = collectMessageKeys(buildConfig('de'), []);
assert.deepStrictEqual(germanKeys, englishKeys, 'localized pages must persist identical keys');
['haUrl', 'haToken', 'entity1', 'unit1', 'entity2', 'unit2'].forEach(function(key) {
  assert(englishKeys.indexOf(key) >= 0, 'legacy setting missing: ' + key);
});
['haRefreshMinutes', 'weatherRefreshMinutes'].forEach(function(key) {
  assert(englishKeys.indexOf(key) >= 0, 'refresh setting missing: ' + key);
});

var watchSource = fs.readFileSync(path.join(root, 'src/embeddedjs/main.js'), 'utf8');
var keyMatch = watchSource.match(/const MESSAGE_KEYS = \[([\s\S]*?)\];/);
assert(keyMatch, 'watch MESSAGE_KEYS not found');
var watchKeys = vm.runInNewContext('[' + keyMatch[1] + ']');
assert.deepStrictEqual(Array.prototype.slice.call(watchKeys), packageInfo.pebble.messageKeys,
                       'package and watch message key order differs');
var legacyMessageKeys = [
  'dummy', 'value1', 'unit1', 'value2', 'unit2', 'latitude', 'longitude', 'error',
  'value3', 'unit3', 'value4', 'unit4', 'value5', 'unit5', 'value6', 'unit6',
  'rowmode', 'weather', 'temperature', 'tempunit', 'timeformat', 'dateformat'
];
assert.deepStrictEqual(packageInfo.pebble.messageKeys.slice(0, legacyMessageKeys.length),
                       legacyMessageKeys, 'released message keys were reordered');
assert.strictEqual(packageInfo.pebble.messageKeys.indexOf('haToken'), -1,
                    'HA credentials must never be sent to the watch');
assert(watchSource.indexOf('configurationReady = restoreDisplaySettings();') >= 0,
       'persisted display settings must be restored before startup rendering');
assert(watchSource.indexOf('if (!configurationReady)') >= 0,
       'first-install rendering must not expose default information rows');
assert(watchSource.indexOf('native.watch_setting_write(SETTING_KEY_VERSION, SETTING_VERSION)') >= 0,
       'complete display settings must be committed atomically with a version marker');

var manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/embeddedjs/manifest.json'), 'utf8'));
assert(fs.existsSync(path.join(root, 'src/c/settings.c')),
       'watch settings persistence source is missing');
assert.deepStrictEqual(manifest.ffi.functions.watch_setting_read.arguments,
                       ['int32_t', 'int32_t']);

var storage = {
  'clay-settings': JSON.stringify({
    haUrl: 'https://ha.example/', haToken: 'secret', entity1: 'sensor.old',
    languageSetting: 'de', showBattery: false, backgroundColor: 0x55AAFF
  })
};
var requests = [];
var intervals = [];
var clearedIntervals = [];

function FakeRequest() {
  requests.push(this);
}
FakeRequest.prototype.open = function(method, url) { this.method = method; this.url = url; };
FakeRequest.prototype.setRequestHeader = function() {};
FakeRequest.prototype.send = function(body) { this.body = body; };

function FakeClay() {}

var mqttModule;

var context = {
  console: console,
  Date: Date,
  JSON: JSON,
  Math: Math,
  parseFloat: parseFloat,
  parseInt: parseInt,
  isNaN: isNaN,
  encodeURIComponent: encodeURIComponent,
  setTimeout: function() {},
  setInterval: function(callback, milliseconds) {
    intervals.push({ callback: callback, milliseconds: milliseconds });
    return intervals.length;
  },
  clearInterval: function(id) { clearedIntervals.push(id); },
  XMLHttpRequest: FakeRequest,
  navigator: { language: 'en-US', languages: ['en-US'] },
  localStorage: {
    getItem: function(key) { return storage[key] || null; },
    setItem: function(key, value) { storage[key] = value; }
  },
  Pebble: {
    addEventListener: function() {},
    sendAppMessage: function(data, success) { if (success) success(); },
    getAccountToken: function() { return ''; },
    getWatchToken: function() { return ''; }
  },
  require: function(name) {
    if (name === '@rebble/clay') return FakeClay;
    if (name === './config') return buildConfig;
    if (name === './mqtt') return mqttModule;
    throw new Error('unexpected require: ' + name);
  }
};
vm.createContext(context);
mqttModule = vm.runInContext('(function() { var module = { exports: {} };\n' +
  fs.readFileSync(path.join(root, 'src/pkjs/mqtt.js'), 'utf8') + '\nreturn module.exports; })()', context);
vm.runInContext(fs.readFileSync(path.join(root, 'src/pkjs/index.js'), 'utf8'), context);

var migrated = context.readSettings();
assert.strictEqual(migrated.url, 'https://ha.example');
assert.strictEqual(migrated.entity1, 'sensor.old');
assert.strictEqual(migrated.showDate, true);
assert.strictEqual(migrated.showBattery, false);
assert.strictEqual(migrated.haRefreshMinutes, 5);
assert.strictEqual(migrated.weatherRefreshMinutes, 15);
assert.strictEqual(context.colorCode(migrated.backgroundColor, 0), 0x55AAFF);
assert.strictEqual(context.selectedLanguage(migrated), 'de');
assert.strictEqual(context.convertTemperature(0, 'C', 'F'), 32);
assert.strictEqual(context.convertTemperature(32, 'F', 'C'), 0);
var storedSettings = JSON.parse(storage['clay-settings']);
storedSettings.haRefreshMinutes = 0;
storedSettings.weatherRefreshMinutes = 999;
storage['clay-settings'] = JSON.stringify(storedSettings);
var boundedIntervals = context.readSettings();
assert.strictEqual(boundedIntervals.haRefreshMinutes, 1);
assert.strictEqual(boundedIntervals.weatherRefreshMinutes, 120);
context.configureRefreshTimers(boundedIntervals);
context.configureRefreshTimers(boundedIntervals);
assert.deepStrictEqual(clearedIntervals, [1, 2], 'old refresh timers were not replaced');
assert.strictEqual(intervals[2].milliseconds, 60 * 1000);
assert.strictEqual(intervals[3].milliseconds, 120 * 60 * 1000);
assert.strictEqual(context.needsLocation({
  url: '', token: '', entity1: 'sensor.old', entity2: '', entity3: 'sensor.old', entity4: '',
  showTop: true, showWeather: true, weatherSource: 'openmeteo'
}), true);

var requestCount = requests.length;
context.refresh();
context.refresh();
assert.strictEqual(requests.length, requestCount + 1, 'parallel HA refresh was started');
assert.strictEqual(context.refreshPending, true);
var sensorRequest = requests[requests.length - 1];
sensorRequest.status = 200;
sensorRequest.responseText = JSON.stringify({ state: '21.5', attributes: { unit_of_measurement: '°C' } });
sensorRequest.onload();
assert.strictEqual(context.refreshInProgress, false);

context.refreshHaWeather({
  url: 'https://ha.example', token: 'secret', weatherEntity: 'weather.home',
  tempUnit: 'fahrenheit', language: 'de'
});
var weatherRequest = requests[requests.length - 1];
assert.strictEqual(weatherRequest.url, 'https://ha.example/api/states/weather.home');
weatherRequest.status = 200;
weatherRequest.responseText = JSON.stringify({
  state: 'partlycloudy',
  attributes: { temperature: 10, temperature_unit: '°C' }
});
weatherRequest.onload();
assert.strictEqual(context.cache.weather, 'Teilwolkig');
assert.strictEqual(context.cache.temperature, '50');
assert.strictEqual(context.cache.tempunit, '°F');

// --- MQTT-Meldung -------------------------------------------------------
['mqttEnabled', 'mqttName', 'mqttPrefix'].forEach(function(key) {
  assert(englishKeys.indexOf(key) >= 0, 'mqtt setting missing: ' + key);
});
assert.strictEqual(packageInfo.pebble.messageKeys.slice(-10).join(),
                   'wstatus,mqttheartbeat,mqtthealth,wsteps,wdist,whr,wsleep,wactive,wkcal,wkcala',
                   'new keys must be appended at the end');
assert(manifest.ffi.functions.watch_health_metric, 'health FFI function missing');
assert.strictEqual(context.readSettings().mqttHealth, false, 'health reporting must be off by default');
assert.strictEqual(packageInfo.pebble.messageKeys.indexOf('mqttEnabled'), -1);
assert(manifest.ffi.functions.watch_status_bits, 'status FFI function missing');
assert(fs.existsSync(path.join(root, 'src/c/status.c')));

var defaults = context.readSettings();
assert.strictEqual(defaults.mqttEnabled, false, 'MQTT must be off by default');
assert.strictEqual(mqttModule.heartbeatMinutes(defaults), 0);
assert.strictEqual(englishKeys.indexOf('mqttHeartbeat'), -1, 'heartbeat follows the HA refresh interval');
assert.strictEqual(defaults.mqttHeartbeat, 5, 'default follows haRefreshMinutes (5)');
var longInterval = JSON.parse(storage['clay-settings']);
longInterval.haRefreshMinutes = 15;
storage['clay-settings'] = JSON.stringify(longInterval);
assert.strictEqual(context.readSettings().mqttHeartbeat, 15);
longInterval.haRefreshMinutes = 1;
storage['clay-settings'] = JSON.stringify(longInterval);
assert.strictEqual(context.readSettings().mqttHeartbeat, 5, 'never more often than every 5 minutes');
var withMqtt = { mqttEnabled: true, url: 'https://ha.example', token: 'secret', mqttHeartbeat: 30 };
assert.strictEqual(mqttModule.heartbeatMinutes(withMqtt), 30);
assert.strictEqual(mqttModule.heartbeatMinutes({ mqttEnabled: true, url: '', token: '', mqttHeartbeat: 30 }), 0,
                   'no credentials means no MQTT');

// Status von der Uhr -> Discovery + Zustand ueber mqtt.publish
var before = requests.length;
mqttModule.handleStatus({ mqttEnabled: true, url: 'https://ha.example', token: 'secret',
                          mqttName: 'Pebble Time 2', mqttPrefix: 'pebble', mqttHeartbeat: 30 },
                        { wstatus: 87 | (1 << 8) | (1 << 10), wsteps: 4000 });
assert.strictEqual(requests.length, before + 1, 'publishes must run one after another');
assert.strictEqual(requests[before].url, 'https://ha.example/api/services/mqtt/publish');
var published = [];
while (requests.length > before && !requests[requests.length - 1].__done) {
  var pending = requests[requests.length - 1];
  pending.__done = true;
  pending.status = 200;
  pending.responseText = '[]';
  pending.onload();
}
var stateRequests = requests.slice(before);
assert.strictEqual(stateRequests.length, 8, 'expected 7 discovery topics plus the state');
stateRequests.forEach(function(r) { published.push(r); });
var stateBody = JSON.parse(stateRequests[7].body);
assert.strictEqual(stateBody.topic, 'pebble/pebble_time_2/state');
assert.strictEqual(stateBody.retain, true);
var statePayload = JSON.parse(stateBody.payload);
assert.strictEqual(statePayload.battery, 87);
assert.strictEqual(statePayload.charging, 'ON');
assert.strictEqual(statePayload.quiet_time, 'OFF');
assert.strictEqual(statePayload.bluetooth, 'ON');
assert.strictEqual(JSON.parse(JSON.parse(stateRequests[0].body).payload).unique_id.indexOf('pebble_ha_sync_pebble_time_2_'), 0);
assert.strictEqual(storage.pebbleha_lastbits, String(87 | (1 << 8) | (1 << 10)));
assert.strictEqual(storage.pebbleha_announced.indexOf('pebble_time_2|pebble|'), 0);

// --- Gesundheitswerte ----------------------------------------------------
function flush(from) {
  while (requests.length > from && !requests[requests.length - 1].__done) {
    var open = requests[requests.length - 1];
    open.__done = true;
    open.status = 200;
    open.responseText = '[]';
    open.onload();
  }
  return requests.slice(from);
}
function stateOf(list) {
  var last = JSON.parse(list[list.length - 1].body);
  assert.strictEqual(last.topic, 'pebble/pebble_time_2/state');
  return JSON.parse(last.payload);
}
var healthSettings = { mqttEnabled: true, mqttHealth: true, url: 'https://ha.example', token: 'secret',
                       mqttName: 'Pebble Time 2', mqttPrefix: 'pebble', mqttHeartbeat: 30 };
assert.strictEqual(mqttModule.healthEnabled(healthSettings), true);
assert.strictEqual(mqttModule.healthEnabled({ mqttEnabled: false, mqttHealth: true, url: 'x', token: 'y', mqttHeartbeat: 30 }), false);

var from = requests.length;
mqttModule.handleStatus(healthSettings, { wstatus: 50, wsteps: 4200, wdist: 3100, wsleep: 430, wactive: 35, wkcal: 1900, wkcala: 300 });
var list = flush(from);
assert.strictEqual(list.length, 15, 'health toggle changes the announcement: 7 + 7 discovery topics plus the state');
var healthState = stateOf(list);
assert.strictEqual(healthState.steps, 4200);
assert.strictEqual(healthState.distance, 3100);
assert.strictEqual(healthState.sleep_minutes, 430);
assert.strictEqual(healthState.active_minutes, 35);
assert.strictEqual(healthState.calories, 1900);
assert.strictEqual(healthState.calories_active, 300);
assert.strictEqual(healthState.heart_rate, null, 'missing values must become null, not stale numbers');
var heartConfig = list.map(function(r) { return JSON.parse(r.body); }).filter(function(b) {
  return b.topic === 'homeassistant/sensor/pebble_time_2/heart_rate/config';
})[0];
assert.strictEqual(JSON.parse(heartConfig.payload).unit_of_measurement, 'bpm');

from = requests.length;
mqttModule.handleStatus(healthSettings, { wstatus: 52, wsteps: 4300 });
assert.strictEqual(flush(from).length, 1, 'unchanged announcement: only the state is sent');

var noHealth = JSON.parse(JSON.stringify(healthSettings));
noHealth.mqttHealth = false;
from = requests.length;
mqttModule.handleStatus(noHealth, { wstatus: 52, wsteps: 4300 });
list = flush(from);
assert.strictEqual(list.length, 15, 'turning health off re-announces and removes the sensors');
var removal = list.map(function(r) { return JSON.parse(r.body); }).filter(function(b) {
  return b.topic === 'homeassistant/sensor/pebble_time_2/steps/config';
})[0];
assert.strictEqual(removal.payload, '', 'sensor config must be cleared');
assert.strictEqual(stateOf(list).steps, undefined, 'no health values without the switch');

console.log('HA Watch Custom validation passed');
