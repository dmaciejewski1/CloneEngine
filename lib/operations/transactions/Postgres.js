/*******************************************************************************
FILE: Postgres
PATH: lib/operations/transactions/Postgres.js
SUMMARY: A Class of canned Postgres database transactions
*******************************************************************************/
"use strict";

var Postgres = {

//tableRowCount-----------------------------------------------------------------
//-->returns the row count of a given table
  tableRowCount : function(connection, tblName){
    let sqlStr = 'SELECT count(*) FROM '+tblName;
    return new Promise (function(resolve, reject){
      connection.query(sqlStr, function(err, response) {
        if(err) {reject(err);}
        resolve(response.rows[0]['count']);
      })
    })
  },

//tableSpec------------------------------------------------------------------
//-->returns a table specification
  tableSpec : function(connection, operation){
    let sqlStr = 'SELECT ordinal_position, '+
                        'column_name, '+
                        'data_type, '+
                        'udt_name, '+
                        'character_maximum_length, '+
                        'numeric_precision, '+
                        'numeric_scale, '+
                        'datetime_precision, '+
                        'is_nullable  '+
                   'FROM information_schema.columns '+
                  'WHERE table_name=\''+operation.sourceDb.tblName+'\'\n';

    return new Promise(function(resolve, reject){
      connection.query(sqlStr, function(err, response) {
        if(err) {reject(err);}
        resolve(response.rows);
      })
    })
  },

//cacheTable------------------------------------------------------------------
//-->returns a table specification
//-->caches souce table into operation object
  cacheTable : function(connection, operation){
    let sqlStr = 'SELECT * FROM '+operation.sourceDb.tblName,
        tableData = [];
    return new Promise(function(resolve, reject){
      connection.query(sqlStr, function(err, response){
        if(err) {reject(err);}
          //copy table data and load data into memory---------
              for (var i = 0; i < response.rows.length; i++){
                var rowData = [];
                //loop through returned data and cache rows in memory...
                for (var key in response.rows[i]){
                  //if date or boolean resolve to string...
                  if (response.rows[i][key] === null){
                    rowData.push(response.rows[i][key]);
                  }else{
                    if (response.rows[i][key].constructor === Date ||
                        response.rows[i][key].constructor === Boolean
                    ){
                      rowData.push(response.rows[i][key].toString());
                    }else{
                        rowData.push(response.rows[i][key]);
                    }
                  }
                }
                //load transformed rowData into tableData cache
                tableData.push(rowData);
              }
              //add "data" and "tableSizeInCharacters" to operation pass through object
              Object.assign(operation,{"data": tableData});
              Object.assign(operation,{"tableSizeInCharacters": (JSON.stringify(response.rows).length)-2});
              resolve(operation)
      })
    })
  }

}

module.exports = Postgres;
