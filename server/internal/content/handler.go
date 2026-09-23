package content

import (
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

type createItem struct {
	Title     string   `json:"title" validate:"required,min=2,max=150" example:"Episódio 1 - O Despertar"`
	Season    uint     `json:"season" validate:"min=0" example:"1"`
	Episode   *float64 `json:"episode" example:"1.0"`
	Language  string   `json:"language" validate:"required,oneof=sub dub none" example:"sub"`
	SourceURL string   `json:"source_url" validate:"required,url" example:"https://stream.exemplo.com/ep1.mp4"`
	CoverURL  string   `json:"cover_url" validate:"omitempty,url" example:"https://exemplo.com/capa-vol1.jpg"`
}

type updateItem struct {
	ID        uint     `json:"id" validate:"required" example:"1"`
	Title     *string  `json:"title" validate:"omitempty,min=2,max=150"`
	Season    *uint    `json:"season"`
	Episode   *float64 `json:"episode"`
	Language  *string  `json:"language" validate:"omitempty,oneof=sub dub none"`
	SourceURL *string  `json:"source_url" validate:"omitempty,url"`
	CoverURL  *string  `json:"cover_url" validate:"omitempty,url"`
}

func (h *Handler) TitleRoutes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", httperr.Wrap(h.CreateBatch))
	return r
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Patch("/", httperr.Wrap(h.UpdateBatch))
	r.Delete("/{id}", httperr.Wrap(h.Delete))
	return r
}

// @Tags Contents
// @Param title_id path int true "ID da Obra"
// @Param request body []createItem true "Lista de Conteúdos a criar"
// @Success 201 {array} domain.Content
// @Router /titles/{title_id}/contents [post]
func (h *Handler) CreateBatch(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	titleID, err := strconv.Atoi(chi.URLParam(r, "title_id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("title_id inválido")
	}

	var req []createItem
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		return nil, http.StatusBadRequest, errors.New("corpo da requisição inválido, esperado um array")
	}

	if len(req) == 0 {
		return nil, http.StatusBadRequest, errors.New("a lista de conteúdos não pode ser vazia")
	}

	contents := make([]domain.Content, 0, len(req))
	for _, item := range req {
		if err := validator.ValidateStruct(item); err != nil {
			return nil, http.StatusBadRequest, err
		}

		contents = append(contents, domain.Content{
			TitleID:   uint(titleID),
			Title:     item.Title,
			Season:    item.Season,
			Episode:   item.Episode,
			Language:  item.Language,
			SourceURL: item.SourceURL,
			CoverURL:  item.CoverURL,
		})
	}

	if err := h.store.CreateBatch(uint(titleID), contents); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("obra não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return contents, http.StatusCreated, nil
}

// @Tags Contents
// @Param request body []updateItem true "Lista de Atualizações com IDs"
// @Success 200 {object} map[string]string
// @Router /contents [patch]
func (h *Handler) UpdateBatch(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	var req []updateItem
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		return nil, http.StatusBadRequest, errors.New("corpo da requisição inválido, esperado um array")
	}

	if len(req) == 0 {
		return nil, http.StatusBadRequest, errors.New("a lista de atualizações não pode ser vazia")
	}

	for _, item := range req {
		if err := validator.ValidateStruct(item); err != nil {
			return nil, http.StatusBadRequest, err
		}
	}

	if err := h.store.UpdateBatch(req); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("um ou mais conteúdos não foram encontrados")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{"mensagem": "conteúdos atualizados com sucesso"}, http.StatusOK, nil
}

// @Tags Contents
// @Param id path int true "ID do Conteúdo"
// @Success 200 {object} map[string]string
// @Router /contents/{id} [delete]
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}

	if err := h.store.Delete(uint(id)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("conteúdo não encontrado")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{"mensagem": "conteúdo removido com sucesso"}, http.StatusOK, nil
}
