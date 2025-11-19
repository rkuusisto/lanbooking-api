import { Connection, ISOLATION_LEVEL } from 'tedious';
import config from '../config/config.js';

class AzureSqlConnection {
    connect() {
        // Validate required configuration
        if (!config.DB_HOST || typeof config.DB_HOST !== 'string') {
            throw new Error('DB_HOST environment variable is required and must be a string');
        }
        if (!config.DB_NAME || typeof config.DB_NAME !== 'string') {
            throw new Error('DB_NAME environment variable is required and must be a string');
        }
        if (!config.DB_USER || typeof config.DB_USER !== 'string') {
            throw new Error('DB_USER environment variable is required and must be a string');
        }
        if (!config.DB_PASSWORD || typeof config.DB_PASSWORD !== 'string') {
            throw new Error('DB_PASSWORD environment variable is required and must be a string');
        }

        // Create connection to database
        var dbConfig = {
            server: config.DB_HOST,
            options: {
                database: config.DB_NAME,
                encrypt: true,
                rowCollectionOnRequestCompletion: true,
                enableArithAbort: true,
                connectionIsolationLevel: ISOLATION_LEVEL.READ_UNCOMMITTED
            },
            authentication: {
                type: "default",
                options: {
                    userName: config.DB_USER,
                    password: config.DB_PASSWORD,
                }
            }
        }

        return new Connection(dbConfig);
    }
}

export default new AzureSqlConnection();
