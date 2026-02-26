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

// Guzzle base_uri config
$guzzleBase = new \GuzzleHttp\Client(['base_uri' => 'https://api.payments.io']);

// cURL
$ch = curl_init('https://api.example.com/users');
curl_setopt($ch, CURLOPT_URL, 'https://api.weather.io/forecast');

// file_get_contents (HTTP — should be detected)
$data = file_get_contents('https://api.example.com/data');

// file_get_contents (local — should NOT be detected)
$localData = file_get_contents('/var/www/config.json');

// Laravel Http facade — use distinct URLs from curl_init/Guzzle
$response = Http::get('https://api.laravel-users.io/list');
$response = Http::post('https://api.laravel-orders.io/submit', $data);

// --- SDK usage ---

\Stripe\Stripe::setApiKey($stripeKey);
$charge = \Stripe\Charge::create(['amount' => 2000, 'currency' => 'usd']);

$s3 = new \Aws\S3\S3Client(['version' => 'latest', 'region' => 'us-east-1']);

$twilio = new \Twilio\Rest\Client($sid, $token);

new \SendGrid($sendgridKey);

\Sentry\init(['dsn' => $sentryDsn]);

// --- Infrastructure ---

$pdo = new PDO('mysql:host=localhost;dbname=mydb', $user, $pass);
$pgpdo = new \PDO('pgsql:host=localhost;dbname=mydb', $user, $pass);

$redis = new \Predis\Client('tcp://127.0.0.1:6379');

$mongo = new \MongoDB\Client('mongodb://user:pass@localhost:27017');

DB::table('users')->where('email', $email)->first();

// Connection string URL — exercises CONN_STRING_PATTERNS directly
$redisUrl = getenv('REDIS_URL'); // e.g. redis://user:pass@redis-host:6379
// The value below exercises redis:// detection
$cfg = ['url' => 'redis://redis-host:6379'];
