// Statuswerte der Uhr fuer die MQTT-Meldung an Home Assistant.
//
// Alles steckt in einer einzigen Ganzzahl, damit die FFI-Bruecke nur einen
// Aufruf braucht:
//   Bits 0..7   Ladestand in Prozent
//   Bit 8       laedt
//   Bit 9       Ruhezeit aktiv
//   Bit 10      Bluetooth-Verbindung zur Pebble-App steht

#include <pebble.h>

int32_t watch_status_bits(void) {
  const BatteryChargeState battery = battery_state_service_peek();
  int32_t bits = battery.charge_percent & 0xFF;
  if (battery.is_charging) bits |= 1 << 8;
  if (quiet_time_is_active()) bits |= 1 << 9;
  if (connection_service_peek_pebble_app_connection()) bits |= 1 << 10;
  return bits;
}

// Weitere Gesundheitswerte fuer die MQTT-Meldung (Schritte und Distanz liest
// src/c/health.c). Rueckgabe -1, solange der Wert nicht vorliegt.
//   0 Herzfrequenz (BPM, letzter Messwert)
//   1 Schlaf heute (Sekunden)
//   2 aktive Zeit heute (Sekunden)
//   3 aktive Kalorien heute (kcal)
//   4 Grundumsatz heute (kcal)
#define HEALTH_UNAVAILABLE (-1)

static bool prv_available(HealthMetric metric) {
  const time_t now = time(NULL);
  return health_service_metric_accessible(metric, time_start_of_today(), now)
         & HealthServiceAccessibilityMaskAvailable;
}

int32_t watch_health_metric(int32_t which) {
  switch (which) {
    case 0: {
      if (!prv_available(HealthMetricHeartRateBPM)) return HEALTH_UNAVAILABLE;
      const HealthValue bpm = health_service_peek_current_value(HealthMetricHeartRateBPM);
      return bpm > 0 ? (int32_t)bpm : HEALTH_UNAVAILABLE;
    }
    case 1:
      return prv_available(HealthMetricSleepSeconds)
             ? (int32_t)health_service_sum_today(HealthMetricSleepSeconds) : HEALTH_UNAVAILABLE;
    case 2:
      return prv_available(HealthMetricActiveSeconds)
             ? (int32_t)health_service_sum_today(HealthMetricActiveSeconds) : HEALTH_UNAVAILABLE;
    case 3:
      return prv_available(HealthMetricActiveKCalories)
             ? (int32_t)health_service_sum_today(HealthMetricActiveKCalories) : HEALTH_UNAVAILABLE;
    case 4:
      return prv_available(HealthMetricRestingKCalories)
             ? (int32_t)health_service_sum_today(HealthMetricRestingKCalories) : HEALTH_UNAVAILABLE;
    default:
      return HEALTH_UNAVAILABLE;
  }
}
