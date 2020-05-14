var Service;
var Characteristic;
var exec = require('child_process').exec;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-windowshades-command', 'WindowShadesCommand', WindowShadesCmdAccessory);
};

function WindowShadesCmdAccessory(log, config) {
  this.log = log;
  this.name = config.name;
  this.openCommand = config.open;
  this.closeCommand = config.close;
  this.stateCommand = config.state;
  this.statusUpdateDelay = config.status_update_delay || 15;
  this.pollStateDelay = config.poll_state_delay || 0;
  this.ignoreErrors = config.ignore_errors || false;
  this.logPolling = config.log_polling || false;
}

WindowShadesCmdAccessory.prototype.setTargetPosition = function(value, callback, context) {
 var accessory = this;
 accessory.log('To, from %s',value);
  var state = value< 50? 'close' : 'open';
  var prop = state + 'Command';
  var command = accessory[prop];
  accessory.log('Commnand to run: ' + command);

  exec(
    command,
    {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 200*1024,
      killSignal: 'SIGTERM',
      cwd: null,
      env: null
    },
    function (err, stdout, stderr) {
      if (err) {
        accessory.log('Error: ' + err);
        callback(err || new Error('Error setting ' + accessory.name + ' to ' + state));
      } else {
        accessory.log('Set ' + accessory.name + ' to ' + state);
        accessory.windowShadesService.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);              
        if (stdout.indexOf('OPEN') > -1) 
              accessory.windowShadesService.setCharacteristic(Characteristic.CurrentPosition, 100);
        else  
              accessory.windowShadesService.setCharacteristic(Characteristic.CurrentPosition, 0);
       callback(null);
     }
  });
};

WindowShadesCmdAccessory.prototype.getState = function(callback) {
  var accessory = this;
  var command = accessory.stateCommand;

  exec(command, function (err, stdout, stderr) {
    if (err) {
      accessory.log('Error: ' + err);
      callback(err || new Error('Error getting state of ' + accessory.name));
    } else {
      var statestr = stdout.toString('utf-8').trim();
      state =  Characteristic.PositionState.STOPPED;
      accessory.log('State of ' + accessory.name + ' is: ' + statestr);
      callback(null, state);
    }
  });
};

WindowShadesCmdAccessory.prototype.getCurrentPosition = function(callback) {
  var accessory = this;
  var command = accessory.stateCommand;

  exec(command, function (err, stdout, stderr) {
    if (err) {
      accessory.log('Error: ' + err);
      callback(err || new Error('Error getting state of ' + accessory.name));
    } else {
      var statestr = stdout.toString('utf-8').trim();
      state = statestr === 'OPEN'? 100 : 0;
        accessory.log('Position of ' + accessory.name + ' is: ' + state);
      callback(null, state);
    }
  });
};


WindowShadesCmdAccessory.prototype.getName = function(callback) {
   callback(null, this.name);
}

WindowShadesCmdAccessory.prototype.getServices = function() {
  this.informationService = new Service.AccessoryInformation();
  this.windowShadesService = new Service.WindowCovering(this.name);

  this.informationService
  .setCharacteristic(Characteristic.Manufacturer, 'Shades Command')
  .setCharacteristic(Characteristic.Model, 'Homebridge Plugin')
  .setCharacteristic(Characteristic.SerialNumber, '001');

  this.windowShadesService.getCharacteristic(Characteristic.Name)
  .on('get', this.getName.bind(this));

  this.windowShadesService.getCharacteristic(Characteristic.TargetPosition)
  .on('set', this.setTargetPosition.bind(this));

  this.windowShadesService.getCharacteristic(Characteristic.CurrentPosition)
  .on('get', this.getCurrentPosition.bind(this));

  this.windowShadesService.getCharacteristic(Characteristic.PositionState)
  .on('get', this.getState.bind(this));

  return [this.informationService, this.windowShadesService];
};
