CREATE TABLE android_trials (device TEXT PRIMARY KEY, started INTEGER NOT NULL);
CREATE TABLE android_purchases (token_hash TEXT PRIMARY KEY, product TEXT NOT NULL, entitled INTEGER NOT NULL, valid_until INTEGER NOT NULL);
CREATE TABLE android_devices (device TEXT NOT NULL, token_hash TEXT NOT NULL REFERENCES android_purchases(token_hash), PRIMARY KEY(device,token_hash));
