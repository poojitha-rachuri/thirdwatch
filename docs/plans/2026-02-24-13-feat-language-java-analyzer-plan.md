---
title: "feat: Java Language Analyzer"
type: feat
phase: 1 — The Map (expansion)
date: 2026-02-24
priority: P1
dependencies: Plan 3 (Scanner Core), Plan 4 (Detectors), Plan 17 (Manifest Support)
package: packages/languages/java
---

# feat: Java Language Analyzer

## Overview

Build `@thirdwatch/language-java` — a language analyzer plugin for Java and Kotlin codebases. Java dominates enterprise backends, Android development, and large-scale distributed systems. Its ecosystem has the most complex manifest formats (Maven POM XML, Gradle Groovy/Kotlin DSL, version catalogs) and the widest variety of HTTP client libraries. The analyzer must handle annotations, builder patterns, and the deeply nested class hierarchies typical of Java code.

## Problem Statement

Enterprise Java codebases are among the most dependency-heavy in existence. A typical Spring Boot microservice has 50–200 transitive dependencies, uses JDBC or JPA for databases, Spring's RestTemplate or WebClient for HTTP, and often integrates with AWS, Stripe, or other SaaS providers via official Java SDKs. Without Java support, Thirdwatch misses the largest segment of backend applications.

## Proposed Solution

A `@thirdwatch/language-java` package implementing `LanguageAnalyzerPlugin` with:
1. Maven `pom.xml` parsing (XML with property interpolation)
2. Gradle `build.gradle` / `build.gradle.kts` parsing (regex for dependency declarations)
3. Gradle version catalogs `libs.versions.toml` parsing
4. HTTP client detection (HttpClient, OkHttp, Retrofit, RestTemplate, WebClient, Feign)
5. SDK detection (AWS SDK v2, Stripe, Firebase, Twilio)
6. Infrastructure detection (JDBC, HikariCP, Jedis, Lettuce, MongoDB, Kafka)

## Technical Approach

### Plugin Entry Point

```typescript
// packages/languages/java/src/index.ts
import type { LanguageAnalyzerPlugin, AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import { analyzeJava } from "./analyzer.js";
import { parseManifests } from "./manifests.js";

export class JavaPlugin implements LanguageAnalyzerPlugin {
  readonly name = "Java Analyzer";
  readonly language = "java";
  readonly extensions = [".java", ".kt"];

  async analyze(context: AnalyzerContext): Promise<DependencyEntry[]> {
    return analyzeJava(context);
  }

  async analyzeManifests(
    manifestFiles: string[],
    scanRoot: string,
  ): Promise<DependencyEntry[]> {
    return parseManifests(manifestFiles, scanRoot);
  }
}
```

### Manifest Parsing — Maven `pom.xml`

Maven POMs are XML with property interpolation (`${project.version}`), parent inheritance, and BOM imports. We use `fast-xml-parser` for parsing.

```xml
<!-- Example pom.xml -->
<project>
  <properties>
    <stripe.version>24.0.0</stripe.version>
    <aws.sdk.version>2.21.0</aws.sdk.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>com.stripe</groupId>
      <artifactId>stripe-java</artifactId>
      <version>${stripe.version}</version>
    </dependency>
    <dependency>
      <groupId>software.amazon.awssdk</groupId>
      <artifactId>s3</artifactId>
      <version>${aws.sdk.version}</version>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <version>42.7.1</version>
    </dependency>
  </dependencies>
</project>
```

```typescript
// packages/languages/java/src/manifests.ts
import { XMLParser } from "fast-xml-parser";

function parsePomXml(content: string, manifestFile: string): DependencyEntry[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const pom = parser.parse(content);
  const project = pom.project;
  if (!project) return [];

  // Extract properties for interpolation
  const properties: Record<string, string> = {};
  if (project.properties) {
    for (const [key, value] of Object.entries(project.properties)) {
      if (typeof value === "string") properties[key] = value;
    }
  }

  const deps = normalizeDependencies(project.dependencies?.dependency);
  const entries: DependencyEntry[] = [];

  for (const dep of deps) {
    const groupId = String(dep.groupId ?? "");
    const artifactId = String(dep.artifactId ?? "");
    let version = String(dep.version ?? "unknown");

    // Interpolate ${property.name}
    const propMatch = version.match(/^\$\{(.+)\}$/);
    if (propMatch && properties[propMatch[1]!]) {
      version = properties[propMatch[1]!]!;
    }

    // Skip test-scoped dependencies
    if (dep.scope === "test") continue;

    entries.push({
      kind: "package",
      name: `${groupId}:${artifactId}`,
      ecosystem: "maven",
      current_version: version,
      version_constraint: version,
      manifest_file: manifestFile,
      locations: [],
      usage_count: 0,
      confidence: "high",
    });
  }

  return entries;
}

function normalizeDependencies(deps: unknown): Record<string, unknown>[] {
  if (!deps) return [];
  if (Array.isArray(deps)) return deps;
  return [deps as Record<string, unknown>];
}
```

### Manifest Parsing — Gradle

```groovy
// build.gradle (Groovy DSL)
dependencies {
    implementation 'com.stripe:stripe-java:24.0.0'
    implementation "software.amazon.awssdk:s3:${awsSdkVersion}"
    implementation group: 'org.postgresql', name: 'postgresql', version: '42.7.1'
    testImplementation 'junit:junit:4.13.2'
    api 'com.google.cloud:google-cloud-storage:2.30.0'
}
```

```kotlin
// build.gradle.kts (Kotlin DSL)
dependencies {
    implementation("com.stripe:stripe-java:24.0.0")
    implementation("software.amazon.awssdk:s3:${property("awsSdkVersion")}")
    testImplementation("junit:junit:4.13.2")
}
```

```typescript
function parseGradleBuild(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];

  // Groovy DSL: implementation 'group:artifact:version'
  const groovyRe = /(?:implementation|api|compileOnly|runtimeOnly)\s+['"]([^'"]+)['"]/g;
  for (const match of content.matchAll(groovyRe)) {
    const entry = parseGradleCoordinate(match[1]!, manifestFile);
    if (entry) entries.push(entry);
  }

  // Kotlin DSL: implementation("group:artifact:version")
  const kotlinRe = /(?:implementation|api|compileOnly|runtimeOnly)\(["']([^"']+)["']\)/g;
  for (const match of content.matchAll(kotlinRe)) {
    const entry = parseGradleCoordinate(match[1]!, manifestFile);
    if (entry) entries.push(entry);
  }

  // Groovy map notation: implementation group: 'x', name: 'y', version: 'z'
  const mapRe = /(?:implementation|api)\s+group:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],\s*version:\s*['"]([^'"]+)['"]/g;
  for (const match of content.matchAll(mapRe)) {
    entries.push({
      kind: "package",
      name: `${match[1]}:${match[2]}`,
      ecosystem: "maven",
      current_version: match[3]!,
      version_constraint: match[3]!,
      manifest_file: manifestFile,
      locations: [],
      usage_count: 0,
      confidence: "high",
    });
  }

  return entries;
}

function parseGradleCoordinate(coord: string, manifestFile: string): DependencyEntry | null {
  const parts = coord.split(":");
  if (parts.length < 2) return null;
  const group = parts[0]!;
  const artifact = parts[1]!;
  const version = parts[2] ?? "unknown";

  return {
    kind: "package",
    name: `${group}:${artifact}`,
    ecosystem: "maven",
    current_version: version.includes("$") ? "unknown" : version,
    version_constraint: version,
    manifest_file: manifestFile,
    locations: [],
    usage_count: 0,
    confidence: version.includes("$") ? "medium" : "high",
  };
}
```

### HTTP Client Detection

Java HTTP patterns to detect:

```java
// java.net.http.HttpClient (Java 11+)
HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.stripe.com/v1/charges"))
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();

// OkHttp
Request request = new Request.Builder()
    .url("https://api.openai.com/v1/completions")
    .post(requestBody)
    .build();

// Spring RestTemplate
ResponseEntity<String> response = restTemplate.getForEntity(
    "https://api.example.com/users", String.class);
restTemplate.postForObject("https://api.example.com/orders", order, Order.class);

// Spring WebClient
webClient.get().uri("https://api.example.com/users").retrieve();
webClient.post().uri(apiUrl).bodyValue(payload).retrieve();

// Retrofit (annotation-based)
@GET("/v1/users")
Call<List<User>> getUsers();

@POST("/v1/charges")
Call<Charge> createCharge(@Body ChargeRequest request);

// Feign
@FeignClient(name = "stripe", url = "https://api.stripe.com")
public interface StripeClient {
    @PostMapping("/v1/charges")
    Charge createCharge(ChargeRequest request);
}
```

```typescript
// packages/languages/java/src/analyzer.ts — HTTP detection

const JAVA_HTTP_PATTERNS: [RegExp, string | null][] = [
  // URI.create("url") — java.net.http
  [/URI\.create\(\s*"([^"]+)"/, null],
  // .url("url") — OkHttp
  [/\.url\(\s*"([^"]+)"/, null],
  // restTemplate.getForEntity("url", ...) / .postForObject("url", ...)
  [/restTemplate\.(getForEntity|postForObject|exchange|getForObject)\(\s*"([^"]+)"/, "REST_TEMPLATE"],
  // webClient.get().uri("url") / .post().uri("url")
  [/webClient\.(get|post|put|patch|delete)\(\)\.uri\(\s*"([^"]+)"/, "WEBCLIENT"],
  // @GET("/path"), @POST("/path") — Retrofit
  [/@(GET|POST|PUT|PATCH|DELETE)\(\s*"([^"]+)"/, "ANNOTATION"],
  // @FeignClient(url = "https://...")
  [/@FeignClient\([^)]*url\s*=\s*"([^"]+)"/, "FEIGN"],
  // @PostMapping("/path"), @GetMapping("/path")
  [/@(Get|Post|Put|Patch|Delete)Mapping\(\s*(?:value\s*=\s*)?"([^"]+)"/, "SPRING_ANNOTATION"],
];
```

### SDK Detection

```java
// AWS SDK v2
S3Client s3 = S3Client.builder().region(Region.US_EAST_1).build();
SqsClient sqs = SqsClient.create();
DynamoDbClient dynamoDb = DynamoDbClient.builder().build();

// Stripe
Stripe.apiKey = System.getenv("STRIPE_API_KEY");
Charge charge = Charge.create(params);
PaymentIntent intent = PaymentIntent.create(params);

// Firebase
FirebaseApp.initializeApp(options);
FirebaseMessaging.getInstance().send(message);
```

```typescript
const JAVA_SDK_PATTERNS: [RegExp, string, string][] = [
  // AWS: S3Client.builder(), SqsClient.create()
  [/(S3|Sqs|Sns|DynamoDb|Lambda|Ses|Iam|Sts|Ec2|Ecs)Client\.(builder|create)\(/, "aws", "aws-sdk-java-v2"],
  // Stripe: Charge.create(), PaymentIntent.create()
  [/(?:Charge|PaymentIntent|Customer|Subscription|Invoice|Refund)\.create\(/, "stripe", "stripe-java"],
  // Firebase: FirebaseApp.initializeApp()
  [/FirebaseApp\.initializeApp\(/, "firebase", "firebase-admin-java"],
  // Twilio
  [/Twilio\.init\(/, "twilio", "twilio-java"],
  // SendGrid
  [/new\s+SendGrid\(/, "sendgrid", "sendgrid-java"],
];
```

### Infrastructure Detection

```java
// JDBC
Connection conn = DriverManager.getConnection("jdbc:postgresql://localhost:5432/mydb");
Connection conn = DriverManager.getConnection("jdbc:mysql://host:3306/db", user, pass);

// HikariCP
HikariConfig config = new HikariConfig();
config.setJdbcUrl("jdbc:postgresql://host:5432/db");
HikariDataSource ds = new HikariDataSource(config);

// Spring Data
spring.datasource.url=jdbc:postgresql://host:5432/db

// Jedis (Redis)
Jedis jedis = new Jedis("redis://localhost:6379");
JedisPool pool = new JedisPool("localhost", 6379);

// Lettuce (Redis)
RedisClient client = RedisClient.create("redis://localhost:6379");

// MongoDB
MongoClient client = MongoClients.create("mongodb://localhost:27017");

// Kafka
Properties props = new Properties();
props.put("bootstrap.servers", "localhost:9092");
KafkaProducer<String, String> producer = new KafkaProducer<>(props);
```

```typescript
const JAVA_INFRA_PATTERNS: [RegExp, string][] = [
  [/DriverManager\.getConnection\(\s*"(jdbc:postgresql:[^"]+)"/, "postgresql"],
  [/DriverManager\.getConnection\(\s*"(jdbc:mysql:[^"]+)"/, "mysql"],
  [/setJdbcUrl\(\s*"(jdbc:postgresql:[^"]+)"/, "postgresql"],
  [/setJdbcUrl\(\s*"(jdbc:mysql:[^"]+)"/, "mysql"],
  [/new\s+Jedis\(/, "redis"],
  [/JedisPool\(/, "redis"],
  [/RedisClient\.create\(/, "redis"],
  [/MongoClients\.create\(/, "mongodb"],
  [/KafkaProducer\s*</, "kafka"],
  [/KafkaConsumer\s*</, "kafka"],
  [/bootstrap\.servers/, "kafka"],
];

const JAVA_JDBC_URL_PATTERNS: [RegExp, string][] = [
  [/jdbc:postgresql:\/\/[^\s"']+/, "postgresql"],
  [/jdbc:mysql:\/\/[^\s"']+/, "mysql"],
  [/jdbc:oracle:[^\s"']+/, "oracle"],
  [/jdbc:sqlserver:[^\s"']+/, "sqlserver"],
  [/jdbc:h2:[^\s"']+/, "h2"],
];
```

## Implementation Phases

### Phase 13.1: Package Scaffold + Maven Parsing
- Initialize `packages/languages/java` with package.json, tsconfig.json
- Add `fast-xml-parser` dependency
- Implement `pom.xml` parser with property interpolation
- Unit tests with multi-module Maven project fixtures

### Phase 13.2: Gradle Parsing
- Implement `build.gradle` (Groovy DSL) parser
- Implement `build.gradle.kts` (Kotlin DSL) parser
- Implement `libs.versions.toml` (version catalog) parser
- Test with fixtures containing all Gradle dependency declaration styles

### Phase 13.3: Import + HTTP Detection
- Implement Java import statement parsing (`import com.package.Class;`)
- Implement HTTP client detection for all 6 client types
- Handle annotation-based patterns (@GET, @POST, @FeignClient)
- Test against `fixtures/java-app/` HTTP patterns

### Phase 13.4: SDK Detection
- Implement SDK constructor/factory detection (AWS, Stripe, Firebase, Twilio)
- Map via imports and registry
- Test: fixtures should produce correct provider entries

### Phase 13.5: Infrastructure Detection
- Implement JDBC URL detection
- Implement Redis (Jedis/Lettuce), MongoDB, Kafka patterns
- Connection string pattern matching
- Test: fixtures should produce entries for postgresql, redis, kafka

### Phase 13.6: Integration + Registry
- Add Java (`maven:`) patterns to all registry YAML files
- Integration test: scan `fixtures/java-app/` → validate full TDM
- Validate TDM against JSON Schema

## Acceptance Criteria

- [ ] Maven `pom.xml` dependencies parsed with `${property}` interpolation
- [ ] Maven test-scoped dependencies excluded by default
- [ ] Gradle `implementation 'group:artifact:version'` parsed correctly
- [ ] Gradle Kotlin DSL `implementation("group:artifact:version")` parsed correctly
- [ ] `RestTemplate.getForEntity("https://...")` produces API entry with method GET
- [ ] `@FeignClient(url = "https://api.stripe.com")` produces API entry
- [ ] `S3Client.builder().build()` produces SDK entry with provider `aws`
- [ ] `DriverManager.getConnection("jdbc:postgresql://...")` produces infra entry
- [ ] `new Jedis("redis://...")` produces infra entry with type `redis`
- [ ] `.java` and `.kt` files are both handled

## File Inventory

| File | Description |
|---|---|
| `packages/languages/java/package.json` | Package manifest (depends on fast-xml-parser) |
| `packages/languages/java/tsconfig.json` | TypeScript config |
| `packages/languages/java/src/index.ts` | JavaPlugin export |
| `packages/languages/java/src/analyzer.ts` | Source code analyzer |
| `packages/languages/java/src/manifests.ts` | pom.xml + build.gradle + version catalog parsers |
| `packages/languages/java/src/__tests__/analyzer.test.ts` | Analyzer unit tests |
| `packages/languages/java/src/__tests__/manifests.test.ts` | Manifest parser tests |
| `fixtures/java-app/` | Java fixture project |

## References

- [Maven POM Reference](https://maven.apache.org/pom.html)
- [Gradle Dependency Management](https://docs.gradle.org/current/userguide/dependency_management.html)
- [Gradle Version Catalogs](https://docs.gradle.org/current/userguide/platforms.html)
- [AWS SDK for Java v2](https://github.com/aws/aws-sdk-java-v2)
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)
