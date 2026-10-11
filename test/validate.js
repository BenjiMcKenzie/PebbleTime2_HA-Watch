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
assert.strictEqual(packageInfo.version, '2.0.3');
assert.strictEqual(packageInfo.license, 'MIT');
assert.strictEqual(packageInfo.pebble.displayName, 'HA Watch Custom');
assert.strictEqual(packageInfo.pebble.uuid, '9698ca1b-7be6-42c5-88b5-7358678dd4c2');
assert.notStrictEqual(packageInfo.pebble.uuid, '013f5b1c-e688-4bb5-841b-f3ca41505d23');

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
FakeRequest.prototype.send = function() {};

function FakeClay() {}

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
    throw new Error('unexpected require: ' + name);
  }
};
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/pkjs/index.js'), 'utf8'), context);

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

console.log('HA Watch Custom validation passed');
