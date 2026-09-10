import { Request, TYPES } from 'tedious';
import sendgrid from '@sendgrid/mail';
import azureSqlConnection from '../utils/azureSqlConnection.js';
import config from '../config/config.js';

class BookingService {
  query(email, code, callback) {
    var connection = azureSqlConnection.connect();

    connection.on('connect', connErr => {
      if (connErr) {
        console.log(connErr);
          connection.close();
          callback({error: 'connection error'});
      } else {
        var request = new Request(
          'SELECT Location FROM [Lanbooking] WHERE Email = @email AND Code = @code',
          (err, rowCount, rows) => {
            if (err) {
              console.error('request error:');
              console.log(err);
                connection.close();
                callback({error: 'request error'});
                return;
            }

              connection.close();
              if (rowCount === 0) {
              callback(null);
            } else {
              rows[0][0].value == null
                ? callback('-')
                : callback(rows[0][0].value);
            }
          }
        );

        request.addParameter('email', TYPES.NVarChar, email);
        request.addParameter('code', TYPES.NVarChar, code);

        connection.execSql(request);
      }
    });

    connection.connect();
  }

  store(email, code, location, callback) {
    var connection = azureSqlConnection.connect();
    var finished = false;

    const fail = error => {
      if (finished) {
        return;
      }
      finished = true;
      connection.close();
      callback({ error });
    };

    const succeed = value => {
      if (finished) {
        return;
      }
      finished = true;
      connection.close();
      callback(value);
    };

    const runUpdate = () => {
      var request = new Request(
        'UPDATE [Lanbooking] SET Location = @location WHERE Email = @email AND Code = @code',
        (err, rowCount) => {
          if (err) {
            console.error('request error:');
            console.log(err);
            fail('request error');
            return;
          }
          if (rowCount === 0) {
            fail('no result');
            return;
          }
          succeed(rowCount);
        }
      );

      request.addParameter('email', TYPES.NVarChar, email);
      request.addParameter('code', TYPES.NVarChar, code);
      request.addParameter('location', TYPES.NVarChar, location);
      connection.execSql(request);
    };

    const checkTaken = () => {
      var request = new Request(
        'SELECT Id FROM [Lanbooking] WHERE Location = @location AND NOT (Email = @email AND Code = @code)',
        (err, rowCount) => {
          if (err) {
            console.error('request error:');
            console.log(err);
            fail('request error');
            return;
          }
          if (rowCount > 0) {
            fail('location already booked');
            return;
          }
          runUpdate();
        }
      );

      request.addParameter('location', TYPES.NVarChar, location);
      request.addParameter('email', TYPES.NVarChar, email);
      request.addParameter('code', TYPES.NVarChar, code);
      connection.execSql(request);
    };

    const checkBlocked = () => {
      var request = new Request(
        'SELECT Id FROM [BlockedLocations] WHERE Location = @location',
        (err, rowCount) => {
          if (err) {
            console.error('request error:');
            console.log(err);
            fail('request error');
            return;
          }
          if (rowCount > 0) {
            fail('location blocked');
            return;
          }
          checkTaken();
        }
      );

      request.addParameter('location', TYPES.NVarChar, location);
      connection.execSql(request);
    };

    connection.on('connect', connErr => {
      if (connErr) {
        console.log(connErr);
        connection.close();
        callback({ error: 'connection error' });
        return;
      }

      if (location == null || location === '' || location === '-') {
        runUpdate();
      } else {
        checkBlocked();
      }
    });

    connection.connect();
  }

  getBlockedLocations(callback) {
    var connection = azureSqlConnection.connect();

    connection.on('connect', connErr => {
      if (connErr) {
        console.log(connErr);
        connection.close();
        callback({ error: 'connection error' });
      } else {
        var request = new Request(
          'SELECT Location FROM [BlockedLocations]',
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
              callback([]);
            } else {
              callback(rows.map(row => row[0].value));
            }
          }
        );

        connection.execSql(request);
      }
    });

    connection.connect();
  }

  isBooked(location, callback) {
    var connection = azureSqlConnection.connect();

    connection.on('connect', connErr => {
      if (connErr) {
        console.log(connErr);
          connection.close();
          callback({error: 'connection error'});
      } else {
        var request = new Request(
          'SELECT * FROM [Lanbooking] WHERE Location = @location',
          (err, rowCount) => {
            if (err) {
              console.error('request error:');
              console.log(err);
              callback({ error: 'request error' });
              return;
            }
            console.log('rowcount: ' + rowCount);
            callback({ booked: rowCount > 0 });
          }
        );

        request.addParameter('location', TYPES.NVarChar, location);

        connection.execSql(request);
      }
    });

    connection.connect();
  }

  allbooked(callback) {
    var connection = azureSqlConnection.connect();

    // Attempt to connect and execute queries if connection goes through
    connection.on('connect', connErr => {
      if (connErr) {
        console.log(connErr);
          connection.close();
          callback({error: 'connection error'});
      } else {
        // Read all rows from table
        var request = new Request(
          'SELECT Location FROM [Lanbooking] WHERE Location IS NOT NULL',
          (err, rowCount, rows) => {
            if (err) {
              console.error('request error:');
              console.log(err);
              callback({ error: 'request error' });
              return;
            }

            if (rowCount === 0) {
              callback([]);
            } else {
              callback(rows.map(row => row[0].value));
            }
          }
        );

        connection.execSql(request);
      }
    });

    connection.connect();
  }

  sendEmails(callback) {
    var connection = azureSqlConnection.connect();

    connection.on('connect', connErr => {
      if (connErr) {
        console.log(connErr);
      } else {
        // Read all rows from table send only for those who has note yet registered
        var request = new Request(
          'SELECT Email FROM [Lanbooking] WHERE InvitationSent = 0; UPDATE [Lanbooking] SET InvitationSent = 1 WHERE InvitationSent = 0;',
          (err, rowCount, rows) => {
            if (err) {
              console.error('request error:');
              console.log(err);
              callback({ error: 'request error' });
              return;
            }
            if (rowCount === 0) {
              callback({ error: 'No emails to sent' });
              return;
            }
            connection.close();

            var emails = rows.map(row => row[0].value);
            //callback(rows.map(row => row[0].value));

            this.sendMail(this.createInvitationMessage(emails), callback);
          }
        );

        connection.execSql(request);
      }
    });

    connection.connect();
  }

  createAccount(email, callback) {
    var connection = azureSqlConnection.connect();
    var code = `tammilanit${this.makeCode()}`;

    // Attempt to connect and execute queries if connection goes through
    connection.on('connect', connErr => {
      if (connErr) {
        console.error(connErr);
      } else {
        // Is already registered?
        var request = new Request(
          'SELECT * FROM [Lanbooking] WHERE Email = @email',
          (err, rowCount) => {
            if (err) {
              console.error('request error:');
              console.error(err);
              callback({ error: 'request error' });
              return;
            }

            if (rowCount > 0) {
              console.log('update account: ' + email);
              this.updateAccountWithCode(connection, email, code, callback);
              return;
            }

            // not yet registered
            console.log('create account: ' + email);
            this.createNewAccountWithCode(connection, email, code, callback);
          }
        );

        request.addParameter('email', TYPES.NVarChar, email);
        connection.execSql(request);
      }
    });

    connection.connect();
  }

  createNewAccountWithCode(connection, email, code, callback) {
    // Create account all rows from table send only for those who has note yet registered
    var request = new Request(
      'INSERT INTO [Lanbooking] (Email, Code) VALUES (@email, @code)',
      (err, rowCount) => {
        if (err) {
          console.error('request error:');
          console.error(err);
          callback({ error: 'request error' });
          return;
        }
        connection.close();

        if (rowCount === 0) {
          callback({ error: 'INSERT failed' });
          return;
        }

        console.log('send email to ' + email);
        this.sendMail(this.createBookingMessage(email, code), callback);
      }
    );

    request.addParameter('code', TYPES.NVarChar, code);
    request.addParameter('email', TYPES.NVarChar, email);

    connection.execSql(request);
  }

  updateAccountWithCode(connection, email, code, callback) {
    // Update account code and send email
    var request = new Request(
      'UPDATE [Lanbooking] SET Code = @code WHERE Email = @email',
      (err, rowCount) => {
        if (err) {
          console.error('request error:');
          console.error(err);
          callback({ error: 'request error' });
          return;
        }
        connection.close();

        if (rowCount === 0) {
          callback({ error: 'UPDATE failed' });
          return;
        }

        console.log('send email to ' + email);
        this.sendMail(this.createBookingMessage(email, code), callback);
      }
    );

    request.addParameter('code', TYPES.NVarChar, code);
    request.addParameter('email', TYPES.NVarChar, email);

    connection.execSql(request);
  }

  createBookingMessage(email, code) {
    return {
      to: email,
      from: 'Tammilanit <info@tammilan.it>',
      templateId: config.SG_BOOKING_TEMPLATE_ID,
      dynamic_template_data: {
        email: email,
        code: code,
      },
    };
  }

  createInvitationMessage(emails) {
    return {
      to: emails,
      from: 'Tammilanit <info@tammilan.it>',
      templateId: config.SG_INVITE_TEMPLATE_ID,
      dynamic_template_data: {
        date: '17.-19.01.2025',
      },
    };
  }

  sendMail(msg, callback) {
    sendgrid.setApiKey(config.SG_API_KEY);

    sendgrid
      .send(msg, true)
      .then(result => {
        console.log('sent');
        console.log(msg);

        if (Array.isArray(msg.to)) {
          callback({ success: true, count: msg.to.length });
        } else {
          callback({ success: true });
        }
      })
      .catch(error => {
        console.error('email send error:');
        console.error(error);
        callback({ error: error });
      });
  }

  makeCode() {
    var text = '';
    var possible = '123456789';

    for (var i = 0; i < 5; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
  }

  getSettings(callback) {
    var connection = azureSqlConnection.connect();

    connection.on('connect', connErr => {
      if (connErr) {
        console.log(connErr);
        connection.close();
        callback({ error: 'connection error' });
      } else {
        var request = new Request(
          'SELECT TOP 1 total, startDate, endDate, eventName FROM [LanSettings] ORDER BY id DESC',
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

  getAllTableGroups(callback) {
    var connection = azureSqlConnection.connect();

    connection.on('connect', connErr => {
      if (connErr) {
        console.log(connErr);
        connection.close();
        callback({ error: 'connection error' });
      } else {
        var request = new Request(
          'SELECT * FROM [TableGroups]',
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
              callback([]);
            } else {
              const tableGroups = rows.map(row => {
                const group = {};
                row.forEach(col => {
                  if (col.value !== null) {
                    if (col.metadata.colName === 'style') {
                      group[col.metadata.colName] = JSON.parse(col.value);
                    } else {
                      group[col.metadata.colName] = col.value;
                    }
                  }
                });
                return group;
              });
              callback(tableGroups);
            }
          }
        );

        connection.execSql(request);
      }
    });

    connection.connect();
  }
}

export default new BookingService();
