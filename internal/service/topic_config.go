package service

import (
	"context"
	"fmt"
	"sort"

	"kafka-manager-go/internal/model"

	"github.com/segmentio/kafka-go"
)

// Editable topic-level configuration keys (Kafka IncrementalAlterConfigs).
var editableTopicConfigKeys = map[string]struct{}{
	"retention.ms":         {},
	"retention.bytes":      {},
	"cleanup.policy":       {},
	"min.insync.replicas":  {},
	"max.message.bytes":    {},
	"compression.type":     {},
	"segment.ms":           {},
	"segment.bytes":        {},
	"delete.retention.ms":  {},
	"file.delete.delay.ms": {},
	"flush.messages":       {},
	"flush.ms":             {},
}

func isEditableTopicConfig(name string) bool {
	_, ok := editableTopicConfigKeys[name]
	return ok
}

// GetTopicConfigs returns all configuration entries for a topic.
func GetTopicConfigs(brokers, topic string) ([]model.TopicConfigEntry, error) {
	client := &kafka.Client{Addr: kafka.TCP(splitBrokers(brokers)...)}

	resp, err := client.DescribeConfigs(context.Background(), &kafka.DescribeConfigsRequest{
		Resources: []kafka.DescribeConfigRequestResource{{
			ResourceType: kafka.ResourceTypeTopic,
			ResourceName: topic,
		}},
		IncludeDocumentation: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to describe topic configs: %w", err)
	}

	if len(resp.Resources) == 0 {
		return nil, fmt.Errorf("topic %s not found", topic)
	}

	resource := resp.Resources[0]
	if resource.Error != nil {
		return nil, resource.Error
	}

	entries := make([]model.TopicConfigEntry, 0, len(resource.ConfigEntries))
	for _, e := range resource.ConfigEntries {
		if e.IsSensitive {
			entries = append(entries, model.TopicConfigEntry{
				Name:      e.ConfigName,
				Value:     "***",
				ReadOnly:  true,
				Sensitive: true,
				Editable:  false,
			})
			continue
		}

		defaultValue := ""
		for _, syn := range e.ConfigSynonyms {
			if syn.ConfigSource == 4 { // DEFAULT_CONFIG
				defaultValue = syn.ConfigValue
				break
			}
		}
		if defaultValue == "" && e.IsDefault {
			defaultValue = e.ConfigValue
		}

		entries = append(entries, model.TopicConfigEntry{
			Name:          e.ConfigName,
			Value:         e.ConfigValue,
			DefaultValue:  defaultValue,
			ReadOnly:      e.ReadOnly,
			Sensitive:     false,
			Documentation: e.ConfigDocumentation,
			Editable:      !e.ReadOnly && isEditableTopicConfig(e.ConfigName),
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Editable != entries[j].Editable {
			return entries[i].Editable
		}
		return entries[i].Name < entries[j].Name
	})

	return entries, nil
}

// UpdateTopicConfigs updates editable topic configuration entries.
func UpdateTopicConfigs(brokers, topic string, configs map[string]string) error {
	if len(configs) == 0 {
		return fmt.Errorf("no configs to update")
	}

	alterConfigs := make([]kafka.IncrementalAlterConfigsRequestConfig, 0, len(configs))
	for name, value := range configs {
		if !isEditableTopicConfig(name) {
			return fmt.Errorf("config %q is not editable", name)
		}
		alterConfigs = append(alterConfigs, kafka.IncrementalAlterConfigsRequestConfig{
			Name:            name,
			Value:           value,
			ConfigOperation: kafka.ConfigOperationSet,
		})
	}

	sort.Slice(alterConfigs, func(i, j int) bool {
		return alterConfigs[i].Name < alterConfigs[j].Name
	})

	client := &kafka.Client{Addr: kafka.TCP(splitBrokers(brokers)...)}
	resp, err := client.IncrementalAlterConfigs(context.Background(), &kafka.IncrementalAlterConfigsRequest{
		Resources: []kafka.IncrementalAlterConfigsRequestResource{{
			ResourceType: kafka.ResourceTypeTopic,
			ResourceName: topic,
			Configs:      alterConfigs,
		}},
	})
	if err != nil {
		return fmt.Errorf("failed to alter topic configs: %w", err)
	}

	for _, r := range resp.Resources {
		if r.Error != nil {
			return fmt.Errorf("failed to update config for %s: %w", r.ResourceName, r.Error)
		}
	}

	return nil
}
