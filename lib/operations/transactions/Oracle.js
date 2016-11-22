/*******************************************************************************
FILE: Oracle
PATH: lib/operations/transactions/Oracle.js
SUMMARY: A Class of canned Oracle database transactions
*******************************************************************************/
"use strict";

var Oracle = {

//tableExists-------------------------------------------------------------------
//-->returns true if table exists and false if it does not
  tableExists : function(connection, table){

    let sqlStr =  'SELECT CASE '+
                            'WHEN tableexists > 0 '+
                              'THEN \'true\' '+
                             'ELSE \'false\' '+
                          'END AS tableexists '+
                    'FROM (SELECT COUNT(rownum) AS tableexists '+
                            'FROM user_all_tables '+
                           'WHERE table_name = UPPER(\''+table+'\')'+
                         ')';

    return new Promise(function(resolve, reject){
      connection.execute(
        sqlStr,
        [],
        connection.oraTransConfig,
        function(err, response){

          if(err){
            //if ORA-00942: catch error and resolve as false
            if(err.toString() === 'Error: ORA-00942: table or view does not exist\n'){
              resolve(false);
            }else{
              reject(err);
            }
          }

          if(response.rows[0]['TABLEEXISTS'] === 'true' ) {resolve(true);}
          if(response.rows[0]['TABLEEXISTS'] === 'false'){resolve(false);}
      })
    })
  },

//tableRowCount-----------------------------------------------------------------
//-->returns the row count of a given table
  tableRowCount : function(connection, table) {

    return new Promise(function(resolve, reject){

      connection.execute(
        'SELECT count(rowid) AS count FROM '+table,
        [],
        connection.oraTransConfig,
        function(err, response){

            if (err){reject(err);return;}

            resolve(response.rows[0]['COUNT']);
        }
      )
    })
  },

//createTable-------------------------------------------------------------------
//-->creates a destination table and returns either true if created
  createTable : function(connection,operation) {

    return new Promise(function(resolve, reject){

      connection.execute(
        operation.createTblString,
        [],
        connection.oraTransConfig,
        function(err, response){

          if(err){
            //if ORA-00942: catch error and resolve as false
            if(err.toString() === 'Error: ORA-00955: name is already used by an existing object\n'){
              resolve(false);
            }else{
              reject(err);
            }
          }

          if(response.rowsAffected === 0 ) {resolve(true);}
          else{resolve(false);}
        }
      )
    })
  },

//dropTable---------------------------------------------------------------------
//-->drops a destination table and returns either true if dropped
  dropTable : function(connection,operation) {

    return new Promise(function(resolve, reject){

      connection.execute(
        operation.dropTblString,
        [],
        connection.oraTransConfig,
        function(err, response){

            if (err){reject(err);}

            // add a catch for table not found oracle error and resolve as false

            if(response.rowsAffected === 0 ){resolve(true);}
            else{resolve(false);}
        }
      )
    })
  },

//loadTable---------------------------------------------------------------------
//-->loops through operation.data and loads destination table then
//   returns either true if loaded
  loadTable : function(connection,operation) {

    return new Promise(function(resolve, reject){
      //loop through data and insert one row at a time until complete then resolve promise
      for (let i = 0; i < operation.data.length; i++){
        let row = operation.data[i];
        connection.execute(
          operation.insertString,
          row,
          connection.oraTransConfig,
          function(err, response){

              if (err){reject(err);}

              // add a catch for table not found oracle error and resolve as false

              if(i < operation.data.length ) {resolve(true);}
        })
      }
    })
  }
}

module.exports = Oracle;
