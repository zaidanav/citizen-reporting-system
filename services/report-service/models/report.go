package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Report struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description" json:"description"`
	Category    string             `bson:"category" json:"category"`
	Location    string             `bson:"location,omitempty" json:"location,omitempty"`
	IsAnonymous bool               `bson:"is_anonymous" json:"is_anonymous"`
	IsPublic    bool               `bson:"is_public" json:"is_public"` // Privacy control
	ReporterID  string             `bson:"reporter_id" json:"reporter_id"`
	Reporter    string             `bson:"reporter_name" json:"reporter_name"`
	ImageURL    string             `bson:"image_url,omitempty" json:"image_url,omitempty"`
	Status      string             `bson:"status" json:"status"`
	Upvotes     int                `bson:"upvotes" json:"upvotes"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

type ReportEvent struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	IsAnonymous bool      `json:"is_anonymous"`
	ReporterID  string    `json:"reporter_id"`
	Reporter    string    `json:"reporter_name"`
	CreatedAt   time.Time `json:"created_at"`
}
