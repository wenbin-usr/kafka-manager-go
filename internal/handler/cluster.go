package handler

import (
	"net/http"

	"kafka-manager-go/internal/model"
	"kafka-manager-go/internal/service"

	"github.com/gin-gonic/gin"
)

// ClusterHandler handles cluster-related API requests
type ClusterHandler struct {
	store *service.ClusterStore
}

// NewClusterHandler creates a new ClusterHandler
func NewClusterHandler(store *service.ClusterStore) *ClusterHandler {
	return &ClusterHandler{store: store}
}

// ListClusters returns all configured clusters
func (h *ClusterHandler) ListClusters(c *gin.Context) {
	clusters := h.store.ListClusters()
	c.JSON(http.StatusOK, model.OKResponse(clusters))
}

// AddCluster adds a new cluster
func (h *ClusterHandler) AddCluster(c *gin.Context) {
	var req struct {
		Name    string `json:"name" binding:"required"`
		Brokers string `json:"brokers" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponseMsg("name and brokers are required"))
		return
	}

	cluster, err := h.store.AddCluster(req.Name, req.Brokers)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusCreated, model.OKResponse(cluster))
}

// RemoveCluster removes a cluster
func (h *ClusterHandler) RemoveCluster(c *gin.Context) {
	id := c.Param("id")
	if err := h.store.RemoveCluster(id); err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse(err))
		return
	}
	c.JSON(http.StatusOK, model.OKResponse(nil))
}

// GetOverview returns cluster overview
func (h *ClusterHandler) GetOverview(c *gin.Context) {
	id := c.Param("id")
	cluster, ok := h.store.GetCluster(id)
	if !ok {
		c.JSON(http.StatusNotFound, model.ErrorResponseMsg("cluster not found"))
		return
	}

	overview, err := service.GetClusterOverview(cluster.Brokers)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse(err))
		return
	}

	c.JSON(http.StatusOK, model.OKResponse(overview))
}
