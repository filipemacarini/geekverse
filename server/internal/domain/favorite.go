package domain

import "time"

type Favorite struct {
	ProfileID string    `json:"profile_id" gorm:"type:uuid;primaryKey"`
	TitleID   uint      `json:"title_id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
}
