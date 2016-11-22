/*******************************************************************************
FILE: CloneEngine
PATH: lib/CloneEngine.js
SUMMARY: Collect inputs and send to engine
*******************************************************************************/
"use strict";
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Emitters = require('./Emitters.js');
var Operation = require('./Operator.js');
var tools = require('./tools.js');

////////////////////////// THE CLONE ENGINE CONSTRUCTOR //////////////////////////
//the CloneEngine Constructor is initialized by both source and destination
//connection cofigurations followed by an optionally set timeZone...will default
//to utc
function CloneEngine(sourceConfig,destConfig,timeZone) {

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
          make          : sourceConfig.dbMake ? sourceConfig.dbMake : undefined,
          user          : sourceConfig.user ? sourceConfig.user : undefined,
          password      : sourceConfig.password || sourceConfig.password === '' ? sourceConfig.password : undefined,
          name          : sourceConfig.dbMake === 'oracle' || sourceConfig.dbMake ===  undefined ? (sourceConfig.database === undefined ? sourceConfig.user : sourceConfig.database) : sourceConfig.database,
          connectString : sourceConfig.dbMake === 'oracle' || sourceConfig.dbMake ===  undefined ? sourceConfig.host+':'+sourceConfig.port+'/'+sourceConfig.service : (sourceConfig.dbMake === 'postgres' ? 'postgres://'+sourceConfig.user+':'+sourceConfig.password+'@'+sourceConfig.host+'/'+sourceConfig.database : '\nERROR: cannot resolve connection string')
    },
    destinationDb : {
          make          : destConfig.dbMake ? destConfig.dbMake : undefined,
          user          : destConfig.user ? destConfig.user : undefined,
          password      : destConfig.password || destConfig.password=== '' ? destConfig.password : undefined,
          name          : destConfig.dbMake === 'oracle' || destConfig.dbMake ===  undefined ? (destConfig.database === undefined ? destConfig.user : destConfig.database) : destConfig.database,
          connectString : destConfig.dbMake === 'oracle' || destConfig.dbMake ===  undefined ? destConfig.host+':'+destConfig.port+'/'+destConfig.service : (destConfig.dbMake === 'postgres' ? 'postgres://'+destConfig.user+':'+destConfig.password+'@'+destConfig.host+'/'+destConfig.database : '\nERROR: cannot resolve connection string')
    },
    emitActivityMsg : Emitters.activityMsg,
    emitOperationMsg : Emitters.operationMsg

  });

}

//////////////////////////////// THE RUN PROTOTYPE ////////////////////////////////

CloneEngine.prototype.run = function (clonePlanObj){

  clonePlanObj.sourceTableName ? Object.assign(this.operation.sourceDb,{tblName : clonePlanObj.sourceTableName}) : reject()
  clonePlanObj.destinationTableName ? Object.assign(this.operation.destinationDb,{tblName : clonePlanObj.destinationTableName}) : reject()
  clonePlanObj.overwriteDestTblIfExists ? Object.assign(this.operation.destinationDb,{overwriteDestTbl : clonePlanObj.overwriteDestTblIfExists}) : reject()

    if (this.operation.sourceDb.make === 'postgres' &&
        this.operation.destinationDb.make === 'oracle') {

          Operation.postgresToOracle.call(this);
    }

}


//calling function will inherit emitter functionality without explicity setting it up
util.inherits(CloneEngine, EventEmitter);
//make function exportable
module.exports = CloneEngine;
