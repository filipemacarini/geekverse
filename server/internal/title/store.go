package title

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

func (s *Store) Create(title *domain.Title) error {
	return s.db.Create(title).Error
}

func (s *Store) FindAll(mediaType string) ([]domain.Title, error) {
	var titles []domain.Title
	query := s.db.Model(&domain.Title{})

	if mediaType != "" {
		query = query.Where("type = ?", mediaType)
	}

	err := query.Find(&titles).Error
	return titles, err
}

func (s *Store) FindByID(id uint) (*domain.Title, error) {
	var title domain.Title
	err := s.db.Preload("Contents").Preload("Genres").First(&title, id).Error
	if err != nil {
		return nil, err
	}
	return &title, nil
}

func (s *Store) Update(id uint, updates interface{}) (*domain.Title, error) {
	var title domain.Title
	if err := s.db.First(&title, id).Error; err != nil {
		return nil, err
	}

	if err := s.db.Model(&title).Updates(updates).Error; err != nil {
		return nil, err
	}
	return &title, nil
}

func (s *Store) Delete(id uint) error {
	return s.db.Delete(&domain.Title{}, id).Error
}
