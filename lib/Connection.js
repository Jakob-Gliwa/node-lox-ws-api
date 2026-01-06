const WebSocket = require('ws');

const MessageHeader = require('./Message/Header.js');
const MessageText = require('./Message/Text.js');
const MessageFile = require('./Message/File.js');
const MessageEventValue = require('./Message/EventValue.js');
const MessageEventText = require('./Message/EventText.js');
const MessageEventDaytimer = require('./Message/EventDaytimer.js');
const MessageEventWeather = require('./Message/EventWeather.js');

/*
    Events:
        close
        close_failed
        connect
        connect_failed
        connection_error
        send
        message_header
        message_text
        message_file
        message_event_table_values
        message_event_table_text
        message_event_table_daytimer
        message_event_table_weather
        message_invalid
        keepalive
*/

var Connection = function (host, keepalive) {
    this._host = host;
    this._keepalive = (keepalive === undefined ? 30000 : keepalive);
    this._keepalive_interval = undefined;
    this._keepalive_time = undefined;
    this._keepalive_response_time = undefined;
    this._reconnect_interval = undefined;
    this._ws_url = 'ws://' + host + '/ws/rfc6455';
    this._ws = undefined;
    this._connection_data = {};
};

Connection.prototype.__proto__ = require('events').EventEmitter.prototype;

Connection.prototype.connect = function () {
    var that = this;
    
    // Create new WebSocket instance with protocol
    this._ws = new WebSocket(this._ws_url, {
        protocol: 'remotecontrol'
    });
    
    // Handle connection errors (before open)
    this._ws.on('error', function (error) {
        console.log("WebSocket error: ", error.message);
        let reason = ' (' + (error.code || 'unknown') + ')';
        that.emit('connect_failed', error, reason);
    });
    
    // Handle successful connection
    this._ws.on('open', function () {
        that.register_connection();
        that.emit('connect');
    });
};

Connection.prototype.close = function () {
    if (this._ws !== undefined) {
        clearInterval(this._keepalive_interval);
        this._ws.close();
    } else {
        this.emit('close_failed');
    }
};

Connection.prototype.register_connection = function () {
    var that = this;
    this._connection_data = {
        'message_state': 'header',
        'status_update_subscription': false,
    };
    this._keepalive_interval = setInterval(function () {
        that._keepalive_response_time = Date.now();
        if (that._ws !== undefined && that._ws.readyState === WebSocket.OPEN) {
            that._ws.send('keepalive');
        } else {
            clearInterval(that._keepalive_interval);
        }
    }, this._keepalive);

    this._reconnect_interval = setInterval(function () {
        if (that._keepalive_time !== undefined) {
            const timeSinceLastKeepalive = Date.now() - that._keepalive_time;
            if (timeSinceLastKeepalive > parseInt(that._keepalive) + 2000) {
                that.emit('close', true, 'timeout');
                clearInterval(that._reconnect_interval)
            }
        }
    }, 5000);

    /*
    this._ws.connection.on('close', function() {
        that._ws.connection = undefined;
        clearInterval(that._keepalive_interval);
        if (that._connection_data.last_header && that._connection_data.last_header.identifier == '5'){
            that.emit('close', true);
        }else{
            that.emit('close', false);
        }
    });

    this._ws.connection.on('error', function(error) {
        clearInterval(that._keepalive_interval);
        that.emit('connection_error', error);
    });
    */

    this._ws.on('close', function (code, reason) {
        const reasonStr = (reason ? reason.toString() : '') + ' (' + code + ')';
        console.log("Websocket Connection closed: ", code, reason);
        that._ws = undefined;
        clearInterval(that._keepalive_interval);
        clearInterval(that._reconnect_interval);
        if (that._connection_data.last_header && that._connection_data.last_header.identifier == '5') {
            that.emit('close', true, reasonStr);
        } else {
            that.emit('close', false, reasonStr);
        }
    });

    this._ws.on('error', function (error) {
        console.log("WebSocket error: ", error.message);
        clearInterval(that._keepalive_interval);
        clearInterval(that._reconnect_interval);
        let reason = error.message + ' (' + (error.code || 'unknown') + ')';
        that.emit('connection_error', error, reason);
    });

    this._ws.on('message', function (data, isBinary) {
        // Adapt ws message format to match expected format for handle_message
        const message = isBinary 
            ? { type: 'binary', binaryData: data }
            : { type: 'utf8', utf8Data: typeof data === 'string' ? data : data.toString() };
        that.handle_message(message);
    });
};

Connection.prototype.send = function (message) {
    if (this._ws !== undefined && this._ws.readyState === WebSocket.OPEN) {
        this._connection_data.last_request = message;
        this._ws.send(message);
        this.emit('send', message);
    }
};

Connection.prototype.handle_message = function (message) {
    var that = this;
    this.emit('handle_message', message);
    switch (this._connection_data.message_state) {
        case 'header':
            if (message.type !== 'binary') {
                this.emit('message_invalid', message);
                break;
            }
            this._connection_data.last_header = new MessageHeader(message.binaryData);
            this._connection_data.message_state = this._connection_data.last_header.next_state();
            if (this._connection_data.last_header.identifier == 6){
                that._keepalive_time = Date.now();
                this.emit('keepalive', Date.now() - this._keepalive_response_time);
            }
            this.emit('message_header', this._connection_data.last_header);
            break;
        case 'text':
            if (message.type === 'binary') {
                this.emit('message_invalid', message);
                break;
            }
            this.emit('message_text', new MessageText(message.utf8Data));
            this._connection_data.message_state = 'header';
            break;
        case 'binary_file':
            this.emit('message_file', new MessageFile(message, that._connection_data.last_request));
            this._connection_data.message_state = 'header';
            break;
        case 'etable_values':
            if (message.type !== 'binary') {
                this.emit('message_invalid', message);
                break;
            }
            var event_table = [];
            var buffer_index = 0;
            while (buffer_index < message.binaryData.length) {
                var event_item = new MessageEventValue(message.binaryData, buffer_index);
                event_table.push(event_item);
                buffer_index += event_item.data_length;
            }
            this.emit('message_event_table_values', event_table);
            this._connection_data.message_state = 'header';
            break;
        case 'etable_text':
            if (message.type !== 'binary') {
                this.emit('message_invalid', message);
                break;
            }
            var event_table = [];
            var buffer_index = 0;
            while (buffer_index < message.binaryData.length) {
                var event_item = new MessageEventText(message.binaryData, buffer_index);
                event_table.push(event_item);
                buffer_index += event_item.data_length;
            }
            this.emit('message_event_table_text', event_table);
            this._connection_data.message_state = 'header';
            break;
        case 'etable_daytimer':
            if (message.type !== 'binary') {
                this.emit('message_invalid', message);
                break;
            }
            var event_table = [];
            var buffer_index = 0;
            while (buffer_index < message.binaryData.length) {
                var event_item = new MessageEventDaytimer(message.binaryData, buffer_index);
                event_table.push(event_item);
                buffer_index += event_item.data_length;
            }
            this.emit('message_event_table_daytimer', event_table);
            this._connection_data.message_state = 'header';
            break;
        case 'etable_weather':
            if (message.type !== 'binary') {
                this.emit('message_invalid', message);
                break;
            }
            var event_table = [];
            var buffer_index = 0;
            while (buffer_index < message.binaryData.length) {
                var event_item = new MessageEventWeather(message.binaryData, buffer_index);
                event_table.push(event_item);
                buffer_index += event_item.data_length;
            }
            this.emit('message_event_table_weather', event_table);
            this._connection_data.message_state = 'header';
            break;
        default:
            this.emit('unknown_message_state', message);
            this._connection_data.message_state = 'header';
    }
};

module.exports = Connection;
