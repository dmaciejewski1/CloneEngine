/*******************************************************************************
FILE: Engine
PATH: lib/Engine.js
SUMMARY: Builds engineTypes
*******************************************************************************/
"use strict";
var pg2ora = require('./engineInventory/postgresToOracle.js');

var Engine = {

  postgresToOracle : function () {

    let operation = this.operation;

    //EMIT: start activity message
    operation.emitActivityMsg(
      'start',
      'Begin cloning '+operation.sourceDb.tblName.toUpperCase()+' table into '+operation.destinationDb.name.toUpperCase()+' database as '+operation.destinationDb.tblName.toUpperCase(),
      operation.startTime
    );

    //synchronously run through all parts of a "postgresToOracle" operation
    pg2ora.generateTableDDLAndDML(operation).then(function(operation){
     pg2ora.createDestinationTable(operation).then(function(operation){
      pg2ora.copySourceDataIntoMemory(operation).then(function(operation){
       pg2ora.loadDataIntoDestinationTable(operation).then(function(operation){

          //EMIT: finish activity message
          operation.emitActivityMsg(
            'finish',
            'Cloning operation for '+operation.sourceDb.tblName.toUpperCase()+' table complete',
            operation.endTime
          );
          //EMIT: operation message
          operation.emitOperationMsg();

    })})})})
  }

};

module.exports = Engine;
