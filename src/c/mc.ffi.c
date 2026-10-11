/* FFI GENERATED FILE; DO NOT EDIT! */

#include "xsffi.h"

txAPI* XS = NULL;

extern int32_t health_steps_today();
extern int32_t health_distance_today();
extern int32_t clock_is_24h();
extern int32_t watch_setting_read(int32_t arg0, int32_t arg1);
extern int32_t watch_setting_write(int32_t arg0, int32_t arg1);

static void xs_health_steps_today(txMachine* the) {
	int32_t result = health_steps_today();
	XS->fromInteger(the, mxResult, (txInteger)result);
}

static void xs_health_distance_today(txMachine* the) {
	int32_t result = health_distance_today();
	XS->fromInteger(the, mxResult, (txInteger)result);
}

static void xs_clock_is_24h(txMachine* the) {
	int32_t result = clock_is_24h();
	XS->fromInteger(the, mxResult, (txInteger)result);
}

static void xs_watch_setting_read(txMachine* the) {
	int32_t arg0 = (int32_t)XS->toInteger(the, mxArgv(0));
	int32_t arg1 = (int32_t)XS->toInteger(the, mxArgv(1));
	int32_t result = watch_setting_read(arg0, arg1);
	XS->fromInteger(the, mxResult, (txInteger)result);
}

static void xs_watch_setting_write(txMachine* the) {
	int32_t arg0 = (int32_t)XS->toInteger(the, mxArgv(0));
	int32_t arg1 = (int32_t)XS->toInteger(the, mxArgv(1));
	int32_t result = watch_setting_write(arg0, arg1);
	XS->fromInteger(the, mxResult, (txInteger)result);
}

void fxBuildFFI(txMachine* the, txAPI* api) {
	XS = api;
	XS->newHostFunction(the, xs_health_steps_today, 0, 0, 0);
	XS->push(the, mxThis);
	XS->defineID(the, XS->id(the, "health_steps_today"), 0, 0x0E);
	XS->pop(the);
	XS->newHostFunction(the, xs_health_distance_today, 0, 0, 0);
	XS->push(the, mxThis);
	XS->defineID(the, XS->id(the, "health_distance_today"), 0, 0x0E);
	XS->pop(the);
	XS->newHostFunction(the, xs_clock_is_24h, 0, 0, 0);
	XS->push(the, mxThis);
	XS->defineID(the, XS->id(the, "clock_is_24h"), 0, 0x0E);
	XS->pop(the);
	XS->newHostFunction(the, xs_watch_setting_read, 2, 0, 0);
	XS->push(the, mxThis);
	XS->defineID(the, XS->id(the, "watch_setting_read"), 0, 0x0E);
	XS->pop(the);
	XS->newHostFunction(the, xs_watch_setting_write, 2, 0, 0);
	XS->push(the, mxThis);
	XS->defineID(the, XS->id(the, "watch_setting_write"), 0, 0x0E);
	XS->pop(the);
}
