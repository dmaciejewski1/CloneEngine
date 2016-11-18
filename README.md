# CloneEngine
A tool for cloning database tables; from Postgres into Oracle

### Summary:
  - Cast one or multiple tables (from a Postgres source) as comparable Oracle
  Tables (or rebuild existing ones). Cloning Operations are run in-memory,
  and can be configured to be run asynchronously or synchronously.

### Usage:
  - This module is purposed to clone SMALLER data tables from within a Postgres
  database environment into an Oracle database environment. The process used
  does not write to file, but rather stores entire tables in memory while
  offloading the data into Oracle. Size your cloning operations accordingly.
  Know the sizes of your tables versus what memory resources are available to
  the system running this module versus how many cloning operations are being
  called at run-time before proceeding. As these operations are done in-memory,
  it may be necessary to run only one cloning operation at a time (i.e.
  synchronously rather than asynchronously).

### Limitations:
  - As a guide, expect a simple laptop to handle realistically between 2 to 10
  Gb of data (that being the total amount of data to be cloned during
  run-time event) in a timely manner. Needless to say, a more robust system
  could handle much more than that.
  - While CloneEngine tries to be responsible handling database connection
  closures, keep in mind the more cloning operations running asynchronously,
  the more database connections that are opened against a database. Each
  database has limits with the amount of connections that it can have open at
  one time. As CloneEngine offloads data, database connections will remain open
  per cloning operation (and most likely for some time) until the data
  offloading process is complete for that operation. Also keep in mind that
  connection time can quickly increase as resources are stretched handling larger
  operations asynchronously.

### Requirements:
  - Oracle Instant Client installed and configured on local machine

### Add-ons:
  - CloneLogger

### Data Type Conversions:

  - Currently resolves the following Postgres data types to the following Oracle
  Data Types


  | Postgres Data Type | Oracle Data Type  |
  |--------------------|-------------------|
  |       varchar      |     varchar2      |
  |       numeric      |      number       |
  |        int4        |     integer       |
  |      timestamp     |     varchar2      |
  |        bool        |     varchar2      |
  |        text        |     varchar2      |

### Message/Feedback Emitters:

##### Message Emitter Types

|     Type      |                     Behavior                          | Category |
|---------------|-------------------------------------------------------|----------|
|    start      | Emits on start only                                   | activity |
|  connection   | Emits when connection is opened or closed             | activity |
| rowsToProcess | Emits the row count of the table to be cloned         | activity |
|   process     | Emits when data is being processed                    | activity |
|  countsMatch  | Emits true if source and destination row counts match | activity |
|    finish     | Emits on finish only                                  | activity |
|   operation   | Emits a summary of operation only                     | summary  |
|    ERROR!     | Emits when errors occur                               | activity |

##### Activity Messages

|  Emitter Property  |                         Property Description                                   |
|--------------------|--------------------------------------------------------------------------------|
|     activityId     | Operation step unique ID                                                       |
|     operation      | Operation name                                                                 |
|    operationId     | Operation unique ID                                                            |
|      msgType       | Operation message type (start, connection, process, finish, operation, ERROR!) |
|       step         | Operation step number                                                          |
|       time         | Operation ISO formatted timestamp                                              |
|    description     | Operation description                                                          |


### Quick Start:
#### *A) Oracle Instant Client Download*
1. Download the following **TWO** Oracle Instant Client Packages (here: http://www.oracle.com/technetwork/database/features/instant-client/index-097480.html ). Please make sure to download the correct packages for your system architecture (i.e. 64 bit vs 32 bit)

    * **Instant Client Package - Basic or Basic Lite**: Contains files required to run OCI, OCCI, and JDBC-OCI applications

    * **Instant Client Package - SDK**: Contains additional header files and an example makefile for developing Oracle applications with Instant Client

#### *B) Oracle Instant Client Installation and Configuration (this example procedure is for Mac OS X 64bit ONLY)*
From a terminal window:

1) Unzip your Oracle Instant Client files to ```~/oracle```
```bash
unzip instantclient-basic-macos.x64-12.1.0.2.0.zip -d ~/oracle
unzip instantclient-sdk-macos.x64-12.1.0.2.0.zip -d ~/oracle
```
2) Update your .bashrc file by appending and saving the following block of code:
```bash
##### Oracle Instant Client 12.1 #####
export OCI_HOME=~/oracle/instantclient_12_1
export OCI_LIB_DIR=$OCI_HOME
export OCI_INC_DIR=$OCI_HOME/sdk/include
export OCI_INCLUDE_DIR=$OCI_HOME/sdk/include
export DYLD_LIBRARY_PATH=$OCI_LIB_DIR
```
3) Create the following symbolic links from within your Instant Client directory (e.g. /oracle/instantclient_12_1):
```bash
ln -s ~/oracle/instantclient_12_1/libclntsh.dylib.12.1 ~/oracle/instantclient_12_1/libclntsh.dylib
ln -s ~/oracle/instantclient_12_1/libocci.dylib.12.1 ~/oracle/instantclient_12_1/libocci.dylib
```
4) Restart your Terminal application OR type the following ```source ~/.bashrc```

#### *C) CloneEngine Installation*
```
npm install cloneengine
```


#### *D) Run CloneEngine Operations*
```js
"use strict";
var CloneEngine = require('cloneengine');
/////////////////////////////////////////// CLONE OPERATION OPTIONS /////////////////////////////////////////

//----Source Database Connection Setup----
const SOURCE_DB = {
        dbMake          : 'postgres',
        database        : 'myPostgresDb',
        user            : 'me',
        password        : 'myPassWord',
        host            : 'my.db.com'
      };


//----Destination Database Connection Setup----
const DESTINATION_DB = {// must have read, write, delete permissions
        dbMake          : 'oracle',
        database        : 'myOracleDb',
        user            : 'me',
        password        : 'myPassWord',
        host            : 'myother.db.com',
        port            : 12345,
        service         : 'myother.db.com'
      };


//---- CloneEngine Options----
const OVERWRITE_FOR_ALL_OPS = 'yes'; // allows CloneEngine to delete existing (Destination Db) table and replace with new one
const TIMEZONE = 'local'; // uses ISO Standard Timestamp... choose either 'utc' or 'local'
const DISPLAY_MESSAGES_ON_CONSOLE = 'yes'; // configures CloneEngine messages to display on console
const RUN_TYPE = 'synchronous'; // choose to run operations either "synchronous" (synchronously) or "asynchronous" (asynchronously)
const STOP_ON_ERROR = 'yes'; // when running synchronously... upon an error: if 'yes' is selected, no further operations will be run


/////////////////////////////////////////////// CLONEENGINE LOGIC /////////////////////////////////////////////

//--------------- Handle emitter output messages---------
//templates for handling output from cloneEngine emitters
var handleEmitterOutput = function(msg){

  //configure output message on console...
  if (DISPLAY_MESSAGES_ON_CONSOLE === 'yes') {
    if(msg.msgType === 'operation'){console.log(msg);}
    else if(msg.msgType === 'ERROR!'){
      //Error just adds a red font
      console.log(
        msg.activityId +' '+msg.operationId+' '+msg.step+' '+msg.operation+' \x1b[31m'+msg.msgType+'\x1b[0m'+' '+msg.time+' => '+msg.description);
    }else{
      console.log(
        msg.activityId +' '+msg.operationId+' '+msg.step+' '+msg.operation+' '+msg.msgType+' '+msg.time+' => '+msg.description);
    }
  }
};

//----------------- Create a Clone Engine---------------
function runCloneEngineOperation (plan) {

  //initialize a new cloning engine
  let engine = new CloneEngine(SOURCE_DB,DESTINATION_DB,TIMEZONE);

  //configure CloneEngine listiners and how to handle outputs
  engine.on('start',function(msg){handleEmitterOutput(msg);})
  engine.on('connection',function(msg){handleEmitterOutput(msg);})
  engine.on('rowsToProcess',function(msg){handleEmitterOutput(msg);})
  engine.on('process',function(msg){handleEmitterOutput(msg);})
  engine.on('countsMatch',function(msg){handleEmitterOutput(msg);})
  engine.on('finish',function(msg){handleEmitterOutput(msg);})
  engine.on('ERROR!',function(msg){handleEmitterOutput(msg);})
  engine.on('operation',function(msg){handleEmitterOutput(msg);})

  //run engine
  engine.run(plan);

  //upon completion of operation resolve promise
  return new Promise(function(resolve, reject){
    STOP_ON_ERROR == 'no' ?
      engine.on('ERROR!',function(msg){if (msg){resolve(msg);}}) :
      engine.on('ERROR!',function(msg){if (msg){reject(msg);}})
    engine.on('finish',function(msg){if (msg) {resolve(true);}})
  })
};


////////////////////////////////////// RUN ENGINE OPERATIONS ////////////////////////////////////

//Run CloneEngine Operations (synchronously)...
if (RUN_TYPE === 'synchronous') {

  runCloneEngineOperation({
    sourceTableName                     : 'table1',
    destinationTableName                : 'clone_a',
    overwriteDestTblIfExists            : OVERWRITE_FOR_ALL_OPS
  })
  .then(function(){
    runCloneEngineOperation({
      sourceTableName                     : 'table2',
      destinationTableName                : 'clone_b',
      overwriteDestTblIfExists            : OVERWRITE_FOR_ALL_OPS
  })
  .then(function(){
    runCloneEngineOperation({
      sourceTableName                     : 'table3',
      destinationTableName                : 'clone_c',
      overwriteDestTblIfExists            : OVERWRITE_FOR_ALL_OPS
  })
  .then(function(){
    runCloneEngineOperation({
      sourceTableName                     : 'table4',
      destinationTableName                : 'clone_d',
      overwriteDestTblIfExists            : OVERWRITE_FOR_ALL_OPS
  })
  }).catch(function(err){console.log(err);})
  }).catch(function(err){console.log(err);})
  }).catch(function(err){console.log(err);});
}

//Run CloneEngine Operations (asynchronously)...
if (RUN_TYPE === 'asynchronous') {

  runCloneEngineOperation({
    sourceTableName                     : 'table1',
    destinationTableName                : 'clone_a',
    overwriteDestTblIfExists            : OVERWRITE_FOR_ALL_OPS
  })

  runCloneEngineOperation({
    sourceTableName                     : 'table2',
    destinationTableName                : 'clone_b',
    overwriteDestTblIfExists            : OVERWRITE_FOR_ALL_OPS
  })

  runCloneEngineOperation({
    sourceTableName                     : 'table3',
    destinationTableName                : 'clone_c',
    overwriteDestTblIfExists            : OVERWRITE_FOR_ALL_OPS
  })

  runCloneEngineOperation({
    sourceTableName                     : 'table4',
    destinationTableName                : 'clone_d',
    overwriteDestTblIfExists            : OVERWRITE_FOR_ALL_OPS
  })
}

```
-
