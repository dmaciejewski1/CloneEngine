/*******************************************************************************
FILE: CloneEngine
PATH: lib/CloneEngine.js
SUMMARY: Collect inputs and send to engine
*******************************************************************************/
"use strict";
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var EmitMsg = require('./Emitter.js');
var Engine = require('./Engine.js');
var tools = require('./tools.js');

////////////////////////// THE CLONE ENGINE CONSTRUCTOR //////////////////////////
//the CloneEngine Constructor is initialized by both source and destination
//connection cofigurations followed by an optionally set timeZone...will default
//to utc
function CloneEngine(sourceTable,destTable,timeZone) {

  this.operation = {};

  Object.assign(this.operation,{

    engine : this,
    operationId : tools.getUniqueID(),
    hostSystem : require('os').hostname(),
    startTimeValue : new Date(),
    startTime : tools.timeStamp(timeZone,this.startTimeValue),
    stepCount : 0,
    timeZone : timeZone ? timeZone : 'utc',
    sourceDb : {
          make          : sourceTable.dbMake ? sourceTable.dbMake : undefined,
          user          : sourceTable.user ? sourceTable.user : undefined,
          password      : sourceTable.password || sourceTable.password === '' ? sourceTable.password : undefined,
          name          : sourceTable.dbMake === 'oracle' || sourceTable.dbMake ===  undefined ? (sourceTable.database === undefined ? sourceTable.user : sourceTable.database) : sourceTable.database,
          connectString : sourceTable.dbMake === 'oracle' || sourceTable.dbMake ===  undefined ? sourceTable.host+':'+sourceTable.port+'/'+sourceTable.service : (sourceTable.dbMake === 'postgres' ? 'postgres://'+sourceTable.user+':'+sourceTable.password+'@'+sourceTable.host+'/'+sourceTable.database : '\nERROR: cannot resolve connection string')
    },
    destinationDb : {
          make          : destTable.dbMake ? destTable.dbMake : undefined,
          user          : destTable.user ? destTable.user : undefined,
          password      : destTable.password || destTable.password=== '' ? destTable.password : undefined,
          name          : destTable.dbMake === 'oracle' || destTable.dbMake ===  undefined ? (destTable.database === undefined ? destTable.user : destTable.database) : destTable.database,
          connectString : destTable.dbMake === 'oracle' || destTable.dbMake ===  undefined ? destTable.host+':'+destTable.port+'/'+destTable.service : (destTable.dbMake === 'postgres' ? 'postgres://'+destTable.user+':'+destTable.password+'@'+destTable.host+'/'+destTable.database : '\nERROR: cannot resolve connection string')
    },
    emitActivityMsg : EmitMsg.activityMsg,
    emitOperationMsg : EmitMsg.operationMsg

  });

}

//////////////////////////////// THE RUN PROTOTYPE ////////////////////////////////

CloneEngine.prototype.run = function (clonePlanObj){

  clonePlanObj.sourceTableName ? Object.assign(this.operation.sourceDb,{tblName : clonePlanObj.sourceTableName}) : reject()
  clonePlanObj.destinationTableName ? Object.assign(this.operation.destinationDb,{tblName : clonePlanObj.destinationTableName}) : reject()
  clonePlanObj.overwriteDestTblIfExists ? Object.assign(this.operation.destinationDb,{overwriteDestTbl : clonePlanObj.overwriteDestTblIfExists}) : reject()

  Engine.postgresToOracle.call(this);


}


//calling function will inherit emitter functionality without explicity setting it up
util.inherits(CloneEngine, EventEmitter);
//make function exportable
module.exports = CloneEngine;
