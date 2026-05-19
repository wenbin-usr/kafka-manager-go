package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"

	"kafka-manager-go/internal/handler"
	"kafka-manager-go/internal/middleware"
	"kafka-manager-go/internal/service"

	"github.com/gin-gonic/gin"
)

//go:embed web/dist/*
var staticFiles embed.FS

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "18855"
	}

	store := service.NewClusterStore()

	clusterHandler := handler.NewClusterHandler(store)
	brokerHandler := handler.NewBrokerHandler(store)
	topicHandler := handler.NewTopicHandler(store)
	consumerHandler := handler.NewConsumerHandler(store)
	messageHandler := handler.NewMessageHandler(store)

	r := gin.Default()
	r.Use(middleware.CORS())

	// API routes
	api := r.Group("/api")
	{
		// Clusters
		api.GET("/clusters", clusterHandler.ListClusters)
		api.POST("/clusters", clusterHandler.AddCluster)
		api.DELETE("/clusters/:id", clusterHandler.RemoveCluster)
		api.GET("/clusters/:id/overview", clusterHandler.GetOverview)
		api.GET("/clusters/:id/brokers", brokerHandler.ListBrokers)

		// Topics
		api.GET("/clusters/:id/topics", topicHandler.ListTopics)
		api.GET("/clusters/:id/topics/:topic", topicHandler.GetTopicDetail)
		api.GET("/clusters/:id/topics/:topic/configs", topicHandler.GetTopicConfigs)
		api.PUT("/clusters/:id/topics/:topic/configs", topicHandler.UpdateTopicConfigs)
		api.POST("/clusters/:id/topics", topicHandler.CreateTopic)
		api.DELETE("/clusters/:id/topics/:topic", topicHandler.DeleteTopic)

		// Consumer Groups
		api.GET("/clusters/:id/consumer-groups", consumerHandler.ListConsumerGroups)
		api.GET("/clusters/:id/consumer-groups/:group", consumerHandler.GetConsumerGroupDetail)
		api.DELETE("/clusters/:id/consumer-groups/:group", consumerHandler.DeleteConsumerGroupOffsets)

		// Messages
		api.GET("/clusters/:id/topics/:topic/messages", messageHandler.ReadMessages)
		api.POST("/clusters/:id/topics/:topic/messages", messageHandler.ProduceMessage)
	}

	// Serve frontend static files
	setupStaticFiles(r)

	log.Printf("Kafka Manager starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func setupStaticFiles(r *gin.Engine) {
	// Try embedded files first (production build)
	distFS, err := fs.Sub(staticFiles, "web/dist")
	if err == nil {
		// Check if index.html exists in embedded fs
		if _, err := fs.Stat(distFS, "index.html"); err == nil {
			r.NoRoute(func(c *gin.Context) {
				// Try serving the static file
				path := c.Request.URL.Path
				f, err := distFS.Open(path[1:]) // Remove leading /
				if err == nil {
					f.Close()
					c.Header("Cache-Control", "no-cache")
					http.FileServer(http.FS(distFS)).ServeHTTP(c.Writer, c.Request)
					return
				}
				// SPA fallback: serve index.html for all unmatched routes
				c.Header("Cache-Control", "no-cache")
				c.FileFromFS("/", http.FS(distFS))
			})
			fmt.Println("Serving embedded frontend")
			return
		}
	}

	// Fallback: serve from local web/dist directory (development)
	if _, err := os.Stat("web/dist"); err == nil {
		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path
			filePath := "web/dist" + path
			if _, err := os.Stat(filePath); err == nil && path != "/" {
				c.Header("Cache-Control", "no-cache")
				c.File(filePath)
				return
			}
			// SPA fallback
			c.Header("Cache-Control", "no-cache")
			c.File("web/dist/index.html")
		})
		fmt.Println("Serving frontend from web/dist")
		return
	}

	fmt.Println("No frontend found. Run: scripts/build-frontend.ps1 (Windows) or make build-frontend")
}
