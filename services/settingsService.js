import { Request, TYPES } from 'tedious';
import azureSqlConnection from '../utils/azureSqlConnection.js';

class SettingsService {

  getSettings(callback) {
    var connection = azureSqlConnection.connect();

    connection.on('connect', connErr => {
      if (connErr) {
        console.log(connErr);
        connection.close();
        callback({ error: 'connection error' });
      } else {
        var request = new Request(
          'SELECT * FROM [LanSettings] ORDER BY id DESC',
          (err, rowCount, rows) => {
            if (err) {
              console.error('request error:');
              console.log(err);
              connection.close();
              callback({ error: 'request error' });
              return;
            }

            connection.close();
            if (rowCount === 0) {
              callback({ error: 'No settings found' });
            } else {
              const settings = {};
              rows[0].forEach(col => {
                if (col.metadata.colName === 'startDate' || col.metadata.colName === 'endDate') {
                  // Format date as yyyy-mm-dd
                  const date = new Date(col.value);
                  settings[col.metadata.colName] = date.toISOString().split('T')[0];
                } else {
                  settings[col.metadata.colName] = col.value;
                }
              });
              callback(settings);
            }
          }
        );

        connection.execSql(request);
      }
    });

    connection.connect();
  }
}
export default new SettingsService();
