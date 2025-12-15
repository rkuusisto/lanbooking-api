import { Request, TYPES } from 'tedious';
import azureSqlConnection from '../utils/azureSqlConnection.js';

class RegistrationService {
    // Helper function to normalize TinyInt values
    // Handles frontend's weird boolean format: ["on"] for true, undefined for false
    // Also converts undefined, null, empty strings, or string numbers to valid TinyInt values
    normalizeTinyInt(value) {
        // Handle frontend's boolean format: array with ["on"] means true
        if (Array.isArray(value)) {
            if (value.length > 0 && value[0] === 'on') {
                return 1;
            }
            // Empty array or other values -> false
            return 0;
        }
        
        // Handle undefined/null/empty -> false (0)
        if (value === null || value === undefined || value === '') {
            return 0;
        }
        
        // Try to convert to number
        const num = typeof value === 'string' ? parseInt(value, 10) : Number(value);
        if (isNaN(num)) {
            return 0;
        }
        // Ensure value is within TinyInt range (0-255)
        return Math.max(0, Math.min(255, num));
    }

    register(model, callback) {
        var connection = azureSqlConnection.connect();

        // Attempt to connect and execute queries if connection goes through
        connection.on('connect', (connErr) => {
            if (connErr) {
                console.log(connErr)
            }
            else {
                // Store registration
                var query = `INSERT INTO [dbo].[Lanregistration]
                                    ([Firstname],[Lastname],[Phone],[Email],[ParentName],[ParentPhone],
                                    [DevicePC],[DeviceConsole],[DeviceHanging],[DeviceOther],[DeviceOtherComment],
                                    [AttendingThu],[AttendingFri],
                                    [TournamentBS],[TournamentOW],[TournamentLOL],[TournamentMC],[TournamentCS],[TournamentTetris],
                                    [TournamentTableFB],[TournamentTableTennis],[TournamentBiljard],[TournamentOther],[TournamentOtherComment],
                                    [Food],[Diet],[DietL],[DietG],[DietV],[DietOther],[DietOtherComment],[Nickname],[SteamID],[Feedback])
                            VALUES
                                    (@firstname,@lastname,@phone,@email,@parentName,@parentPhone,
                                    @devicePC,@deviceConsole,@deviceHanging,@deviceOther,@deviceOtherComment,
                                    @attendingThu,@attendingFri,
                                    @tournamentBS,@tournamentOW,@tournamentLOL,@tournamentMC,@tournamentCS,@tournamentTetris,
                                    @tournamentTableFB,@tournamentTableTennis,@tournamentBiljard,@tournamentOther,@tournamentOtherComment,
                                    @food,@diet,@dietL,@dietG,@dietV,@dietOther,@dietOtherComment,@nickname,@steamId,@feedback);
                            SELECT @@identity`;

                var request = new Request(query,
                    (err, rowCount, rows) => {
                        if (err) {
                            console.log(err);
                        }
                        // console.log("rowcount r: " + rowCount);
                        if (rowCount === 0) {
                            callback(null);
                        }
                        else {
                            //console.log('New id: %d', rows[0][0].value)
                            callback(rowCount);
                        }
                    });

                request.addParameter('firstname', TYPES.NVarChar, model.etunimi);
                request.addParameter('lastname', TYPES.NVarChar, model.sukunimi);
                request.addParameter('phone', TYPES.NVarChar, model.puhelin);
                request.addParameter('email', TYPES.NVarChar, model.email);
                request.addParameter('parentName', TYPES.NVarChar, model.huoltajaNimi);
                request.addParameter('parentPhone', TYPES.NVarChar, model.huoltajaPuhelin);
                request.addParameter('devicePC', TYPES.TinyInt, this.normalizeTinyInt(model.mukaanPc));
                request.addParameter('deviceConsole', TYPES.TinyInt, this.normalizeTinyInt(model.mukaanKonsoli));
                request.addParameter('deviceHanging', TYPES.TinyInt, this.normalizeTinyInt(model.mukaanHengailu));
                request.addParameter('deviceOther', TYPES.TinyInt, this.normalizeTinyInt(model.mukaanMuuta));
                request.addParameter('deviceOtherComment', TYPES.NVarChar, model.mukaanMuutaKommentti);
                request.addParameter('attendingThu', TYPES.TinyInt, this.normalizeTinyInt(model.osallistumisToPe));
                request.addParameter('attendingFri', TYPES.TinyInt, this.normalizeTinyInt(model.osallistumisPeLa));
                request.addParameter('tournamentBS', TYPES.TinyInt, this.normalizeTinyInt(model.turnausBS));
                request.addParameter('tournamentOW', TYPES.TinyInt, this.normalizeTinyInt(model.turnausOW));
                request.addParameter('tournamentLOL', TYPES.TinyInt, this.normalizeTinyInt(model.turnausLOL));
                request.addParameter('tournamentMC', TYPES.TinyInt, this.normalizeTinyInt(model.turnausMC));
                request.addParameter('tournamentCS', TYPES.TinyInt, this.normalizeTinyInt(model.turnausCS));
                request.addParameter('tournamentTetris', TYPES.TinyInt, this.normalizeTinyInt(model.turnausTetris));
                request.addParameter('tournamentNerf', TYPES.TinyInt, this.normalizeTinyInt(model.turnausNerf));
                request.addParameter('tournamentTableFB', TYPES.TinyInt, this.normalizeTinyInt(model.turnausTableFB));
                request.addParameter('tournamentTableTennis', TYPES.TinyInt, this.normalizeTinyInt(model.turnausTableTennis));
                request.addParameter('tournamentBiljard', TYPES.TinyInt, this.normalizeTinyInt(model.turnausBiljari));
                request.addParameter('tournamentOther', TYPES.TinyInt, this.normalizeTinyInt(model.turnausMuuta));
                request.addParameter('tournamentOtherComment', TYPES.NVarChar, model.turnausMuutaKommentti);
                request.addParameter('food', TYPES.TinyInt, this.normalizeTinyInt(model.ruoka));
                request.addParameter('diet', TYPES.TinyInt, this.normalizeTinyInt(model.ruokaKaikki));
                request.addParameter('dietL', TYPES.TinyInt, this.normalizeTinyInt(model.ruokaLaktoositon));
                request.addParameter('dietG', TYPES.TinyInt, this.normalizeTinyInt(model.ruokaGluteeniton));
                request.addParameter('dietV', TYPES.TinyInt, this.normalizeTinyInt(model.ruokaVegaani));
                request.addParameter('dietOther', TYPES.TinyInt, this.normalizeTinyInt(model.ruokaMuu));
                request.addParameter('dietOtherComment', TYPES.NVarChar, model.ruokaMuuKommentti);
                request.addParameter('nickname', TYPES.NVarChar, model.nickname);
                request.addParameter('steamId', TYPES.NVarChar, model.steamId);
                request.addParameter('feedback', TYPES.NVarChar, model.feedback);

                connection.execSql(request);
                connection.on('requestCompleted', function () {
                    connection.close();
                });
            }
        });

        connection.connect();
    }

    isRegistered(email, callback) {
        var connection = azureSqlConnection.connect();
        
        connection.on('connect', (connErr) => {
            if (connErr) {
                console.log(connErr)
            }
            else {
                var request = new Request("SELECT * FROM [Lanregistration] WHERE Email = @email AND History IS NULL",
                        (err, rowCount) => {
                            if (err) {
                                console.log(err);
                            } else {
                                callback({'registered': rowCount > 0});
                            }
                        });

                        request.addParameter('email', TYPES.NVarChar, email);

                connection.execSql(request);
                connection.on('requestCompleted', function () {
                    connection.close();
                });
            }
        });

        connection.connect();
    }

    tournaments(callback) {
        var connection = azureSqlConnection.connect();

        connection.on('connect', (connErr) => {
            if (connErr) {
                console.log(connErr)
            }
            else {
                var request = new Request("SELECT Id, Name, Link FROM [Lantournament] WHERE Enabled = 1",
                        (err, rowCount, rows) => {
                            if (err) {
                                console.log(err);
                            }
                            console.log("rowcount: " + rowCount);
                            if (rowCount === 0) {
                                callback([]);
                            }
                            else {
                                callback(rows.map(row => {
                                        return {
                                            [row[0].metadata.colName]: row[0].value,
                                            [row[1].metadata.colName]: row[1].value,
                                            [row[2].metadata.colName]: row[2].value
                                        };
                                    }
                                ));
                            }
                        });

                connection.execSql(request);
                connection.on('requestCompleted', function () {
                    connection.close();
                });
            }
        });

        connection.connect();
    }

    count(callback) {
        var connection = azureSqlConnection.connect();

        connection.on('connect', (connErr) => {
            if (connErr) {
                console.log(connErr)
            }
            else {
                var request = new Request("SELECT COUNT(*) FROM [Lanregistration] WHERE History IS NULL",
                        (err, rowCount, rows) => {
                            if (err) {
                                console.log(err);
                            }
                            console.log("rowcount: " + rowCount);
                            if (rowCount === 0) {
                                callback([]);
                            }
                            else {
                                callback(rows.map(row => {
                                        return row[0].value;
                                    }
                                ));
                            }
                        });

                connection.execSql(request);
                connection.on('requestCompleted', function () {
                    connection.close();
                });
            }
        });

        connection.connect();
    }

}

export default new RegistrationService();
