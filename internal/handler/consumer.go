package handler

import (
	"net/http"

	"kafka-manager-go/internal/model"
	"kafka-manager-go/internal/service"

	"github.com/gin-gonic/gin"
)

// ConsumerHandler handles consumer group-related API requests
type ConsumerHandler struct {
	store *service.ClusterStore
}

// NewConsumerHandler creates a new ConsumerHandler
func NewConsumerHandler(store *service.ClusterStore) *ConsumerHandler {
	return &ConsumerHandler{store: store}
}

// ListConsumerGroups returns all consumer groups in a cluster
func (h *ConsumerHandler) ListConsumerGroups(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	groups, err := service.ListConsumerGroups(cluster.Brokers)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(groups))
}

// GetConsumerGroupDetail returns detailed information about a consumer group
func (h *ConsumerHandler) GetConsumerGroupDetail(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	groupID := c.Param("group")
	detail, err := service.GetConsumerGroupDetail(cluster.Brokers, groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(detail))
}

// DeleteConsumerGroupOffsets deletes offsets for a consumer group
func (h *ConsumerHandler) DeleteConsumerGroupOffsets(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	groupID := c.Param("group")
	if err := service.DeleteConsumerGroupOffsets(cluster.Brokers, groupID); err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(nil))
}

func (h *ConsumerHandler) getCluster(c *gin.Context) (model.ClusterConfig, bool) {
	id := c.Param("id")
	cluster, ok := h.store.GetCluster(id)
	if !ok {
		c.JSON(http.StatusNotFound, model.ErrorResponseMsg("cluster not found"))
		return cluster, false
	}
	return cluster, true
}
