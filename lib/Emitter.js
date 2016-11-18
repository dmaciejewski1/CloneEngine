/*******************************************************************************
FILE: Emitter
PATH: lib/Emitter.js
SUMMARY: Emitter templates
*******************************************************************************/
"use strict";
var tools = require('./tools.js');
var Emitter = {

  activityMsg     : function (messageType,message,time){
                       let engine = this.engine ;
                       let ts;

                       //if time is not explicitly set/input, generate a timestamp
                       time ? ts = time : ts = tools.timeStamp(this.timeZone)

                       engine.emit(messageType, {
                        'activityId'   : tools.getUniqueID(),
                        'operationId'  : this.operationId,
                        'operation'    : this.destinationDb.tblName.toUpperCase(),
                        'msgType'      : messageType,
                        'step'         : ++this.stepCount,
                        'time'         : ts,
                        'description'  : message
                       });
                    },


  operationMsg    : function (){
                       let engine = this.engine ;

                       engine.emit('operation',{
                        'operation'         : this.destinationDb.tblName.toUpperCase(),
                        'operationId'       : this.operationId,
                        'description'       : 'Clone '+this.sourceDb.tblName.toUpperCase()+' Table to '+this.destinationDb.name.toUpperCase()+ ' Database as '+this.destinationDb.tblName.toUpperCase(),
                        'msgType'           : 'operation',
                        'hostSystem'        : this.hostSystem,
                        'startTime'         : this.startTime,
                        'endTime'           : this.endTime,
                        'bytesCloned'       : this.tableSizeInCharacters,
                        'secondsTaken'      : (this.endTimeValue.getTime() - this.startTimeValue.getTime())/1000,
                        'stepsTaken'        : this.stepCount,
                        'sourceDb'          : {'name'              : this.sourceDb.name,
                                               'make'              : this.sourceDb.make,
                                               'table'             : this.sourceDb.tblName,
                                               'rows'              : this.sourceTblRowCt},
                        'destinationDb'     : {'name'              : this.destinationDb.name,
                                               'make'              : this.destinationDb.make,
                                               'table'             : this.destinationDb.tblName,
                                               'rows'              : this.destTblRowCt,
                                               'created'           : this.destTblCreated,
                                               'tableWasRebuilt'   : this.destinationDb.overwriteDestTbl},
                        'rowCountsMatch'    : this.sourceTblRowCt == this.destTblRowCt ? "yes" : "no"
                       });
                    }

}

module.exports = Emitter;
