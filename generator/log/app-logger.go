package log

import (
	"log"
	"time"

	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
)

type AppLogger struct {
	labels model.LabelSet
	levels map[model.LabelValue]model.LabelSet
	logger Logger
}

func NewAppLogger(labels model.LabelSet, logger Logger) *AppLogger {
	levels := map[model.LabelValue]model.LabelSet{
		DEBUG: labels.Merge(model.LabelSet{"level": DEBUG}),
		INFO:  labels.Merge(model.LabelSet{"level": INFO}),
		WARN:  labels.Merge(model.LabelSet{"level": WARN}),
		ERROR: labels.Merge(model.LabelSet{"level": ERROR}),
	}
	return &AppLogger{
		labels: labels,
		levels: levels,
		logger: logger,
	}
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
