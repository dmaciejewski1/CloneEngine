/*******************************************************************************
FILE: postgresToOracle
PATH: lib/operations/postgresToOracle.js
SUMMARY: the tools and parts that comprise the Postgres to Oracle Operation
*******************************************************************************/
"use strict";
var pg = require('pg');
var oracledb = require('oracledb');
var oraCall = require('./transactions/Oracle.js');
var pgCall = require('./transactions/Postgres.js');
var tools = require('../tools.js');
var oraTransactionConfig= {
    autoCommit: true,
    outFormat: oracledb.OBJECT
};

function openDestinationDbConn (operation){
  return new Promise (function(resolve, reject){
    oracledb.getConnection(
      {user           :operation.destinationDb.user,
       password       :operation.destinationDb.password,
       connectString  :operation.destinationDb.connectString
      },
      function(err, connection){

      //if oracle connection error... handle
        if (err) {
          //EMIT: error activity message
          operation.emitActivityMsg(
            'ERROR!',
            err
          );
          reject(err);
          return;
        }
        //assign oraTransConfig with in th operation pass through object
        Object.assign(connection,{'oraTransConfig': oraTransactionConfig});
       //EMIT: connection activity message
        operation.emitActivityMsg(
          'connection',
          'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database OPEN'
        );
        resolve(connection);
      })
  })
}

function closeDestinationDbConn (connection, operation){ //FUSE with emitErrAndCloseDestinationDbConn
  return new Promise(function(resolve, reject){
    connection.release(function(connErr){
      //if connection error... handle
      if(connErr){
        //EMIT: error activity message
        operation.emitActivityMsg(
          'ERROR!',
          connErr
        );
          //EMIT: connection activity message
          operation.emitActivityMsg(
            'connection',
            'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database CLOSED'
          );
          reject(connErr);
          return;
      }
     //EMIT: connection activity message
      operation.emitActivityMsg(
        'connection',
        'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database CLOSED'
      );
      resolve(operation);
    })
  })
}

function emitErrAndCloseDestinationDbConn (connection, operation, errMsg){
  //EMIT: error activity message
  operation.emitActivityMsg(
    'ERROR!',
    errMsg
  );
  return new Promise(function(resolve, reject){
    connection.release(function(connErr){
      //if connection error... handle
        if(connErr){
          //EMIT: error activity message
          operation.emitActivityMsg(
            'ERROR!',
            connErr
          );
          //EMIT: connection activity message
          operation.emitActivityMsg(
            'connection',
            'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database CLOSED'
          );
          reject(connErr);
          return;
        }
        //EMIT: connection activity message
         operation.emitActivityMsg(
           'connection',
           'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database CLOSED'
         );
        //resolve(true);
        return;
    })
  });
}

function openSourceDbConn (operation){
  return new Promise (function(resolve, reject){
    let postgresDb = new pg.Client(operation.sourceDb.connectString);
    postgresDb.connect(function(err) {
        //if  connection error... handle
        if (err) {
          //EMIT: error activity message
          operation.emitActivityMsg(
            'ERROR!',
            err
          );
          reject(err);
          return;
        }
      //EMIT: connection activity message
      operation.emitActivityMsg(
        'connection',
        'Connection to '+operation.sourceDb.make+' '+operation.sourceDb.name.toUpperCase()+' database OPENED'
      );
      resolve(postgresDb);
    })
  })
}

function closeSourceDbConn (connection, operation){//FUSE with emitErrAndCloseDestinationDbConn
  return new Promise (function(resolve, reject){
    connection.end();
    //EMIT: connection activity message
     operation.emitActivityMsg(
       'connection',
       'Connection to '+operation.sourceDb.make+' '+operation.sourceDb.name.toUpperCase()+' database CLOSED'
     );
     resolve(operation);
  })
}

function emitErrAndCloseSourceDbConn (connection, operation, errMsg){
  //EMIT: error activity message
  operation.emitActivityMsg(
    'ERROR!',
    errMsg
  );
  return new Promise (function(resolve, reject){
    connection.end();
    //EMIT: connection activity message
    operation.emitActivityMsg(
      'connection',
      'Connection to '+operation.sourceDb.make+' '+operation.sourceDb.name.toUpperCase()+' database CLOSED'
    );
    return;
  })
}

/*______________________________________________________________________________
PART 1 : Generate Table DDL and DML Strings...
  Perform the following activities synchronously against source db:
      1. open connection with source database
      2. grab source table specification/definition
      3. resolve to DDL and DML (i.e: build "Create Table" and "Insert" SQL strings)
      4. grab a row count from source table
      5. close connection with source Db
________________________________________________________________________________*/
exports.generateTableDDLAndDML = function(operation){
  return new Promise(function(resolveGenTblDDLnDML, rejectGenTblDDLnDML){
    openSourceDbConn(operation)
    .then(function(connection){
      //EMIT: process activity message
      operation.emitActivityMsg(
        'process',
        'Fetching row count for '+operation.sourceDb.tblName.toUpperCase()+' table'
      );

      pgCall.tableRowCount(connection,operation.sourceDb.tblName)
      .then(function(rowCount){
        //add source table rowCount to operation pass through object
        Object.assign(operation,{"sourceTblRowCt": rowCount});
        //EMIT: rowsToProcess activity message
        operation.emitActivityMsg(
          'rowsToProcess',
          rowCount
        );
        //EMIT: process activity message
        operation.emitActivityMsg(
          'process',
          'Generating SQL strings'
        );
        pgCall.tableSpec(connection, operation)
        .then(function(tableSpec){

          let createTblString = 'CREATE TABLE '+operation.destinationDb.tblName+' (\n',
              insertString = "INSERT INTO "+operation.destinationDb.tblName+" VALUES(";
          //based on query results, resolve data types and build both "Create Table" and "INSERT" PL/SQL strings ---------
          for (var i = 0; i < tableSpec.length; i++) {
            let smartComma;
            if ((tableSpec.length - 1) === i) {smartComma = '';}else{smartComma = ',';}

            if (tableSpec[i].udt_name === 'varchar') {
              createTblString = createTblString+'\t'+tableSpec[i].column_name+' VARCHAR2('+tableSpec[i].character_maximum_length+' BYTE)'+smartComma+'\n';
              insertString = insertString + ' :' + tableSpec[i].column_name + smartComma;
            }
            if (tableSpec[i].udt_name === 'numeric') {
                createTblString = createTblString+'\t'+tableSpec[i].column_name+' NUMBER('+tableSpec[i].numeric_precision+','+tableSpec[i].numeric_scale+')'+smartComma+'\n';
                insertString = insertString + ' :' + tableSpec[i].column_name + smartComma;
            }
            if (tableSpec[i].udt_name === 'int4') {
                createTblString = createTblString+'\t'+tableSpec[i].column_name+' INTEGER'+smartComma+'\n';
                insertString = insertString + ' :' + tableSpec[i].column_name + smartComma;
            }
            if (tableSpec[i].udt_name === 'timestamp') {
                createTblString = createTblString+'\t'+tableSpec[i].column_name+' VARCHAR2(50 BYTE)'+smartComma+'\n';
                insertString = insertString + ' :' + tableSpec[i].column_name + smartComma;
            }
            if (tableSpec[i].udt_name === 'bool') {
                createTblString = createTblString+'\t'+tableSpec[i].column_name+' VARCHAR2(5 BYTE)'+smartComma+'\n';
                insertString = insertString + ' :' + tableSpec[i].column_name + smartComma;
            }
            if (tableSpec[i].udt_name === 'text') {
                createTblString = createTblString+'\t'+tableSpec[i].column_name+' VARCHAR2(4000 BYTE)'+smartComma+'\n';
                insertString = insertString + ' :' + tableSpec[i].column_name + smartComma;
            }
          }
          createTblString = createTblString+')\n';
          insertString = insertString + ' )';

          //add createTblString and insertString to operation pass through object
          Object.assign(operation,{"createTblString": createTblString});
          Object.assign(operation,{"insertString": insertString});
          Object.assign(operation,{"dropTblString":'DROP TABLE '+ operation.destinationDb.tblName})


          //EMIT: process activity message
          operation.emitActivityMsg(
            'process',
            'SQL strings generated'
          );

          closeSourceDbConn (connection, operation)
          .then(function(operation){
            resolveGenTblDDLnDML(operation);
          }).catch(function(errCloseingConnection){
            emitErrAndCloseSourceDbConn(connection, operation,'Error disconnecting from Source Database => '+ errCloseingConnection);
          })
        }).catch(function(errGettingTableSpec){
          emitErrAndCloseSourceDbConn (connection, operation, 'Error source table specification => '+errGettingTableSpec);
        })
      }).catch(function(errGettingRowCt){
        emitErrAndCloseSourceDbConn (connection, operation, 'Error getting source table row count => '+errGettingRowCt);
      })
    })
    .catch(function(errConnectingToDb){
      emitErrAndCloseSourceDbConn(connection, operation,'Error connecting to Source Database => '+ errConnectingToDb);
    })
  })
}

/*______________________________________________________________________________
PART 2: Create a Destination Table within the Destination Db...
   Perform the following activities synchronously against Destination Db:
      A. IF overwriteDestTbl = 'yes' THEN...
          1. Open connection with destination db
          2. Check to see if table exsists
              IF NOT:
                a. Create a new table
              ELSE
                a. Drop exsisting table in destination db
                b. Recreate (dropped) table in destination db
          3. Close connection with destinaton db
      B. IF overwriteDestTbl = 'no' THEN...
          1. Open connection with destination db
          2. Check to see if table exsists
              IF NOT:
                 a. Create a new table
              ELSE:
                 a. return/terminate
          3. Close connection with destinaton db
______________________________________________________________________________*/
exports.createDestinationTable = function(operation){
  return new Promise(function(resolveCreateDestTbl, rejectCreateDestTbl){
    openDestinationDbConn(operation)
    .then(function(connection){
      //-----if "overwriteOraTableIfAlreadyExists" is set to "yes" then... -----
       if (operation.destinationDb.overwriteDestTbl === 'yes') {
         oraCall.tableExists(connection, operation.destinationDb.tblName)
         .then(function(tblExists){
           if (tblExists === false) {
             //EMIT: process activity message
             operation.emitActivityMsg(
               'process',
               operation.destinationDb.tblName.toUpperCase()+' table does not yet exist in '+operation.destinationDb.name.toUpperCase()
             );
             oraCall.createTable(connection, operation)
             .then(function(tableCreated){// table created message emitted and timestamp inserted into operation object???
               //add destTblCreated timestamp to operation pass through object
               Object.assign(operation,{"destTblCreated": tools.timeStamp(operation.timeZone)});
               //EMIT: process activity message
               operation.emitActivityMsg(
                 'process',
                 operation.destinationDb.tblName.toUpperCase()+' table created',
                 operation.destTblCreated
               );
               closeDestinationDbConn(connection, operation)
               .then(function(op){
                 resolveCreateDestTbl(op)
               })
             }).catch(function(errCreatingTbl){
                 emitErrAndCloseDestinationDbConn (connection, operation, 'Error creating table => '+errCreatingTbl);
             })
           }
           if (tblExists === true) {
             oraCall.dropTable(connection, operation, operation.destinationDb.tblName)
             .then(function(tableDropped){
               //EMIT: process activity message
               operation.emitActivityMsg(
                 'process',
                 operation.destinationDb.tblName.toUpperCase()+' table dropped'
               );
               oraCall.createTable(connection, operation, operation.destinationDb.tblName)
               .then(function(tableCreated){// table created message emitted and timestamp inserted into operation object???
                 //add destTblCreated timestamp to operation pass through object
                 Object.assign(operation,{"destTblCreated": tools.timeStamp(operation.timeZone)});
                 //EMIT: process activity message
                 operation.emitActivityMsg(
                   'process',
                   operation.destinationDb.tblName.toUpperCase()+' table created',
                   operation.destTblCreated
                 );
                 closeDestinationDbConn(connection, operation)
                 .then(function(op){
                   resolveCreateDestTbl(op)
                 })
               })
               .catch(function(errCreatingTbl){
                 emitErrAndCloseDestinationDbConn (connection, operation, 'Error creating destination table => '+errCreatingTbl);
               })
             })
             .catch(function(errDroppingTable){
               emitErrAndCloseDestinationDbConn (connection, operation,'Error dropping destination table => '+ errDroppingTable);
             })
           }
         })
         .catch(function(tblExistsErr){
           emitErrAndCloseDestinationDbConn (connection, operation, 'Error checking if destination table exists => '+tblExistsErr);
         })
       }
  //-----if "overwriteOraTableIfAlreadyExists" is set to "no" then... -----
       else if (operation.destinationDb.overwriteDestTbl === 'no') {
         oraCall.tableExists(connection, operation.destinationDb.tblName)
         .then(function(tblExists){
           if (tblExists === false) {
             //EMIT: process activity message
             operation.emitActivityMsg(
               'process',
               operation.destinationDb.tblName.toUpperCase()+' table does not yet exist in '+operation.destinationDb.name.toUpperCase()
             );
             oraCall.createTable(connection, operation, operation.destinationDb.tblName)
             .then(function(tableCreated){// table created message emitted and timestamp inserted into operation object???
               //add destTblCreated timestamp to operation pass through object
               Object.assign(operation,{"destTblCreated": tools.timeStamp(operation.timeZone)});
               //EMIT: process activity message
               operation.emitActivityMsg(
                 'process',
                 operation.destinationDb.tblName.toUpperCase()+' table created',
                 operation.destTblCreated
               );
               closeDestinationDbConn(connection, operation)
               .then(function(op){
                 resolveCreateDestTbl(op)
               })
             })
             .catch(function(errCreatingTbl){
               emitErrAndCloseDestinationDbConn (connection, operation,'Error creating destination table => '+ errCreatingTbl);
             })
           }
           if (tblExists === true) {
             Object.assign(operation,{"skipped":'yes'});
             //EMIT: process activity message
             operation.emitActivityMsg(
               'process',
               operation.destinationDb.tblName.toUpperCase()+' table already exists at destination, rebuild SKIPPED',
               operation.destTblCreated
             );
             closeDestinationDbConn(connection, operation)
             .then(function(op){
               resolveCreateDestTbl(op)
             })
           }
         })
       }
    }).catch(function(errConnectingToDestDb){
      emitErrAndCloseDestinationDbConn (connection, operation,'Error connecting to destination database => '+ errConnectingToDestDb);
    })
  })
}

/*______________________________________________________________________________
PART 3: Copy Source Data into Memory...
  Perform the following activities synchronously against source db:
      1. Connect with Source Db
      2. Copy data from source table and load into memory
      3. Close connection with Source Db
_______________________________________________________________________________*/
exports.copySourceDataIntoMemory = function(operation){

  return new Promise(function(resolveCpDataIn2Mem, rejectCpDataIn2Mem){

    if (operation.skipped === 'yes'){
      //add "data" and "tableSizeInCharacters" to operation pass through object
      Object.assign(operation,{"data": null});
      Object.assign(operation,{"tableSizeInCharacters": 0});
      resolveCpDataIn2Mem(operation);
    }else{
    openSourceDbConn(operation)
    .then(function(connection){
    //EMIT: process activity message
      operation.emitActivityMsg(
        'process',
        'Caching '+operation.sourceDb.tblName.toUpperCase()+' table'
      );
      pgCall.cacheTable(connection,operation)
      .then(function(loadedOp){
        //EMIT: process activity message
          operation.emitActivityMsg(
            'process',
            operation.sourceDb.tblName.toUpperCase()+' table cached'
          );
        //EMIT: process activity message
          operation.emitActivityMsg(
            'bytesCached',
            operation.tableSizeInCharacters
          );
        closeSourceDbConn(connection, loadedOp)
        .then(function(finshedOp){
          resolveCpDataIn2Mem(finshedOp);
        })
      }).catch(function(errCachingTable){
        emitErrAndCloseSourceDbConn(connection, operation,'Error cashing source table => '+ errCachingTable);
      })
    }).catch(function(errConnectingToDb){
      emitErrAndCloseSourceDbConn(connection, operation,'Error connecting to Source Database => '+ errConnectingToDb);
    })
  }

  })
}

/*______________________________________________________________________________
PART 4: Load Data into Destination Database Table...
  Perform the following activities synchronously against destination db:
    1. open connection to destination db
    2. offload data from memory into destination table
    3. get a row count of the destination table
    4. close connection to destination db
    5. compile/emit clone operation summary data
_______________________________________________________________________________*/
exports.loadDataIntoDestinationTable = function(operation){
  return new Promise(function(resolveLdDataIn2DestTbl,rejectLdDataIn2DestTbl){

    if (operation.skipped === 'yes'){
      //add destTblRowCt timestamp to operation pass through object
      Object.assign(operation,{'destTblRowCt': 0});
      resolveLdDataIn2DestTbl(operation);
    }else{
    openDestinationDbConn(operation)
    .then(function(connection){
      //EMIT: process activity message
      operation.emitActivityMsg(
        'process',
        'Loading data into '+operation.destinationDb.tblName.toUpperCase()+' table'
      );
      oraCall.loadTable(connection,operation)
      .then(function(loadTblResponse){
        //EMIT: process activity message
        operation.emitActivityMsg(
          'process',
          operation.destinationDb.tblName.toUpperCase()+' table LOADED'
        );
        //EMIT: process activity message
        operation.emitActivityMsg(
          'process',
          'Checking row counts match'
        );
        oraCall.tableRowCount(connection,operation.destinationDb.tblName)
        .then(function(tblRowCtResponse){

          //add destTblRowCt timestamp to operation pass through object
          Object.assign(operation,{'destTblRowCt': tblRowCtResponse});

            //EMIT: countsMatch activity message
            operation.emitActivityMsg(
              'countsMatch',
              operation.destTblRowCt == operation.sourceTblRowCt ? true : false
            );

          closeDestinationDbConn(connection, operation)
          .then(function(op){
            resolveLdDataIn2DestTbl(op);
          })

        }).catch(function(errGettingRowCt){
          emitErrAndCloseDestinationDbConn (connection, operation, 'Error getting destination table row count => '+errGettingRowCt);
        })
      }).catch(function(errLoadingTbl){
        emitErrAndCloseDestinationDbConn (connection, operation, 'Error loading destination table => '+errLoadingTbl);
      })
    }).catch(function(errConnectingToDestDb){
      emitErrAndCloseDestinationDbConn (connection, operation, 'Error connecting to destination database => '+errLoadingTbl);
    })
  }
  })
}
