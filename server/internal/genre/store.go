package genre

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

func (s *Store) FindAll() ([]domain.Genre, error) {
	var genres []domain.Genre
	err := s.db.Order("name ASC").Find(&genres).Error
	return genres, err
}

func (s *Store) CreateBatch(genres []domain.Genre) error {
	return s.db.Create(&genres).Error
}

func (s *Store) UpdateBatch(items []updateItem) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			result := tx.Model(&domain.Genre{ID: item.ID}).Updates(item)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return gorm.ErrRecordNotFound
			}
		}
		return nil
	})
}

func (s *Store) Delete(id uint) error {
	result := s.db.Delete(&domain.Genre{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
