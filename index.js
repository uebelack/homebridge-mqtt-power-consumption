'use strict';
var inherits = require('util').inherits;
var Service, Characteristic;
var mqtt = require('mqtt');



module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;


    homebridge.registerAccessory('homebridge-mqtt-power-consumption', 'mqtt-power-consumption', MqttPowerConsumptionAccessory);
};

function MqttPowerConsumptionAccessory(log, config) {
    this.log = log;
    this.name = config['name'];
    this.url = config['url'];
    this.client_Id = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
    this.options = {
        keepalive: 10,
        clientId: this.client_Id,
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        will: {
            topic: 'WillMsg',
            payload: 'Connection Closed abnormally..!',
            qos: 0,
            retain: false
        },
        username: config['username'],
        password: config['password'],
        rejectUnauthorized: false
    };

    this.powerConsumption = 0;
    this.totalPowerConsumption = 0;
    this.topics = config['topics'];

    var EvePowerConsumption = function() {
        Characteristic.call(this, 'Consumption', 'E863F10D-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.UINT16,
            unit: 'watts',
            maxValue: 1000000000,
            minValue: 0,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(EvePowerConsumption, Characteristic);

    var EveTotalPowerConsumption = function() {
        Characteristic.call(this, 'Total Consumption', 'E863F10C-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.FLOAT, // Deviation from Eve Energy observed type
            unit: 'kilowatthours',
            maxValue: 1000000000,
            minValue: 0,
            minStep: 0.001,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(EveTotalPowerConsumption, Characteristic);

    var PowerMeterService = function(displayName, subtype) {
        Service.call(this, displayName, '00000001-0000-1777-8000-775D67EC4377', subtype);
        this.addCharacteristic(EvePowerConsumption);
        this.addOptionalCharacteristic(EveTotalPowerConsumption);
    };

    inherits(PowerMeterService, Service);

    this.service = new PowerMeterService(this.options['name']);
    this.service.getCharacteristic(EvePowerConsumption).on('get', this.getPowerConsumption.bind(this));
    this.service.addCharacteristic(EveTotalPowerConsumption).on('get', this.getTotalPowerConsumption.bind(this));

    this.client = mqtt.connect(this.url, this.options);

    var self = this;

    this.client.on('error', function (err) {
        self.log('Error event on MQTT:', err);
    });

    this.client.on('message', function (topic, message) {
        if (topic == self.topics['power']) {
            self.powerConsumption = parseFloat(message.toString());
            self.service.getCharacteristic(EvePowerConsumption).setValue(self.powerConsumption, undefined, undefined);
        }

        if (topic == self.topics['totalPower']) {
            self.totalPowerConsumption = parseFloat(message.toString());
            self.service.getCharacteristic(EveTotalPowerConsumption).setValue(self.totalPowerConsumption, undefined, undefined);
        }
    });

    this.client.subscribe(self.topics['power']);
    this.client.subscribe(self.topics['totalPower']);
}

MqttPowerConsumptionAccessory.prototype.getPowerConsumption = function (callback) {
    callback(null, this.powerConsumption);
};

MqttPowerConsumptionAccessory.prototype.getTotalPowerConsumption = function (callback) {
    callback(null, this.totalPowerConsumption);
};

MqttPowerConsumptionAccessory.prototype.getServices = function () {
    return [this.service];
};
