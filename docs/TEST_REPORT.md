# HA Watch Custom Test Report

Date: 2026-10-10

## Identity and Coexistence

| Build | Display name | UUID |
|---|---|---|
| Original HA Watch 1.2.0 | HA Watch | `013f5b1c-e688-4bb5-841b-f3ca41505d23` |
| HA Watch Custom 2.0.3 | HA Watch Custom | `9698ca1b-7be6-42c5-88b5-7358678dd4c2` |

The source metadata and generated PBW metadata use the Custom UUID. Pebble
identifies installed applications by UUID, so these builds can coexist. A PBW
built before the UUID was changed must not be used for this test; install the
new `build/HAWatchCustom.pbw` artifact (version 2.0.3).

## Startup Rendering Fix

The reported default-layout flash after returning from the watch menu had a
deterministic cause. The watch process initialized `rowConfigured` as empty and
`visibility` with every information row enabled, then both the battery callback
and the end of `main.js` could draw that default state. The phone supplied the
saved configuration only afterwards through AppMessage. There is no second
renderer, old Pebble layer or duplicate window: `mdbl.c` creates one window and
all application drawing goes through the single Poco `draw()` function.

Version 2.0.3 stores the display configuration in Pebble's app-local persistent
storage and restores it before battery initialization or the first explicit
draw. This includes row modes, visibility, time/date/language formats, colors
and font style. The version marker is invalidated before an update and restored
only after all values were written successfully, so an interrupted write is
not accepted as a complete configuration. Unchanged AppMessages cause no flash
writes. Sensor values, HA credentials and refresh data are not persisted on the
watch.

On a true first installation, where no watch-local configuration can exist,
startup draws only the time until one complete phone configuration arrives.
Consequently the original default information rows and hidden entities are not
rendered even in that case. Normal minute, battery and AppMessage redraw
triggers are otherwise unchanged; no animation or additional periodic redraw
was introduced.

## Reported Watchface Switch

No code in HA Watch Custom launches or selects another application. The phone
code only opens the configuration page, reads network/location data and sends
AppMessage values to the currently running Custom UUID. Saving settings cannot
select the original HA Watch.

No physical-device crash log was available for the reported incident, so its
cause is not confirmed. Plausible explanations are explicitly hypotheses:

- The installed test PBW may have predated the Custom UUID and therefore
  replaced or conflicted with the original app identity.
- PebbleOS may have fallen back to another watchface after a Custom watchface
  crash or restart.
- Phone/watch synchronization may have restored the previously selected
  watchface independently of this application's configuration code.
- The user may have observed the original because both versions previously had
  the same visible name/author, even though the current builds are distinct.

## Stability Review

- The application starts a Moddable VM, initializes Poco and FFI, restores the
  display settings, then initializes battery and draws. Network access happens
  only in PebbleKit JS on the phone and cannot directly crash the watch renderer.
- Health and clock-style FFI calls are guarded; unavailable health data uses
  placeholders.
- AppMessage keys preserve the complete released 1.2.0 prefix and append new
  keys, preventing old sensor values from being remapped.
- Message input is 512 bytes. Current payload lengths and six bounded sensor
  values fit this allocation.
- Time fonts are now loaded lazily. Previously all six 60/68/76 px font
  variants were opened during startup even though only one or two are normally
  needed. Lazy loading reduces startup heap pressure without changing output.
- HA sensor batches and weather requests are serialized. A startup location
  callback, settings save or timer tick now queues/coalesces rather than opening
  a duplicate batch. Failed weather attempts are throttled by the configured
  interval instead of being retried by every unrelated refresh.
- Home Assistant and weather intervals are independently configurable from
  1–120 minutes, defaulting to 5 and 15 minutes. Timers are replaced rather than
  accumulated when settings change.
- The build reports 78,139 bytes of resources out of 256 KB and a native RAM
  footprint of 1,405 bytes, with approximately 130 KB reported as free heap.
  These figures do not prove the absence of a runtime Moddable heap failure,
  but they show no static resource-limit violation.

## Tests

- `npm test`: passed
- JavaScript syntax checks: passed
- Clean Pebble SDK 4.33.1 build: passed
- `emery` (Pebble Time 2) target: passed
- `gabbro` target: passed
- Generated PBW name, UUID, display name, version and author metadata: checked
- Startup persistence and first-install render guards: statically checked
- Emulator launch: not completed because the local environment lacks
  `libSDL2-2.0.so.0`; this is a host dependency failure, not an app crash
- Physical Pebble Time 2 logs: unavailable

## Feature Coverage

| Requirement | Status |
|---|---|
| German date display | Implemented and included in the watch font character set |
| German weather descriptions | Implemented for Open-Meteo and standard HA weather states |
| Open-Meteo / HA weather selection | Implemented |
| Individual information visibility | Implemented with shared-row semantics documented in the README |
| Automatic time enlargement | Implemented with 60/68/76 px resources and width fallback |
| Background and text colors | Implemented using the Pebble color palette |
| Alternative fonts | Roboto Bold and Roboto Regular implemented; no additional family bundled |
| HA refresh interval | Implemented, 1–120 minutes, default 5 |
| Weather refresh interval | Implemented, 1–120 minutes, default 15 |

No requested feature in this table is absent. Hardware behavior is still
subject to the on-device verification described below.

## Connectivity and Lifecycle

- HA requests time out after 15 seconds. A failed complete sensor batch keeps
  cached values and displays one localized error; partial success updates the
  values that arrived.
- AppMessage retries once after three seconds. During a longer Bluetooth outage
  the phone cache remains intact and the next scheduled refresh publishes the
  latest state. There is no PebbleKit JS connection-restored event used here,
  so with a 120-minute interval restoration may not be immediate.
- Weather failures are not retried in a tight loop. Open-Meteo retains the last
  successful value; unavailable HA weather is shown as a placeholder.
- Timer callbacks are bounded to two replaceable intervals. Switching away
  from a watchface is managed by PebbleOS; this project has no API call that
  selects HA Watch or any other watchface.

The SDK linker emits a warning that the generated ELF has an RWX load segment.
This is produced by the Pebble/Moddable SDK linker setup and is also present in
successful builds; no application-specific failure accompanies it.

## Open Verification

For a conclusive incident diagnosis, capture `pebble logs` while launching the
test PBW on the affected Pebble Time 2. Test a cold launch, several watchface
switches, a phone synchronization and configuration saves. Without that log,
the crash and synchronization explanations above remain hypotheses.

## Repository Preparation

- Package name, display name, UUID, author, description, license and version are
  set for HA Watch Custom.
- `package-lock.json` is intended to be tracked for reproducible dependencies.
- The original MIT license and Axel Kark copyright remain unchanged.
- The original repository is attributed in the README.
- No Appstore upload or GitHub publication was performed.
- The local Git remote still points to the original repository. Before creating
  the independent repository, configure the new repository as `origin` and keep
  the original project as an `upstream` remote.
