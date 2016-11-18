/*******************************************************************************
FILE: tools
PATH: lib/tools.js
SUMMARY: an assortment of tools
*******************************************************************************/
///////////////////////////////////////// THE CLONE ENGINE TOOLS /////////////////////////////////////////
//Create an ISO standardized timestamp for emitter messages
exports. timeStamp = function(zone,date) {
  let now;
  //if no date input... generate a new one
  date ? now = date : now = new Date()

  if (zone === 'local'){
    return(
      now.getFullYear()+
      '-'+
      (((now.getMonth()+1) < 10 ? "0" : "") + (now.getMonth()+1))+
      '-'+
      ((now.getDate() < 10 ? "0" : "") + now.getDate())+
      'T'+
      ((now.getHours() < 10 ? "0" : "") + now.getHours())+
      ':'+
      ((now.getMinutes() < 10 ? "0" : "") + now.getMinutes())+
      ':'+
      ((now.getSeconds() < 10 ? "0" : "") + now.getSeconds())+
      '.'+
      ((now.getMilliseconds() < 10 ? "00" : (now.getMilliseconds() < 100 ? "0" : "")) + now.getMilliseconds())+
      getTz(now.getTimezoneOffset())
    );
  }
  return(
    now.getUTCFullYear()+
    '-'+
    (((now.getUTCMonth()+1) < 10 ? "0" : "") + (now.getUTCMonth()+1))+
    '-'+
    ((now.getUTCDate() < 10 ? "0" : "") + now.getUTCDate())+
    'T'+
    ((now.getUTCHours() < 10 ? "0" : "") + now.getUTCHours())+
    ':'+
    ((now.getUTCMinutes() < 10 ? "0" : "") + now.getUTCMinutes())+
    ':'+
    ((now.getUTCSeconds() < 10 ? "0" : "") + now.getUTCSeconds())+
    '.'+
    ((now.getUTCMilliseconds() < 10 ? "00" : (now.getUTCMilliseconds() < 100 ? "0" : "")) + now.getUTCMilliseconds())+
    'Z'
  );
};

//transform JavaScript timezone offset to ISO format
function getTz (timeZoneOffsetMinutes){
  if(timeZoneOffsetMinutes === 720) {return "-12:00";}
  if(timeZoneOffsetMinutes === 660) {return "-11:00";}
  if(timeZoneOffsetMinutes === 600) {return "-10:00";}
  if(timeZoneOffsetMinutes === 540) {return "-09:00";}
  if(timeZoneOffsetMinutes === 480) {return "-08:00";}
  if(timeZoneOffsetMinutes === 420) {return "-07:00";}
  if(timeZoneOffsetMinutes === 360) {return "-06:00";}
  if(timeZoneOffsetMinutes === 300) {return "-05:00";}
  if(timeZoneOffsetMinutes === 240) {return "-04:00";}
  if(timeZoneOffsetMinutes === 180) {return "-03:00";}
  if(timeZoneOffsetMinutes === 120) {return "-02:00";}
  if(timeZoneOffsetMinutes === 60) {return "-01:00";}
  if(timeZoneOffsetMinutes === 0) {return "+00:00";}
  if(timeZoneOffsetMinutes === -60) {return "+01:00";}
  if(timeZoneOffsetMinutes === -120) {return "+02:00";}
  if(timeZoneOffsetMinutes === -180) {return "+03:00";}
  if(timeZoneOffsetMinutes === -240) {return "+04:00";}
  if(timeZoneOffsetMinutes === -300) {return "+05:00";}
  if(timeZoneOffsetMinutes === -360) {return "+06:00";}
  if(timeZoneOffsetMinutes === -420) {return "+07:00";}
  if(timeZoneOffsetMinutes === -480) {return "+08:00";}
  if(timeZoneOffsetMinutes === -540) {return "+09:00";}
  if(timeZoneOffsetMinutes === -600) {return "+10:00";}
  if(timeZoneOffsetMinutes === -660) {return "+11:00";}
  if(timeZoneOffsetMinutes === -720) {return "+12:00";}
}

//a uniqueId generator
exports.getUniqueID = function() {
  return require('crypto').randomBytes(Math.ceil(12/2)).toString('hex').slice(0,12);
}
