package com.example;

import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.regions.Region;
import com.stripe.Stripe;
import com.stripe.model.Charge;
import com.stripe.param.ChargeCreateParams;
import com.google.firebase.FirebaseApp;
import redis.clients.jedis.Jedis;
import org.apache.kafka.clients.producer.KafkaProducer;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.sql.DriverManager;
import java.sql.Connection;
import java.util.Properties;

public class App {
    public static void main(String[] args) throws Exception {
        // HTTP call via java.net.http
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.stripe.com/v1/charges"))
            .build();

        // AWS S3
        S3Client s3 = S3Client.builder().region(Region.US_EAST_1).build();

        // Stripe
        Stripe.apiKey = System.getenv("STRIPE_API_KEY");
        Charge charge = Charge.create(new ChargeCreateParams.Builder().build());

        // Firebase
        FirebaseApp.initializeApp();

        // PostgreSQL via JDBC
        Connection conn = DriverManager.getConnection("jdbc:postgresql://localhost:5432/mydb");

        // Redis via Jedis
        Jedis jedis = new Jedis("redis://localhost:6379");

        // Kafka
        Properties props = new Properties();
        props.put("bootstrap.servers", "localhost:9092");
        KafkaProducer<String, String> producer = new KafkaProducer<>(props);
    }
}
