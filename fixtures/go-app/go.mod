module github.com/acme/payments-service

go 1.22

require (
	github.com/stripe/stripe-go/v78 v78.1.0
	github.com/aws/aws-sdk-go-v2 v1.24.0
	github.com/aws/aws-sdk-go-v2/service/s3 v1.47.0
	github.com/redis/go-redis/v9 v9.4.0
	github.com/jackc/pgx/v5 v5.5.0
	github.com/sashabaranov/go-openai v1.20.0
)

require (
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
)
