// Persistiert ausschliesslich den Darstellungszustand der Uhr. Sensorwerte und
// Home-Assistant-Zugangsdaten bleiben weiterhin auf dem Telefon.

#include <pebble.h>

#define SETTINGS_KEY_BASE 7000
#define SETTINGS_KEY_MAX 32

int32_t watch_setting_read(int32_t key, int32_t fallback) {
  if (key < 0 || key > SETTINGS_KEY_MAX) return fallback;
  const uint32_t persist_key = SETTINGS_KEY_BASE + (uint32_t)key;
  return persist_exists(persist_key) ? persist_read_int(persist_key) : fallback;
}

int32_t watch_setting_write(int32_t key, int32_t value) {
  if (key < 0 || key > SETTINGS_KEY_MAX) return -1;
  const uint32_t persist_key = SETTINGS_KEY_BASE + (uint32_t)key;

  // Flash nur beschreiben, wenn sich der Wert tatsaechlich geaendert hat.
  if (persist_exists(persist_key) && persist_read_int(persist_key) == value)
    return 0;
  return persist_write_int(persist_key, value);
}
