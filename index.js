var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');

var users = {};
var frmId = 0;
var toId = 0;
  
app.get('/', function(req, res){
        frmId = req.query.fromid;
        toId = req.query.toid;
        res.sendFile(__dirname + '/index.html');
});

//DB Config
var connection;

var db_config = {
    host: '127.0.0.1',
    user: 'root',
    password: 'root',
    database: 'chat',
    connectionLimit: 200,
    queueLimit: 0,
    waitForConnection: true
};

function handleDisconnect() {
    connection = mysql.createConnection(db_config); // Recreate the connection, since
    // the old one cannot be reused.

    connection.connect(function (err) {              // The server is either down
        if (err) {                                     // or restarting (takes a while sometimes).
            console.log('error when connecting to ' + db_config.databse + 'db:', err);
            setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
        }                                     // to avoid a hot loop, and to allow our node script to
    });                                     // process asynchronous requests in the meantime.
    // If you're also serving http, display a 503 error.
    connection.on('error', function (err) {
        console.log(db_config.databse + ' db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
            handleDisconnect();                         // lost due to either server restart, or a
        } else {                                      // connnection idle timeout (the wait_timeout
            handleDisconnect();
        }
    });
}

handleDisconnect();

// Define/initialize our global vars

var chats = [];
var isInitNotes = false;
var socketCount = 0;
var msguser='';

io.on('connection', function(socket){
   
  socket.on('chatmessage', function(data){
//    console.log('socketid: ' + socket.id,'fromid: ' + data.fromid,'toid: ' + data.toid,'msg: ' + data.msg);
    connection.query("select name from user where id = '"+data.fromid+"'")
            .on('result', function(udata){

            msguser = udata.name;
            var theDate = new Date(Math.floor(Date.now() / 1000) * 1000);
            dateString = theDate.toTimeString();
            if(frmId==data.fromid){    
                var newmsg = '<li><span class="fromuser">'+msguser+':</span>' + data.msg+ '<span class="timestamp">' + dateString.substring(0,8) + '</span></li>';
            }else{
                var newmsg = '<li><span class="touser">'+msguser+':</span>' + data.msg+ '<span class="timestamp">' + dateString.substring(0,8) + '</span></li>';
            }
            io.emit('chatmessage',newmsg);
            });
    

    CurrentTimeStamp = Math.floor(Date.now() / 1000);
    var InsertConversation = "INSERT INTO conversation(from_id,to_id,timestamp,con_id) VALUES ('" +data.fromid+ "','"+ data.toid +"','" + CurrentTimeStamp + "','1')";
    connection.query(InsertConversation, function (err) {
        if (err) {
            console.log(connection.database + 'Connection error:', err);
        }
    }); 

    var InsertReply = "INSERT INTO conversation_reply(reply,from_id,to_id,timestamp,con_id,read_status) VALUES ('" +data.msg+ "','" +data.fromid+ "','"+ data.toid +"','" + CurrentTimeStamp + "','1','N')";
    connection.query(InsertReply, function (err) {
        if (err) {
            console.log(connection.database + 'Connection error:', err);
        }
    }); 
  });

    // Check to see if initial query/notes are set
//    if (! isInitNotes) {
        // Initial app start, run db query
        connection.query("select a.name as username,conversation_reply.reply as msg,conversation_reply.from_id,conversation_reply.to_id,conversation_reply.timestamp from conversation_reply join user as a on a.id = conversation_reply.from_id where conversation_reply.from_id='"+frmId+"' and conversation_reply.to_id='"+toId+"' or  conversation_reply.from_id='"+toId+"' and conversation_reply.to_id='"+frmId+"' group by conversation_reply.id order by conversation_reply.timestamp asc")
            .on('result', function(data){
                // Push results onto the notes array
                chats.push(data)
            })
            .on('end', function(){
                // Only emit notes after query has been completed
                socket.emit('initial chats',{ frmId: frmId,toId: toId,chats:chats});
                chats = [];
            })
// 
//        isInitNotes = true
//    } else {
//        
//        console.log('test:----@@@@@@@@@2>'+frmId);
//        // Initial notes already exist, send out
//        socket.emit('initial chats', chats)
//    }
    
});

http.listen(3001, function(){
  console.log('listening on *:3001');
});