package handler

import (
	"net/http"
	"strconv"

	"kafka-manager-go/internal/model"
	"kafka-manager-go/internal/service"

	"github.com/gin-gonic/gin"
)

// MessageHandler handles message-related API requests
type MessageHandler struct {
	store *service.ClusterStore
}

// NewMessageHandler creates a new MessageHandler
func NewMessageHandler(store *service.ClusterStore) *MessageHandler {
	return &MessageHandler{store: store}
}

// ReadMessages reads messages from a topic
func (h *MessageHandler) ReadMessages(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	topic := c.Param("topic")

	query := model.MessageQuery{
		ValueFilter: c.Query("valueFilter"),
	}

	if p := parseIntQueryParam(c, "partition"); p != nil {
		query.Partition = p
	}

	if s := c.Query("startOffset"); s != "" {
		if n, err := strconv.ParseInt(s, 10, 64); err == nil {
			query.StartOffset = n
		}
	} else {
		// Negative means "read from the end of the partition" (service default).
		query.StartOffset = -1
	}

	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			query.Limit = n
		}
	}

	messages, err := service.ReadMessages(cluster.Brokers, topic, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(messages))
}

// ProduceMessage sends a message to a topic
func (h *MessageHandler) ProduceMessage(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	var req model.ProduceMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponseMsg("invalid request body"))
		return
	}

	topic := c.Param("topic")
	result, err := service.ProduceMessage(cluster.Brokers, topic, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(result))
}

func (h *MessageHandler) getCluster(c *gin.Context) (model.ClusterConfig, bool) {
	id := c.Param("id")
	cluster, ok := h.store.GetCluster(id)
	if !ok {
		c.JSON(http.StatusNotFound, model.ErrorResponseMsg("cluster not found"))
		return cluster, false
	}
	return cluster, true
}
