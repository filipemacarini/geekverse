package title

import (
	"encoding/json"
	"errors"
	"geekverse/internal/domain"
	"geekverse/internal/platform/httperr"
	"geekverse/internal/platform/validator"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"gorm.io/gorm"
)

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

type createRequest struct {
	Name            string `json:"name" validate:"required,min=2,max=150" example:"Solo Leveling"`
	Synopsis        string `json:"synopsis" example:"O caçador mais fraco do mundo..."`
	CoverURL        string `json:"cover_url" validate:"required,url" example:"https://exemplo.com/capa.jpg"`
	BannerURL       string `json:"banner_url" validate:"omitempty,url" example:"https://exemplo.com/banner.jpg"`
	Type            string `json:"type" validate:"required,oneof=anime manga novel" example:"anime"`
	AgeRating       string `json:"age_rating" validate:"required,oneof=L 12 14 16 18" example:"16"`
	Status          string `json:"status" validate:"required,oneof=releasing completed" example:"releasing"`
	Source          string `json:"source" example:"ID000001"`
	PublicationYear int    `json:"publication_year" validate:"required" example:"2024"`

	GenreIDs []uint `json:"genre_ids" example:"[1, 3]"`
}

type updateRequest struct {
	Name            *string `json:"name,omitempty" validate:"omitempty,min=2,max=150"`
	Synopsis        *string `json:"synopsis,omitempty"`
	CoverURL        *string `json:"cover_url,omitempty" validate:"omitempty,url"`
	BannerURL       *string `json:"banner_url,omitempty" validate:"omitempty,url"`
	Type            *string `json:"type,omitempty" validate:"omitempty,oneof=anime manga novel"`
	AgeRating       *string `json:"age_rating,omitempty" validate:"omitempty,oneof=L 12 14 16 18"`
	Status          *string `json:"status,omitempty" validate:"omitempty,oneof=releasing completed"`
	Source          *string `json:"source,omitempty"`
	PublicationYear *int    `json:"publication_year,omitempty"`

	GenreIDs []uint `json:"genre_ids,omitempty"`
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", httperr.Wrap(h.List))
	r.Get("/{id}", httperr.Wrap(h.GetByID))
	r.Post("/", httperr.Wrap(h.Create))
	r.Patch("/{id}", httperr.Wrap(h.Update))
	r.Delete("/{id}", httperr.Wrap(h.Delete))
	return r
}

// @Tags Titles
// @Success 200 {array} domain.Title
// @Router /titles [get]
func (h *Handler) List(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	mediaType := r.URL.Query().Get("type")
	titles, err := h.store.FindAll(mediaType)
	if err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return titles, http.StatusOK, nil
}

// @Tags Titles
// @Param id path int true "ID da Obra"
// @Success 200 {object} domain.Title
// @Router /titles/{id} [get]
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}

	title, err := h.store.FindByID(uint(id))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("obra não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return title, http.StatusOK, nil
}

// @Tags Titles
// @Param request body createRequest true "Dados da Obra"
// @Success 201 {object} domain.Title
// @Router /titles [post]
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	var req createRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		return nil, http.StatusBadRequest, errors.New("corpo da requisição inválido")
	}

	if err := validator.ValidateStruct(req); err != nil {
		return nil, http.StatusBadRequest, err
	}

	newTitle := domain.Title{
		Name:            req.Name,
		Synopsis:        req.Synopsis,
		CoverURL:        req.CoverURL,
		BannerURL:       req.BannerURL,
		Type:            req.Type,
		AgeRating:       req.AgeRating,
		Status:          req.Status,
		Source:          req.Source,
		PublicationYear: req.PublicationYear,
	}

	if err := h.store.Create(&newTitle); err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	if len(req.GenreIDs) > 0 {
		if err := h.store.SetGenres(newTitle.ID, req.GenreIDs); err != nil {
			return nil, http.StatusInternalServerError, httperr.ErrInternal
		}
	}

	return &newTitle, http.StatusCreated, nil
}

// @Tags Titles
// @Param id path int true "ID da Obra"
// @Param request body updateRequest true "Campos para atualizar"
// @Success 200 {object} domain.Title
// @Router /titles/{id} [patch]
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}

	var req updateRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		return nil, http.StatusBadRequest, errors.New("corpo da requisição inválido")
	}

	if err := validator.ValidateStruct(req); err != nil {
		return nil, http.StatusBadRequest, err
	}

	var updates map[string]interface{}
	data, _ := json.Marshal(req)
	_ = json.Unmarshal(data, &updates)
	delete(updates, "genre_ids")

	if err := h.store.Update(uint(id), updates); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("obra não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	if req.GenreIDs != nil {
		if err := h.store.SetGenres(uint(id), req.GenreIDs); err != nil {
			return nil, http.StatusInternalServerError, httperr.ErrInternal
		}
	}

	return map[string]string{"mensagem": "obra atualizada com sucesso"}, http.StatusOK, nil
}

// @Tags Titles
// @Param id path int true "ID da Obra"
// @Success 200 {object} map[string]string
// @Router /titles/{id} [delete]
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}

	if err := h.store.Delete(uint(id)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("obra não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{"mensagem": "obra removida com sucesso"}, http.StatusOK, nil
}
