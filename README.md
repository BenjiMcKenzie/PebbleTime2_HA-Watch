# HA Watch Custom

*Your Home Assistant sensors next to the time.*

HA Watch Custom is a configurable Pebble watchface for Pebble Time 2 (`emery`) and
Pebble Round 2 (`gabbro`). It combines the time with Home Assistant sensors,
weather, sunrise/sunset, Pebble Health and battery information.

Custom version author: **Benji McKenzie**.

This project is an extended version of the original
[HA Watch](https://github.com/ProggroP/HAWatch). It uses its own application
name and UUID, so HA Watch Custom can be installed alongside the original.

## Features

- English, German or automatic language selection based on the phone
- Localized weekday/month names, date formats and weather descriptions
- Open-Meteo weather (default) or a configurable Home Assistant `weather.*`
  entity using the existing HA URL and long-lived access token
- Independent Home Assistant and weather refresh intervals from 1–120 minutes
  (defaults: 5 and 15 minutes)
- Three existing Home Assistant information lines with up to two entities each
- Individual visibility controls for date, top line/sun times, weather,
  additional HA lines, steps/distance and battery
- Dynamic 60/68/76 px time size and automatic vertical centering
- Configurable background, time, information and accent colors from the Pebble
  color palette
- Original Roboto Bold time font or Roboto Regular
- Watch, forced 24-hour or forced 12-hour time format

The original white/black/gray appearance, all information lines, Open-Meteo,
Roboto Bold and the previous time size remain the defaults.

## Display Areas

The watchface retains its existing physical structure. A configured line shows
HA sensors; an empty line uses its default:

| Area | Default when empty | Visibility control |
|---|---|---|
| Above the time | Sunrise and sunset | Top line / sunrise and sunset |
| First line below | Current weather | Weather, or Additional HA lines when configured |
| Second line below | Steps and distance | Steps and distance, or Additional HA lines when configured |

This content-based behavior keeps the existing sensor slots compatible and
prevents duplicate rows where defaults and HA values share one display area.
The time is always visible.

## Home Assistant Weather

Select **Home Assistant** under **Weather** and enter an entity such as
`weather.weather_fusion_ai_home`. HA Watch Custom requests exactly that entity through
`/api/states/<entity_id>` and reads only values the entity actually exposes:

- state: current weather condition
- `attributes.temperature`: current temperature
- `attributes.temperature_unit`: source unit used for conversion

Forecast values are not inferred. Missing, `unknown` or `unavailable` values
show the normal weather placeholder. Explicit Celsius/Fahrenheit settings are
honored; automatic follows the phone region. HA weather itself requires no
location request. Location is still requested when Open-Meteo or the local
sunrise/sunset calculation is visible.

## Settings and Updates

All settings are available from the watchface settings page in the Pebble app,
organized into language/date, connection, weather, information lines, time and
layout, and colors/fonts.

Settings remain in PebbleKit JS local storage on the phone. Version 2 keeps the
existing `clay-settings` keys, HA URL/token and the six established sensor
slots. New settings receive defaults when upgrading. The HA token is never
sent to the watch or included in the source/build.

Changing the language updates the watch after saving. The settings page uses
the newly selected language the next time it is opened.

## Technical Notes

- Pebble Time 2 has a 200 x 228 color display. The renderer measures the chosen
  time font and falls back one size in 12-hour layouts if the suffix would not
  fit.
- Colors are quantized by Clay/Pebble to the supported 64-color palette.
- Roboto Regular is offered as the lightweight alternative because it is
  already bundled and includes Basic Latin plus Latin-1 Supplement (including
  German umlauts). Additional font families were deliberately not bundled to
  avoid unnecessary application/resource growth.
- Long sensor values and weather text are truncated to prevent overlap.
- A failed HA sensor refresh keeps the last successful values and displays one
  localized connection warning. Missing HA weather is cleared instead of
  inventing a value.
- HA and weather refreshes are serialized per source, so timer, location and
  settings events cannot start duplicate request batches.

## Build and Test

Install the current [Pebble SDK](https://developer.repebble.com/sdk/), then run:

```bash
npm install
npm test
pebble build
```

The build targets both supported platforms and creates
`build/HAWatchCustom.pbw`.
The current implementation was verified with Pebble SDK 4.33.1; the project
also retains the SDK 3 application format expected by Pebble/RePebble.
Detailed compatibility and incident findings are recorded in
[`docs/TEST_REPORT.md`](docs/TEST_REPORT.md).

To test on the Pebble Time 2 emulator:

```bash
pebble install --emulator emery
```

## Install on Pebble Time 2

1. Build the project or obtain `HAWatchCustom.pbw` from a trusted release artifact.
2. Open the `.pbw` with the Pebble/RePebble mobile app, or use the SDK's
   `pebble install` workflow for a connected device.
3. Open HA Watch Custom settings in the Pebble app.
4. Enter the externally reachable Home Assistant URL and a long-lived access
   token if HA sensors or HA weather are required.
5. Choose the weather source and entity, then save.

## Credits

- HA Watch Custom development: Benji McKenzie
- Original project: [HA Watch](https://github.com/ProggroP/HAWatch),
  Copyright (c) 2026 Axel Kark
- Weather data: [Open-Meteo](https://open-meteo.com), CC BY 4.0
- Font: Roboto by Christian Robertson, Apache License 2.0

## License

MIT License, see [LICENSE](LICENSE). The bundled fonts are not covered by it and
remain under their own licenses.
