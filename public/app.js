const form = document.getElementById("form");

form.addEventListener("submit", submitForm);

document.getElementById("compare_button").addEventListener("click", compare_audio);
document.getElementById("identify_button").addEventListener("click", identify_audio);
document.getElementById("file").addEventListener("click", enableSubmit);
function enableSubmit(){
  document.getElementById("submit_page").disabled = false;
}

function identify_audio(){
  fetch("http://localhost:4541/api/get_identity/"+document.getElementById("hidden_operationId").value, {
    method: 'POST',
    cache: 'no-cache',
    })
      .then((res) => res.json())
      .then(data => {
        // Handle the response from the backend
      //  console.log(data);
         alert(data.message)
    })
      .catch((err) => ("Error occured", err));
}
function compare_audio(){
  fetch("http://localhost:4541/api/audio_compare", {
    method: 'GET',
    cache: 'no-cache',
    })
      .then((res) => res.json())
      .then(data => {
        // Handle the response from the backend
        console.log(data);
        document.getElementById("hidden_operationId").value = data.operationId
        alert("successfully running the process.Please Press the get result.")
        document.getElementById("identify_button").disabled = false;
        document.getElementById("compare_button").disabled = true;
    })
      .catch((err) => ("Error occured", err));
}

function submitForm(e) {
  e.preventDefault();
  const files = document.getElementById("file");
  const formData = new FormData();
    formData.append("file", files.files[0]);
  fetch("http://localhost:4541/api/audio_upload", {
    method: 'POST',
    cache: 'no-cache',
    'Content-Type': 'application/octet-stream',
      body: formData,
    })
      .then((res) => {
        if(!res.ok){
          alert("File not uploaded")
          return;
        }
           document.getElementById("compare_button").disabled = false;
           document.getElementById("submit_page").disabled = true;
            // alert("Audio file uploadedsss")
      })
      .catch((err) => ("Error occured", err));
}
document
  .getElementById("startRecording")
  .addEventListener("click", initFunction);

let isRecording = document.getElementById("isRecording");

async function uploadBlob(audioBlob, fileType) {
  const body = new FormData();
  //body.append('audio_data', audioBlob, 'file');
 body.append('type', fileType || 'mp3');
 body.append("recording", audioBlob);

  // Your server endpoint to upload audio:
  const apiUrl = "http://localhost:4541/api/upload/"+ document.getElementById("recorderName").value;
  const response = await fetch(apiUrl, {
    method: 'POST',
    cache: 'no-cache',
    'Content-Type': 'application/octet-stream',
    body: body
  });
  return response.ok;
}
function initFunction() {
  if(!document.getElementById("recorderName").value.length){
      alert("Please Enter Name first to proceed.")
    return;
  }
  // Display recording
  async function getUserMedia(constraints) {
    if (window.navigator.mediaDevices) {
      return window.navigator.mediaDevices.getUserMedia(constraints);
    }

    let legacyApi =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

    if (legacyApi) {
      return new Promise(function (resolve, reject) {
        legacyApi.bind(window.navigator)(constraints, resolve, reject);
      });
    } else {
      alert("user api not supported");
    }
  }

  isRecording.textContent = "Recording...";
  //

  let audioChunks = [];
  let rec;

  function handlerFunction(stream) {
    rec = new MediaRecorder(stream);
    rec.start();
    rec.ondataavailable = (e) => {
      audioChunks.push(e.data);
      if (rec.state == "inactive") {
        let blob = new Blob(audioChunks, { type: "audio/wav" });
        document.getElementById("audioElement").src = URL.createObjectURL(blob);
        let status = uploadBlob(blob,"wav");
        //console.log("status",status);
        if(!status){
             alert("Error in uploading file");
             return;
        }
              alert("Recording uploaded and enrolled successfully")
           
      }
    };
  }

  function startusingBrowserMicrophone(boolean) {
    getUserMedia({ audio: boolean }).then((stream) => {
      handlerFunction(stream);
    });
  }

  startusingBrowserMicrophone(true);

  // Stoping handler
  document.getElementById("stopRecording").addEventListener("click", (e) => {
    rec.stop();
    isRecording.textContent = "Click play button to start listening";
  });
}
