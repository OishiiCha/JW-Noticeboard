CREATE TABLE IF NOT EXISTS BackupLog (
    id TEXT NOT NULL PRIMARY KEY,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'success',
    createdBy TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS BackupLog_createdAt_idx ON BackupLog(createdAt);

CREATE TABLE IF NOT EXISTS ActionLog (
    id TEXT NOT NULL PRIMARY KEY,
    userId TEXT,
    userEmail TEXT,
    userRole TEXT,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    entityId TEXT,
    entityName TEXT,
    details TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ActionLog_createdAt_idx ON ActionLog(createdAt);
CREATE INDEX IF NOT EXISTS ActionLog_module_idx ON ActionLog(module);
CREATE INDEX IF NOT EXISTS ActionLog_userId_idx ON ActionLog(userId);
