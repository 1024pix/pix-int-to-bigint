require('dotenv').config();
const execa = require('execa');
const fs = require('fs');

const RESTORE_LIST_FILENAME = './restore.list';
const BACKUP_FILENAME = './dump.pgsql';

const keepAlive = () => {
   const oneMinute = 1000 * 60;
   setInterval(() => {
      console.log('alive')
   }, oneMinute)
}

function execShell(cmdline) {
   return execa(cmdline, {stdio: 'inherit', shell: true});
}

function exec(cmd, args) {
   return execa(cmd, args, {stdio: 'inherit'});
}

async function execStdOut(cmd, args) {
   const { stdout } = await execa(cmd, args, { stderr: 'inherit' });
   return stdout;
}

async function setupPath() {
   await execShell('mkdir -p "$HOME/bin"');
   process.env.PATH = process.env.HOME + '/bin' + ':' + process.env.PATH;
}

function installPostgresClient() {
   return exec('dbclient-fetcher', ['pgsql']);
}

async function setupDatabaseClient() {
   if (process.env.NODE_ENV === 'production') {
      await setupPath();
      await installPostgresClient();
   }
}

async function writeRestoreList() {
   const backupObjectList = await execStdOut('pg_restore', [ BACKUP_FILENAME, '-l' ]);
   const backupObjectLines = backupObjectList.split('\n');

   const filteredObjectLines = backupObjectLines
      .filter((line) => !/ COMMENT /.test(line)).filter((line) => !/FK CONSTRAINT/.test(line));

   fs.writeFileSync(RESTORE_LIST_FILENAME, filteredObjectLines.join('\n'));
}

async function createBackup({databaseUrl, tableName}) {

   console.info('Creating backup...');

   await exec('pg_dump', [
      '--clean',
      '--if-exists',
      '--format', 'c',
      '--dbname', databaseUrl,
      '--no-owner',
      '--no-privileges',
      '--no-comments',
      '--table', tableName,
      '--file', BACKUP_FILENAME,
      '--verbose'
   ]);

   console.info('End create Backup');
}

async function restoreBackup({databaseUrl}) {

   await writeRestoreList();

   console.info('Start restore');

   try {

      await exec('pg_restore', [
         '--verbose',
         '--no-owner',
         '--clean',
         `--dbname=${databaseUrl}`,
         '--use-list', RESTORE_LIST_FILENAME,
         BACKUP_FILENAME
      ]);

   } finally {
      fs.unlinkSync(BACKUP_FILENAME);
      fs.unlinkSync(RESTORE_LIST_FILENAME);
   }

   console.info('Restore done');
}

async function backupAndRestore() {

   const configuration = {
      sourceDatabaseUrl: process.env.SOURCE_DATABASE_URL,
      tableName: process.env.TABLE_TO_COPY,
      targetDatabaseUrl: process.env.DATABASE_URL
   }

   if(!configuration.sourceDatabaseUrl || !configuration.tableName || !configuration.targetDatabaseUrl){
      console.error('Invalid configuration');
      process.exit(1);
   }

   await setupDatabaseClient();

   await createBackup({
      databaseUrl: configuration.sourceDatabaseUrl,
      tableName: configuration.tableName
   });

   await restoreBackup({ databaseUrl: configuration.targetDatabaseUrl});
}

(async () => {
   keepAlive();
   await backupAndRestore();
   process.exit(0);
})()
