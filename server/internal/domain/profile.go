package domain

import "time"

type Profile struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey" validate:"required"`
	Username  string    `json:"username" gorm:"type:varchar(50);unique;not null" validate:"required,min=4,max=50"`
	Email     string    `json:"email" gorm:"type:varchar(100);unique;not null" validate:"required,email"`
	AvatarURL string    `json:"avatar_url" gorm:"type:text" validate:"omitempty,url"`
	Role      string    `json:"role" gorm:"type:varchar(20);not null;default:'user';check:role IN ('user', 'moderator', 'content_manager', 'admin')" validate:"required,oneof=user moderator content_manager admin"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`

	Arts      []Art      `json:"arts,omitempty" gorm:"foreignKey:ProfileID;constraint:OnDelete:CASCADE"`
	Favorites []Favorite `json:"favorites,omitempty" gorm:"foreignKey:ProfileID;constraint:OnDelete:CASCADE"`
}
