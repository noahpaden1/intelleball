#include <WiFi.h>
#define WIFI_SSID "eduroam"
#define EAP_IDENTITY "pid@vt.edu"
#define EAP_USERNAME "pid@vt.edu"
#define EAP_PASSWORD "personal_wifi_password"
void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println();
  Serial.println("================================");
  Serial.println("   VIRGINIA TECH EDUROAM TEST");
  Serial.println("================================");
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(1000);
  Serial.println("Configuring WPA2 Enterprise...");
  Serial.println("SSID: eduroam");
  Serial.print("Identity: ");
  Serial.println(EAP_IDENTITY);
  WiFi.begin(
    WIFI_SSID,
    WPA2_AUTH_PEAP,
    EAP_IDENTITY,
    EAP_USERNAME,
    EAP_PASSWORD
  );
  Serial.println();
  Serial.print("Connecting");
  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - startTime < 30000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("================================");
    Serial.println("       WIFI CONNECTED!");
    Serial.println("================================");
    Serial.print("SSID: ");
    Serial.println(WiFi.SSID());
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Gateway: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("Subnet: ");
    Serial.println(WiFi.subnetMask());
    Serial.print("RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.print("MAC: ");
    Serial.println(WiFi.macAddress());
  } else {
    Serial.println();
    Serial.println("================================");
    Serial.println("       CONNECTION FAILED");
    Serial.println("================================");
    Serial.print("WiFi status: ");
    Serial.println(WiFi.status());
    Serial.println();
    Serial.println("Check:");
    Serial.println("1. SSID is eduroam");
    Serial.println("2. Email is your full @vt.edu address");
    Serial.println("3. Network password is correct");
    Serial.println("4. Board supports WPA2 Enterprise");
    Serial.println("5. ESP32 board package is up to date");
  }
}
void loop() {
  delay(5000);
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("CONNECTED | IP: ");
    Serial.print(WiFi.localIP());
    Serial.print(" | RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("DISCONNECTED");
  }
}