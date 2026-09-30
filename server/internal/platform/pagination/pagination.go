package pagination

import (
	"math"
	"net/http"
	"strconv"
)

type Params struct {
	Page  int
	Limit int
}

func GetParams(r *http.Request) Params {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page <= 0 {
		page = 1
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	switch {
	case limit <= 0:
		limit = 20
	case limit > 100:
		limit = 100
	}

	return Params{Page: page, Limit: limit}
}

type Result struct {
	Data       any   `json:"data"`
	Total      int64 `json:"total"`
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	TotalPages int   `json:"total_pages"`
}

func NewResult[T any](data []T, total int64, p Params) Result {
	totalPages := int(math.Ceil(float64(total) / float64(p.Limit)))
	return Result{
		Data:       data,
		Total:      total,
		Page:       p.Page,
		Limit:      p.Limit,
		TotalPages: totalPages,
	}
}
