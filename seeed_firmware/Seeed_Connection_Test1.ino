#include <WiFi.h>

const char* ssid = "ZACHARY-LAPTOP";
const char* password = "DrakeMaye";

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("Starting Wi-Fi connection...");
  Serial.print("Connecting to: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  // Wait up to 20 seconds for connection
  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi connected successfully!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } 
  else {
    Serial.println("Wi-Fi connection FAILED.");
    Serial.print("Wi-Fi status code: ");
    Serial.println(WiFi.status());
  }
}

void loop() {
  // Nothing needed here
}