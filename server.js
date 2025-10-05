require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const connectDB = require('./config/db');
const cors = require('cors');
const path = require('path');

const resumesRouter = require('./routes/resumes');
const jobsRouter = require('./routes/jobs');
const app = express();

const allowedOrigins = ['https://resume-rag-frontend.vercel.app', 'http://localhost:5173'];
app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true); // allow non-browser requests like Postman
    if(allowedOrigins.indexOf(origin) !== -1){
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));



app.use(morgan('dev'));
app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({extended:true}));

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/resumerag';

connectDB(MONGO_URI);

app.use('/api/resumes', resumesRouter);
app.use('/api/jobs', jobsRouter);

// static uploads route
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

app.get('/', (req,res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
