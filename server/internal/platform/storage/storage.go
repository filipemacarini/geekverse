package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewClient(baseURL string, apiKey string) *Client {
	cleanURL := strings.TrimRight(baseURL, "/")
	return &Client{
		baseURL: cleanURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (c *Client) Upload(ctx context.Context, bucket string, filename string, fileReader io.Reader, contentType string) (string, error) {
	if c.baseURL == "" || c.apiKey == "" {
		return "", errors.New("supabase storage não configurado no .env")
	}

	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.baseURL, bucket, filename)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, fileReader)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", contentType)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("falha ao enviar arquivo para o supabase (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", c.baseURL, bucket, filename)
	return publicURL, nil
}
