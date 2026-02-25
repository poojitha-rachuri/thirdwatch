package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	s3 "github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
	"github.com/sashabaranov/go-openai"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/charge"
)

func main() {
	ctx := context.Background()

	// HTTP calls
	resp, err := http.Get("https://api.stripe.com/v1/charges")
	if err != nil {
		fmt.Println(err)
	}
	defer resp.Body.Close()

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/completions", nil)
	if err != nil {
		fmt.Println(err)
	}
	_ = req

	// AWS S3
	cfg, _ := config.LoadDefaultConfig(ctx)
	s3Client := s3.NewFromConfig(cfg)
	_ = s3Client

	// Stripe
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
	params := &stripe.ChargeParams{Amount: stripe.Int64(2000)}
	ch, _ := charge.New(params)
	_ = ch

	// PostgreSQL
	conn, _ := pgx.Connect(ctx, os.Getenv("DATABASE_URL"))
	defer conn.Close(ctx)

	// Redis
	rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
	_ = rdb

	// OpenAI
	client := openai.NewClient(os.Getenv("OPENAI_API_KEY"))
	_ = client
}
