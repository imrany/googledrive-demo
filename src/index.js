import express from "express"
import {readFileSync, writeFileSync, createReadStream} from "fs"
import { google } from "googleapis"
import * as dotenv from "dotenv"
import cors from 'cors'
dotenv.config()

const app=express()
app.use(cors({}))
const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
);

const drive = google.drive({
    version: 'v3',
    auth: oauth2Client
});

try {
    const creds=readFileSync('creds.json')
    oauth2Client.setCredentials(JSON.parse(creds))
} catch (error) {
    console.log('no creds',error)
}  

app.get('/auth/google',async(req,res)=>{
    try {
        const url=oauth2Client.generateAuthUrl({
            access_type:"offline",
            scope:['https://www.googleapis.com/auth/userinfo.profile','https://www.googleapis.com/auth/drive']
        })
        res.redirect(url)
    } catch (error) {
        res.status(500).send({error:error.message})
    }
})

app.get('/google/redirect',async(req,res)=>{
    try {
        const {code}=req.query
        const {tokens}= await oauth2Client.getToken(code)
        oauth2Client.setCredentials(tokens)
        writeFileSync('creds.json',JSON.stringify(tokens))
        res.send({msg:"success"})
    } catch (error) {
        res.status(500).send({error:error.message})
    }
})

//uploading a file to google drive e.g image/png
app.get("/save/image",async(req,res)=>{
    try {
        const response = await drive.files.create({
            requestBody: {
              name: 'testimage.png',
              mimeType: 'image/png'
            },
            media: {
              mimeType: 'image/png',
              body: createReadStream('awesome.png')
            }
        });
        res.send({msg:response.data})
    } catch (error) {
        res.status(500).send({error:error.message})
    }
})

//fetch all files
app.get('/files/:id',async(req,res)=>{
    const {id}=req.params
    const files = [];
    try {
        await drive.permissions.create({
            fileId:id,
            requestBody:{
                role:"reader",
                type:"anyone"
            }
        })
        drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' },
            function (err, response) {
                response.data
                    .on('end', () => {
                        console.log('Done');
                    })
                    .on('error', err => {
                        console.log('Error', err);
                    })
                    .pipe(res);
            }
        );
        // const response = await drive.files.get({
        //     fileId:id,
        //     alt:'media',
        //     // fields:'webViewLink, webContentLink'
        //     // q: 'mimeType=\'image/jpeg\'',
        //     // fields: 'nextPageToken, files(id, name)',
        //     // spaces: 'drive',
        // });
        // Array.prototype.push.apply(files, response.files);
        // response.data.files.forEach(function(file) {
        //     console.log('Found file:', file.name, file.id);
        // });
        // res.send(response.data);
        // console.log(response.data)
    } catch (error) {
        res.status(500).send({error:error.message})
    }
})

const port=process.env.PORT||8080
app.listen(port,()=>{
    console.log(`Server running on port ${port}`)
})