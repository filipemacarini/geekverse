package profile

import (
	"geekverse/internal/domain"

	"gorm.io/gorm"
)

type Store struct {
	db *gorm.DB
}

func NewStore(db *gorm.DB) *Store {
	return &Store{db: db}
}

func (s *Store) FindAll() ([]domain.Profile, error) {
	var profiles []domain.Profile
	err := s.db.Order("username ASC").Find(&profiles).Error
	return profiles, err
}

func (s *Store) FindByID(id string) (*domain.Profile, error) {
	var profile domain.Profile
	err := s.db.Preload("Arts").First(&profile, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func (s *Store) Update(id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}

	result := s.db.Model(&domain.Profile{ID: id}).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *Store) UpdateRole(id string, role string) error {
	result := s.db.Model(&domain.Profile{ID: id}).Update("role", role)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
