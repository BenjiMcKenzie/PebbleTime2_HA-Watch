/* Clay configuration. Built for the selected UI language when the page opens. */

function option(label, value) {
  return { label: label, value: value };
}

function input(messageKey, label, placeholder, type) {
  return {
    type: 'input',
    messageKey: messageKey,
    label: label,
    defaultValue: '',
    attributes: {
      placeholder: placeholder,
      type: type || 'text',
      autocorrect: 'off',
      autocapitalize: 'off'
    }
  };
}

function numberInput(messageKey, label, defaultValue, description) {
  return {
    type: 'input',
    messageKey: messageKey,
    label: label,
    description: description,
    defaultValue: String(defaultValue),
    attributes: { type: 'number', min: 1, max: 120, step: 1 }
  };
}

function sensorItems(t, leftSlot, rightSlot) {
  return [
    input('entity' + leftSlot, t.leftEntity, 'sensor.outside_temperature'),
    input('unit' + leftSlot, t.leftUnit, t.auto),
    input('entity' + rightSlot, t.rightEntity, 'sensor.humidity'),
    input('unit' + rightSlot, t.rightUnit, t.auto)
  ];
}

function section(title, items) {
  return { type: 'section', items: [{ type: 'heading', defaultValue: title }].concat(items) };
}

var TEXT = {
  en: {
    intro: 'Configure Home Assistant, weather, visible information and the appearance of the watch face. Existing connection and sensor settings are retained.',
    languageDate: 'Language and date', language: 'Language', automatic: 'Automatic (phone)', german: 'German', english: 'English',
    timeFormat: 'Time format', followWatch: 'Follow the watch', hours24: '24 hours', hours12: '12 hours (am/pm)', dateFormat: 'Date format', auto: 'Automatic', original: 'Original',
    connection: 'Home Assistant connection', connectionHelp: 'Use a URL reachable from the phone. The token is stored only by PebbleKit JS on the phone and is never sent to the watch.', token: 'Access token', haInterval: 'HA refresh interval (minutes)', intervalRange: '1–120 minutes. Short intervals use more phone and watch battery.',
    weather: 'Weather', weatherSource: 'Weather source', openMeteo: 'Open-Meteo (default)', homeAssistant: 'Home Assistant', weatherEntity: 'Weather entity ID', weatherHelp: 'Home Assistant reads only the configured weather entity\'s current state, temperature and temperature unit. It reuses the connection above and does not need a location for weather.', temperature: 'Temperature unit', weatherInterval: 'Weather refresh interval (minutes)', celsius: 'Celsius (°C)', fahrenheit: 'Fahrenheit (°F)',
    infoLines: 'Information lines', visibilityHelp: 'The weather/first HA line and activity/second HA line share their existing display areas. The relevant content switch is used, so no duplicate row is created.', showDate: 'Date', showTop: 'Top HA line / sunrise and sunset', showWeather: 'Weather (when no first-line HA sensors are configured)', showExtraHa: 'Additional HA sensor lines', showActivity: 'Steps and distance (when no second-line HA sensors are configured)', showBattery: 'Battery level',
    combineBatterySteps: 'Show battery and steps in one line (replaces distance)',
    showPhoneBattery: 'Phone battery next to the watch battery (if the Pebble app provides it)',
    topLine: 'Top line / sunrise and sunset', middleLine: 'Weather / first HA line', bottomLine: 'Activity / second HA line', lineHelp: 'A line with configured entities shows Home Assistant values. An empty line uses its named default. One entity uses the full width.', leftEntity: 'Left entity ID', rightEntity: 'Right entity ID', leftUnit: 'Left unit', rightUnit: 'Right unit',
    layout: 'Time and layout', font: 'Time font', bold: 'Roboto Bold (original)', regular: 'Roboto Regular', layoutHelp: 'The time remains visible. It is centered and grows automatically as information is hidden.',
    colors: 'Colors and fonts', background: 'Background', timeColor: 'Time', infoColor: 'Additional information', accentColor: 'Units and hints', colorHelp: 'Colors are limited to the 64-color Pebble Time 2 palette. The original white, black and gray design remains the default.',
    save: 'Save'
  },
  de: {
    intro: 'Home Assistant, Wetter, sichtbare Informationen und das Aussehen des Zifferblatts konfigurieren. Bestehende Verbindungs- und Sensoreinstellungen bleiben erhalten.',
    languageDate: 'Sprache und Datum', language: 'Sprache', automatic: 'Automatisch (Smartphone)', german: 'Deutsch', english: 'Englisch',
    timeFormat: 'Zeitformat', followWatch: 'Einstellung der Uhr', hours24: '24 Stunden', hours12: '12 Stunden (am/pm)', dateFormat: 'Datumsformat', auto: 'Automatisch', original: 'Original',
    connection: 'Home-Assistant-Verbindung', connectionHelp: 'Eine vom Smartphone erreichbare URL verwenden. Das Token wird nur durch PebbleKit JS auf dem Smartphone gespeichert und niemals an die Uhr gesendet.', token: 'Zugriffstoken', haInterval: 'HA-Aktualisierungsintervall (Minuten)', intervalRange: '1–120 Minuten. Kurze Intervalle benötigen mehr Smartphone- und Uhrenakku.',
    weather: 'Wetter', weatherSource: 'Wetterquelle', openMeteo: 'Open-Meteo (Standard)', homeAssistant: 'Home Assistant', weatherEntity: 'Weather-Entitäts-ID', weatherHelp: 'Home Assistant liest nur Zustand, aktuelle Temperatur und Temperatureinheit der konfigurierten Weather-Entität. Die obige Verbindung wird wiederverwendet; für das Wetter ist kein Standort nötig.', temperature: 'Temperatureinheit', weatherInterval: 'Wetter-Aktualisierungsintervall (Minuten)', celsius: 'Celsius (°C)', fahrenheit: 'Fahrenheit (°F)',
    infoLines: 'Informationszeilen', visibilityHelp: 'Wetter/erste HA-Zeile und Aktivität/zweite HA-Zeile teilen ihre bisherigen Anzeigebereiche. Es gilt jeweils der passende Inhaltsschalter, sodass keine Zeile doppelt erscheint.', showDate: 'Datum', showTop: 'Oberste HA-Zeile / Sonnenauf- und -untergang', showWeather: 'Wetter (wenn die erste HA-Zeile leer ist)', showExtraHa: 'Weitere HA-Sensorzeilen', showActivity: 'Schritte und Entfernung (wenn die zweite HA-Zeile leer ist)', showBattery: 'Akkustand',
    combineBatterySteps: 'Akku und Schritte in einer Zeile (ersetzt die Entfernung)',
    showPhoneBattery: 'Handy-Akku neben dem Uhrenakku (wenn die Pebble-App ihn bereitstellt)',
    topLine: 'Oberste Zeile / Sonne', middleLine: 'Wetter / erste HA-Zeile', bottomLine: 'Aktivität / zweite HA-Zeile', lineHelp: 'Eine Zeile mit Entitäten zeigt Home-Assistant-Werte. Eine leere Zeile nutzt die genannte Vorgabe. Eine einzelne Entität erhält die volle Breite.', leftEntity: 'Linke Entitäts-ID', rightEntity: 'Rechte Entitäts-ID', leftUnit: 'Linke Einheit', rightUnit: 'Rechte Einheit',
    layout: 'Uhrzeit und Layout', font: 'Schrift der Uhrzeit', bold: 'Roboto Fett (Original)', regular: 'Roboto Regular', layoutHelp: 'Die Uhrzeit bleibt immer sichtbar. Sie wird automatisch zentriert und wächst, wenn Informationen ausgeblendet werden.',
    colors: 'Farben und Schriftarten', background: 'Hintergrund', timeColor: 'Uhrzeit', infoColor: 'Zusatzinformationen', accentColor: 'Einheiten und Hinweise', colorHelp: 'Die Farben sind auf die 64-Farben-Palette der Pebble Time 2 begrenzt. Das ursprüngliche Design in Weiß, Schwarz und Grau bleibt Standard.',
    save: 'Speichern'
  }
};

module.exports = function buildConfig(language) {
  var t = TEXT[language] || TEXT.en;
  var config = [
    { type: 'heading', defaultValue: 'HA Watch Custom' },
    { type: 'text', defaultValue: t.intro },
    section(t.languageDate, [
      { type: 'select', messageKey: 'languageSetting', label: t.language, defaultValue: 'auto', options: [option(t.automatic, 'auto'), option(t.german, 'de'), option(t.english, 'en')] },
      { type: 'select', messageKey: 'timeFormat', label: t.timeFormat, defaultValue: 'watch', options: [option(t.followWatch, 'watch'), option(t.hours24, '24'), option(t.hours12, '12')] },
      { type: 'select', messageKey: 'dateFormat', label: t.dateFormat, defaultValue: 'auto', options: [option(t.automatic, 'auto'), option('Fr, 9. Okt', 'dayMonth'), option('Fri, Oct 9', 'monthDay'), option('Fr, 09.10.', 'numericDe'), option('Fri, 10/09', 'numericUs'), option('2026-10-09', 'iso'), option(t.original, 'classic')] }
    ]),
    section(t.connection, [
      { type: 'text', defaultValue: t.connectionHelp },
      input('haUrl', 'URL', 'https://ha.example.org', 'url'),
      input('haToken', t.token, 'eyJhbGciOi...'),
      numberInput('haRefreshMinutes', t.haInterval, 5, t.intervalRange)
    ]),
    section(t.weather, [
      { type: 'text', defaultValue: t.weatherHelp },
      { type: 'select', messageKey: 'weatherSource', label: t.weatherSource, defaultValue: 'openmeteo', options: [option(t.openMeteo, 'openmeteo'), option(t.homeAssistant, 'ha')] },
      input('weatherEntity', t.weatherEntity, 'weather.weather_fusion_ai_home'),
      { type: 'select', messageKey: 'tempUnit', label: t.temperature, defaultValue: 'auto', options: [option(t.automatic, 'auto'), option(t.celsius, 'celsius'), option(t.fahrenheit, 'fahrenheit')] },
      numberInput('weatherRefreshMinutes', t.weatherInterval, 15, t.intervalRange)
    ]),
    section(t.infoLines, [
      { type: 'text', defaultValue: t.visibilityHelp },
      { type: 'toggle', messageKey: 'showDate', label: t.showDate, defaultValue: true },
      { type: 'toggle', messageKey: 'showTop', label: t.showTop, defaultValue: true },
      { type: 'toggle', messageKey: 'showWeather', label: t.showWeather, defaultValue: true },
      { type: 'toggle', messageKey: 'showExtraHa', label: t.showExtraHa, defaultValue: true },
      { type: 'toggle', messageKey: 'showActivity', label: t.showActivity, defaultValue: true },
      { type: 'toggle', messageKey: 'showBattery', label: t.showBattery, defaultValue: true },
      { type: 'toggle', messageKey: 'combineBatterySteps', label: t.combineBatterySteps, defaultValue: false },
      { type: 'toggle', messageKey: 'showPhoneBattery', label: t.showPhoneBattery, defaultValue: true }
    ]),
    section(t.topLine, [{ type: 'text', defaultValue: t.lineHelp }].concat(sensorItems(t, '3', '4'))),
    section(t.middleLine, sensorItems(t, '1', '2')),
    section(t.bottomLine, sensorItems(t, '5', '6')),
    section(t.layout, [
      { type: 'text', defaultValue: t.layoutHelp },
      { type: 'select', messageKey: 'fontStyle', label: t.font, defaultValue: 'bold', options: [option(t.bold, 'bold'), option(t.regular, 'regular')] }
    ]),
    section(t.colors, [
      { type: 'text', defaultValue: t.colorHelp },
      { type: 'color', messageKey: 'backgroundColor', label: t.background, defaultValue: 'ffffff', sunlight: false },
      { type: 'color', messageKey: 'timeColor', label: t.timeColor, defaultValue: '000000', sunlight: false },
      { type: 'color', messageKey: 'infoColor', label: t.infoColor, defaultValue: '000000', sunlight: false },
      { type: 'color', messageKey: 'accentColor', label: t.accentColor, defaultValue: '787878', sunlight: false }
    ]),
    { type: 'submit', defaultValue: t.save }
  ];
  return config;
};
