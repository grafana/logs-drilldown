package log

import (
	"log"
	"sync/atomic"
	"time"

	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
)

type AppLogger struct {
	labels  model.LabelSet
	levels  map[model.LabelValue]model.LabelSet
	logger  Logger
	sleepFn func()

	// Static-mode state. When static is non-nil, Now() returns timestamps
	// derived from the virtual clock, Sleep() advances the iteration counter
	// (with a small real-time throttle), and Done() reports when this logger
	// has emitted enough logs to cover the configured window.
	static      *StaticConfig
	staticIdx   atomic.Int64
	staticIters int64
}

func NewAppLogger(labels model.LabelSet, logger Logger) *AppLogger {
	levels := map[model.LabelValue]model.LabelSet{
		DEBUG: labels.Merge(model.LabelSet{"level": DEBUG}),
		INFO:  labels.Merge(model.LabelSet{"level": INFO}),
		WARN:  labels.Merge(model.LabelSet{"level": WARN}),
		ERROR: labels.Merge(model.LabelSet{"level": ERROR}),
	}
	app := &AppLogger{
		labels:  labels,
		levels:  levels,
		logger:  logger,
		sleepFn: LogSleep,
	}
	if cfg := CurrentStatic(); cfg != nil {
		app.static = cfg
		app.staticIters = staticIters()
	}
	return app
}

// SetSleep sets the sleep function used by Sleep(). When nil, uses LogSleep.
// In static mode, the configured sleepFn is ignored.
func (app *AppLogger) SetSleep(fn func()) {
	if fn != nil {
		app.sleepFn = fn
	} else {
		app.sleepFn = LogSleep
	}
}

// Sleep advances the loop. In live mode it calls the configured sleep
// function; in static mode it bumps the virtual clock and pauses briefly to
// avoid overwhelming the ingester.
func (app *AppLogger) Sleep() {
	if app.static != nil {
		app.staticIdx.Add(1)
		if app.static.Throttle > 0 {
			time.Sleep(app.static.Throttle)
		}
		return
	}
	app.sleepFn()
}

// Now returns the timestamp this logger should use for its next log line.
// In live mode this is wall time; in static mode it is start + idx*step.
func (app *AppLogger) Now() time.Time {
	if app.static == nil {
		return time.Now()
	}
	idx := app.staticIdx.Load()
	return app.static.Start.Add(time.Duration(idx) * app.static.Step)
}

// Done reports whether this AppLogger has produced enough logs in static
// mode. Always false in live mode so existing context-driven loops keep
// running.
func (app *AppLogger) Done() bool {
	if app.static == nil {
		return false
	}
	return app.staticIdx.Load() >= app.staticIters
}

func (app *AppLogger) Log(level model.LabelValue, t time.Time, message string) {
	labels, ok := app.levels[level]
	if !ok {
		labels = app.labels
	}
	err := app.logger.Handle(labels, t, message)
	if err != nil {
		log.Printf("Error logging message: %s", err)
	}
}

func (app *AppLogger) LogWithMetadata(level model.LabelValue, t time.Time, message string, metadata push.LabelsAdapter) {
	labels, ok := app.levels[level]
	if !ok {
		labels = app.labels
	}
	err := app.logger.HandleWithMetadata(labels, t, message, metadata)
	if err != nil {
		log.Printf("Error logging message: %s", err)
	}
}
