package server

import (
	"database/sql"
	"net/http"

	_ "github.com/lib/pq"
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	resp, err := http.Get("https://api.example.com/health")
	if err != nil {
		http.Error(w, "upstream unhealthy", 502)
		return
	}
	defer resp.Body.Close()
	w.WriteHeader(200)
}

func initDB() (*sql.DB, error) {
	db, err := sql.Open("postgres", "postgresql://user:pass@db.internal:5432/mydb")
	if err != nil {
		return nil, err
	}
	return db, nil
}
