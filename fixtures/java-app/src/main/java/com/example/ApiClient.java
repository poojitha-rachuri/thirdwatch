package com.example;

import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;

public class ApiClient {
    private final RestTemplate restTemplate = new RestTemplate();
    private final WebClient webClient = WebClient.create();

    public void callApis() {
        // RestTemplate GET
        restTemplate.getForEntity("https://api.example.com/users", String.class);

        // RestTemplate POST
        restTemplate.postForObject("https://api.example.com/orders", null, String.class);

        // WebClient GET
        webClient.get().uri("https://api.example.com/products").retrieve();

        // WebClient POST
        webClient.post().uri("https://api.example.com/checkout").retrieve();
    }
}

@FeignClient(name = "stripe", url = "https://api.stripe.com")
interface StripeClient {
    @PostMapping("/v1/charges")
    Object createCharge(Object request);

    @GetMapping("/v1/customers")
    Object listCustomers();
}
