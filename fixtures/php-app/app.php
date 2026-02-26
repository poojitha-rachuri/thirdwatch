<?php

use Stripe\Charge;
use Stripe\PaymentIntent;
use Aws\S3\S3Client;
use Twilio\Rest\Client as TwilioClient;

// --- HTTP calls ---

// Guzzle
$client = new \GuzzleHttp\Client();
$response = $client->get('https://api.stripe.com/v1/charges');
$response = $client->post('https://api.example.com/orders', [
    'json' => $payload,
]);
$response = $client->request('PUT', 'https://api.openai.com/v1/completions', $options);

// cURL
$ch = curl_init('https://api.example.com/users');
curl_setopt($ch, CURLOPT_URL, 'https://api.weather.io/forecast');

// file_get_contents
$data = file_get_contents('https://api.example.com/data');

// Laravel Http facade
$response = Http::get('https://api.example.com/users');
$response = Http::post('https://api.example.com/orders', $data);

// --- SDK usage ---

\Stripe\Stripe::setApiKey($stripeKey);
$charge = \Stripe\Charge::create(['amount' => 2000, 'currency' => 'usd']);

$s3 = new \Aws\S3\S3Client(['version' => 'latest', 'region' => 'us-east-1']);

$twilio = new \Twilio\Rest\Client($sid, $token);

// --- Infrastructure ---

$pdo = new PDO('mysql:host=localhost;dbname=mydb', $user, $pass);
$pgpdo = new \PDO('pgsql:host=localhost;dbname=mydb', $user, $pass);

$redis = new \Predis\Client('tcp://127.0.0.1:6379');

$mongo = new \MongoDB\Client('mongodb://user:pass@localhost:27017');

DB::table('users')->where('email', $email)->first();
