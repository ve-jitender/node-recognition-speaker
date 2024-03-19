"use strict";

const cognitive = require('./src/index.js');
const config = require('./config.js');
const fs = require('fs');
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const path = require("path");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

// Tell fluent-ffmpeg where it can find FFmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
const port = process.env.PORT || 4541;
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
		if (fs.existsSync(path.join(__dirname, "audios"))) {
			fs.rmSync(path.join(__dirname, "audios"), { recursive: true })
		}
		fs.mkdirSync(path.join(__dirname, "audios"), { recursive: true })
      cb(null, 'audios/')
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname)
    },
  })
  const uploadAudio = multer({ storage: storage })
const upload = multer({
	dest: path.join(__dirname, "recordings"),
	limits: { fileSize: 2500000 },
	fileFilter: (req, file, cb) => cb(null, file.mimetype === "audio/wav"),
	filename: (req, file, cb) => {
		const { originalname } = file;
		const fileExtension = (originalname.match(/\.+[\S]+$/) || [])[0];
		cb(null, `${file.fieldname}__${Date.now()}${fileExtension}`);
         }
}).single("recording");
const adapter = new FileSync(path.join(__dirname, "voice-memo.json"));
const db = low(adapter);
db.defaults({ users: [] }).write();
const linkToProfiles = new FileSync(path.join(__dirname, "profile.json"));
const dbProfile = low(linkToProfiles);
dbProfile.defaults({ profile: [] }).write();

const deleteTimestamp = 259200000;
const deleteInterval = 21600000;
var output;
const handleList = (id) => {
	const files = db
		.get("users")
		.filter({ name: id })
		.sortBy("date")
		.reverse()
		.slice(0, 5)
		.write();

	if (files) {
		return files.map((file) => ({ filename: file.filename, date: file.date }));
	}
	return [];
};

const cleanup = () => {
	db.get("users")
		.filter((e) => Date.now() - e.accessed > deleteTimestamp)
		.value()
		.forEach((file) => {
			fs.unlink(path.join(__dirname, "recordings", file.filename), (err) => {
				if (err && err.code === "ENOENT") {
					db.get("users").remove({ filename: file.filename }).write();
				} else if (err) {
					console.error(err);
				}
			});
		});

	db.get("users")
		.filter((e) => Date.now() - e.accessed < deleteTimestamp)
		.write();
};

//cleanup();
//setInterval(cleanup, deleteInterval);

app.use(helmet());
app.use(cors());
app.use(cookieParser());

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).send("oh no error");
});
// To compare the audio with the recordings and get the operation Id.This opertion
// will be stored in the frontend and return back to backend while fetching result.
app.get('/api/audio_compare', async function (req, res) {
	let arrayValues = dbProfile.get("profile").write()	
	let arraySpecificofProfileIds = arrayValues.map(({id}) => (id)).toString()
	//let fileInDir = [];
	Operation(arraySpecificofProfileIds,`./audios/${fs.readdirSync('./audios/')[0]}`, function(response,err){
		res.send({operationId : `${response}`})
	});
  })

  /**api for getting the result. Result will show the match happened or return the failure 
   * result.
   */
  app.post('/api/get_identity/:operationId', async function (req, res) {
	Identify(req.params.operationId,function(identityStatus,err){
		console.log("sdsdfds",identityStatus);
		if((identityStatus.status === "succeeded") && (identityStatus.processingResult.identifiedProfileId !=="00000000-0000-0000-0000-000000000000") ){
				let fileFound = dbProfile.get("profile")
			  					.find({ id: identityStatus.processingResult.identifiedProfileId}).write()
			 					 res.send({message:`Voice matched to ${fileFound.name} with  ${identityStatus.processingResult.confidence} confidence.`});	
			 	}
			 	else if((identityStatus.status === "succeeded") && (identityStatus.processingResult.identifiedProfileId == "00000000-0000-0000-0000-000000000000") ){
					res.send({message:`Voice not matched to any recording with ${identityStatus.processingResult.confidence} confidence.`});	
			 	}
			 	else
				 res.send({message:"File compare failure or it is in processing"});
			})
			 
  })
// eslint-disable-next-line no-unused-vars
app.get("/api/list/:name", (req, res, next) => {
	const files = handleList(req.params.name);
	// the whole cookie thing is just rudimentary "security"
	res.cookie("auth", Buffer.from(req.ip).toString("base64"));
	res.json({ files });
});

app.post("/api/delete/:name/:filename", (req, res, next) => {
	if (req.cookies.auth === Buffer.from(req.ip).toString("base64")) {
		fs.unlink(
			path.join(__dirname, "recordings", req.params.filename),
			(err) => {
				if (err && !err.code === "ENOENT") next(err);
			}
		);
		db.get("users")
			.remove({ name: req.params.name, filename: req.params.filename })
			.write();

		const files = handleList(req.params.name);
		res.status(200).send({ files });
	} else {
		res.status(403).send("absolutely not");
	}
});

/**
 * api to store the recording to the recordings folder and convert it to desired format 
 * from the incoming format.
 */
app.post("/api/upload/:name", (req, res, next) => {
	upload(req, res, (err) => {
		if (err) next(err);
			db.get("users")
				.push({
					name: req.params.name,
					filename: req.file.filename,
					date: Date.now(),
					accessed: Date.now()
				})
				.write();

            ffmpeg()
            // Input file
            .input(path.join(__dirname, "recordings",req.file.filename))
            // Audio bit rate
            .outputOptions('-ar', '16000')
            // Output file
            .saveToFile(path.join(__dirname, "recordings",req.params.name+"_voice.wav"))
            // Log the percentage of work completed
            .on('progress', (progress) => {
            if (progress.percent) {
                console.log(`Processing: ${Math.floor(progress.percent)}% done`);
            }
            })
            // The callback that is run when FFmpeg is finished
            .on('end', () => {
            console.log('FFmpeg has finished.');
			fs.unlinkSync(path.join(__dirname, "recordings",req.file.filename));
			let fileFound = dbProfile.get("profile")
					.find({ name: req.params.name}).write()
			if(!fileFound){
					 createAndEnroll(`./recordings/${req.params.name}_voice.wav`,function(res,err){
						 console.log("enroll",res);
					dbProfile.get("profile")
					.push({
						id: res,
						name: req.params.name,
						date: Date.now(),
						accessed: Date.now()
					})
					.write();					
					});
		}
            })
            // The callback that is run when FFmpeg encountered an error
            .on('error', (error) => {
            console.error(error);
            });
           
            const files = handleList(req.params.name);
			res.status(200).send({files});
	});
});

/**
 * upload of audio to be compared in audios folder.
 */
app.post('/api/audio_upload',uploadAudio.single('file'), function (req, res) {
    res.status(200).json({})
  })

  /**
 * api to play yhe recording file
 */
app.get("/api/play/:filename", (req, res, next) => {
	fs.open(
		path.join(__dirname, "recordings", req.params.filename),
		"r",
		(err) => {
			if (err && err.code === "ENOENT") {
				res.status(404).send("not found");
			} else if (err) {
				next(err);
			} else {
				db.get("users")
					.find({ filename: req.params.filename })
					.assign({ accessed: Date.now() })
					.write();
				res.sendFile(
					req.params.filename,
					{
						root: path.join(__dirname, "recordings"),
						dotfiles: "deny"
					},
					(err) => {
						if (err && err.code === "ENOENT") {
							res.status(404);
						} else if (err) {
							next(err);
						}
					}
				);
			}
		}
	);
});

app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'home.html'));
});
app.get('/app.js', function(req, res) {
	res.sendFile(__dirname + '/public/app.js') //change this to your file path
	})
app.post("/*", (req, res) => {
	res.status(403).send("absolutely not");
});

app.listen(port, "localhost", () => console.log(`listening on port ${port}`));


const client = new cognitive.speakerIdentification({
    apiKey: config.speakerRecognition.apiKey,
    endpoint: config.speakerRecognition.endpoint
});

 /**
 * This is the function to create and enroll the profile in speker recognition api
 */
function createAndEnroll(trainingAudio,callback) {
    // Create User Profile
    console.log('Creating identification profile...')
    const body = {
        locale: 'en-US'
    }
    client.createProfile({
        body
    }).then(response => {
        var identificationProfileId = response.identificationProfileId;
        console.log(identificationProfileId);

        
        //Enroll User Voice
        console.log('Enrolling identification profile...')
        
        const parameters = { identificationProfileId: identificationProfileId }
        const body = fs.readFileSync(trainingAudio);
        const headers = { 'Content-type': 'application/octet-stream' }
        
        client.createEnrollment({parameters,headers,body}).then(response => {
            callback(identificationProfileId,null)
        }).catch(err => {
			console.log("dsfdsfsd",err);
            callback(null,err)
        });
    }).catch(err => {
        console.log("err",err);
        callback(null,err)
    });
}

/**
 * This is the function to check that profile is enrolled in speker recognition api
 * successfully or not.
 */
function checkIfEnroll(identificationProfileId,callback) {
    const parameters = { identificationProfileId: identificationProfileId }
    client.getProfile({parameters}).then(response => {
        callback(response,null)
    }).catch(err => {
        callback(null,err)
    });
}

/**
 * This is the function to check operation for enrolleded profiles in speker recognition api
 * successfully..
 */
function Operation(identificationProfileIds,testAudio,callback){
    var parameters = {identificationProfileIds: identificationProfileIds}
    const headers = {'Content-type': 'application/octet-stream'}
    const body = fs.readFileSync(testAudio);
	 client.identify({parameters,headers,body}).then(response => {
		callback(response,null)
    }).catch(err => {
        callback(null,err)
    });
}

/**
 * This is the function to check identity for enrolleded profiles in speker recognition api
 * w.r.t provided audio frame.
 */
function Identify(operationId,callback){
    var parameters = {operationId: operationId}
	client.getOperationStatus({parameters}).then(response => {
        callback(response,null)
    }).catch(err => {
        callback(null,err)
    });
	
}