package handler

import (
	"net/http"

	"kafka-manager-go/internal/model"
	"kafka-manager-go/internal/service"

	"github.com/gin-gonic/gin"
)

// BrokerHandler handles broker-related API requests
type BrokerHandler struct {
	store *service.ClusterStore
}

// NewBrokerHandler creates a new BrokerHandler
func NewBrokerHandler(store *service.ClusterStore) *BrokerHandler {
	return &BrokerHandler{store: store}
}

// ListBrokers returns all brokers in a cluster
func (h *BrokerHandler) ListBrokers(c *gin.Context) {
	cluster, ok := h.getCluster(c)
	if !ok {
		return
	}

	brokers, err := service.ListBrokers(cluster.Brokers)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(brokers))
}

func (h *BrokerHandler) getCluster(c *gin.Context) (model.ClusterConfig, bool) {
	id := c.Param("id")
	cluster, ok := h.store.GetCluster(id)
	if !ok {
		c.JSON(http.StatusNotFound, model.ErrorResponseMsg("cluster not found"))
		return cluster, false
	}
	return cluster, true
}
