package content

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

func (s *Store) CreateBatch(titleID uint, contents []domain.Content) error {
	var title domain.Title
	if err := s.db.Select("id").First(&title, titleID).Error; err != nil {
		return err
	}

	return s.db.Create(contents).Error
}

func (s *Store) UpdateBatch(items []updateItem) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			result := tx.Model(&domain.Content{ID: item.ID}).Where("id = ?", item.ID).Updates(item)
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
	result := s.db.Delete(&domain.Content{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
