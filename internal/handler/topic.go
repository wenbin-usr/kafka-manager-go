package handler

import (
	"net/http"
	"strconv"

	"kafka-manager-go/internal/model"
	"kafka-manager-go/internal/service"

	"github.com/gin-gonic/gin"
)

// TopicHandler handles topic-related API requests
type TopicHandler struct {
	store *service.ClusterStore
}

// NewTopicHandler creates a new TopicHandler
func NewTopicHandler(store *service.ClusterStore) *TopicHandler {
	return &TopicHandler{store: store}
}

// ListTopics returns all topics in a cluster
func (h *TopicHandler) ListTopics(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	topics, err := service.ListTopics(cluster.Brokers)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(topics))
}

// GetTopicDetail returns detailed information about a topic
func (h *TopicHandler) GetTopicDetail(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	topic := c.Param("topic")
	detail, err := service.GetTopicDetail(cluster.Brokers, topic)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(detail))
}

// GetTopicConfigs returns configuration entries for a topic
func (h *TopicHandler) GetTopicConfigs(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	topic := c.Param("topic")
	configs, err := service.GetTopicConfigs(cluster.Brokers, topic)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(configs))
}

// UpdateTopicConfigs updates editable topic configuration entries
func (h *TopicHandler) UpdateTopicConfigs(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	var req model.UpdateTopicConfigsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponseMsg("invalid request body"))
		return
	}

	topic := c.Param("topic")
	if err := service.UpdateTopicConfigs(cluster.Brokers, topic, req.Configs); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(nil))
}

// CreateTopic creates a new topic
func (h *TopicHandler) CreateTopic(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	var req model.CreateTopicRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponseMsg("invalid request body"))
		return
	}

	if req.PartitionCount <= 0 {
		req.PartitionCount = 3
	}
	if req.ReplicationFactor <= 0 {
		req.ReplicationFactor = 1
	}

	if err := service.CreateTopic(cluster.Brokers, req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusCreated, model.OKResponse(nil))
}

// DeleteTopic deletes a topic
func (h *TopicHandler) DeleteTopic(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	topic := c.Param("topic")
	if err := service.DeleteTopic(cluster.Brokers, topic); err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(nil))
}

func (h *TopicHandler) getCluster(c *gin.Context) (model.ClusterConfig, bool) {
	id := c.Param("id")
	cluster, ok := h.store.GetCluster(id)
	if !ok {
		c.JSON(http.StatusNotFound, model.ErrorResponseMsg("cluster not found"))
		return cluster, false
	}
	return cluster, true
}

// parseIntQueryParam parses an integer query parameter
func parseIntQueryParam(c *gin.Context, key string) *int {
	val := c.Query(key)
	if val == "" {
		return nil
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return nil
	}
	return &n
}
