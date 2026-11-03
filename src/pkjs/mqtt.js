// MQTT-Meldung der Uhrenwerte an Home Assistant.
//
// Laeuft auf dem Telefon: die Uhr schickt ihren Status als eine Ganzzahl
// ("wstatus", siehe src/c/status.c), dieses Modul veroeffentlicht ihn ueber die
// HA-REST-API (Service mqtt.publish) und legt die Entitaeten per
// MQTT-Discovery an. URL und Token stammen aus den vorhandenen Einstellungen
// der Watchface und verlassen das Telefon nicht in Richtung Uhr.
//
// Alles hier ist abgeschottet: ein Fehler darf weder das Zifferblatt noch die
// uebrigen HA-Anfragen beeintraechtigen.

var DISCOVERY_PREFIX = 'homeassistant';
var FW_KEY = 'pebbleha_firmware';
var ANNOUNCED_KEY = 'pebbleha_announced';
var LAST_BITS_KEY = 'pebbleha_lastbits';
var LAST_HEALTH_KEY = 'pebbleha_lasthealth';
var REQUEST_TIMEOUT_MS = 15 * 1000;

var inFlight = false;
var queuedBits = null;

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'pebble';
}

// Heartbeat in Minuten fuer die Uhr; 0 heisst: MQTT aus.
function heartbeatMinutes(settings) {
  if (!settings.mqttEnabled || !settings.url || !settings.token) return 0;
  return settings.mqttHeartbeat;
}

// Gesundheitswerte mitsenden? Nur wenn MQTT laeuft und der Schalter gesetzt ist.
function healthEnabled(settings) {
  return heartbeatMinutes(settings) > 0 && !!settings.mqttHealth;
}

// Schluessel der Uhr -> Schluessel im Zustand und Objekt-ID der Entitaet.
var HEALTH_FIELDS = [
  { watch: 'wsteps', key: 'steps', name: 'Schritte', unit: 'steps', icon: 'mdi:shoe-print', cls: null, state: 'total_increasing' },
  { watch: 'wdist', key: 'distance', name: 'Distanz', unit: 'm', icon: null, cls: 'distance', state: 'total_increasing' },
  { watch: 'whr', key: 'heart_rate', name: 'Herzfrequenz', unit: 'bpm', icon: 'mdi:heart-pulse', cls: null, state: 'measurement' },
  { watch: 'wsleep', key: 'sleep_minutes', name: 'Schlafdauer', unit: 'min', icon: null, cls: 'duration', state: 'measurement' },
  { watch: 'wactive', key: 'active_minutes', name: 'Aktive Minuten', unit: 'min', icon: null, cls: 'duration', state: 'total_increasing' },
  { watch: 'wkcal', key: 'calories', name: 'Kalorien', unit: 'kcal', icon: 'mdi:fire', cls: null, state: 'total_increasing' },
  { watch: 'wkcala', key: 'calories_active', name: 'Aktive Kalorien', unit: 'kcal', icon: 'mdi:fire', cls: null, state: 'total_increasing' }
];

// Werte aus der Nachricht der Uhr; was fehlt (nicht verfuegbar), wird null.
function healthFromPayload(payload) {
  var health = {};
  HEALTH_FIELDS.forEach(function(field) {
    var value = payload[field.watch];
    health[field.key] = (typeof value === 'number' && isFinite(value)) ? value : null;
  });
  return health;
}

function haPublish(settings, topic, payload, retain, done) {
  var finished = false;
  var timer = null;
  var request = null;

  // Meldet genau einmal zurueck, egal was passiert. Haengt eine Anfrage oder
  // wirft send(), darf inFlight in send() nie dauerhaft gesetzt bleiben, sonst
  // wird nie wieder etwas gemeldet.
  function finish(ok) {
    if (finished) return;
    finished = true;
    if (timer !== null) clearTimeout(timer);
    done(ok);
  }

  try {
    request = new XMLHttpRequest();
    request.open('POST', settings.url + '/api/services/mqtt/publish', true);
    request.setRequestHeader('Authorization', 'Bearer ' + settings.token);
    request.setRequestHeader('Content-Type', 'application/json');
    request.timeout = REQUEST_TIMEOUT_MS;
    request.onload = function() {
      var ok = request.status >= 200 && request.status < 300;
      if (!ok) console.log('MQTT publish failed: ' + request.status);
      finish(ok);
    };
    request.onerror = function() { console.log('MQTT publish network error'); finish(false); };
    request.ontimeout = function() { console.log('MQTT publish timeout'); finish(false); };
    // Eigener Timer: nicht jede PebbleKit-JS-Umgebung loest xhr.timeout aus.
    timer = setTimeout(function() {
      console.log('MQTT publish stuck, giving up');
      try { request.abort(); } catch (e) { /* ignorieren */ }
      finish(false);
    }, REQUEST_TIMEOUT_MS + 5000);
    request.send(JSON.stringify({
      topic: topic,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      retain: !!retain,
      qos: 1
    }));
  } catch (e) {
    console.log('MQTT publish failed to start: ' + e.message);
    finish(false);
  }
}

// Nacheinander senden, das schont das Handy-Netz.
function publishAll(settings, items, done) {
  var index = 0;
  var allOk = true;
  (function next() {
    if (index >= items.length) { done(allOk); return; }
    var item = items[index++];
    haPublish(settings, item.topic, item.payload, item.retain, function(ok) {
      if (!ok) allOk = false;
      next();
    });
  })();
}

function watchInfo() {
  var info = {};
  try { info = Pebble.getActiveWatchInfo() || {}; } catch (e) { info = {}; }
  var fw = info.firmware || {};
  var version = [fw.major, fw.minor, fw.patch].filter(function(x) {
    return x !== undefined;
  }).join('.');
  if (fw.suffix) version += '-' + fw.suffix;
  return { version: version || 'unknown', model: info.model || '', platform: info.platform || '' };
}

// Merkt sich, wann sich die Firmware-Version zuletzt geaendert hat. Beim
// allerersten Lauf ist das der erste Sync.
function firmwareChangedAt(version) {
  var stored = null;
  try { stored = JSON.parse(localStorage.getItem(FW_KEY) || 'null'); } catch (e) { stored = null; }
  if (!stored || stored.version !== version) {
    stored = { version: version, changedAt: new Date().toISOString() };
    try { localStorage.setItem(FW_KEY, JSON.stringify(stored)); } catch (e2) { /* ignorieren */ }
  }
  return stored.changedAt;
}

function discoveryItems(settings, info, removeHealth) {
  var id = slug(settings.mqttName);
  var stateTopic = settings.mqttPrefix + '/' + id + '/state';
  var device = {
    identifiers: ['pebble_ha_sync_' + id],
    name: settings.mqttName,
    manufacturer: 'Core Devices',
    model: 'Pebble',
    sw_version: info.version
  };

  function configTopic(component, object) {
    return DISCOVERY_PREFIX + '/' + component + '/' + id + '/' + object + '/config';
  }
  function base(object, name) {
    return {
      name: name,
      unique_id: 'pebble_ha_sync_' + id + '_' + object,
      state_topic: stateTopic,
      device: device
    };
  }
  function binary(object, name, deviceClass) {
    var entity = base(object, name);
    if (deviceClass) entity.device_class = deviceClass;
    entity.value_template = '{{ value_json.' + object + ' }}';
    entity.payload_on = 'ON';
    entity.payload_off = 'OFF';
    return entity;
  }

  var battery = base('battery', 'Akku');
  battery.device_class = 'battery';
  battery.unit_of_measurement = '%';
  battery.state_class = 'measurement';
  battery.value_template = '{{ value_json.battery }}';

  var quiet = binary('quiet_time', 'Ruhezeit');
  quiet.icon = 'mdi:bell-sleep';

  var firmware = base('firmware', 'Firmware');
  firmware.value_template = '{{ value_json.firmware }}';
  firmware.json_attributes_topic = stateTopic;
  firmware.json_attributes_template = '{{ {"model": value_json.model, "platform": value_json.platform} | tojson }}';
  firmware.icon = 'mdi:chip';
  firmware.entity_category = 'diagnostic';

  var firmwareChanged = base('firmware_changed', 'Letztes Firmware-Update');
  firmwareChanged.device_class = 'timestamp';
  firmwareChanged.value_template = '{{ value_json.firmware_changed }}';
  firmwareChanged.entity_category = 'diagnostic';

  var lastSync = base('last_sync', 'Letzter Sync');
  lastSync.device_class = 'timestamp';
  lastSync.value_template = '{{ value_json.last_sync }}';
  lastSync.entity_category = 'diagnostic';

  var health = HEALTH_FIELDS.map(function(field) {
    var entity = base(field.key, field.name);
    entity.value_template = '{{ value_json.' + field.key + ' }}';
    entity.unit_of_measurement = field.unit;
    entity.state_class = field.state;
    if (field.cls) entity.device_class = field.cls;
    if (field.icon) entity.icon = field.icon;
    return { topic: configTopic('sensor', field.key), payload: entity, retain: true };
  });

  var items = [
    { topic: configTopic('sensor', 'battery'), payload: battery, retain: true },
    { topic: configTopic('binary_sensor', 'charging'), payload: binary('charging', 'Laedt', 'battery_charging'), retain: true },
    { topic: configTopic('binary_sensor', 'quiet_time'), payload: quiet, retain: true },
    { topic: configTopic('binary_sensor', 'bluetooth'), payload: binary('bluetooth', 'Bluetooth', 'connectivity'), retain: true },
    { topic: configTopic('sensor', 'firmware'), payload: firmware, retain: true },
    { topic: configTopic('sensor', 'firmware_changed'), payload: firmwareChanged, retain: true },
    { topic: configTopic('sensor', 'last_sync'), payload: lastSync, retain: true }
  ];

  // Eingeschaltet: Gesundheitssensoren anlegen. Ausgeschaltet, nachdem sie
  // angelegt waren: leere Konfiguration entfernt sie wieder aus Home Assistant.
  if (settings.mqttHealth) return items.concat(health);
  if (!removeHealth) return items;
  return items.concat(health.map(function(item) {
    return { topic: item.topic, payload: '', retain: true };
  }));
}

function onOff(flag) { return flag ? 'ON' : 'OFF'; }

function send(settings, bits, health) {
  if (inFlight) { queuedBits = { bits: bits, health: health }; return; }

  var id = slug(settings.mqttName);
  var info = watchInfo();
  var state = {
    battery: bits & 255,
    charging: onOff(bits & (1 << 8)),
    quiet_time: onOff(bits & (1 << 9)),
    bluetooth: onOff(bits & (1 << 10)),
    firmware: info.version,
    firmware_changed: firmwareChangedAt(info.version),
    model: info.model,
    platform: info.platform,
    last_sync: new Date().toISOString()
  };
  if (healthEnabled(settings)) {
    Object.keys(health).forEach(function(key) { state[key] = health[key]; });
  }

  // Discovery nur, wenn sich Name, Praefix oder Firmware geaendert haben.
  var announceKey = id + '|' + settings.mqttPrefix + '|' + info.version + '|' + (settings.mqttHealth ? 'h' : '-');
  var announced = null;
  try { announced = localStorage.getItem(ANNOUNCED_KEY); } catch (e) { announced = null; }
  var needAnnounce = announced !== announceKey;

  var wasHealth = !!announced && announced.slice(-2) === '|h';
  var items = needAnnounce ? discoveryItems(settings, info, wasHealth) : [];
  items.push({ topic: settings.mqttPrefix + '/' + id + '/state', payload: state, retain: true });

  inFlight = true;
  publishAll(settings, items, function(ok) {
    inFlight = false;
    if (ok) {
      try {
        if (needAnnounce) localStorage.setItem(ANNOUNCED_KEY, announceKey);
        localStorage.setItem(LAST_BITS_KEY, String(bits));
        localStorage.setItem(LAST_HEALTH_KEY, JSON.stringify(health));
      } catch (e) { /* ignorieren */ }
    }
    if (queuedBits !== null) {
      var next = queuedBits;
      queuedBits = null;
      send(settings, next.bits, next.health);
    }
  });
}

// Neuer Stand von der Uhr.
function handleStatus(settings, payload) {
  if (!heartbeatMinutes(settings)) return;
  var bits = payload && payload.wstatus;
  if (typeof bits !== 'number' || !isFinite(bits)) return;
  send(settings, bits, healthFromPayload(payload));
}

// Nach geaenderten Einstellungen (Name, Praefix): Discovery und letzten Stand
// erneut senden, ohne auf die Uhr zu warten.
function settingsChanged(settings) {
  try { localStorage.removeItem(ANNOUNCED_KEY); } catch (e) { /* ignorieren */ }
  if (!heartbeatMinutes(settings)) return;
  var last = null;
  try { last = parseInt(localStorage.getItem(LAST_BITS_KEY), 10); } catch (e) { last = null; }
  var health = null;
  try { health = JSON.parse(localStorage.getItem(LAST_HEALTH_KEY) || 'null'); } catch (e) { health = null; }
  if (typeof last === 'number' && isFinite(last)) send(settings, last, health || healthFromPayload({}));
}

module.exports = {
  heartbeatMinutes: heartbeatMinutes,
  healthEnabled: healthEnabled,
  handleStatus: handleStatus,
  settingsChanged: settingsChanged,
  slug: slug
};
