package storage

import (
	"errors"
	"fmt"
	"geekverse/internal/platform/httperr"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	client *Client
}

func NewHandler(client *Client) *Handler {
	return &Handler{client: client}
}

func (h *Handler) Routes(requireAuth, requireStaff func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()

	r.Group(func(users chi.Router) {
		users.Use(requireAuth)
		users.Post("/arts", httperr.Wrap(h.UploadArt))
	})

	r.Group(func(staff chi.Router) {
		staff.Use(requireAuth)
		staff.Use(requireStaff)
		staff.Post("/novels", httperr.Wrap(h.UploadNovel))
	})

	return r
}

// @Tags Storage
// @Security BearerAuth
// @Param file formData file true "Imagem da Arte"
// @Success 201 {object} map[string]string
// @Router /upload/arts [post]
func (h *Handler) UploadArt(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	validExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true}
	return h.handleUpload(w, r, "arts", validExts)
}

// @Tags Storage
// @Security BearerAuth
// @Param file formData file true "Arquivo da Novel (PDF/EPUB)"
// @Success 201 {object} map[string]string
// @Router /upload/novels [post]
func (h *Handler) UploadNovel(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	validExts := map[string]bool{".pdf": true, ".epub": true}
	return h.handleUpload(w, r, "novels", validExts)
}

// Função privada com a lógica central reaproveitada
func (h *Handler) handleUpload(w http.ResponseWriter, r *http.Request, bucket string, validExts map[string]bool) (interface{}, int, error) {
	maxSize := int64(25 << 20) // 25 MB
	if err := r.ParseMultipartForm(maxSize); err != nil {
		return nil, http.StatusBadRequest, errors.New("o arquivo excede o limite máximo permitido de 25MB")
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("file é obrigatório")
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	ext := strings.ToLower(filepath.Ext(header.Filename))

	if !validExts[ext] {
		return nil, http.StatusBadRequest, fmt.Errorf("extensão inválida para o bucket %s", bucket)
	}

	safeFilename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)

	publicURL, err := h.client.Upload(r.Context(), bucket, safeFilename, file, contentType)
	if err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{
		"url": publicURL,
	}, http.StatusCreated, nil
}
