package favorite

import (
	"errors"
	"geekverse/internal/platform/auth"
	"geekverse/internal/platform/httperr"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
)

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) Routes(requireAuth func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()

	r.Use(requireAuth)

	r.Get("/", httperr.Wrap(h.List))
	r.Post("/{title_id}", httperr.Wrap(h.Create))
	r.Delete("/{title_id}", httperr.Wrap(h.Delete))

	return r
}

func (h *Handler) PublicRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", httperr.Wrap(h.ListByProfile))

	return r
}

// @Tags Favorites
// @Security BearerAuth
// @Success 200 {array} domain.Favorite
// @Router /favorites [get]
func (h *Handler) List(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	profileID := auth.GetProfileID(r.Context())

	favorites, err := h.store.FindByProfile(profileID)
	if err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return favorites, http.StatusOK, nil
}

// @Tags Favorites
// @Param id path string true "UUID do Perfil"
// @Success 200 {array} domain.Favorite
// @Router /profiles/{id}/favorites [get]
func (h *Handler) ListByProfile(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	profileID := chi.URLParam(r, "id")

	favorites, err := h.store.FindByProfile(profileID)
	if err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return favorites, http.StatusOK, nil
}

// @Tags Favorites
// @Security BearerAuth
// @Param title_id path int true "ID da Obra"
// @Success 201 {object} map[string]string
// @Router /favorites/{title_id} [post]
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	profileID := auth.GetProfileID(r.Context())

	titleID, err := strconv.Atoi(chi.URLParam(r, "title_id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("title_id é inválido")
	}

	if err := h.store.Create(profileID, uint(titleID)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("obra não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{"mensagem": "obra adicionada aos favoritos"}, http.StatusCreated, nil
}

// @Tags Favorites
// @Security BearerAuth
// @Param title_id path int true "ID da Obra"
// @Success 200 {object} map[string]string
// @Router /favorites/{title_id} [delete]
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	profileID := auth.GetProfileID(r.Context())

	titleID, err := strconv.Atoi(chi.URLParam(r, "title_id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("title_id inválido")
	}

	if err := h.store.Delete(profileID, uint(titleID)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("favorito não encontrado")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{"mensagem": "obra removida dos favoritos"}, http.StatusOK, nil
}
