#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BNO055.h>

Adafruit_BNO055 bno = Adafruit_BNO055(55);

unsigned long lastTime = 0;

float linAccelerationX = 0;
float linAccelerationY = 0;
float linAccelerationZ = 0;

float linVelocityX = 0;
float linVelocityY = 0;
float linVelocityZ = 0;

float positionX = 0;
float positionY = 0;
float positionZ = 0;

void setup() {
  Serial.begin(115200);

  Wire.begin(21, 22);

  while (!bno.begin()) {
    Serial.println("Failed to start BNO055");
    delay(1000);
  }

  delay(1000);
  bno.setExtCrystalUse(true);

  lastTime = millis();
}

void loop() {

  sensors_event_t event;

  bno.getEvent(&event, Adafruit_BNO055::VECTOR_LINEARACCEL);

  linAccelerationX = event.acceleration.x;
  linAccelerationY = event.acceleration.y;
  linAccelerationZ = event.acceleration.z;

  if (abs(linAccelerationX) < 0.5) {
    linAccelerationX = 0;
  }

  if (abs(linAccelerationY) < 0.5) {
    linAccelerationY = 0;
  }

  if (abs(linAccelerationZ) < 0.5) {
    linAccelerationZ = 0;
  }

  unsigned long currentTime = millis();
  float dt = (currentTime - lastTime) / 1000.0;
  lastTime = currentTime;

  if (abs(linAccelerationX) < 0.5 && abs(linAccelerationY) < 0.5 && abs(linAccelerationZ) < 0.5) {
    linVelocityX = 0;
    linVelocityY = 0;
    linVelocityZ = 0;
  }
  else {
    linVelocityX += linAccelerationX * dt;
    linVelocityY += linAccelerationY * dt;
    linVelocityZ += linAccelerationZ * dt;
  }

  positionX += linVelocityX * dt;
  positionY += linVelocityY * dt;
  positionZ += linVelocityZ * dt;

  Serial.print("Position: ");
  Serial.print(positionX, 2);
  Serial.print(", ");
  Serial.print(positionY, 2);
  Serial.print(", ");
  Serial.println(positionZ, 2);

  delay(10);
}