  var mongo = require('mongodb'); 
  var schedule = require('node-schedule');

  var moment = require('moment');

  const dbName = "leRo_DB";
	const MongoClient = mongo.MongoClient;
  const url = "mongodb+srv://tcc2020:zDOo5kKVvZ0JMzAJ@lero-vjuos.gcp.mongodb.net/test?retryWrites=true&w=majority";
  const paramsM = { useNewUrlParser: true, useUnifiedTopology: true };
  const scheduleEnvVar = process.env.CRON_JOB || '0 * * * *';
  const scheduleEnvVarStatus = process.env.CRON_JOB2 || '* * * * *';
  const scheduleEnvVarReport = process.env.CRON_JOB3 || '0 0 * * *';

  // Variáveis para guardar o dia de hoje e o próximo dia a processar (Next Run começa com a data de hoje e ao processar uma vez é setada ao outra dia)
  let nextRun = new Date();

  // Função que roda para verificar se a data de hoje é igual ao da próxima vez de processar
  function eventsFinalizeProcessRun() {
      let todayDate = new Date();
      todayDate.setHours(todayDate.getHours()-3);

      if (todayDate.toLocaleDateString() == nextRun.toLocaleDateString()) {

        let countEventsToUpdate = 0;
        console.log("\nRodando processo na data de "+ todayDate.toLocaleDateString() + " ..."); 

        MongoClient.connect(url, paramsM, function(err, db) {
          if (err) throw err;
          var dbo = db.db(dbName);

          dbo.collection("events").find({status: {$eq: 0}}, {projection: {status: 1, data: 1}}).toArray(function(err, result) {
            if (err) throw err;
            // console.log(result);
            // console.log(moment().format("yyyyMMDD"));
            if(result){
              let i = 0;
              for(i = 0; i < result.length; ++i){
                let event = result[i];
                let dateEvent = moment(event.data).format("yyyyMMDD");
                console.log(dateEvent);
                console.log(moment().format("yyyyMMDD"));
                if(dateEvent < moment().format("yyyyMMDD")){
                  countEventsToUpdate++;
                  console.log("\nFinalizando eventos de datas anteriores a "+ todayDate.toLocaleDateString() + " ..."); 
                  let eventId = new require('mongodb').ObjectID(event._id);
                  dbo.collection("events").updateOne({_id: eventId}, {$set: {status: 1}}, {upsert: true}, function(err, result) {
                    if (err) throw err;
                  });
                }
              }
              if(i+1 == countEventsToUpdate) db.close();
            }

            if(countEventsToUpdate > 0){
              console.log(countEventsToUpdate+ " evento(s) teve/tiveram seu status atualizado. ");
              console.log("Eventos com data menor que "+ todayDate.toLocaleDateString() + " finalizados com sucesso. ");
            }else{
              console.log("Não há eventos para finalizar. ");
            }
            nextRun = new Date();
            nextRun.setDate(nextRun.getDate()+1);
            console.log("Próximo processamento: "+ nextRun.toLocaleDateString());
            
          });
        }); 
      }else{
        console.log("Próximo processamento: "+ nextRun.toLocaleDateString());
      }
  }

  // Função que roda para trocar os status de online dos usuários
  function changeStatusUsersProcessRun() {
    MongoClient.connect(url, paramsM, function(err, db) {
      var dbo = db.db(dbName);
			dbo.collection("users").updateMany({online: 1}, {$set: 	{ online: 0 }}, function(err, result) {
				if (err) throw err;
				db.close();
      });
    });
  }

  // Função que roda para inativar os usuários que foram denunciados
  function inactiveReportedUsersProcessRun() {
    let userToInactivate = 0;
    let usersResult = 0;
    MongoClient.connect(url, paramsM, function(err, db) {
      var dbo = db.db(dbName);
			// dbo.collection("users").updateMany({reports : { $exists: true, $gt: {$size: 2} }}, {$set: 	{ status_account: true }}, function(err, result) {
      //   if (err) throw err;
      //   console.log("\n[BLOQUEIO] " + result.modifiedCount + " usuários foram bloqueados \n");
			// 	db.close();
      // });

      dbo.collection("users").find({reports : { $exists: true}, status_account: false}, {projection: {_id: 1, reports: 1}}).toArray(function(err, result) {
        if (err) throw err;
        if(result){
          let i = 0;
          let userLength = result.length;
          for(i = 0; i < userLength; ++i){
            let user = result[i];
            usersResult++;
            if(user.reports.length >= 6){
              userToInactivate++;
              let userId = new require('mongodb').ObjectID(user._id);
              dbo.collection("users").updateOne({_id: userId}, {$set: {status_account: true}}, {upsert: true}, function(err, result) {
                if (err) throw err;
              });
            }
          } 
          if(i+1 == usersResult) db.close();
        }
        console.log("\n[BLOQUEIO] " + userToInactivate + " usuários foram bloqueados \n");
      });

    });
  }

  schedule.scheduleJob(scheduleEnvVar, function(){
    eventsFinalizeProcessRun();
  });

  schedule.scheduleJob(scheduleEnvVarStatus, function(){
    changeStatusUsersProcessRun();
  });

  schedule.scheduleJob(scheduleEnvVarReport, function(){
    inactiveReportedUsersProcessRun();
  });

  eventsFinalizeProcessRun();
  changeStatusUsersProcessRun();
  inactiveReportedUsersProcessRun();
