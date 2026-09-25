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
	query := s.db.Model(&domain.Title{}).Select(`
		titles.*,
		(SELECT COUNT(id) FROM contents WHERE contents.title_id = titles.id) AS episode_count,
		EXISTS(SELECT 1 FROM contents WHERE contents.title_id = titles.id AND language = 'sub') AS has_sub,
		EXISTS(SELECT 1 FROM contents WHERE contents.title_id = titles.id AND language = 'dub') AS has_dub
	`).Preload("Genres")

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

func (s *Store) Update(id uint, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}

	result := s.db.Model(&domain.Title{ID: id}).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *Store) SetGenres(titleID uint, genreIDs []uint) error {
	genres := make([]domain.Genre, 0, len(genreIDs))
	for _, gID := range genreIDs {
		genres = append(genres, domain.Genre{ID: gID})
	}

	return s.db.Model(&domain.Title{ID: titleID}).Association("Genres").Replace(&genres)
}

func (s *Store) Delete(id uint) error {
	result := s.db.Delete(&domain.Title{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
