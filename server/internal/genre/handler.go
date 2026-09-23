package genre

import (
	"errors"
	"net/http"
	"strconv"

	"geekverse/internal/domain"
	"geekverse/internal/platform/httperr"
	"geekverse/internal/platform/validator"

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
	Name string `json:"name" validate:"required,min=2,max=50" example:"Isekai"`
}

type updateItem struct {
	ID   uint   `json:"id" validate:"required" example:"1"`
	Name string `json:"name" validate:"required,min=2,max=50" example:"Ação"`
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", httperr.Wrap(h.List))
	r.Post("/", httperr.Wrap(h.CreateBatch))
	r.Patch("/", httperr.Wrap(h.UpdateBatch))
	r.Delete("/{id}", httperr.Wrap(h.Delete))
	return r
}

// @Tags Genres
// @Success 200 {array} domain.Genre
// @Router /genres [get]
func (h *Handler) List(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	genres, err := h.store.FindAll()
	if err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return genres, http.StatusOK, nil
}

// @Tags Genres
// @Param request body []createItem true "Lista de Gêneros a cadastrar"
// @Success 201 {array} domain.Genre
// @Router /genres [post]
func (h *Handler) CreateBatch(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	var req []createItem
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		return nil, http.StatusBadRequest, errors.New("corpo da requisição inválido, esperado um array")
	}

	if len(req) == 0 {
		return nil, http.StatusBadRequest, errors.New("a lista de gêneros não pode ser vazia")
	}

	genres := make([]domain.Genre, 0, len(req))
	for _, item := range req {
		if err := validator.ValidateStruct(item); err != nil {
			return nil, http.StatusBadRequest, err
		}
		genres = append(genres, domain.Genre{Name: item.Name})
	}

	if err := h.store.CreateBatch(genres); err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return genres, http.StatusCreated, nil
}

// @Tags Genres
// @Param request body []updateItem true "Lista de Gêneros a atualizar com seus IDs"
// @Success 200 {object} map[string]string
// @Router /genres [patch]
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
			return nil, http.StatusNotFound, errors.New("um ou mais gêneros não foram encontrados")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{"mensagem": "gêneros atualizados com sucesso"}, http.StatusOK, nil
}

// @Tags Genres
// @Param id path int true "ID do Gênero"
// @Success 200 {object} map[string]string
// @Router /genres/{id} [delete]
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}

	if err := h.store.Delete(uint(id)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("gênero não encontrado")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{"mensagem": "gênero removido com sucesso"}, http.StatusOK, nil
}
