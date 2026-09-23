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

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/{bucket}", httperr.Wrap(h.UploadFile))
	return r
}

// UploadFile godoc
// @Tags Storage
// @Param bucket path string true "Nome do Balde (novels ou arts)"
// @Param file formData file true "Arquivo a enviar"
// @Success 201 {object} map[string]string
// @Router /upload/{bucket} [post]
func (h *Handler) UploadFile(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	bucket := chi.URLParam(r, "bucket")

	if bucket != "novels" && bucket != "arts" {
		return nil, http.StatusBadRequest, errors.New("bucket deve ser um dos seguintes valores: novels arts")
	}

	maxSize := int64(25 << 20)
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

	if bucket == "arts" {
		validImages := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true}
		if !validImages[ext] {
			return nil, http.StatusBadRequest, errors.New("extensão deve ser um dos seguintes valores: .jpg .jpeg .png .webp .gif")
		}
	} else if bucket == "novels" {
		validDocs := map[string]bool{".pdf": true, ".epub": true}
		if !validDocs[ext] {
			return nil, http.StatusBadRequest, errors.New("extensão deve ser um dos seguintes valores: .pdf .epub")
		}
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
