use hyper::{Method, Request, Body};
use ureq;

pub async fn handle_request() -> Result<(), Box<dyn std::error::Error>> {
    // HTTP: ureq GET
    let resp = ureq::get("https://api.example.com/users").call()?;

    // HTTP: ureq POST
    let resp = ureq::post("https://api.example.com/orders").send_json(json)?;

    // HTTP: hyper builder with Method::POST
    let req = Request::builder()
        .method(Method::POST)
        .uri("https://api.example.com/webhook")
        .body(Body::from(payload))?;

    // MongoDB
    let mongo = mongodb::Client::with_uri_str("mongodb://user:pass@localhost:27017").await?;

    // Kafka
    let producer: FutureProducer = ClientConfig::new()
        .set("bootstrap.servers", "localhost:9092")
        .create()?;

    Ok(())
}
