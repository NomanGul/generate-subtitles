const path = require('path');
const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const FormData = require('form-data');
const multer = require("multer");
var router = express.Router();
const transcribe = require('../transcribe-api-wrapped')
const transcribeWrapped = require("../transcribe-wrapped");
const constants = require("../constants");
const filenamify = require("filenamify");
const createTranslatedFiles = require("../translate-files-api");
const { languagesToTranslateTo, newLanguagesMap, translationLanguages } = constants;

const makeFileNameSafe = function(string){
  return filenamify(string, {replacement: '_' })
    .replace(/[&\/\\#,+()$~%.'":*?<>{}!]/g, '')
    .replace(/\s+/g,"_")
    .split('：').join(':');
}

function getCodeFromLanguageName(languageName){
  return translationLanguages.find(function(filteredLanguage){
    return languageName === filteredLanguage.name;
  }).code
}


const storage = multer.diskStorage({ // notice  you are calling the multer.diskStorage() method here, not multer()
  destination: function(req, file, cb) {
    cb(null, './uploads/')
  },
});

var upload = multer({ storage });

// file
// {
//   fieldname: 'file',
//   originalname: 'dutch_language.mp3',
//   encoding: '7bit',
//   mimetype: 'audio/mpeg',
//   destination: './uploads/',
//   filename: '572fa0ecb660b1d0eb489b879c2e2310',
//   path: 'uploads/572fa0ecb660b1d0eb489b879c2e2310',
//   size: 22904865
// }

router.post('/api', upload.single('file'), async function (req, res, next) {
  try {
    const postBodyData = Object.assign({},req.body)
    const file = req.file;
    const { originalname: originalFileName, filename: uploadFileName } = file;

    l(file);
    l(postBodyData);

    const sixDigitNumber = Math.floor(100000 + Math.random() * 900000);

    const { model, language } = postBodyData;

    l(originalFileName);
    l(uploadFileName);
    l(model, language);

    // TODO: move this stuff to transcribe function
    // something.mp4
    let originalFileNameWithExtension = originalFileName;

    // .mp4 (includes leading period)
    const originalFileExtension = path.parse(originalFileNameWithExtension).ext;

    const originalFileNameWithoutExtension = path.parse(originalFileNameWithExtension).name;
    l('originalFileNameWithoutExtension')
    l(originalFileNameWithoutExtension)

    // something
    const directorySafeFileNameWithoutExtension = makeFileNameSafe(originalFileNameWithoutExtension)

    l('directorySafeFileNameWithoutExtension')
    l(directorySafeFileNameWithoutExtension)

    // todo: rename to transcribeAndTranslate
    const response = await transcribe({
      language,
      model,
      originalFileExtension,
      uploadFileName,
      originalFileName,
      sixDigitNumber // standin for claimId or something like that
    })

    // tell the clitent it's started
    if(response === 'started'){
      const port = req.socket.localPort;
      const thing = req.protocol + '://' + req.hostname  + ( port === 80 || port === 443 ? '' : ':'+port ) + req.path;

      // return res.redirect(`/api/${sixDigitNumber}`)
      res.send({
        status: 'started',
        sixDigitNumber,
        url: `${thing}/${sixDigitNumber}`,
      });
    }
  } catch (err){
    l('err')
    l(err);
    throw(err);
  }
});

/** UNFINISHED FUNCTIONALITY **/
// post file from backend
router.get('/api/:sixDigitNumber', async function(req, res, next){
  try {
    l(req.body);
    l(req.params);

    l('original url');
    l(req.originalUrl);
    l(req.protocol)
    l(req.hostname)
    l(req.port)

    const port = req.socket.localPort;
    const thing = req.protocol + '://' + req.hostname  + ( port === 80 || port === 443 ? '' : ':'+port ) + req.path;

    l('thing');
    l(thing);

    console.log(req.socket.localPort);
    console.log(req.socket.remotePort);



    // TODO:

    const sixDigitNumber = req.params.sixDigitNumber;

    const processingData = JSON.parse(await fs.readFile(`./transcriptions/${sixDigitNumber}/processing_data.json`, 'utf8'));

    const transcriptionStatus = processingData.status;

    // todo: should be a number
    const progress = processingData.progress;

    const { language, languageCode, translatedLanguages } = processingData;

    /** transcription successfully completed **/
    if(transcriptionStatus === 'processing'){
      // send current processing data
      return res.send({
        status: 'transcribing',
        sixDigitNumber, // todo: replace here
        progress,
        processingData
      })

    /** transcription successfully completed, attach VTT files **/
    } else if(transcriptionStatus === 'completed'){
      // TODO: get other files here
      let subtitles = [];

      // add original vtt
      const originalVtt = await fs.readFile(`./transcriptions/${sixDigitNumber}/${sixDigitNumber}.vtt`, 'utf8');
      subtitles.push({
        language,
        languageCode,
        webVtt: originalVtt
      })

      l('processing data');
      l(processingData);

      l('translated language');
      l(translatedLanguages);

      for(const translatedLanguage of translatedLanguages){
        const originalVtt = await fs.readFile(`./transcriptions/${sixDigitNumber}/${sixDigitNumber}_${translatedLanguage}.vtt`, 'utf8');
        subtitles.push({
          language: translatedLanguage,
          languageCode: getCodeFromLanguageName(translatedLanguage),
          webVtt: originalVtt
        })
      }

      return res.send({
        status: 'completed',
        sixDigitNumber,
        // vttFile: originalVtt,
        processingData,
        subtitles
      })
    }



    return res.send(processingData);

    // TODO: handle the case where processing data exists, progress if needed or other thing
    // const { progress, status, language, translatedLanguages } = processingData;

    // TODO: get translations


    // get vtt
    const file = await fs.readFile(`./transcriptions/${sixDigitNumber}/${sixDigitNumber}.vtt`, 'utf8');
    l('file');
    l(file);

    res.send(file);

    // res.send('ok');
  } catch (err){
    l('err');
    l(err);
  }
})





/** UNFINISHED FUNCTIONALITY **/
// post file from backend
router.post('/post', async function(req, res, next){
  try {
    l(req.body);
    l(req.params);

    const endpointToHit = 'http:localhost:3000'

    // Create a new form instance
    const form = new FormData();

    const file = await fs.readFile('./ljubav.srt');
    l('file');
    l(file);

    form.append('subtitles', file, 'subtitles');

    form.append('filename', 'ljubav.srt');


    l('form headers');
    l(form.getHeaders())

    const response = await axios.post(endpointToHit, form, {
      headers: {
        ...form.getHeaders(),
      },
      data: {
        foo: 'bar', // This is the body part
      }
    });

    // l('response');
    // l(response);

    // res.send('ok');
  } catch (err){
    l('err');
    l(err);
  }
})

module.exports = router;
