package httperr

import (
	"errors"
	"net/http"

	"github.com/go-chi/render"
	"gorm.io/gorm"
)

var ErrInternal = errors.New("erro interno no servidor")

type EndpointFunc func(w http.ResponseWriter, r *http.Request) (interface{}, int, error)

func Wrap(fn EndpointFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, status, err := fn(w, r)

		if err != nil {
			if errors.Is(err, ErrInternal) {
				render.Status(r, http.StatusInternalServerError)
			} else if errors.Is(err, gorm.ErrRecordNotFound) {
				render.Status(r, http.StatusNotFound)
			} else {
				render.Status(r, http.StatusBadRequest)
			}

			render.JSON(w, r, map[string]string{"error": err.Error()})
			return
		}

		render.Status(r, status)
		if data != nil {
			render.JSON(w, r, data)
		}
	}
}
