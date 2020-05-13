var Service;
var Characteristic;
var exec = require('child_process').exec;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-windowshades-command', 'WindowShadesCommand', WindowShadesAccessory);
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

WindowShadesCmdAccessory.prototype.setState = function(isClosed, callback, context) {
  if (context === 'pollState') {
    // The state has been updated by the pollState command - don't run the open/close command
    callback(null);
    return;
  }

  var accessory = this;
  var state = isClosed ? 'close' : 'open';
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
        if (stdout.indexOf('OPENING') > -1) {
          accessory.windowShadesService.setCharacteristic(Characteristic.CurrentShadesState, Characteristic.CurrentShadesState.OPENING);
          setTimeout(
            function() {
              accessory.windowShadesService.setCharacteristic(Characteristic.CurrentShadesState, Characteristic.CurrentShadesState.OPEN);
            },
            accessory.statusUpdateDelay * 1000
          );
        } else if (stdout.indexOf('CLOSING') > -1) {
          accessory.windowShadesService.setCharacteristic(Characteristic.CurrentShadesState, Characteristic.CurrentShadesState.CLOSING);
          setTimeout(
            function() {
              accessory.windowShadesService.setCharacteristic(Characteristic.CurrentShadesState, Characteristic.CurrentShadesState.CLOSED);
            },
            accessory.statusUpdateDelay * 1000
          );
        }
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
      var state = stdout.toString('utf-8').trim();
      if (state === 'STOPPED' && accessory.ignoreErrors) {
        state = 'CLOSED';
      }
      if (accessory.logPolling) {
        accessory.log('State of ' + accessory.name + ' is: ' + state);
      }

      callback(null, Characteristic.CurrentShadesState[state]);
    }

    if (accessory.pollStateDelay > 0) {
      accessory.pollState();
    }
  });
};

WindowShadesCmdAccessory.prototype.pollState = function() {
  var accessory = this;

  // Clear any existing timer
  if (accessory.stateTimer) {
    clearTimeout(accessory.stateTimer);
    accessory.stateTimer = null;
  }

  accessory.stateTimer = setTimeout(
    function() {
      accessory.getState(function(err, currentDeviceState) {
        if (err) {
          accessory.log(err);
          return;
        }

        if (currentDeviceState === Characteristic.CurrentShadesState.OPEN || currentDeviceState === Characteristic.CurrentShadesState.CLOSED) {
          // Set the target state to match the actual state
          // If this isn't done the Home app will show the shades in the wrong transitioning state (opening/closing)
          accessory.windowShadesService.getCharacteristic(Characteristic.TargetShadesState)
            .setValue(currentDeviceState, null, 'pollState');
        }
        accessory.windowShadesService.setCharacteristic(Characteristic.CurrentShadesState, currentDeviceState);
      })
    },
    accessory.pollStateDelay * 1000
  );
}

WindowShadesCmdAccessory.prototype.getServices = function() {
  this.informationService = new Service.AccessoryInformation();
  this.windowShadesService = new Service.WindowCovering(this.name);

  this.informationService
  .setCharacteristic(Characteristic.Manufacturer, 'Shades Command')
  .setCharacteristic(Characteristic.Model, 'Homebridge Plugin')
  .setCharacteristic(Characteristic.SerialNumber, '001');

  this.windowShadesService.getCharacteristic(Characteristic.TargetShadesState)
  .on('set', this.setState.bind(this));

  if (this.stateCommand) {
    this.windowShadesService.getCharacteristic(Characteristic.CurrentShadesState)
    .on('get', this.getState.bind(this));
    this.windowShadesService.getCharacteristic(Characteristic.TargetShadesState)
    .on('get', this.getState.bind(this));
  }

  return [this.informationService, this.windowShadesService];
};
