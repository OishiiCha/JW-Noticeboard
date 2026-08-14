#!/bin/bash
# Daily backup script — exports SQLite DB to JSON and stores in /app/data/backups/
# Runs via cron inside Docker container

set -e

DB_PATH="/app/data/noticeboard.db"
BACKUP_DIR="/app/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.json"

mkdir -p "$BACKUP_DIR"

# Export all tables as JSON using sqlite3
TABLES=$(sqlite3 "$DB_PATH" ".tables" | tr ' ' '\n' | grep -v '^$' | sort)

echo "{" > "$BACKUP_FILE"
FIRST=true
for TABLE in $TABLES; do
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo "," >> "$BACKUP_FILE"
  fi
  echo -n "  \"$TABLE\": " >> "$BACKUP_FILE"
  sqlite3 "$DB_PATH" "SELECT json_group_array(json_object($(sqlite3 "$DB_PATH" "SELECT group_concat(column_name || ': ' || column_name) FROM (SELECT name as column_name FROM pragma_table_info('$TABLE'))"))" FROM "$TABLE")" >> "$BACKUP_FILE" 2>/dev/null || echo "[]" >> "$BACKUP_FILE"
done
echo "}" >> "$BACKUP_FILE"

SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || echo 0)

# Log to BackupLog table
sqlite3 "$DB_PATH" "INSERT INTO BackupLog (id, filename, size, type, status, createdAt) VALUES (lower(hex(randomblob(8)) || hex(randomblob(4)) || '4' || substr(hex(randomblob(2)), 2) || 'a' || substr(hex(randomblob(2)), 2) || hex(randomblob(6))), '$(basename $BACKUP_FILE)', $SIZE, 'scheduled', 'success', datetime('now'));"

echo "Backup completed: $BACKUP_FILE ($SIZE bytes)"

# Clean up backups older than 30 days
find "$BACKUP_DIR" -name "backup_*.json" -mtime +30 -delete 2>/dev/null || true
echo "Old backups cleaned up"
