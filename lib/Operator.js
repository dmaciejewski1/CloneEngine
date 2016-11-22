/*******************************************************************************
FILE: Operator
PATH: lib/Operator.js
SUMMARY: Per each operation (defined below), handles the order of execution of
         an operation's smaller parts synchronously
*******************************************************************************/
"use strict";
var postgres2Oracle = require('./operations/postgresToOracle.js');
var tools = require('./tools');

var Engine = {

  postgresToOracle : function () {

    let operation = this.operation;

    //EMIT: start activity message
    operation.emitActivityMsg(
      'start',
      'Begin '+operation.destinationDb.tblName.toUpperCase()+' cloning operation',
      operation.startTime
    );

    //synchronously run through all parts of a "postgresToOracle" operation
    postgres2Oracle.generateTableDDLAndDML(operation).then(function(operation){
     postgres2Oracle.createDestinationTable(operation).then(function(operation){
      postgres2Oracle.copySourceDataIntoMemory(operation).then(function(operation){
       postgres2Oracle.loadDataIntoDestinationTable(operation).then(function(operation){

         //add "endTimeValue" and "endTime" to operation pass through object
         Object.assign(operation,{'endTimeValue': new Date()});
         Object.assign(operation,{'endTime': tools.timeStamp(operation.timeZone,operation.endTimeValue)});
          //EMIT: finish activity message
          operation.emitActivityMsg(
            'finish',
            operation.destinationDb.tblName.toUpperCase()+' cloning operation complete',
            operation.endTime
          );
          //EMIT: operation message
          operation.emitOperationMsg();

       }).catch(function(err){})
     }).catch(function(err){})
   }).catch(function(err){})
 }).catch(function(err){})
  }

};

module.exports = Engine;
