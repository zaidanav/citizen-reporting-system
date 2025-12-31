package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Report struct {
	ID                  primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title               string             `bson:"title" json:"title"`
	Description         string             `bson:"description" json:"description"`
	Category            string             `bson:"category" json:"category"`
	Location            string             `bson:"location,omitempty" json:"location,omitempty"`
	IsAnonymous         bool               `bson:"is_anonymous" json:"is_anonymous"`
	IsPublic            bool               `bson:"is_public" json:"is_public"`
	AssignedDepartments []string           `bson:"assigned_departments" json:"assigned_departments"`
	ReporterID          string             `bson:"reporter_id" json:"reporter_id"`
	// ReporterIDEnc stores the real reporter user id encrypted (AES-GCM) for anonymous reports.
	// It is never returned in any API response.
	ReporterIDEnc string     `bson:"reporter_id_enc,omitempty" json:"-"`
	Reporter      string     `bson:"reporter_name" json:"reporter_name"`
	ImageURL      string     `bson:"image_url,omitempty" json:"image_url,omitempty"`
	Status        string     `bson:"status" json:"status"`
	Upvotes       int        `bson:"upvotes" json:"upvotes"`
	UpvotedBy     []string   `bson:"upvoted_by,omitempty" json:"-"`
	HasUpvoted    bool       `bson:"-" json:"has_upvoted,omitempty"`
	CreatedAt     time.Time  `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `bson:"updated_at" json:"updated_at"`
	SlaDeadline   *time.Time `bson:"sla_deadline,omitempty" json:"sla_deadline,omitempty"`
	IsEscalated   bool       `bson:"is_escalated" json:"is_escalated"`
	EscalatedAt   *time.Time `bson:"escalated_at,omitempty" json:"escalated_at,omitempty"`
	EscalatedBy   string     `bson:"escalated_by,omitempty" json:"escalated_by,omitempty"`
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
