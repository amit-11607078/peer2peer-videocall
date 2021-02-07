import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [alluser, setAlluser] = useState([]);
  const [user, setUser] = useState("");
  const [other, setOther] = useState("");

  const localVideo = useRef();
  const remoteVideo = useRef();
  var connectedUser;
  var yourConn;
  var data;
  var serverConnection;
  var connectionState;
  var peerConnectionConfig = {
    iceServers: [
      { urls: "stun:stun.stunprotocol.org:3478" },
      { urls: "stun:stun.l.google.com:19302" },
    ],
  };
  useEffect(() => {
    serverConnection = new WebSocket(
      "wss://" + window.location.hostname + ":8443"
    );

    serverConnection.onopen = function () {
      console.log("Connected to the signaling server");
    };

    serverConnection.onmessage = gotMessageFromServer;
  });

  function send(msg) {
    //attach the other peer username to our messages
    connectedUser = user;
    if (user) {
      msg.name = user;
    }
    console.log("msg before sending to server", msg);
    serverConnection.send(JSON.stringify(msg));
  }

  function gotMessageFromServer(message) {
    console.log("Got message", message.data);
    data = JSON.parse(message.data);

    switch (data.type) {
      case "login":
        handleLogin(data.success, data.allUsers);
        break;
      //when somebody wants to call us
      case "offer":
        console.log("inside offer");
        handleOffer(data.offer, data.name);
        break;
      case "answer":
        console.log("inside answer");
        handleAnswer(data.answer);
        break;
      //when a remote peer sends an ice candidate to us
      case "candidate":
        console.log("inside handle candidate");
        handleCandidate(data.candidate);
        break;
      case "leave":
        handleLeave();
        break;
      default:
        break;
    }

    serverConnection.onerror = function (err) {
      console.log("Got error", err);
    };
  }
  /* START: Register user for first time i.e. Prepare ground for webrtc call to happen */
  function handleLogin(success, allUsers) {
    if (success === false) {
      alert("Ooops...try a different username");
    } else {
      var allAvailableUsers = allUsers.join();
      console.log("All available users", allAvailableUsers);
      // showAllUsers.innerHTML = 'Available users: '+allAvailableUsers;
      setAlluser((prevAlluser) => {
        return [...prevAlluser, allAvailableUsers];
      });
      // localVideo = document.getElementById('localVideo');
      // remoteVideo = document.getElementById('remoteVideo');
      // document.getElementById('myName').hidden = true;
      // document.getElementById('otherElements').hidden = false;

      var constraints = {
        video: true,
        audio: true,
      };

      /* START:The camera stream acquisition */
      if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia(constraints)
          .then(getUserMediaSuccess)
          .catch(errorHandler);
      } else {
        alert("Your browser does not support getUserMedia API");
      }
      /* END:The camera stream acquisition */
    }
  }
  /* END: Register user for first time i.e. Prepare ground for webrtc call to happen */

  function getUserMediaSuccess(stream) {
    var localStream = stream;
    localVideo.current.srcObject = stream;
    yourConn = new RTCPeerConnection(peerConnectionConfig);

    connectionState = yourConn.connectionState;
    console.log("connection state inside getusermedia", connectionState);

    yourConn.onicecandidate = function (event) {
      console.log(
        "onicecandidate inside getusermedia success",
        event.candidate
      );
      if (event.candidate) {
        send({
          type: "candidate",
          candidate: event.candidate,
        });
      }
    };
    yourConn.ontrack = gotRemoteStream;
    yourConn.addStream(localStream);
  }

  function handleChange(e) {
    setUser(e.target.value);
  }
  function onSave() {
    // setAlluser((prevAlluser) => {
    //   return [...prevAlluser, user];
    // });
    if (user.length > 0) {
      send({
        type: "login",
        name: user,
      });
    }
  }
  function handleChangeOther(e) {
    setOther(e.target.value);
  }
  function onCall(e) {
    console.log("inside call button");
    if (other.length > 0) {
      connectedUser = other;
      console.log("other user- ", other);
      console.log("nameToCall", connectedUser);
      console.log("create an offer to-", connectedUser);
      yourConn = new RTCPeerConnection(peerConnectionConfig);

      connectionState = yourConn.connectionState;
      var connectionState2 = yourConn.connectionState;
      console.log("connection state before call beginning", connectionState2);
      var signallingState2 = yourConn.signalingState;
      //console.log('connection state after',connectionState1)
      console.log("signalling state after", signallingState2);
      yourConn.createOffer(
        function (offer) {
          send({
            type: "offer",
            offer: offer,
          });

          yourConn.setLocalDescription(offer);
        },
        function (error) {
          alert("Error when creating an offer", error);
          console.log("Error when creating an offer", error);
        }
      );
      // document.getElementById('callOngoing').style.display = 'block';
      // document.getElementById('callInitiator').style.display = 'none';
    } else alert("username can't be blank!");
  }

  /* START: Create an answer for an offer i.e. send message to server */
  function handleOffer(offer, name) {
    /* Call answer functionality starts */
    console.log("data ", data, data.name, data.offer);
    connectedUser = name;
    yourConn.setRemoteDescription(new RTCSessionDescription(offer));

    //create an answer to an offer
    yourConn.createAnswer(
      function (answer) {
        yourConn.setLocalDescription(answer);

        send({
          type: "answer",
          answer: answer,
        });
      },
      function (error) {
        alert("Error when creating an answer");
      }
    );
  }

  function gotRemoteStream(event) {
    console.log("got remote stream");
    remoteVideo.current.srcObject = event.streams[0];
  }
  function errorHandler(error) {
    console.log(error);
  }
  //when we got an answer from a remote user
  function handleAnswer(answer) {
    console.log("answer: ", answer);
    yourConn.setRemoteDescription(new RTCSessionDescription(answer));
  }
  //when we got an ice candidate from a remote user
  function handleCandidate(candidate) {
    yourConn.addIceCandidate(new RTCIceCandidate(candidate));
  }

  function handleHangup(e) {
    send({
      type: "leave",
    });

    handleLeave();

    // document.getElementById('callOngoing').style.display = 'none';
    // document.getElementById('callInitiator').style.display = 'block';
  }

  function handleLeave() {
    connectedUser = null;
    remoteVideo.current.src = null;
    connectionState = yourConn.connectionState;
    var signallingState = yourConn.signalingState;
    console.log("connection state before", connectionState);
    console.log("signalling state before", signallingState);
    yourConn.close();
    yourConn.onicecandidate = null;
    yourConn.onaddstream = null;
    var connectionState1 = yourConn.connectionState;
    var signallingState1 = yourConn.signalingState;
    console.log("connection state after", connectionState1);
    console.log("signalling state after", signallingState1);
  }
  function handleDecline() {}

  return (
    <>
      <div>
        <input
          type="text"
          onChange={handleChange}
          placeholder="My name"
          value={user}
        ></input>
        <input type="button" onClick={onSave} value="Save"></input>
      </div>
      <span>Hello, {user}</span>

      <span>Alluser:- {alluser}</span>

      <input
        type="text"
        onChange={handleChangeOther}
        value={other}
        placeholder="username to call"
      ></input>
      <button onClick={onCall}>Call</button>
      <div>
        <video ref={localVideo} autoPlay muted style={{ width: 400 }}></video>
        <b>
          <span> </span>
        </b>
        <video ref={remoteVideo} autoPlay style={{ width: 600 }}></video>

        <br />
        <div>
          <button onClick={handleOffer} className="btn-success btn">
            Answer
          </button>
          <button onClick={handleDecline} className="btn-danger btn">
            Decline
          </button>
        </div>
        <div>
          <button onClick={handleHangup} className="btn-danger btn">
            Hang Up
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
