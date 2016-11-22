/*******************************************************************************
FILE: postgresToOracle
PATH: lib/engine-connectors/postgresToOracle.js
SUMMARY: the parts that comprise the postgres to oracle operation
*******************************************************************************/
"use strict";
var pg = require('pg');
var pgTools = require('./databases/postgres.js');
var oracledb = require('oracledb');
var oraTools = require('./databases/oracle.js');
var tools = require('../tools.js');


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

      let postgresDb = new pg.Client(operation.sourceDb.connectString);
      //Configure SQL Strings
      let tableMetaDataQuery = 'SELECT ordinal_position, column_name, data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale, datetime_precision, is_nullable FROM information_schema.columns WHERE table_name=\''+operation.sourceDb.tblName+'\'\n';
      let createTblString = 'CREATE TABLE '+operation.destinationDb.tblName+' (\n';
      let insertString = "INSERT INTO "+operation.destinationDb.tblName+" VALUES(";


  //-----open connection with postgres source database-----
      postgresDb.connect(function(err) {


      //if postgres connection error... handle
        if(err) {
          //EMIT: error activity message
          operation.emitActivityMsg(
            'ERROR!',
            'Attempting to connect with '+operation.sourceDb.make+' '+operation.sourceDb.name.toUpperCase()+' yielded the following error: '+err
          );
          rejectGenTblDDLnDML(err);
          return;
        }


      //EMIT: connection activity message
        operation.emitActivityMsg(
          'connection',
          'Connection1 to '+operation.sourceDb.make+' '+operation.sourceDb.name.toUpperCase()+' database OPENED'
        );

  //------send query/transaction to postgres to get source table structure----------
        postgresDb.query(tableMetaDataQuery, function(err, tableMetaData) {


        //if postgres transaction error... handle
          if(err) {
            //EMIT: error activity message
            operation.emitActivityMsg(
              'ERROR!',
              'Attempting to query '+operation.sourceDb.make+' '+operation.sourceDb.name.toUpperCase()+' yielded the following error: '+err
            );
            //on error, close connection
            postgresDb.end();
            rejectGenTblDDLnDML(err);
            return;
          }


        //EMIT: process activity message
          operation.emitActivityMsg(
            'process',
            operation.sourceDb.tblName.toUpperCase()+' table metadata gathered'
          );


  //------based on query results, resolve data types and build both "Create Table" and "INSERT" PL/SQL strings ---------
          for (var i = 0; i < tableMetaData.rows.length; i++) {
            let smartComma;
            if ((tableMetaData.rows.length - 1) === i) {smartComma = '';}else{smartComma = ',';}
            //
            if (tableMetaData.rows[i].udt_name === 'varchar') {
              createTblString = createTblString+'\t'+tableMetaData.rows[i].column_name+' VARCHAR2('+tableMetaData.rows[i].character_maximum_length+' BYTE)'+smartComma+'\n';
              insertString = insertString + ' :' + tableMetaData.rows[i].column_name + smartComma;
            }
            if (tableMetaData.rows[i].udt_name === 'numeric') {
                createTblString = createTblString+'\t'+tableMetaData.rows[i].column_name+' NUMBER('+tableMetaData.rows[i].numeric_precision+','+tableMetaData.rows[i].numeric_scale+')'+smartComma+'\n';
                insertString = insertString + ' :' + tableMetaData.rows[i].column_name + smartComma;
            }
            if (tableMetaData.rows[i].udt_name === 'int4') {
                createTblString = createTblString+'\t'+tableMetaData.rows[i].column_name+' INTEGER'+smartComma+'\n';
                insertString = insertString + ' :' + tableMetaData.rows[i].column_name + smartComma;
            }
            if (tableMetaData.rows[i].udt_name === 'timestamp') {
                createTblString = createTblString+'\t'+tableMetaData.rows[i].column_name+' VARCHAR2(50 BYTE)'+smartComma+'\n';
                insertString = insertString + ' :' + tableMetaData.rows[i].column_name + smartComma;
            }
            if (tableMetaData.rows[i].udt_name === 'bool') {
                createTblString = createTblString+'\t'+tableMetaData.rows[i].column_name+' VARCHAR2(5 BYTE)'+smartComma+'\n';
                insertString = insertString + ' :' + tableMetaData.rows[i].column_name + smartComma;
            }
            if (tableMetaData.rows[i].udt_name === 'text') {
                createTblString = createTblString+'\t'+tableMetaData.rows[i].column_name+' VARCHAR2(4000 BYTE)'+smartComma+'\n';
                insertString = insertString + ' :' + tableMetaData.rows[i].column_name + smartComma;
            }
          }
          createTblString = createTblString+')\n';
          insertString = insertString + ' )';


        //add createTblString and insertString to operation pass through object
          Object.assign(operation,{"createTblString": createTblString});
          Object.assign(operation,{"insertString": insertString});


        //EMIT: process activity message
          operation.emitActivityMsg(
            'process',
            'SQL strings generated'
          );

 //------send query/transaction to postgres to get a row count from the source table-------
          postgresDb.query('SELECT count(*) FROM '+operation.sourceDb.tblName, function(err, rowCount) {


          //if postgres transaction error... handle
            if(err) {
              //EMIT: error activity message
              operation.emitActivityMsg(
                'ERROR!',
                err
              );
              //on error, close connection
              postgresDb.end();
              rejectGenTblDDLnDML(err);
              return;
            }


          //add source table rowCount to pass through
            Object.assign(operation,{
              "sourceTblRowCt": rowCount.rows[0]['count']
            });



          //EMIT: rowsToProcess activity message
            operation.emitActivityMsg(
              'rowsToProcess',
              rowCount.rows[0]['count']
            );

  //------close connection with source postgresDb------
            postgresDb.end();


          //EMIT: connection activity message
            operation.emitActivityMsg(
              'connection',
              'Connection1 to '+operation.sourceDb.make+' '+operation.sourceDb.name.toUpperCase()+' database CLOSED'
            );


          //resolve promise with operation pass through object
          //console.log(operation);
            resolveGenTblDDLnDML(operation);

          })
        });
      }
    );
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
          rejectCreateDestTbl(err);
          return;
        }


      //EMIT: connection activity message
        operation.emitActivityMsg(
          'connection',
          'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database OPEN'
        );

//-----if "overwriteOraTableIfAlreadyExists" is set to "yes" then... -----
        if (operation.destinationDb.overwriteDestTbl === 'yes') {

          //does table exsist?
          oraTools.tableExsists(connection,operation)
            .then(function(response){
              //NO...
              if (response === false){
                //create table
                oraTools.createTable(connection,operation,operation.destinationDb.name);
              //YES...
              }else{
                //first, drop table
                oraTools.dropTable(connection,operation,operation.destinationDb.name)
                  .then(function(){
                    //then, create table
                    if (response == true){
                      oraTools.createTable(connection,operation,operation.destinationDb.name);
                    }
                  });

              }
            })





  //------check to see if table exsists...
          return new Promise(function(resolveTableExists, rejectTableExsists){
            connection.execute(
              'SELECT CASE WHEN tableexists = 1 THEN \'true\' ELSE \'false\' END AS tableexists FROM (SELECT COUNT(rownum) AS tableexists FROM user_all_tables WHERE table_name = UPPER(\''+operation.destinationDb.tblName+'\'))',
              [],
              { outFormat: oracledb.OBJECT },
              function(err, response){

                //if error in transaction...handle
                  if (err){
                    //EMIT: error activity message
                    operation.emitActivityMsg(
                      'ERROR!',
                      err
                    );
                    //on error, close connection... if close connection error... handle
                    connection.release(function(connErr){if(connErr){
                      //EMIT: error activity message
                      operation.emitActivityMsg(
                        'ERROR!',
                        connErr
                      );
                      rejectCreateDestTbl(connErr)
                      return;
                    }});
                    rejectCreateDestTbl(err);
                    return;
                  }

        //-------IF NOT...
                if(response.rows[0]['TABLEEXISTS'] === 'false' ) {

                //create one...
                  connection.execute(
                    operation.createTblString,
                    [],
                    { outFormat: oracledb.OBJECT },
                    function(err, dbResponse){


                    //if error in transaction...handle
                      if (err){
                        //EMIT: error activity message
                        operation.emitActivityMsg(
                          'ERROR!',
                          err
                        );
                        //on error, close connection... if close connection error... handle
                        connection.release(function(connErr){
                          //if connection error...handle
                          if(connErr){
                          //EMIT: error activity message
                          operation.emitActivityMsg(
                            'ERROR!',
                            connErr
                          );
                            rejectCreateDestTbl(connErr);
                            return;
                          }
                        });
                        rejectCreateDestTbl(err);
                        return;
                      }


                    //add destTblCreated timestamp to operation pass through object
                      Object.assign(operation,{"destTblCreated": tools.timeStamp(operation.timeZone)});


                    //EMIT: process activity message
                      operation.emitActivityMsg(
                        'process',
                        operation.destinationDb.tblName.toUpperCase()+' table created',
                        operation.destTblCreated
                      );


              //-----upon success, close connection to oracle destination database ------
                      connection.release(function(connErr){


                      //if connection error... handle
                        if(connErr){
                          //EMIT: error activity message
                          operation.emitActivityMsg(
                            'ERROR!',
                            connErr
                          );
                          rejectCreateDestTbl(connErr);
                          return;
                        }
                      });


                    //EMIT: connection activity message
                      operation.emitActivityMsg(
                        'connection',
                        'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database CLOSED'
                      );
                    //resolve with operation pass through object
                      resolveCreateDestTbl(operation);
                    }
                  )

//------ELSE drop exsisting table and recreate it---------
                }else if(response.rows[0]['TABLEEXISTS'] === 'true'){

            //------send "drop table" SQL transaction to oracle destination database-------
                  return new Promise(function(resolveDropTableTransaction, rejectDropTableTransaction){

                    connection.execute(
                      'DROP TABLE '+operation.destinationDb.tblName+' CASCADE CONSTRAINTS',
                      [],
                      { outFormat: oracledb.OBJECT },
                      function(err, dbResponse){


                      //if error in transaction...handle
                        if (err){
                          //EMIT: error activity message
                          operation.emitActivityMsg(
                            'ERROR!',
                            err
                          );
                          //on error, close connection... if close connection error... handle
                          connection.release(function(connErr){if(connErr){
                            //EMIT: error activity message
                            operation.emitActivityMsg(
                              'ERROR!',
                              connErr
                            );
                            rejectCreateDestTbl(connErr)
                            return;
                          }});
                          rejectCreateDestTbl(err);
                          return;
                        }


                      //EMIT: process activity message
                        operation.emitActivityMsg(
                          'process',
                          operation.destinationDb.tblName.toUpperCase()+' table purged'
                        );

                      })

                  })

      //------send "create table" SQL transaction to oracle destination database -------
                  .then(
                      connection.execute(
                        operation.createTblString,
                        [],
                        { outFormat: oracledb.OBJECT },
                        function(err, dbResponse){


                        //if error in transaction...handle
                          if (err){
                            //EMIT: error activity message
                            operation.emitActivityMsg(
                              'ERROR!',
                              err
                            );
                            //on error, close connection... if close connection error... handle
                            connection.release(function(connErr){
                              //if connection error...handle
                              if(connErr){
                              //EMIT: error activity message
                              operation.emitActivityMsg(
                                'ERROR!',
                                connErr
                              );
                                rejectCreateDestTbl(connErr);
                                return;
                              }
                            });
                            rejectCreateDestTbl(err);
                            return;
                          }


                        //add destTblCreated timestamp to operation pass through object
                          Object.assign(operation,{"destTblCreated": tools.timeStamp(operation.timeZone)});


                        //EMIT: process activity message
                          operation.emitActivityMsg(
                            'process',
                            operation.destinationDb.tblName.toUpperCase()+' table created',
                            operation.destTblCreated
                          );


      //-----upon success, close connection to oracle destination database ------
                          connection.release(function(connErr){


                          //if connection error... handle
                            if(connErr){
                              //EMIT: error activity message
                              operation.emitActivityMsg(
                                'ERROR!',
                                connErr
                              );
                              rejectCreateDestTbl(connErr);
                              return;
                            }
                          });


                        //EMIT: connection activity message
                          operation.emitActivityMsg(
                            'connection',
                            'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database CLOSED'
                          );
                        //resolve with operation pass through object
                          resolveCreateDestTbl(operation);
                        }
                      )
                  )
                }
              }
            )
          });
        }

//------- if "overwriteOraTableIfAlreadyExists" is set to "no" then... ---------
        if (operation.destinationDb.overwriteDestTbl === 'no') {

  //--------Check to see if table exsists--------
          return new Promise(function(resolveTableExists, rejectTableExsists){
            connection.execute(
              'SELECT CASE WHEN tableexists = 1 THEN \'true\' ELSE \'false\' END AS tableexists FROM (SELECT COUNT(rownum) AS tableexists FROM user_all_tables WHERE table_name = UPPER(\''+operation.destinationDb.tblName+'\'))',
              [],
              { outFormat: oracledb.OBJECT },
              function(err, response){

                //if error in transaction...handle
                  if (err){
                    //EMIT: error activity message
                    operation.emitActivityMsg(
                      'ERROR!',
                      err
                    );
                    //on error, close connection... if close connection error... handle
                    connection.release(function(connErr){if(connErr){
                      //EMIT: error activity message
                      operation.emitActivityMsg(
                        'ERROR!',
                        connErr
                      );
                      rejectCreateDestTbl(connErr)
                      return;
                    }});
                    rejectCreateDestTbl(err);
                    return;
                  }

            //----IF NOT
                if(response.rows[0]['TABLEEXISTS'] === 'false' ) {

                //create one...
                  connection.execute(
                    operation.createTblString,
                    [],
                    { outFormat: oracledb.OBJECT },
                    function(err, dbResponse){


                    //if error in transaction...handle
                      if (err){
                        //EMIT: error activity message
                        operation.emitActivityMsg(
                          'ERROR!',
                          err
                        );
                        //on error, close connection... if close connection error... handle
                        connection.release(function(connErr){
                          //if connection error...handle
                          if(connErr){
                          //EMIT: error activity message
                          operation.emitActivityMsg(
                            'ERROR!',
                            connErr
                          );
                            rejectCreateDestTbl(connErr);
                            return;
                          }
                        });
                        rejectCreateDestTbl(err);
                        return;
                      }


                    //add destTblCreated timestamp to operation pass through object
                      Object.assign(operation,{"destTblCreated": tools.timeStamp(operation.timeZone)});


                    //EMIT: process activity message
                      operation.emitActivityMsg(
                        'process',
                        operation.destinationDb.tblName.toUpperCase()+' table created',
                        operation.destTblCreated
                      );


              //-----upon success, close connection to oracle destination database ------
                      connection.release(function(connErr){


                      //if connection error... handle
                        if(connErr){
                          //EMIT: error activity message
                          operation.emitActivityMsg(
                            'ERROR!',
                            connErr
                          );
                          rejectCreateDestTbl(connErr);
                          return;
                        }
                      });


                    //EMIT: connection activity message
                      operation.emitActivityMsg(
                        'connection',
                        'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database CLOSED'
                      );
                    //resolve with operation pass through object
                      resolveCreateDestTbl(operation);
                    }
                  )


                }else if(response.rows[0]['TABLEEXISTS'] === 'true'){

                  connection.release(function(connErr){


                  //if connection error... handle
                    if(connErr){
                      //EMIT: error activity message
                      operation.emitActivityMsg(
                        'ERROR!',
                        connErr
                      );
                      rejectCreateDestTbl(connErr);
                      return;
                    }
                  });

                //EMIT: connection activity message
                  operation.emitActivityMsg(
                    'connection',
                    'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database CLOSED'
                  );

                //EMIT: error activity message
                  operation.emitActivityMsg(
                    'ERROR!',
                    'Unable overwrite '+operation.destinationDb.tblName+' table'
                  )

                  resolveCreateDestTbl(operation);

                }
              }
            )
          });
        }
      }
    );
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

  let getTableDataQuery = 'SELECT * FROM '+operation.sourceDb.tblName;
  let tableData = [];

  return new Promise(function(resolveCpDataIn2Mem, rejectCpDataIn2Mem){
    let postgresDb = new pg.Client(operation.sourceDb.connectString);

//-----open connection with postgres source database-----
    postgresDb.connect(function(err) {


    //if postgres connection error... handle
      if(err){
        //EMIT: error activity message
        operation.emitActivityMsg(
          'ERROR!',
          err
        );
        rejectCpDataIn2Mem(err);
        return;
      }


    //EMIT: connection activity message
      operation.emitActivityMsg(
        'connection',
        'Connection2 to '+operation.sourceDb.make+' '+operation.sourceDb.name.toUpperCase()+' database OPENED'
      );


    //EMIT: process activity message
      operation.emitActivityMsg(
        'process',
        'Begin copying '+operation.sourceDb.tblName.toUpperCase()+' table into memory'
      );


//------send query/transaction to postgres to get source table data ----------
      postgresDb.query(getTableDataQuery, function(err, result) {


      //if postgres transaction error... handle
        if(err){
          //EMIT: error activity message
          operation.emitActivityMsg(
            'ERROR!',
            err
          );
          rejectCpDataIn2Mem(err);
          return;
        }


//------copy table data and load data into memory---------
      for (var i = 0; i < result.rows.length; i++){
        var rowData = [];

      //loop through returned data and cache rows in memory...
        for (var key in result.rows[i]){

          //if date or boolean resolve to string...
          if (result.rows[i][key] === null){rowData.push(result.rows[i][key]);}else{
            if (result.rows[i][key].constructor === Date ||
                result.rows[i][key].constructor === Boolean
            ){
              rowData.push(result.rows[i][key].toString());
            }else{
                rowData.push(result.rows[i][key]);
            }
          }
        }

        //load transformed rowData into tableData cache
        tableData.push(rowData);
      }


    //add "data" and "tableSizeInCharacters" to operation pass through object
      Object.assign(operation,{"data": tableData});
      Object.assign(operation,{"tableSizeInCharacters": (JSON.stringify(result.rows).length)-2});


    //EMIT: process activity message
      operation.emitActivityMsg(
        'process',
        'Copying complete -- '+operation.tableSizeInCharacters+' bytes of data copied into memory'
      );


//------close connection to postgresDb source------
      postgresDb.end();

    //EMIT: connection activity message
      operation.emitActivityMsg(
        'connection',
        'Connection2 to '+operation.sourceDb.make+' '+operation.sourceDb.name.toUpperCase()+' database CLOSED'
      );

      //resolve promise with operation pass through object
      resolveCpDataIn2Mem(operation);
    });
  });
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
    oracledb.getConnection(
      {user           :operation.destinationDb.user,
       password       :operation.destinationDb.password,
       connectString  :operation.destinationDb.connectString
      },
      function(err, connection){


      //if connection error...handle
        if (err){
          //EMIT: error activity message
          operation.emitActivityMsg(
            'ERROR!',
            err
          );
          rejectLdDataIn2DestTbl(err);
          return;
        }


      //EMIT: connection activity message
        operation.emitActivityMsg(
          'connection',
          'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database OPEN'
        );


      //EMIT: process activity message
        operation.emitActivityMsg(
          'process',
          'Loading data into the '+operation.destinationDb.tblName.toUpperCase()+' table'
        );


//-------load data into oracle destination database table return promise when done
        return new Promise(function(resolveLoadData, rejectLoadData){

          //loop through data and insert one row at a time until complete then resolve promise
          for (let i = 0; i < operation.data.length; i++){
            let row = operation.data[i];

          //insert row into oracle destination database table and auto commit
            connection.execute(
              operation.insertString,
              row,
              { autoCommit: true},
              function(err, createTblString)
              {


              //if error in transaction...handle
                if (err){
                  //EMIT: error activity message
                  operation.emitActivityMsg(
                    'ERROR!',
                    err
                  );
                  rejectLdDataIn2DestTbl(err);
                  return;
                  //close database connection
                  connection.release(function(connErr){
                    //on close connection error... handle
                    if(connErr){
                      //EMIT: error activity message
                      operation.emitActivityMsg(
                        'ERROR!',
                        connErr
                      );
                      rejectLdDataIn2DestTbl(connErr);
                      return;
                    }
                  });
                  rejectLdDataIn2DestTbl(err)
                  return;
                }

              });
          }


        //resolve promise with operation pass through object
          resolveLoadData(operation);
        })

//---------after inserting (and committing), do a row count of the destination table (to later compair against the count from the source table)
        .then(function(operation){
          connection.execute(
            'SELECT count(rowid) AS count FROM '+operation.destinationDb.tblName,
            [],
            { outFormat: oracledb.OBJECT },
            function(err, rowCount){


            //if error in transaction...handle
              if (err) {
                //EMIT: error activity message
                operation.emitActivityMsg(
                  'ERROR!',
                  err
                );
                rejectLdDataIn2DestTbl(err);
                return;
                //close connection
                connection.release(function(connErr){
                  //on error close connection error...handle
                  if(connErr){
                    //EMIT: error activity message
                    operation.emitActivityMsg(
                      'ERROR!',
                      connErr
                    );
                    rejectLdDataIn2DestTbl(connErr);
                    return;
                  }});
                rejectLdDataIn2DestTbl(err);
                return;
              }


            //add destination table to operation pass through object
              Object.assign(operation,{'destTblRowCt': rowCount.rows[0]['COUNT']});


            //EMIT: process activity message
              operation.emitActivityMsg(
                'process',
                'Data loaded -- '+operation.destTblRowCt+' rows inserted'
              );


            //EMIT: process activity message
              operation.emitActivityMsg(
                'process',
                'Check row count'
              );


            //EMIT: countsMatch activity message
              operation.emitActivityMsg(
                'countsMatch',
                operation.destTblRowCt == operation.sourceTblRowCt ? true : false
              );

//-----upon success, close connection to oracle destination database ------
              connection.release(function(connErr){
                if(connErr){
                  //EMIT: error activity message
                  operation.emitActivityMsg(
                    'ERROR!',
                    connErr
                  );
                  rejectLdDataIn2DestTbl(connErr);
                  return;
                }
              });


              //EMIT: connection activity message
              operation.emitActivityMsg(
                'connection',
                'Connection to '+operation.destinationDb.make+' '+operation.destinationDb.name.toUpperCase()+' database CLOSED'
              );


              //add "endTimeValue" and "endTime" to operation pass through object
              Object.assign(operation,{'endTimeValue': new Date()});
              Object.assign(operation,{'endTime': tools.timeStamp(operation.timeZone,operation.endTimeValue)});



              resolveLdDataIn2DestTbl(operation);
            }
          );
        })
      });
  })
}
