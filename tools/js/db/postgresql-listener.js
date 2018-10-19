// postgresql-listener
// © Will Smart 2018. Licence: MIT

// TODO describe

const ConvertIds = require('../datapoints/convert-ids');
const PostgresqlConnection = require('../db/postgresql-connection');
const PublicApi = require('../general/public-api');
const log = require('../general/log');

// API is auto-generated at the bottom from the public interface of this class

class PostgresqlListener {
  // public methods
  static publicMethods() {
    return ['listenForDatapointChanges', 'startDBChangeNotificationPrompter', 'listen', 'connection'];
  }

  constructor({ connection }) {
    Object.assign(this, {
      _connection: connection,
      listeningChannels: {},
    });
  }

  get connection() {
    return this._connection;
  }

  async listenForDatapointChanges({ cache, schema }) {
    return this.listen({
      channel: 'modelchanges',
      callbackKey: 'listenForDatapointChanges',
      callback: changes => {
        try {
          changes = JSON.parse(changes);
          log('db.changes', () => `DB has model changes: ${JSON.stringify(changes)}`);
          if (Array.isArray(changes)) {
            changes.forEach(datapointId => {
              if (datapointId.endsWith('_id')) datapointId = datapointId.substring(0, datapointId.length - 3);
              if (datapointId.endsWith('__+') || datapointId.endsWith('__-')) return;

              const datapoint = cache.getExistingDatapoint(datapointId);
              if (datapoint) datapoint.invalidate();
            });
          }
        } catch (error) {
          log('err.db.changes', `Error while handling db model change: ${error.message}`);
        }
      },
    });
  }

  async startDBChangeNotificationPrompter({ delay = 100 }) {
    const pgListener = this,
      connection = pgListener.connection;

    await pgListener.listen({
      channel: 'modelchanges',
      callbackKey: 'startDBChangeNotificationPrompter',
      callback: changes => {
        if (pgListener.dbcnpTimeout === undefined) return;
        clearTimeout(pgListener.dbcnpTimeout);
      },
    });
    await pgListener.listen({
      channel: 'prompterscript',
      callbackKey: 'startDBChangeNotificationPrompter',
      callback: () => {
        if (pgListener.dbcnpTimeout !== undefined) return;
        pgListener.dbcnpTimeout = setTimeout(() => {
          delete pgListener.dbcnpTimeout;
          log('db.changes', 'Telling the db to notify others of the outstanding change');
          connection.query("UPDATE model_change_notify_request SET model_change_id = 0 WHERE name = 'modelchanges';");
        }, delay);
      },
    });
  }

  async listeningClient() {
    const pgListener = this,
      connection = pgListener.connection;

    if (pgListener._listeningClient) return pgListener._listeningClient;

    pgListener._listeningClient = await connection.newConnectedClient();

    pgListener._listeningClient.on('notification', msg => {
      log('db.verbose.changes', `Received message from db on ${msg.channel}: "${msg.payload}"`);
      const callbacks = pgListener.listeningChannels[msg.channel];
      if (callbacks)
        Object.keys(callbacks).forEach(key => {
          callbacks[key](msg.payload);
        });
    });

    return pgListener._listeningClient;
  }

  async listen({ channel, callback, callbackKey }) {
    const pgListener = this;

    if (!channel) throw new Error('Please supply a channel');
    if (typeof callback != 'function') throw new Error('Please supply a callback function');
    callbackKey = callbackKey || 'default';

    if (!pgListener.listeningChannels[channel]) {
      pgListener.listeningChannels[channel] = {};

      const sql = `LISTEN ${channel};`;
      log('db.verbose.changes', sql);
      const client = await pgListener.listeningClient();
      await client.query(sql);
    }

    pgListener.listeningChannels[channel][callbackKey] = callback;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: PostgresqlListener,
  hasExposedBackDoor: true,
});
