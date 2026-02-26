use aws_sdk_s3::Client as S3Client;
use aws_config;
use stripe;
use async_openai::Client;
use reqwest;
use sqlx::postgres::PgPool;
use redis;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // HTTP: reqwest GET call
    let resp = reqwest::get("https://api.stripe.com/v1/charges").await?;

    // HTTP: client POST
    let client = reqwest::Client::new();
    let resp = client.post("https://api.openai.com/v1/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send().await?;

    // AWS SDK
    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let s3 = aws_sdk_s3::Client::new(&config);

    // Stripe SDK
    let stripe_client = stripe::Client::new(stripe_key);
    let charge = stripe::Charge::create(&stripe_client, params).await?;

    // OpenAI SDK
    let openai = async_openai::Client::new();

    // PostgreSQL via sqlx
    let pool = PgPool::connect("postgresql://user:pass@localhost:5432/mydb").await?;

    // Redis
    let redis_client = redis::Client::open("redis://127.0.0.1/")?;

    Ok(())
}
